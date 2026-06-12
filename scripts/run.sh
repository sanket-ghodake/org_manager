#!/bin/bash
export PATH="$(pwd)/portables/bun/bin:$(pwd)/portables/postgres/bin:$PATH"
echo "Booting up Local Development Portal Stack..."
bun run --cwd src/frontend dev
