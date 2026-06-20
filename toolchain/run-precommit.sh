#!/usr/bin/env bash
set -e

# Colors for premium CLI look
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${BLUE}=========================================${RESET}"
echo -e "${CYAN}   OPTIMIZED PRE-COMMIT VALIDATION       ${RESET}"
echo -e "${BLUE}=========================================${RESET}"

# Ensure we run from workspace root
cd "$(dirname "$0")/.."

# Export paths for local/portable runtimes
if [ -d "portables/bun/bin" ]; then
  export PATH="$(pwd)/portables/bun/bin:$PATH"
fi
if [ -d ".venv/bin" ]; then
  export PATH="$(pwd)/.venv/bin:$PATH"
fi
if [ -d "node_modules/.bin" ]; then
  export PATH="$(pwd)/node_modules/.bin:$PATH"
fi

# 1. Identify all staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✓ No staged files found. Skipping checks.${RESET}"
  exit 0
fi

FAILED=0

# Helper to print check headers
start_check() {
  echo -e "\n${BLUE}* $1...${RESET}"
}

# --- JS/TS check ---
STAGED_JS_TS=$(echo "$STAGED_FILES" | grep -E '\.(js|jsx|ts|tsx|json|css)$' || true)
if [ -n "$STAGED_JS_TS" ]; then
  start_check "Linting JS/TS files (Biome)"
  # We pass only the staged files to biome to optimize performance and memory
  bunx biome ci $STAGED_JS_TS || FAILED=1
fi

# --- Python check ---
STAGED_PY=$(echo "$STAGED_FILES" | grep -E '\.py$' || true)
if [ -n "$STAGED_PY" ]; then
  start_check "Linting Python files (Ruff)"
  # Run ruff check only on staged python files
  ruff check $STAGED_PY || FAILED=1
fi

# --- SQL check ---
STAGED_SQL=$(echo "$STAGED_FILES" | grep -E '\.sql$' || true)
if [ -n "$STAGED_SQL" ]; then
  start_check "Linting SQL Schemas (SQLFluff)"
  # Run sqlfluff on staged sql files
  sqlfluff lint $STAGED_SQL --dialect postgres || FAILED=1
fi

# --- Architecture Boundary check (Dependency-Cruiser) ---
STAGED_DEPS=$(echo "$STAGED_FILES" | grep -E '^(core|packages|sandbox)/.*\.(js|jsx|ts|tsx)$' || true)
if [ -n "$STAGED_DEPS" ]; then
  start_check "Checking Architecture Boundaries (Dependency-Cruiser)"
  depcruise --config .dependency-cruiser.json core packages sandbox || FAILED=1
fi

# --- Go check (golangci-lint) ---
STAGED_GO=$(echo "$STAGED_FILES" | grep -E '\.go$' || true)
if [ -n "$STAGED_GO" ]; then
  start_check "Linting Go files (golangci-lint)"
  if command -v golangci-lint &>/dev/null && command -v go &>/dev/null; then
    (cd sandbox/apps/reference-go && golangci-lint run ./...) || FAILED=1
  else
    echo -e "${YELLOW}⚠️ Go / golangci-lint not found on host. Falling back to containerised linting...${RESET}"
    # Ensure toolchain container image exists
    if ! docker image inspect sgforge-toolchain:latest &>/dev/null; then
      echo -e "${BLUE}Building toolchain container image...${RESET}"
      docker compose -f toolchain/docker-compose.yml build toolchain
    fi
    # Run golangci-lint for the reference-go app inside the toolchain container
    docker compose -f toolchain/docker-compose.yml run --rm -e GOFLAGS="-buildvcs=false" --entrypoint "sh" toolchain -c "cd sandbox/apps/reference-go && golangci-lint run ./..." || FAILED=1
  fi
fi

if [ $FAILED -ne 0 ]; then
  echo -e "\n${RED}❌ Pre-commit validation checks failed! Please correct the errors above.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}✓ All optimized pre-commit validation checks passed successfully!${RESET}"
  exit 0
fi
