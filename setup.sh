#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/setup.log"
ROUTER_LOG_FILE="$LOG_DIR/router.log"
ROUTER_PID_FILE="$LOG_DIR/router.pid"
BIN_DIR="$ROOT/bin"
ROUTER_BINARY_DEFAULT="$BIN_DIR/proxy-router"
ENV_FILE="$ROOT/.env"
ENV_TEMPLATE_URL="https://raw.githubusercontent.com/Lumerin-protocol/proxy-router/v1.8.0/.env.min.example"
MORPHEUS_ROUTER_TAG="${MORPHEUS_ROUTER_TAG:-v5.7.0}"
GO_VERSION="${GO_VERSION:-1.22.7}"
IPFS_VERSION="${IPFS_VERSION:-v0.32.0}"
IPFS_PID_FILE="$LOG_DIR/ipfs.pid"
IPFS_LOG_FILE="$LOG_DIR/ipfs.log"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

log "Starting Nebuchadnezzar setup"
log "Working directory: $ROOT"

if [ ! -f "$ROOT/.env.local" ] && [ -f "$ROOT/.env.local.example" ]; then
  cp "$ROOT/.env.local.example" "$ROOT/.env.local"
  log "Created .env.local from .env.local.example"
fi

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    log "Node present: $(node -v)"
    return
  fi

  log "Node not found; attempting install via nvm (best effort)."
  if ! command -v curl >/dev/null 2>&1; then
    log "curl is missing; install curl to allow automated Node setup."
    return
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -d "$NVM_DIR" ]; then
    log "Installing nvm to $NVM_DIR"
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >>"$LOG_FILE" 2>&1 || true
  fi

  # shellcheck source=/dev/null
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi

  if command -v nvm >/dev/null 2>&1; then
    nvm install --lts >>"$LOG_FILE" 2>&1 || true
    nvm use --lts >>"$LOG_FILE" 2>&1 || true
    log "nvm ready; Node version: $(node -v 2>/dev/null || echo 'not available')"
  else
    log "nvm unavailable; install Node manually to continue."
  fi
}

ensure_node

ensure_go() {
  if command -v go >/dev/null 2>&1; then
    log "Go present: $(go version)"
    return 0
  fi

  local go_dir="$ROOT/.cache/go"
  local go_tar="$ROOT/.cache/go.tar.gz"
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) arch="" ;;
  esac

  if [ -z "$arch" ]; then
    log "Unsupported arch for Go install: $(uname -m)"
    return 1
  fi

  local go_url="https://go.dev/dl/go${GO_VERSION}.${os}-${arch}.tar.gz"
  log "Installing Go ${GO_VERSION} locally to $go_dir"
  mkdir -p "$ROOT/.cache"
  if curl -fSL "$go_url" -o "$go_tar" >>"$LOG_FILE" 2>&1; then
    rm -rf "$go_dir"
    mkdir -p "$ROOT/.cache"
    tar -C "$ROOT/.cache" -xzf "$go_tar" >>"$LOG_FILE" 2>&1 || true
    if [ -d "$ROOT/.cache/go/bin" ]; then
      export PATH="$ROOT/.cache/go/bin:$PATH"
      log "Go installed locally: $("$ROOT/.cache/go/bin/go" version 2>>"$LOG_FILE" || true)"
      return 0
    fi
  else
    log "Failed to download Go from $go_url"
  fi
  return 1
}

ensure_go

ensure_ipfs() {
  if command -v ipfs >/dev/null 2>&1; then
    log "IPFS present: $(ipfs version || true)"
    echo "$(command -v ipfs)"
    return 0
  fi

  local os arch url tarball target ipfs_bin
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) arch="" ;;
  esac
  case "$os" in
    linux|darwin) ;;
    *) os="" ;;
  esac
  if [ -z "$os" ] || [ -z "$arch" ]; then
    log "Unsupported platform for automatic IPFS install (os=${os} arch=${arch})."
    return 1
  fi

  url="https://dist.ipfs.tech/kubo/${IPFS_VERSION}/kubo_${IPFS_VERSION#v}_${os}-${arch}.tar.gz"
  tarball="$ROOT/.cache/kubo.tar.gz"
  target="$ROOT/.cache/kubo"
  mkdir -p "$ROOT/.cache"
  log "Downloading IPFS ${IPFS_VERSION} from ${url}"
  if ! curl -fSL "$url" -o "$tarball" >>"$LOG_FILE" 2>&1; then
    log "Failed to download IPFS; install ipfs manually."
    return 1
  fi
  rm -rf "$target"
  mkdir -p "$target"
  if ! tar -C "$target" -xzf "$tarball" >>"$LOG_FILE" 2>&1; then
    log "Failed to extract IPFS archive."
    return 1
  fi
  ipfs_bin="$(find "$target" -type f -name ipfs | head -n1)"
  if [ -z "$ipfs_bin" ]; then
    log "IPFS binary not found after extraction."
    return 1
  fi
  mkdir -p "$BIN_DIR"
  cp "$ipfs_bin" "$BIN_DIR/ipfs"
  chmod +x "$BIN_DIR/ipfs"
  log "Installed IPFS to $BIN_DIR/ipfs"
  echo "$BIN_DIR/ipfs"
  return 0
}

