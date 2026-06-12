#!/bin/bash
set -e

echo "=== Initializing Local Portable Development Environment ==="
mkdir -p portables

OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"

# Download Portable Bun Runtime based on OS Architecture
if [ "$OS_TYPE" = "Darwin" ]; then
    echo "Downloading Bun for macOS..."
    curl -fsSL https://bun.sh/install | BUN_INSTALL=$(pwd)/portables/bun bash -s -- "bun-v1.2.0"
elif [ "$OS_TYPE" = "Linux" ]; then
    echo "Downloading Bun for Linux..."
    curl -fsSL https://bun.sh/install | BUN_INSTALL=$(pwd)/portables/bun bash -s -- "bun-v1.2.0"
fi

# Export temporary environment pathing for localized installation tasks
export PATH="$(pwd)/portables/bun/bin:$PATH"

echo "Installing project dependencies locally..."
bun install

echo "Preparing local database architecture..."
bun run src/database/initialize-local-db.ts

echo "=== System Environment Successfully Configured ==="
