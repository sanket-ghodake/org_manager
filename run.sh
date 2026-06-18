#!/usr/bin/env bash
set -e

# Always run from the monorepo root context
cd "$(dirname "$0")"

# Colors for premium CLI look
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Check if portable bun is available and add to PATH
if [ -d "portables/bun/bin" ]; then
  export PATH="$(pwd)/portables/bun/bin:$PATH"
fi

# Function to display help
show_help() {
  echo -e "${CYAN}SG Forge Platform Orchestrator${RESET}"
  echo -e "Usage: ./run.sh [platform] [environment/command]"
  echo ""
  echo -e "Platforms:"
  echo -e "  ${GREEN}docker${RESET}     Run containerized stack via Docker Compose"
  echo -e "  ${GREEN}portable${RESET}   Run local processes using native runtimes (Bun/Node)"
  echo -e "  ${GREEN}toolchain${RESET}  Run validation toolchain (lint, format, security, test, docs, all)"
  echo ""
  echo -e "Environments (for docker/portable):"
  echo -e "  ${GREEN}dev${RESET}        Start development servers (with hot-reloading)"
  echo -e "  ${GREEN}sandbox${RESET}    Start production-ready simulation (production build)"
  echo ""
  echo -e "Commands (for toolchain):"
  echo -e "  ${GREEN}lint${RESET}       Run Biome, Ruff, golangci-lint, SQLFluff, and boundary checks"
  echo -e "  ${GREEN}format${RESET}     Auto-format all codebases"
  echo -e "  ${GREEN}security${RESET}   Scan for secrets, vulnerabilities, and SAST problems"
  echo -e "  ${GREEN}test${RESET}       Execute test suites with coverage mapping"
  echo -e "  ${GREEN}docs${RESET}       Build documentation site using MkDocs"
  echo -e "  ${GREEN}all${RESET}        Run lint, security, test, and docs builds sequentially"
  echo ""
  echo -e "Example:"
  echo -e "  ./run.sh docker dev"
  echo -e "  ./run.sh toolchain lint"
}

PLATFORM=$(echo "$1" | tr '[:upper:]' '[:lower:]')
ENV=$(echo "$2" | tr '[:upper:]' '[:lower:]')

# Bypass interactive prompt and execute immediately for toolchain
if [ "$PLATFORM" = "toolchain" ]; then
  if [ -z "$ENV" ]; then
    ENV="all"
  fi
  if [[ "$ENV" != "lint" && "$ENV" != "format" && "$ENV" != "security" && "$ENV" != "test" && "$ENV" != "docs" && "$ENV" != "all" ]]; then
    echo -e "${RED}Invalid toolchain command: $ENV. Expected: lint, format, security, test, docs, all.${RESET}"
    exit 1
  fi
  
  echo -e "${CYAN}Running SG Forge Toolchain [Command: ${ENV}]...${RESET}"

  echo ""
  
  # Ensure network exists
  docker network create sgforge-network 2>/dev/null || true
  
  # Build toolchain container first to ensure up-to-date image
  docker compose -f toolchain/docker-compose.yml build toolchain
  
  # Run the selected checker service
  docker compose -f toolchain/docker-compose.yml run --rm $ENV
  exit $?
fi

# Interactive selection if arguments are missing
if [ -z "$PLATFORM" ] || [ -z "$ENV" ]; then
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      SG FORGE RUNTIME ORCHESTRATOR      ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"
  echo ""
  
  if [ -z "$PLATFORM" ]; then
    echo -e "Select target execution ${BLUE}platform${RESET}:"
    echo -e "  1) ${GREEN}Docker${RESET} (Containerized isolation)"
    echo -e "  2) ${GREEN}Portable${RESET} (Native local processes)"
    read -p "Enter choice [1-2]: " plat_choice
    case $plat_choice in
      1) PLATFORM="docker" ;;
      2) PLATFORM="portable" ;;
      *) echo -e "${RED}Invalid choice.${RESET}"; exit 1 ;;
    esac
    echo ""
  fi

  if [ -z "$ENV" ]; then
    echo -e "Select execution ${BLUE}environment${RESET}:"
    echo -e "  1) ${GREEN}Development${RESET} (Hot-reloading & Watch mode)"
    echo -e "  2) ${GREEN}Sandbox / Production${RESET} (Optimized build)"
    read -p "Enter choice [1-2]: " env_choice
    case $env_choice in
      1) ENV="dev" ;;
      2) ENV="sandbox" ;;
      *) echo -e "${RED}Invalid choice.${RESET}"; exit 1 ;;
    esac
    echo ""
  fi
fi

if [[ "$PLATFORM" != "docker" && "$PLATFORM" != "portable" ]] || [[ "$ENV" != "dev" && "$ENV" != "sandbox" ]]; then
  show_help
  exit 1