ensure_ipfs_repo() {
  local ipfs_bin="$1"
  local repo_dir="$ROOT/data/ipfs"
  mkdir -p "$repo_dir"
  if [ ! -d "$repo_dir/config" ] && [ ! -f "$repo_dir/config" ]; then
    log "Initializing IPFS repo at $repo_dir"
    if ! "$ipfs_bin" --repo-dir "$repo_dir" init >>"$LOG_FILE" 2>&1; then
      log "IPFS repo init failed; check $LOG_FILE."
      return 1
    fi
  fi
  echo "$repo_dir"
}

start_ipfs_daemon() {
  local ipfs_bin="$1"
  local repo_dir="$2"

  if [ -f "$IPFS_PID_FILE" ]; then
    local pid
    pid="$(cat "$IPFS_PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
      log "IPFS daemon already running (pid $pid)."
      return 0
    fi
  fi

  log "Starting IPFS daemon (repo: $repo_dir)..."
  : > "$IPFS_LOG_FILE"
  (IPFS_PATH="$repo_dir" "$ipfs_bin" daemon --enable-gc >>"$IPFS_LOG_FILE" 2>&1 & echo $!) >"$IPFS_PID_FILE"
  sleep 2
  local pid
  pid="$(cat "$IPFS_PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
    log "IPFS daemon started (pid $pid). Logs: $IPFS_LOG_FILE"
    return 0
  fi

  log "IPFS daemon failed to start; see $IPFS_LOG_FILE."
  return 1
}

if ! command -v npm >/dev/null 2>&1; then
  log "npm not found; ensure Node/npm is installed."
else
  if [ ! -d "$ROOT/node_modules" ]; then
    log "Installing npm dependencies..."
    (cd "$ROOT" && npm install) >>"$LOG_FILE" 2>&1 || log "npm install encountered issues (see log)."
  else
    log "Dependencies already installed."
  fi

  log "Running npm run lint (sanity check)..."
  if (cd "$ROOT" && npm run lint) >>"$LOG_FILE" 2>&1; then
    log "Lint check passed."
  else
    log "Lint check failed; review $LOG_FILE."
  fi
fi

BASE_URL="${NEXT_PUBLIC_MOR_PROXY_API_BASE:-}"
if [ -z "$BASE_URL" ] && [ -f "$ROOT/.env.local" ]; then
  BASE_URL="$(grep -E '^NEXT_PUBLIC_MOR_PROXY_API_BASE=' "$ROOT/.env.local" | tail -n1 | cut -d'=' -f2- || true)"
fi
BASE_URL="${BASE_URL:-http://localhost:8082}"
HEALTH_URL="${BASE_URL%/}/healthcheck"
PORT_FROM_URL="$(echo "$BASE_URL" | sed -n 's~.*://[^:/]*:\\([0-9]*\\).*~\\1~p')"
ROUTER_PORT="${PORT_FROM_URL:-8082}"

ensure_env_file() {
  set_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
      sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
      rm -f "${ENV_FILE}.bak"
    else
      echo "${key}=${value}" >>"$ENV_FILE"
    fi
  }

  if [ -f "$ENV_FILE" ]; then
    log "Found existing .env; validating placeholders."
  else
    log "No .env found; creating from upstream template."
    if command -v curl >/dev/null 2>&1; then
      if curl -fSL "$ENV_TEMPLATE_URL" -o "$ENV_FILE" >>"$LOG_FILE" 2>&1; then
        log "Downloaded .env template from $ENV_TEMPLATE_URL"
      else
        log "Failed to download template; writing minimal placeholders."
      fi
    fi

    if [ ! -f "$ENV_FILE" ]; then
      cat >"$ENV_FILE" <<'EOF'
