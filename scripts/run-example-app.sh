#!/bin/bash
# Script to run example-forge-app container stack independently

# Ensure target network exists before spawning compose
if ! docker network inspect sgforge-network >/dev/null 2>&1; then
  echo "Creating shared docker bridge network: sgforge-network..."
  docker network create sgforge-network
else
  echo "Shared network sgforge-network already exists."
fi

# Boot the isolated app compose stack
echo "Starting example-forge-app containers in background..."
docker compose -f test/example-forge-app/docker-compose.yml up -d --build

echo "============================================="
echo "Example Forge App is booted!"
echo "Port: 8090"
echo "Database Port (External Mapping): 5434"
echo "============================================="