fi

echo -e "${CYAN}Starting SG Forge [Platform: ${PLATFORM}] [Env: ${ENV}]...${RESET}"
echo ""

# Determine environment file name suffix and Docker directory
if [ "$ENV" = "dev" ]; then
  ENV_FILE_SUFFIX="development"
  DOCKER_DIR="docker/development"
else
  ENV_FILE_SUFFIX="production"
  DOCKER_DIR="docker/production"
fi

ENV_FILE="config/envs/${PLATFORM}.${ENV_FILE_SUFFIX}.env"

if [ -f "$ENV_FILE" ]; then
  echo -e "${BLUE}Loading environment configuration: ${ENV_FILE}${RESET}"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo -e "${YELLOW}⚠️ Environment configuration file ${ENV_FILE} not found. Running with default shell environment.${RESET}"
fi

# Pre-flight port checks to avoid silent errors or next.js port fallback bugs
check_port() {
  local port=$1
  if (exec 3<>/dev/tcp/127.0.0.1/$port) &>/dev/null; then
    exec 3>&-
    return 1
  fi
  if command -v nc &>/dev/null; then
    if nc -z 127.0.0.1 $port &>/dev/null; then
      return 1
    fi
  fi
  if command -v lsof &>/dev/null; then
    if lsof -Pi :$port -sTCP:LISTEN -t &>/dev/null; then
      return 1
    fi
  fi
  return 0
}

ports_to_check=(${PORT:-3001} 3002 3003)
if [ "$PLATFORM" = "portable" ]; then
  ports_to_check+=(5433)
fi

occupied_ports=()
for port in "${ports_to_check[@]}"; do
  if ! check_port $port; then
    occupied_ports+=($port)
  fi
done

if [ ${#occupied_ports[@]} -ne 0 ]; then
  echo -e "${RED}❌ Error: The following ports required by SG Forge are already in use: ${occupied_ports[*]}${RESET}"
  echo -e "${YELLOW}Please free up these ports before starting the platform (e.g. check other running dev processes).${RESET}"
  exit 1
fi

# Ensure docker network exists
docker network create sgforge-network 2>/dev/null || true

if [ "$PLATFORM" = "docker" ]; then
  # ----------------------------------------------------
  # DOCKER EXECUTION FLOW
  # ----------------------------------------------------
  docker compose -f "$DOCKER_DIR/docker-compose.yaml" --env-file "$ENV_FILE" up --build

else
  # ----------------------------------------------------
  # PORTABLE / LOCAL EXECUTION FLOW
  # ----------------------------------------------------
  # Track all background process PIDs for selective cleanup
  PIDS=()
  cleanup() {
    echo -e "\n${YELLOW}Stopping background services...${RESET}"
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
  }
  trap cleanup EXIT
  
  echo -e "${BLUE}Configuring database container...${RESET}"
  # Start the DB container in detached mode to support local execution
  docker compose -f docker/development/docker-compose.yaml --env-file "$ENV_FILE" up -d db
  
  # Wait for DB to be healthy
  echo -e "${BLUE}Waiting for local Postgres DB container to be ready...${RESET}"
  until docker exec sgforge-db-sanket pg_isready -U lifeos -d org_db >/dev/null 2>&1; do
    sleep 1
  done
  echo -e "${GREEN}Database is ready!${RESET}"
  
  # Initialize database schemas
  echo -e "${BLUE}Syncing database schemas...${RESET}"
  bun core/src/database/initialize-local-db.ts

  # Build/Bundle Forge SDK
  echo -e "${BLUE}Bundling Forge SDK...${RESET}"
  bun build --target=browser --format=iife --outfile=core/src/frontend/public/sdk/forge-sdk.js packages/sdk/forge-sdk.ts
  
  # Launch other processes
  echo -e "${BLUE}Launching microservice platforms...${RESET}"
  
  # 1. Dev-Dashboard (port 3002)
  if [ "$NODE_ENV" = "development" ]; then
    bun --watch core/src/backend/dev-dashboard/server.ts &
  else
    bun core/src/backend/dev-dashboard/server.ts &
  fi
  PIDS+=($!)
  
  # 2. Dynamic Sandbox App Runner
  bun scripts/dynamic-app-runner.ts &
  PIDS+=($!)
  
  # 3. Developer Portal Proxy (port 3003)
  bun scripts/developer-proxy.ts &
  PIDS+=($!)
  
  # 6. Core Next.js Application
  if [ "$NODE_ENV" = "development" ]; then
    (cd core/src/frontend && bun run dev --port "${PORT:-3001}")
  else
    echo -e "${BLUE}Building core production bundle...${RESET}"
    (cd core/src/frontend && bun run build)
    (cd core/src/frontend && bun run start --port "${PORT:-3001}")
  fi
fi
