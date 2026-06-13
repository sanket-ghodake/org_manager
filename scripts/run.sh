#!/bin/bash
# Move to the project root directory regardless of where the script is executed
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

export PATH="$(pwd)/portables/bun/bin:$(pwd)/portables/postgres/bin:$PATH"


# Trap exit signals to clean up background processes
trap "kill 0" EXIT

echo "Booting up Developer Dashboard on port 3002..."
bun run src/backend/dev-dashboard/server.ts &

echo "Booting up Local Development Portal Stack..."
bun run --cwd src/frontend dev -- --hostname 0.0.0.0 --port 3001

