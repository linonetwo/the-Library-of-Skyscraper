#!/bin/bash
set -eu
cd "$(dirname "$0")"
export ARENA_SCRIPT_RUNNER="$PWD/bin/skyscraper-arena-script-runner"
export ARENA_SCRIPT_TOOLCHAIN="$PWD/arena/script-toolchain/cli.mjs"
export ARENA_DATA_DIR="$PWD/data"
export ARENA_PROXY_TARGET="${ARENA_PROXY_TARGET:-http://127.0.0.1:${ARENA_PORT:-8787}}"
setsid ./bin/skyscraper-arena-server >logs/authority.log 2>&1 &
authority_pid=$!
cleanup() {
  for pid in "$authority_pid" "$preview_pid"; do
    if kill -0 "$pid" 2>/dev/null; then kill "$pid"; fi
  done
  wait
}
trap cleanup EXIT
trap 'exit 0' INT TERM
setsid node arena/client/node_modules/vite/bin/vite.js preview --config arena/client/vite.config.ts --outDir "$PWD/arena/client/dist" --host 0.0.0.0 --port "${ARENA_WEB_PORT:-5173}" --strictPort &
preview_pid=$!
wait "$preview_pid"
