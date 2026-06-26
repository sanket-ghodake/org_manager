#!/usr/bin/env bash
set -e

# Premium console colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${BLUE}=========================================${RESET}"
echo -e "${CYAN}   SG-DASHBOARD PRE-COMMIT VALIDATION     ${RESET}"
echo -e "${BLUE}=========================================${RESET}"

# Ensure we run from the submodule root directory
cd "$(dirname "$0")/.."

# 1. Run Biome Linter & Formatter Checks
echo -e "${CYAN}Step 1: Running Biome Lint & Format checks...${RESET}"
if bun run lint; then
  echo -e "${GREEN}✓ Biome checks passed successfully!${RESET}"
else
  echo -e "${RED}❌ Biome checks failed! Please resolve linting/formatting errors before committing.${RESET}"
  exit 1
fi

echo -e "${BLUE}-----------------------------------------${RESET}"

# 2. Run Test Suite
echo -e "${CYAN}Step 2: Running Unit & Integration Tests...${RESET}"
if bun run test; then
  echo -e "${GREEN}✓ All tests passed successfully!${RESET}"
else
  echo -e "${RED}❌ Test suite failed! Please fix test failures before committing.${RESET}"
  exit 1
fi

echo -e "${BLUE}=========================================${RESET}"
echo -e "${GREEN}✓ All pre-commit checks passed! Ready to commit.${RESET}"
echo -e "${BLUE}=========================================${RESET}"
exit 0
