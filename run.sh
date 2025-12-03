#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ ! -f ".env.local" ] && [ -f ".env.local.example" ]; then
  cp ".env.local.example" ".env.local"
  echo "Created .env.local from .env.local.example"
fi

mkdir -p logs
LOG_FILE="logs/nebuchadnezzar.log"
: > "$LOG_FILE"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

HOST="${HOST:-localhost}"
PORT="${PORT:-4343}"

echo "Starting dev server on ${HOST}:${PORT}"
NODE_ENV=development npm run dev -- --hostname "$HOST" --port "$PORT" 2>&1 | tee -a "$LOG_FILE"
