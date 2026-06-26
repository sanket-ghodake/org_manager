#!/usr/bin/env bash
set -e

# Premium console colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Find the git directory for the repository or submodule
GIT_DIR=$(git rev-parse --git-common-dir 2>/dev/null || git rev-parse --git-dir 2>/dev/null)
if [ -z "$GIT_DIR" ]; then
  echo -e "${RED}Error: Not a git repository or submodule.${RESET}"
  exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"
mkdir -p "$HOOKS_DIR"

# Write pre-commit hook that delegates to run-precommit.sh
cat << 'EOF' > "$HOOKS_DIR/pre-commit"
#!/usr/bin/env bash
# Installed by SG-Dashboard setup-hooks.sh
set -e

# Make sure we run from the repository root
cd "$(git rev-parse --show-toplevel)"
./scripts/run-precommit.sh
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo -e "${GREEN}✓ Pre-commit hook installed successfully in ${HOOKS_DIR}/pre-commit!${RESET}"
