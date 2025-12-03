#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/tunnel.log"
PID_FILE="$LOG_DIR/tunnel.pid"
CONFIG_DIR="${CLOUDFLARE_CONFIG_DIR:-$HOME/.cloudflared}"
TUNNEL_NAME="${CF_TUNNEL_NAME:-mor-router}"
ROUTER_HOST="${CF_ROUTER_HOST:-}"
API_HOST="${CF_API_HOST:-}"
ROUTER_SERVICE="${CF_ROUTER_SERVICE:-http://localhost:3333}"
API_SERVICE="${CF_API_SERVICE:-http://localhost:8082}"
CONFIG_FILE="$CONFIG_DIR/${TUNNEL_NAME}.yml"

mkdir -p "$LOG_DIR"
: >"$LOG_FILE"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

ensure_pkg_debian() {
  local pkg="$1"
  if command -v apt-get >/dev/null 2>&1; then
    log "Installing $pkg via apt-get..."
    sudo apt-get update >>"$LOG_FILE" 2>&1 || true
    sudo apt-get install -y "$pkg" >>"$LOG_FILE" 2>&1 || true
  fi
}

ensure_jq() {
  if command -v jq >/dev/null 2>&1; then
    return
  fi
  ensure_pkg_debian jq
  if ! command -v jq >/dev/null 2>&1; then
    log "Missing dependency: jq. Install it and re-run."
    exit 1
  fi
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return
  fi
  if command -v apt-get >/dev/null 2>&1; then
    log "Installing cloudflared via apt..."
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
    sudo apt-get update >>"$LOG_FILE" 2>&1 || true
    sudo apt-get install -y cloudflared >>"$LOG_FILE" 2>&1 || true
  fi
  if ! command -v cloudflared >/dev/null 2>&1; then
    log "Missing dependency: cloudflared. Install it and re-run."
    exit 1
  fi
}

ensure_jq
ensure_cloudflared

if [ -z "$ROUTER_HOST" ]; then
  echo "This hostname will expose your proxy-router port 3333 through Cloudflare (HTTPS → localhost:3333)."
  read -rp "Router hostname (e.g., router.example.com): " ROUTER_HOST
fi

if [ -z "$API_HOST" ]; then
  echo "Optional: a hostname for the API/Swagger (port 8082). Leave blank to skip exposing 8082."
  read -rp "API hostname (optional, e.g., api.example.com): " API_HOST
fi

read -rp "Tunnel name [${TUNNEL_NAME}]: " input_name
if [ -n "$input_name" ]; then
  TUNNEL_NAME="$input_name"
fi

if [ ! -f "$CONFIG_DIR/cert.pem" ]; then
  log "Cloudflare tunnel cert not found at $CONFIG_DIR/cert.pem."
  read -rp "Run cloudflared tunnel login now? [y/N]: " do_login
  if [[ "$do_login" =~ ^[Yy]$ ]]; then
    cloudflared tunnel login
  else
    log "Aborting. Run cloudflared tunnel login then re-run this script."
    exit 1
  fi
fi

log "Using tunnel name: $TUNNEL_NAME"
log "Steps for first-time Cloudflare users:"
log "1) Create a Cloudflare account and add your domain. Point nameservers to Cloudflare."
log "2) Run 'cloudflared tunnel login' (this script will prompt you if cert is missing)."
log "3) When prompted here, enter the router hostname (e.g., router.example.com) and optional API hostname."
log "4) Script will create the tunnel, DNS, config, and start it; logs: logs/tunnel.log, pid: logs/tunnel.pid."

tunnel_uuid="$(
  cloudflared tunnel list --output json 2>>"$LOG_FILE" || true |
    jq -r --arg NAME "$TUNNEL_NAME" '(. // []) | .[] | select(.name==$NAME) | .id' | head -n1
)"

if [ -z "$tunnel_uuid" ]; then
  log "Creating tunnel $TUNNEL_NAME ..."
  cloudflared tunnel create "$TUNNEL_NAME" >>"$LOG_FILE" 2>&1
  tunnel_uuid="$(
    cloudflared tunnel list --output json 2>>"$LOG_FILE" || true |
      jq -r --arg NAME "$TUNNEL_NAME" '(. // []) | .[] | select(.name==$NAME) | .id' | head -n1
  )"
fi

if [ -z "$tunnel_uuid" ]; then
  log "Failed to create or find tunnel $TUNNEL_NAME."
  exit 1
fi

cred_file="$CONFIG_DIR/${tunnel_uuid}.json"
if [ ! -f "$cred_file" ]; then
  log "Credentials file missing: $cred_file"
  exit 1
fi

log "Writing tunnel config to $CONFIG_FILE"
{
  echo "tunnel: $tunnel_uuid"
  echo "credentials-file: $cred_file"
  echo "ingress:"
  echo "  - hostname: $ROUTER_HOST"
  echo "    service: $ROUTER_SERVICE"
  if [ -n "$API_HOST" ]; then
    echo "  - hostname: $API_HOST"
    echo "    service: $API_SERVICE"
  fi
  echo "  - service: http_status:404"
} >"$CONFIG_FILE"

log "Creating DNS route for $ROUTER_HOST"
cloudflared tunnel route dns "$TUNNEL_NAME" "$ROUTER_HOST" >>"$LOG_FILE" 2>&1

if [ -n "$API_HOST" ]; then
  log "Creating DNS route for $API_HOST"
  cloudflared tunnel route dns "$TUNNEL_NAME" "$API_HOST" >>"$LOG_FILE" 2>&1
fi

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
    log "Stopping existing tunnel process (pid $pid)"
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
  fi
fi

log "Starting tunnel..."
(
  cloudflared tunnel run "$TUNNEL_NAME" --config "$CONFIG_FILE" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
) || true

sleep 2
pid="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
  log "Tunnel running (pid $pid). Logs: $LOG_FILE"
else
  log "Tunnel failed to start. Check $LOG_FILE."
  exit 1
fi