# Generated by setup.sh — fill these values before starting the router.
WALLET_PRIVATE_KEY=REPLACE_WITH_PRIVATE_KEY
ETH_NODE_ADDRESS=wss://arb-mainnet.g.alchemy.com/v2/REPLACE_WITH_KEY
CLONE_FACTORY_ADDRESS=0x998135c509b64083cd27ed976c1bcda35ab7a40b
VALIDATOR_REGISTRY_ADDRESS=0xbEB5b2df7B554Fb175e97Eb21eE1e8D7fF2f56B1
POOL_ADDRESS=//account.worker:@mine.pool.com:port
WEB_ADDRESS=0.0.0.0:8080
WEB_PUBLIC_URL=http://localhost:8080
EOF
      log "Wrote minimal .env with placeholders."
    fi
  fi

  if command -v python3 >/dev/null 2>&1; then
    local pk
    pk="$(python3 - <<'PY'
import secrets
print("0x" + secrets.token_hex(32))
PY
)"
    if grep -q "WALLET_PRIVATE_KEY=<your-private-key>" "$ENV_FILE" || grep -q "WALLET_PRIVATE_KEY=REPLACE" "$ENV_FILE"; then
      sed -i.bak "s|WALLET_PRIVATE_KEY=.*|WALLET_PRIVATE_KEY=${pk}|" "$ENV_FILE"
      rm -f "${ENV_FILE}.bak"
      log "Inserted generated WALLET_PRIVATE_KEY into .env (update if you prefer another key)."
    fi
  else
    log "python3 not available; left WALLET_PRIVATE_KEY placeholder in .env."
  fi

  sed -i.bak "s|^ETH_NODE_ADDRESS=.*|ETH_NODE_ADDRESS=wss://arb-mainnet.g.alchemy.com/v2/demo|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  log "Set ETH_NODE_ADDRESS to Alchemy Arbitrum mainnet demo endpoint (replace with your real node URL)."

  sed -i.bak "s|^VALIDATOR_REGISTRY_ADDRESS=.*|VALIDATOR_REGISTRY_ADDRESS=0xbEB5b2df7B554Fb175e97Eb21eE1e8D7fF2f56B1|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  log "Set VALIDATOR_REGISTRY_ADDRESS to Arbitrum mainnet default."

  sed -i.bak "s|^POOL_ADDRESS=.*|POOL_ADDRESS=//user.worker:@localhost:3333|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  log "Set POOL_ADDRESS to a localhost placeholder; update to your mining pool."

  sed -i.bak "s|^WEB_ADDRESS=.*|WEB_ADDRESS=0.0.0.0:8082|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  log "Set WEB_ADDRESS to 0.0.0.0:8082 to match dashboard default."

  sed -i.bak "s|^WEB_PUBLIC_URL=.*|WEB_PUBLIC_URL=http://localhost:8082|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  log "Set WEB_PUBLIC_URL to http://localhost:8082."

  set_var "DIAMOND_CONTRACT_ADDRESS" "0xDE819AaEE474626E3f34Ef0263373357e5a6C71b"
  set_var "MOR_TOKEN_ADDRESS" "0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86"
  set_var "BLOCKSCOUT_API_URL" "\"https://arbitrum.blockscout.com/api/v2\""
  set_var "ETH_NODE_CHAIN_ID" "42161"
  set_var "ENVIRONMENT" "production"
  set_var "PROXY_ADDRESS" "0.0.0.0:3333"
  set_var "WEB_ADDRESS" "0.0.0.0:8082"
  set_var "WEB_PUBLIC_URL" "http://localhost:8082"
}

