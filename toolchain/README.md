# SG Forge Verification Toolchain

This directory houses the containerized verification toolchain for the SG Forge platform. It bundles all necessary runtimes (Node, Bun, Go, Python) and analysis tools into a single container image to ensure linting, formatting, security auditing, and test executions run identically on developer machines and CI pipelines.

---

## 🛠 Included Tools

The toolchain container packages the following analysis and testing utilities:

| Tool Category | Tool Name | Target Scope | Purpose |
|---|---|---|---|
| **Linting & Code Style** | **Biome** | TypeScript / JavaScript | Fast syntax validation, linting, and formatting |
| | **Ruff** | Python | Linting and formatting Python microservices |
| | **golangci-lint** | Go | Metalinter for Go codebase |
| | **SQLFluff** | SQL / Drizzle | SQL dialect linting and style enforcement |
| **Architectural Integrity**| **Dependency-Cruiser**| Monorepo structure | Checks boundary crossings (e.g. preventing frontend from importing backend directly) |
| **Security & Secrets** | **Gitleaks** | Git repository | Scans commit history and files for leaked secrets, credentials, or keys |
| | **Trivy** | Filesystem & Lockfiles | Dependency vulnerability scanner |
| | **Semgrep** | Source Code | Static Application Security Testing (SAST) |
| | **govulncheck** | Go Modules | Official vulnerability scanner for Go |
| **Testing** | **Bun Test** | TS/JS / Core Portal | Unit and integration test runner with coverage reports |
| | **Go Test** | Go Apps / Services | Native unit tests |

---

## 🚀 How to Run

Verification commands should be run using the orchestrator script in the workspace root, which will automatically build the toolchain container and execute the relevant validation suite.

### Standard Commands

Always run from the workspace root:

```bash
# Run all checks (linting, security, and tests)
./run.sh toolchain all

# Run linters and boundary checks only
./run.sh toolchain lint

# Auto-format all source code
./run.sh toolchain format

# Run security audits (secrets, Trivy, and Semgrep)
./run.sh toolchain security

# Execute test suites with coverage
./run.sh toolchain test
```

### Direct Docker Compose Usage

If you prefer to run commands directly via `docker compose`:

```bash
# Build the toolchain container
docker compose -f toolchain/docker-compose.yml build toolchain

# Run checks
docker compose -f toolchain/docker-compose.yml run --rm lint
docker compose -f toolchain/docker-compose.yml run --rm format
docker compose -f toolchain/docker-compose.yml run --rm security
docker compose -f toolchain/docker-compose.yml run --rm test
```

---

## 📂 File Structure

* `Dockerfile`: Declares the Debian-based environment containing Go, Node, Bun, Python, and all scanning tools.
* `docker-compose.yml`: Defines the toolchain services, volume mounts, and network configurations.
* `run-checks.sh`: The entrypoint shell script inside the container that dispatches to the requested checker.
