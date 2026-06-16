#!/usr/bin/env bash
# Move to workspace root
cd "$(dirname "$0")/../../.."

set -e

echo "=== Initializing Local Portable Development Environment ==="
mkdir -p portables

OS_TYPE="$(uname -s)"

# Download Portable Bun Runtime based on OS Architecture
if [ "$OS_TYPE" = "Darwin" ] || [ "$OS_TYPE" = "Linux" ]; then
    echo "Downloading Bun..."
    curl -fsSL https://bun.sh/install | BUN_INSTALL=$(pwd)/portables/bun bash
fi

# Export temporary environment pathing for localized installation tasks
export PATH="$(pwd)/portables/bun/bin:$PATH"

echo "Installing project dependencies locally..."
bun install

echo "Preparing local database architecture..."
bun core/src/database/initialize-local-db.ts

echo "=== System Environment Successfully Configured ==="