ensure_router_binary() {
  local found=""

  if [ -n "${ROUTER_CMD:-}" ]; then
    if command -v "$ROUTER_CMD" >/dev/null 2>&1; then
      found="$ROUTER_CMD"
    elif [ -x "$ROUTER_CMD" ]; then
      found="$ROUTER_CMD"
    else
      log "ROUTER_CMD provided but not executable: $ROUTER_CMD"
    fi
  fi

  if [ -z "$found" ]; then
    for candidate in morpheus-router proxy-router lumerin-proxy-router "$ROUTER_BINARY_DEFAULT"; do
      if command -v "$candidate" >/dev/null 2>&1; then
        found="$(command -v "$candidate")"
        break
      elif [ -x "$candidate" ]; then
        found="$candidate"
        break
      fi
    done
  fi

  if [ -n "$found" ]; then
    echo "$found"
    return 0
  fi

  mkdir -p "$BIN_DIR"

  if [ -n "${ROUTER_DOWNLOAD_URL:-}" ]; then
    log "Downloading router from ROUTER_DOWNLOAD_URL to $ROUTER_BINARY_DEFAULT"
    if command -v curl >/dev/null 2>&1; then
      if curl -fSL "${ROUTER_DOWNLOAD_URL}" -o "$ROUTER_BINARY_DEFAULT" >>"$LOG_FILE" 2>&1; then
        chmod +x "$ROUTER_BINARY_DEFAULT" || true
        if [ -x "$ROUTER_BINARY_DEFAULT" ]; then
          log "Router downloaded to $ROUTER_BINARY_DEFAULT"
          echo "$ROUTER_BINARY_DEFAULT"
          return 0
        fi
      else
        log "Failed to download router from ${ROUTER_DOWNLOAD_URL}"
      fi
    else
      log "curl not available; cannot download router."
    fi
  fi

  # Try Morpheus router release with /blockchain APIs when a platform asset exists.
  if command -v curl >/dev/null 2>&1; then
    local os arch asset url
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"
    case "$os" in
      linux) os="linux" ;;
      darwin) os="mac" ;;
      *) os="" ;;
    esac
    case "$arch" in
      x86_64|amd64) arch="x86_64" ;;
      arm64|aarch64)
        if [ "$os" = "mac" ]; then
          arch="arm64"
        else
          arch=""
        fi
        ;;
      *) arch="" ;;
    esac

    if [ -n "$os" ] && [ -n "$arch" ]; then
      asset="${os}-${arch}-morpheus-router-${MORPHEUS_ROUTER_TAG#v}"
      url="https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases/download/${MORPHEUS_ROUTER_TAG}/${asset}"
      log "Attempting Morpheus router download: $url"
      if curl -fSL "$url" -o "$ROUTER_BINARY_DEFAULT" >>"$LOG_FILE" 2>&1; then
        chmod +x "$ROUTER_BINARY_DEFAULT" || true
        if [ -x "$ROUTER_BINARY_DEFAULT" ]; then
          log "Morpheus router downloaded to $ROUTER_BINARY_DEFAULT"
          echo "$ROUTER_BINARY_DEFAULT"
          return 0
        fi
      else
        log "Morpheus router download failed or unsupported for this platform (os=${os} arch=${arch})."
      fi
    else
      log "Morpheus router asset not available for this platform (os=${os} arch=${arch})."
    fi
  fi

  # Build Morpheus router from source if Go is available
  if command -v go >/dev/null 2>&1; then
    local src_dir="$ROOT/.cache/morpheus-router-src"
    mkdir -p "$ROOT/.cache"
    if [ -d "$src_dir/.git" ]; then
      log "Updating Morpheus router source in $src_dir"
      (cd "$src_dir" && git fetch --tags >>"$LOG_FILE" 2>&1 && git checkout "$MORPHEUS_ROUTER_TAG" >>"$LOG_FILE" 2>&1 || git checkout main >>"$LOG_FILE" 2>&1)
    else
      log "Cloning Morpheus router source to $src_dir"
      if ! git clone --depth 1 --branch "$MORPHEUS_ROUTER_TAG" https://github.com/MorpheusAIs/Morpheus-Lumerin-Node.git "$src_dir" >>"$LOG_FILE" 2>&1; then
        git clone --depth 1 https://github.com/MorpheusAIs/Morpheus-Lumerin-Node.git "$src_dir" >>"$LOG_FILE" 2>&1 || true
      fi
    fi

    if [ -d "$src_dir/proxy-router" ]; then
      log "Building Morpheus router from source..."
      if (cd "$src_dir/proxy-router" && go build -o "$ROUTER_BINARY_DEFAULT" ./cmd >>"$LOG_FILE" 2>&1); then
        chmod +x "$ROUTER_BINARY_DEFAULT" || true
        if [ -x "$ROUTER_BINARY_DEFAULT" ]; then
          log "Built Morpheus router to $ROUTER_BINARY_DEFAULT"
          echo "$ROUTER_BINARY_DEFAULT"
          return 0
        fi
      else
        log "Go build failed; see $LOG_FILE for details."
      fi
    else
      log "Morpheus router source missing proxy-router directory; build skipped."
    fi
  else
    log "Go toolchain not available; cannot build router from source."
  fi

  if command -v curl >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    local os arch target api_url asset_url
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"
    case "$arch" in
      x86_64|amd64) arch="amd64" ;;
      aarch64|arm64) arch="arm64" ;;
      *) arch="" ;;
    esac
    case "$os" in
      linux|darwin) ;;
      *) os="" ;;
    esac
    if [ -n "$os" ] && [ -n "$arch" ]; then
      target="${os}-${arch}"
      api_url="https://api.github.com/repos/Lumerin-protocol/proxy-router/releases/latest"
      log "Fetching latest proxy-router release for ${target}"
      asset_url="$(curl -fsSL "$api_url" | node -e "const data = JSON.parse(require('fs').readFileSync(0,'utf8')); const target='${target}'; const asset=(data.assets||[]).find(a=>a.name && a.name.includes(target)); if(asset) console.log(asset.browser_download_url);")"
      if [ -n "$asset_url" ]; then
        log "Downloading router binary from $asset_url"
        if curl -fSL "$asset_url" -o "$ROUTER_BINARY_DEFAULT" >>"$LOG_FILE" 2>&1; then
          chmod +x "$ROUTER_BINARY_DEFAULT" || true
          if [ -x "$ROUTER_BINARY_DEFAULT" ]; then
            log "Router downloaded to $ROUTER_BINARY_DEFAULT"
            echo "$ROUTER_BINARY_DEFAULT"
            return 0
          fi
        else
          log "Failed to download router from $asset_url"
        fi
      else
        log "No matching asset found for ${target}."
      fi
    else
      log "Unsupported platform for automatic download (os=${os} arch=${arch})."
    fi
  fi

  if [ -n "${ROUTER_INSTALL_SCRIPT:-}" ]; then
    log "Running ROUTER_INSTALL_SCRIPT..."
    if bash -c "$ROUTER_INSTALL_SCRIPT" >>"$LOG_FILE" 2>&1; then
      if [ -x "$ROUTER_BINARY_DEFAULT" ]; then
        echo "$ROUTER_BINARY_DEFAULT"
        return 0
      fi
    else
      log "ROUTER_INSTALL_SCRIPT failed."
    fi
  fi

  echo ""
  return 1
}

