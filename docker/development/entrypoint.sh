#!/bin/bash
set -e

# Change directory to the app root
cd /app

echo "Checking node_modules..."
if [ ! -d "node_modules/drizzle-orm" ] || [ ! -d "core/src/frontend/node_modules/next" ]; then
  echo "Dependencies not found or incomplete. Installing packages..."
  bun install
  cd core/src/frontend && bun install
  cd /app
fi

echo "Waiting for database to be ready..."
until pg_isready -h db -U lifeos -d org_db; do
  sleep 1
done
echo "Database is ready!"

echo "Initializing database schema and seeding data..."
bun run core/src/database/initialize-local-db.ts

echo "Syncing app manifests to database..."
bun -e "import { parseAndRegisterManifests } from './core/src/backend/utils/manifestParser'; await parseAndRegisterManifests(); process.exit(0);"

echo "Bundling Forge SDK..."
bun build --target=browser --format=iife --outfile=core/src/frontend/public/sdk/forge-sdk.js packages/sdk/forge-sdk.ts

echo "Starting SG Forge Portal Services in Development (Hot-Reloading)..."

# 1. Start Dev-Dashboard (port 3002)
bun --watch core/src/backend/dev-dashboard/server.ts &

# 2. Start Dynamic Sandbox App Runner
bun scripts/dynamic-app-runner.ts &

# 3. Start Next.js Developer Portal Proxy (port 3003)
bun run scripts/developer-proxy.ts &

# 4. Start Health Check background worker (persistent daemon)
bun core/src/backend/workers/healthCheck.ts --daemon >/dev/null 2>&1 &

# 6. Start Next.js Frontend Portal (port 3001) in development mode
bun run --cwd core/src/frontend dev -- --hostname 0.0.0.0 --port 3001
