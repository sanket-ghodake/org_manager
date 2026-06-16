# Docker Setup Optimization & Multi-Stage Environment Architecture

The SG Forge Platform Docker setup has been restructured and optimized to drastically reduce image sizes, speed up build times, support hot-reloading in development, and enforce sandboxed compilation in production.

---

## 🏗 Key Architectural Decisions

We separated the legacy single-stage Docker configuration into two distinct target environments:

```
docker/
├── development/
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   └── entrypoint.sh
└── production/
    ├── Dockerfile
    ├── docker-compose.yaml
    └── entrypoint.sh
```

---

## ⚡ Development vs. Production Breakdown

| Feature / Metric | Development Environment (`docker/development/`) | Production Environment (`docker/production/`) |
| :--- | :--- | :--- |
| **Hot-Reloading** | Yes (watches source files via `bun --watch` and Next.js dev server) | No (compiled/standalone assets run on production servers) |
| **Host Volume Mounts** | Yes (`../..:/app` maps local codebase with dependency overrides) | No (complete container sandbox isolation for security) |
| **Build Optimization** | Skip source copy and bundle building (built in under 30 seconds) | Multi-stage builder stages (`go-builder` & `js-builder`) |
| **Go Code Execution** | On-the-fly execution via `go run main.go` | Pre-compiled binary `./reference-go-bin` (no Go SDK in runtime image) |
| **Next.js Execution** | Development server (`next dev`) with lazy parsing | Optimized production bundle (`next start`) |

---

## 🛠 Dockerized Toolchain & CI/CD Pipeline

To solve the question *"Are cicd and all other things fully docker setup? testing and docs generation and other things?"*, we have fully containerized all validation checks.

### 1. Updated Toolchain Image
The `toolchain/` configuration now installs python packages for **MkDocs** and **MkDocs-Material**, enabling zero-dependency documentation generation.

- **Linting & Formatting**: `docker compose -f toolchain/docker-compose.yml run --rm lint`
- **Security Audit**: `docker compose -f toolchain/docker-compose.yml run --rm security`
- **Tests with Coverage**: `docker compose -f toolchain/docker-compose.yml run --rm test`
- **Docs Generation**: `docker compose -f toolchain/docker-compose.yml run --rm docs`

### 2. Parity in CI/CD Pipeline
We rewritten the GitHub Actions workflow (`.github/workflows/ci.yml`) to execute tests, linters, security checkers, and documentation builders inside the exact same Docker toolchain containers. This guarantees absolute parity between local and CI environments.

---

## 📊 Developer Operations Cheat Sheet

### Run the Stack
*   **Start Development (with live reload)**:
    ```bash
    ./run.sh docker dev
    ```
*   **Start Production Sandbox (fully compiled)**:
    ```bash
    ./run.sh docker sandbox
    ```

### Run Checks via Dockerized Toolchain
*   **Run All Validation Checks**:
    ```bash
    ./run.sh toolchain all
    ```
*   **Run Tests**:
    ```bash
    ./run.sh toolchain test
    ```
*   **Generate Documentation**:
    ```bash
    ./run.sh toolchain docs
    ```