start_router() {
  local router_bin
  router_bin="$(ensure_router_binary | tail -n1)"

  if [ -z "$router_bin" ]; then
    log "No router binary found. Provide ROUTER_DOWNLOAD_URL or ROUTER_CMD to install/start the proxy router."
    return 1
  fi

  if [ ! -f "$ENV_FILE" ]; then
    log "Cannot start router: $ENV_FILE is missing."
    return 1
  fi

  if grep -q "REPLACE_WITH" "$ENV_FILE" || grep -q "<your-private-key>" "$ENV_FILE"; then
    log "Cannot start router: update $ENV_FILE with real WALLET_PRIVATE_KEY, ETH_NODE_ADDRESS, and POOL_ADDRESS."
    return 1
  fi

  log "Starting proxy router via '$router_bin' (logging to $ROUTER_LOG_FILE)..."
  : > "$ROUTER_LOG_FILE"
  "$router_bin" >>"$ROUTER_LOG_FILE" 2>&1 &
  echo $! > "$ROUTER_PID_FILE"
  sleep 2
  if ps -p "$(cat "$ROUTER_PID_FILE")" >/dev/null 2>&1; then
    log "Router started with pid $(cat "$ROUTER_PID_FILE")."
    return 0
  fi

  log "Router failed to start with '$router_bin' (see $ROUTER_LOG_FILE)."
  return 1
}

ipfs_bin="$(ensure_ipfs | tail -n1 || true)"
if [ -n "$ipfs_bin" ] && [ -x "$ipfs_bin" ]; then
  repo_dir="$(ensure_ipfs_repo "$ipfs_bin" || true)"
  if [ -n "$repo_dir" ]; then
    start_ipfs_daemon "$ipfs_bin" "$repo_dir" || true
  fi
else
  log "IPFS binary unavailable; IPFS-dependent actions may fail."
fi

if command -v curl >/dev/null 2>&1; then
  log "Checking router health at $HEALTH_URL"
  if curl -fsS "$HEALTH_URL" >>"$LOG_FILE" 2>&1; then
    log "Router healthcheck responded successfully."
  else
    log "Router healthcheck failed; attempting to start the proxy router locally."
    ensure_env_file
    start_router || true
    log "Re-checking router health at $HEALTH_URL after start attempt"
    if curl -fsS "$HEALTH_URL" >>"$LOG_FILE" 2>&1; then
      log "Router responded successfully after start attempt."
    else
      log "Healthcheck still failing; install/start the real router and rerun setup."
    fi
  fi
else
  log "curl unavailable; skipping router healthcheck."
fi

log "Setup complete. See $LOG_FILE for details."
