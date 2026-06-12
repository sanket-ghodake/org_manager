#!/bin/bash
export PATH="$(pwd)/portables/bun/bin:$(pwd)/portables/postgres/bin:$PATH"
echo "Booting up Local Development Portal Stack..."
bun --cwd src/frontend run dev
