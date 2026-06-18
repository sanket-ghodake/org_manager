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
if command -v docker &>/dev/null && docker ps &>/dev/null; then
    echo "Docker daemon detected. Spawning local PostgreSQL container..."
    if [ -f "config/envs/portable.development.env" ]; then
        set -a
        source "config/envs/portable.development.env"
        set +a
    fi
    docker compose -f docker/development/docker-compose.yaml up -d db
    echo "Waiting for database to be ready..."
    until docker exec sgforge-db-sanket pg_isready -U lifeos -d org_db &>/dev/null; do
      sleep 1
    done
    bun core/src/database/initialize-local-db.ts
else
    echo "⚠️ Docker daemon is not active or not installed. Skipping local database initialization."
    echo "Note: The database container will be spawned and initialized when you run './run.sh portable dev'."
fi

echo "=== System Environment Successfully Configured ==="
