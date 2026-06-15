#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until pg_isready -h db -U lifeos -d org_db; do
  sleep 1
done
echo "Database is ready!"

echo "Initializing database schema and seeding data..."
bun run src/database/initialize-local-db.ts

echo "Starting SG Forge Portal Services..."

# 1. Start Dev-Dashboard (port 3002)
bun run src/backend/dev-dashboard/server.ts &

# 2. Start Reference Expenses App (port 8085)
bun run src/apps/reference-expenses/server.ts &

# 3. Start Reference Python App (port 8087)
python3 src/apps/reference-python/server.py &

# 4. Start Reference Go App (port 8086)
cd src/apps/reference-go
go run main.go &
cd /app

# 5. Start Next.js Frontend Portal in production mode (port 3001)
bun run --cwd src/frontend start -p 3001
