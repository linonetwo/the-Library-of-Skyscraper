#!/bin/bash
set -eu
cd "$(dirname "$0")"
export ARENA_SCRIPT_RUNNER="$PWD/bin/skyscraper-arena-script-runner"
export ARENA_SCRIPT_TOOLCHAIN="$PWD/arena/script-toolchain/cli.mjs"
export ARENA_DATA_DIR="$PWD/data"
./bin/skyscraper-arena-server >logs/authority.log 2>&1 &
authority_pid=$!
trap 'kill "$authority_pid"' EXIT
trap 'exit 0' INT TERM
node arena/client/node_modules/vite/bin/vite.js preview --config arena/client/vite.config.ts --outDir "$PWD/arena/client/dist" --host 127.0.0.1 --port 5173 --strictPort
