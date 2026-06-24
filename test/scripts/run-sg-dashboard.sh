#!/bin/bash
# Script to run sg-dashboard container stack independently

# Always evaluate from the monorepo root context
cd "$(dirname "$0")/../.."

# Ensure target network exists before spawning compose
if ! docker network inspect sgforge-network >/dev/null 2>&1; then
  echo "Creating shared docker bridge network: sgforge-network..."
  docker network create sgforge-network
else
  echo "Shared network sgforge-network already exists."
fi

# Boot the isolated app compose stack
echo "Starting sg-dashboard containers in background..."
docker compose -f test/apps/sg-dashboard/docker-compose.yml up -d --build

echo "============================================="
echo "SG_Dashboard Forge App is booted!"
echo "Port: 8095"
echo "Database: SQLite local.db (no running DB containers, conserving memory!)"
echo "============================================="
