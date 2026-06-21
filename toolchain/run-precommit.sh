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

# 1. Identify all staged files, excluding deleted ones to avoid lint failures on deleted assets
STAGED_FILES=()
while IFS= read -r line; do
  [ -n "$line" ] && STAGED_FILES+=("$line")
done < <(git diff --cached --name-only --diff-filter=d)

if [ ${#STAGED_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ No staged files found. Skipping checks.${RESET}"
  exit 0
fi

# 2. Check for merge conflict markers in staged changes to prevent broken commits
if git diff --cached | grep -qE '^\+(<<<<<<<|=======|>>>>>>>)'; then
  echo -e "${RED}❌ Error: Merge conflict markers detected in staged files! Please resolve them before committing.${RESET}"
  exit 1
fi

# 3. Categorize staged files for granular analysis
STAGED_JS_TS=()
STAGED_PY=()
STAGED_SQL=()
STAGED_GO=()
STAGED_DEPS_SRC=()
LOCKFILES_CHANGED=false
GO_DEPS_CHANGED=false
STAGED_LOCKFILES=()

for file in "${STAGED_FILES[@]}"; do
  if [[ "$file" =~ \.(js|jsx|ts|tsx|json|css)$ ]]; then
    STAGED_JS_TS+=("$file")
  fi
  if [[ "$file" =~ \.py$ ]]; then
    STAGED_PY+=("$file")
  fi
  if [[ "$file" =~ \.sql$ ]]; then
    STAGED_SQL+=("$file")
  fi
  if [[ "$file" =~ \.go$ ]]; then
    STAGED_GO+=("$file")
  fi
  if [[ "$file" =~ ^(core|packages|sandbox)/.*\.(js|jsx|ts|tsx)$ ]]; then
    STAGED_DEPS_SRC+=("$file")
  fi
  if [[ "$file" == "package-lock.json" || "$file" == "bun.lock" || "$file" == "package.json" ]]; then
    LOCKFILES_CHANGED=true
    STAGED_LOCKFILES+=("$file")
  fi
  if [[ "$file" == "sandbox/apps/reference-go/go.mod" || "$file" == "sandbox/apps/reference-go/go.sum" ]]; then
    GO_DEPS_CHANGED=true
  fi
done

# 4. Check tool availability on host to determine container fallback requirements
NEED_CONTAINER=false
HAS_DOCKER=false
if command -v docker &>/dev/null; then
  HAS_DOCKER=true
fi

has_biome() { command -v biome &>/dev/null || command -v bunx &>/dev/null; }
has_ruff() { command -v ruff &>/dev/null; }
has_sqlfluff() { command -v sqlfluff &>/dev/null; }
has_depcruise() { command -v depcruise &>/dev/null; }
has_go() { command -v golangci-lint &>/dev/null && command -v go &>/dev/null; }
has_gitleaks() { command -v gitleaks &>/dev/null; }
has_semgrep() { command -v semgrep &>/dev/null; }
has_trivy() { command -v trivy &>/dev/null; }
has_govulncheck() { command -v govulncheck &>/dev/null && command -v go &>/dev/null; }

if [ ${#STAGED_JS_TS[@]} -gt 0 ] && ! has_biome; then NEED_CONTAINER=true; fi
if [ ${#STAGED_PY[@]} -gt 0 ] && ! has_ruff; then NEED_CONTAINER=true; fi
if [ ${#STAGED_SQL[@]} -gt 0 ] && ! has_sqlfluff; then NEED_CONTAINER=true; fi
if [ ${#STAGED_DEPS_SRC[@]} -gt 0 ] && ! has_depcruise; then NEED_CONTAINER=true; fi
if [ ${#STAGED_GO[@]} -gt 0 ] && ! has_go; then NEED_CONTAINER=true; fi
if ! has_gitleaks; then NEED_CONTAINER=true; fi

local_sast_scan=()
local_sast_scan+=("${STAGED_JS_TS[@]}")
local_sast_scan+=("${STAGED_PY[@]}")
local_sast_scan+=("${STAGED_GO[@]}")
if [ ${#local_sast_scan[@]} -gt 0 ] && ! has_semgrep; then NEED_CONTAINER=true; fi

if [ "$LOCKFILES_CHANGED" = true ] && ! has_trivy; then NEED_CONTAINER=true; fi
if [ "$GO_DEPS_CHANGED" = true ] && ! has_govulncheck; then NEED_CONTAINER=true; fi

# 5. Upfront Docker Image Preparation (resolves race conditions in parallel container builds)
ensure_docker_image() {
  if [ "$HAS_DOCKER" = true ]; then
    if ! docker image inspect sgforge-toolchain:latest &>/dev/null; then
      echo -e "${BLUE}Building toolchain container image...${RESET}"
      docker compose -f toolchain/docker-compose.yml build toolchain
    fi
  else
    echo -e "${YELLOW}⚠️ Warning: Docker is not running or not installed, but some checks require container fallback.${RESET}"
  fi
}

if [ "$NEED_CONTAINER" = true ]; then
  ensure_docker_image
fi

# 6. Define check runners (will run concurrently in subshells)
check_biome() {
  if has_biome; then
    if command -v bunx &>/dev/null; then
      bunx biome ci "${STAGED_JS_TS[@]}"
    else
      biome ci "${STAGED_JS_TS[@]}"
    fi
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ Biome not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "bunx biome ci ${STAGED_JS_TS[*]}"
  else
    echo -e "${RED}❌ Error: Biome is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_ruff() {
  if has_ruff; then
    ruff check "${STAGED_PY[@]}"
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ Ruff not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "ruff check ${STAGED_PY[*]}"
  else
    echo -e "${RED}❌ Error: Ruff is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_sqlfluff() {
  if has_sqlfluff; then
    sqlfluff lint "${STAGED_SQL[@]}" --dialect postgres
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ SQLFluff not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "sqlfluff lint ${STAGED_SQL[*]} --dialect postgres"
  else
    echo -e "${RED}❌ Error: SQLFluff is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_depcruise() {
  if has_depcruise; then
    depcruise --config .dependency-cruiser.json core packages sandbox
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ dependency-cruiser not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "depcruise --config .dependency-cruiser.json core packages sandbox"
  else
    echo -e "${RED}❌ Error: dependency-cruiser is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_golangci() {
  if has_go; then
    (cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./...)
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ Go/golangci-lint not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm -e GOFLAGS="-buildvcs=false" --entrypoint "sh" toolchain -c "git config --global --add safe.directory /app && cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./..."
  else
    echo -e "${RED}❌ Error: Go/golangci-lint is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_gitleaks() {
  if has_gitleaks; then
    gitleaks protect --staged --verbose --redact
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ Gitleaks not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "git config --global --add safe.directory /app && gitleaks protect --staged --verbose --redact"
  else
    echo -e "${RED}❌ Error: Gitleaks is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_semgrep() {
  local scan_files=()
  scan_files+=("${STAGED_JS_TS[@]}")
  scan_files+=("${STAGED_PY[@]}")
  scan_files+=("${STAGED_GO[@]}")

  if [ ${#scan_files[@]} -eq 0 ]; then
    return 0
  fi

  if has_semgrep; then
    semgrep scan --config auto --error --skip-unknown-extensions "${scan_files[@]}"
  elif [ "$HAS_DOCKER" = true ]; then
    echo -e "${YELLOW}⚠️ Semgrep not found on host. Running in container...${RESET}"
    docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "git config --global --add safe.directory /app && semgrep scan --config auto --error --skip-unknown-extensions ${scan_files[*]}"
  else
    echo -e "${RED}❌ Error: Semgrep is not available locally and Docker is not running.${RESET}"
    return 1
  fi
}

check_dependencies() {
  local failed=0
  if [ "$LOCKFILES_CHANGED" = true ]; then
    echo -e "${BLUE}* Scanning lockfile vulnerabilities (Trivy)...${RESET}"
    for lockfile in "${STAGED_LOCKFILES[@]}"; do
      echo -e "${BLUE}Scanning $lockfile...${RESET}"
      if has_trivy; then
        trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed "$lockfile" || failed=1
      elif [ "$HAS_DOCKER" = true ]; then
        echo -e "${YELLOW}⚠️ Trivy not found on host. Running in container for $lockfile...${RESET}"
        docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "git config --global --add safe.directory /app && trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed $lockfile" || failed=1
      else
        echo -e "${RED}❌ Error: Trivy is not available locally and Docker is not running.${RESET}"
        failed=1
        break
      fi
    done
  fi

  if [ "$GO_DEPS_CHANGED" = true ]; then
    echo -e "${BLUE}* Checking Go dependencies (Govulncheck)...${RESET}"
    if has_govulncheck; then
      (cd sandbox/apps/reference-go && govulncheck ./...) || failed=1
    elif [ "$HAS_DOCKER" = true ]; then
      echo -e "${YELLOW}⚠️ govulncheck not found on host. Running in container...${RESET}"
      docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "sh" toolchain -c "git config --global --add safe.directory /app && cd sandbox/apps/reference-go && govulncheck ./..." || failed=1
    else
      echo -e "${RED}❌ Error: govulncheck is not available locally and Docker is not running.${RESET}"
      failed=1
    fi
  fi
  return $failed
}

# 7. Initialize job management system
TEMP_DIR=$(mktemp -d -t precommit-XXXXXX)
trap 'rm -rf "$TEMP_DIR"' EXIT

job_names=()
job_pids=()
job_start_times=()
job_log_files=()

run_job() {
  local name="$1"
  shift
  local log_file="$TEMP_DIR/job_${#job_names[@]}.log"
  
  # Run target function in background, redirecting output to isolate job results
  "$@" > "$log_file" 2>&1 &
  local pid=$!
  
  job_names+=("$name")
  job_pids+=("$pid")
  job_start_times+=($(date +%s))
  job_log_files+=("$log_file")
  
  echo -e "${BLUE}* Started $name...${RESET}"
}

# 8. Dispatch all checks in parallel to minimize git commit lag
if [ ${#STAGED_JS_TS[@]} -gt 0 ]; then
  run_job "JS/TS Linting (Biome)" check_biome
fi

if [ ${#STAGED_PY[@]} -gt 0 ]; then
  run_job "Python Linting (Ruff)" check_ruff
fi

if [ ${#STAGED_SQL[@]} -gt 0 ]; then
  run_job "SQL Linting (SQLFluff)" check_sqlfluff
fi

if [ ${#STAGED_DEPS_SRC[@]} -gt 0 ]; then
  run_job "Architecture Boundaries (Dependency-Cruiser)" check_depcruise
fi

if [ ${#STAGED_GO[@]} -gt 0 ]; then
  run_job "Go Linting (golangci-lint)" check_golangci
fi

# Always protect staged assets from credentials leaks (Gitleaks)
run_job "Secret Scanning (Gitleaks)" check_gitleaks

# Run SAST vulnerability check if relevant source files are modified
sast_files=()
sast_files+=("${STAGED_JS_TS[@]}")
sast_files+=("${STAGED_PY[@]}")
sast_files+=("${STAGED_GO[@]}")
if [ ${#sast_files[@]} -gt 0 ]; then
  run_job "SAST Vulnerability Scan (Semgrep)" check_semgrep
fi

# Run package/dependency audit if lockfiles or packages changed
if [ "$LOCKFILES_CHANGED" = true ] || [ "$GO_DEPS_CHANGED" = true ]; then
  run_job "Dependency Security Audit" check_dependencies
fi

# 9. Wait for all background checks to complete and aggregate results
GLOBAL_FAILED=0
results=()

for i in "${!job_pids[@]}"; do
  pid="${job_pids[$i]}"
  name="${job_names[$i]}"
  log_file="${job_log_files[$i]}"
  start_time="${job_start_times[$i]}"
  
  exit_code=0
  wait "$pid" || exit_code=$?
  
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  if [ $exit_code -ne 0 ]; then
    results+=("${RED}❌ [FAIL] $name (${duration}s)${RESET}")
    GLOBAL_FAILED=1
    echo -e "\n${RED}=========================================${RESET}"
    echo -e "${RED}   DETAILED FAILURE: $name${RESET}"
    echo -e "${RED}=========================================${RESET}"
    cat "$log_file"
    echo -e "${RED}-----------------------------------------${RESET}"
  else
    results+=("${GREEN}✅ [PASS] $name (${duration}s)${RESET}")
  fi
done

# 10. Print comprehensive architectural and security report
echo -e "\n${BLUE}=========================================${RESET}"
echo -e "${CYAN}      PRE-COMMIT VALIDATION REPORT       ${RESET}"
echo -e "${BLUE}=========================================${RESET}"
for result in "${results[@]}"; do
  echo -e "  $result"
done
echo -e "${BLUE}=========================================${RESET}"

if [ $GLOBAL_FAILED -ne 0 ]; then
  echo -e "\n${RED}❌ Pre-commit validation checks failed! Please correct the errors above before committing.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}✓ All pre-commit validation checks passed successfully!${RESET}"
  exit 0
fi
