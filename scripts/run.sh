#!/bin/bash
# Move to the project root directory regardless of where the script is executed
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

export PATH="$(pwd)/portables/bun/bin:$(pwd)/portables/postgres/bin:$PATH"


# Trap exit signals to clean up background processes
trap "kill 0" EXIT

echo "Booting up Developer Dashboard on port 3002..."
bun run src/backend/dev-dashboard/server.ts &

echo "Booting up Reference Expenses App on port 8085..."
bun run src/apps/reference-expenses/server.ts &

echo "Booting up Reference Python App on port 8087..."
python3 src/apps/reference-python/server.py &

if command -v go &> /dev/null; then
  echo "Booting up Reference Go App on port 8086..."
  (cd src/apps/reference-go && go run main.go) &
else
  echo "[Notice] Go is not installed on system; skipping Go reference app auto-run. Code is stored under src/apps/reference-go."
fi

echo "Booting up Developer Console Proxy on port 3003..."
bun run scripts/developer-proxy.ts &

echo "Booting up Local Development Portal Stack..."
bun run --cwd src/frontend dev -- --hostname 0.0.0.0 --port 3001


