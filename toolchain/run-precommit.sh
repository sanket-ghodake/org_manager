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

# 1. Identify all staged files, excluding deleted ones
STAGED_FILES=()
while IFS= read -r line; do
  [ -n "$line" ] && STAGED_FILES+=("$line")
done < <(git diff --cached --name-only --diff-filter=d)

if [ ${#STAGED_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ No staged files found. Skipping checks.${RESET}"
  exit 0
fi

# 2. Check for merge conflict markers
if git diff --cached | grep -qE '^\+(<<<<<<<|=======|>>>>>>>)'; then
  echo -e "${RED}❌ Error: Merge conflict markers detected in staged files! Please resolve them before committing.${RESET}"
  exit 1
fi

# 3. Categorize staged files
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

# 4. Check tool availability on host
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
has_tsc() { command -v tsc &>/dev/null; }

# Determine which checks need container fallback
NEED_CONTAINER=false
CONTAINER_COMMANDS=()
CONTAINER_JOB_NAMES=()

# 5. Upfront Docker Image Preparation
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

# 6. Define check runners (for local execution)
check_biome() {
  if command -v bunx &>/dev/null; then
    bunx biome ci --config-path=config "${STAGED_JS_TS[@]}"
  else
    biome ci --config-path=config "${STAGED_JS_TS[@]}"
  fi
}

check_ruff() {
  ruff check "${STAGED_PY[@]}" && ruff format --check "${STAGED_PY[@]}"
}

check_sqlfluff() {
  sqlfluff lint "${STAGED_SQL[@]}" --dialect postgres
}

check_depcruise() {
  depcruise --config .dependency-cruiser.json "${STAGED_DEPS_SRC[@]}"
}

check_golangci() {
  (cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./...)
}

check_gitleaks() {
  gitleaks protect --staged --verbose --redact
}

check_semgrep() {
  semgrep scan --config auto --error --skip-unknown-extensions "${sast_files[@]}"
}

check_trivy() {
  local failed=0
  for lockfile in "${STAGED_LOCKFILES[@]}"; do
    echo -e "${BLUE}Scanning $lockfile...${RESET}"
    trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed "$lockfile" || failed=1
  done
  return $failed
}

check_govulncheck() {
  (cd sandbox/apps/reference-go && govulncheck ./...)
}

check_tsc() {
  local staged_ts_files=()
  for file in "${STAGED_JS_TS[@]}"; do
    if [[ "$file" =~ \.tsx?$ ]]; then
      staged_ts_files+=("$file")
    fi
  done
  
  if [ ${#staged_ts_files[@]} -eq 0 ]; then
    return 0
  fi
  
  local tsc_output
  tsc_output=$(tsc --noEmit --incremental --tsBuildInfoFile .tsbuildinfo 2>&1) || true
  
  local failed=0
  local errors=()
  
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      for file in "${staged_ts_files[@]}"; do
        if [[ "$line" == *"$file"* ]]; then
          errors+=("$line")
          failed=1
        fi
      done
    fi
  done <<< "$tsc_output"
  
  if [ $failed -eq 1 ]; then
    echo -e "${RED}TypeScript compilation errors detected in staged files:${RESET}"
    for err in "${errors[@]}"; do
      echo -e "  $err"
    done
    return 1
  fi
  return 0
}

# 7. Initialize job management system
TEMP_DIR=$(mktemp -d -t precommit-XXXXXX)
CONTAINER_LOGS_DIR=".precommit_container_logs"
trap 'rm -rf "$TEMP_DIR" "$CONTAINER_LOGS_DIR"' EXIT

job_names=()
job_pids=()
job_start_times=()
job_log_files=()

run_job() {
  local name="$1"
  shift
  local log_file="$TEMP_DIR/job_${#job_names[@]}.log"
  
  "$@" > "$log_file" 2>&1 &
  local pid=$!
  
  job_names+=("$name")
  job_pids+=("$pid")
  job_start_times+=($(date +%s))
  job_log_files+=("$log_file")
  
  echo -e "${BLUE}* Started $name...${RESET}"
}

# Orchestrator for coalesced container checks
run_container_checks() {
  local container_script_file="$CONTAINER_LOGS_DIR/run_checks.sh"
  
  cat << 'EOF' > "$container_script_file"
#!/usr/bin/env bash
export GOFLAGS="-buildvcs=false"
git config --global --add safe.directory /app
EOF

  for i in "${!CONTAINER_COMMANDS[@]}"; do
    local cmd="${CONTAINER_COMMANDS[$i]}"
    cat << EOF >> "$container_script_file"
( $cmd ) > /app/$CONTAINER_LOGS_DIR/job_$i.log 2>&1 &
pid_$i=\$!
EOF
  done

  for i in "${!CONTAINER_COMMANDS[@]}"; do
    cat << EOF >> "$container_script_file"
exit_code_$i=0
wait \$pid_$i || exit_code_$i=\$?
echo \$exit_code_$i > /app/$CONTAINER_LOGS_DIR/job_$i.exit
EOF
  done

  chmod +x "$container_script_file"
  
  docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "bash" toolchain "/app/$container_script_file"
}

schedule_check() {
  local name="$1"
  local local_func="$2"
  local has_tool_func="$3"
  local container_cmd="$4"
  local condition="${5:-true}"
  
  if [ "$condition" = "false" ]; then
    return 0
  fi
  
  if $has_tool_func; then
    run_job "$name" "$local_func"
  elif [ -n "$container_cmd" ] && [ "$HAS_DOCKER" = true ]; then
    CONTAINER_COMMANDS+=("$container_cmd")
    CONTAINER_JOB_NAMES+=("$name")
    NEED_CONTAINER=true
  else
    if [ -n "$container_cmd" ]; then
      run_job "$name" "echo -e \"${RED}❌ Error: $name is not available locally and Docker is not running.${RESET}\" && exit 1"
    fi
  fi
}

# 8. Dispatch all checks
run_biome=false
run_ruff=false
run_sqlfluff=false
run_depcruise=false
run_golangci=false
run_semgrep=false
run_trivy=false
run_govulncheck=false
run_tsc=false

if [ ${#STAGED_JS_TS[@]} -gt 0 ]; then
  run_biome=true
  run_semgrep=true
  for file in "${STAGED_JS_TS[@]}"; do
    if [[ "$file" =~ \.tsx? ]]; then
      run_tsc=true
      break
    fi
  done
fi

if [ ${#STAGED_PY[@]} -gt 0 ]; then
  run_ruff=true
  run_semgrep=true
fi

if [ ${#STAGED_SQL[@]} -gt 0 ]; then
  run_sqlfluff=true
fi

if [ ${#STAGED_DEPS_SRC[@]} -gt 0 ]; then
  run_depcruise=true
fi

if [ ${#STAGED_GO[@]} -gt 0 ]; then
  run_golangci=true
  run_semgrep=true
fi

if [ "$LOCKFILES_CHANGED" = true ]; then
  run_trivy=true
fi

if [ "$GO_DEPS_CHANGED" = true ]; then
  run_govulncheck=true
fi

# Schedule checks
schedule_check "JS/TS Linting (Biome)" check_biome has_biome "bunx biome ci --config-path=config ${STAGED_JS_TS[*]}" "$run_biome"
schedule_check "Python Linting & Formatting (Ruff)" check_ruff has_ruff "ruff check ${STAGED_PY[*]} && ruff format --check ${STAGED_PY[*]}" "$run_ruff"
schedule_check "SQL Linting (SQLFluff)" check_sqlfluff has_sqlfluff "sqlfluff lint ${STAGED_SQL[*]} --dialect postgres" "$run_sqlfluff"
schedule_check "Architecture Boundaries (Dependency-Cruiser)" check_depcruise has_depcruise "depcruise --config .dependency-cruiser.json ${STAGED_DEPS_SRC[*]}" "$run_depcruise"
schedule_check "Go Linting (golangci-lint)" check_golangci has_go "cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./..." "$run_golangci"
schedule_check "Secret Scanning (Gitleaks)" check_gitleaks has_gitleaks "gitleaks protect --staged --verbose --redact" "true"

sast_files=()
sast_files+=("${STAGED_JS_TS[@]}")
sast_files+=("${STAGED_PY[@]}")
sast_files+=("${STAGED_GO[@]}")
schedule_check "SAST Vulnerability Scan (Semgrep)" check_semgrep has_semgrep "semgrep scan --config auto --error --skip-unknown-extensions ${sast_files[*]}" "$run_semgrep"

trivy_container_cmd="failed=0; for lockfile in ${STAGED_LOCKFILES[*]}; do trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \$lockfile || failed=1; done; exit \$failed"
schedule_check "Dependency Security Audit (Trivy)" check_trivy has_trivy "$trivy_container_cmd" "$run_trivy"
schedule_check "Go Vulnerability Audit (Govulncheck)" check_govulncheck has_govulncheck "cd sandbox/apps/reference-go && govulncheck ./..." "$run_govulncheck"

# TypeScript Compilation Check (Local only)
schedule_check "TypeScript Compilation (tsc)" check_tsc has_tsc "" "$run_tsc"

# Setup container directory
rm -rf "$CONTAINER_LOGS_DIR"
mkdir -p "$CONTAINER_LOGS_DIR"

if [ "$NEED_CONTAINER" = true ]; then
  ensure_docker_image
  run_job "Containerized Checks" run_container_checks
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
  
  if [ "$name" = "Containerized Checks" ]; then
    if [ $exit_code -ne 0 ]; then
      echo -e "\n${RED}⚠️ Container runner failed to execute properly. Docker logs:${RESET}"
      cat "$log_file"
      echo -e "${RED}-----------------------------------------${RESET}"
    fi
    
    for j in "${!CONTAINER_JOB_NAMES[@]}"; do
      c_name="${CONTAINER_JOB_NAMES[$j]}"
      c_exit_file="$CONTAINER_LOGS_DIR/job_$j.exit"
      c_log_file="$CONTAINER_LOGS_DIR/job_$j.log"
      
      c_exit=1
      if [ -f "$c_exit_file" ]; then
        c_exit=$(cat "$c_exit_file")
      fi
      
      if [ "$c_exit" -ne 0 ]; then
        results+=("${RED}❌ [FAIL] $c_name (Containerized)${RESET}")
        GLOBAL_FAILED=1
        echo -e "\n${RED}=========================================${RESET}"
        echo -e "${RED}   DETAILED FAILURE: $c_name (Containerized)${RESET}"
        echo -e "${RED}=========================================${RESET}"
        if [ -f "$c_log_file" ]; then
          cat "$c_log_file"
        else
          echo "No log file found. Container check might not have executed."
        fi
        echo -e "${RED}-----------------------------------------${RESET}"
      else
        results+=("${GREEN}✅ [PASS] $c_name (Containerized)${RESET}")
      fi
    done
  else
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
  fi
done

# 10. Print report
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
