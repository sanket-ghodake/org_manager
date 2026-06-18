# SG Forge (Modular Corporate Portal Engine) - v0.1.0

SG Forge is an installable, stable, and extensible organizational workspace portal and secure sandboxing engine. It enables organizations to orchestrate internal micro-frontends (Forge Apps) written in any language (Go, Python, TypeScript) under strict sandbox boundaries and unified, stateless authentication.

---

## 🚀 Orchestrator & Quick Start

All execution targets, environments, and validation checkers are run via the central orchestrator script in the repository root: **`./run.sh`**.

### 🐳 1. Docker Setup (Zero-dependency Runtime)
Run the entire platform, its PostgreSQL database, and all microservices fully containerized. No runtime dependencies (such as Node, Bun, Python, or Go) are required on your host machine.

*   **Development Mode (Hot-Reloading & Live Loading)**:
    ```bash
    ./run.sh docker dev
    ```
*   **Production Sandbox Mode (Statically Compiled & Isolated)**:
    ```bash
    ./run.sh docker sandbox
    ```

For details on configuration and commands, see the [Docker Optimization Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker_optimization.md) and [Docker Environment Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker.md).

---

### 💻 2. Portable Setup (Local Host Runtime)
Runs application services natively on your host machine. Runtimes are localized inside the workspace directory (using an isolated `bun` download) to avoid system-wide dependency pollutions.

*   **One-Time Initialization**:
    ```bash
    # Downloads local bun, installs npm/bun workspaces, seeds DB schema
    bun run setup
    ```
*   **Start Local Dev Servers**:
    ```bash
    ./run.sh portable dev
    ```

For detailed instructions, see the [Installation & Setup Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/installation.md) and the [Orchestration Scripts Guide](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md).

---

### ⚡ 3. Custom App Development & "Vibe Coding"
Scaffold and run a new micro-frontend app instantly with zero manual configuration.

*   **Scaffold App Boilerplate**:
    ```bash
    bun run create-app "My New App" --lang=ts
    ```
    This automatically scans for allocated ports, assigns the next free port, and generates files under `sandbox/apps/my-new-app/`.
*   **Run Platform Dev Servers**:
    ```bash
    ./run.sh docker dev     # Or ./run.sh portable dev
    ```
*   **Hot-Reload & Live Logs**: Code changes in `sandbox/apps/` refresh automatically. Monitor live logs and database tables at the **Developer Dashboard** (`http://localhost:3002`).

---

## ⚙️ System Independence & Performance Optimizations

### 1. System Independence
*   **Docker Setup**: Fully system-independent. Any developer with Docker and Docker Compose installed on their host system (Linux, macOS, or Windows/WSL2) can execute the run scripts, and it will build and run identically. The build context is completely isolated and does not rely on local node dependencies or absolute host file paths.
*   **Portable Setup**: System-independent for Linux and macOS. The `setup.sh` script dynamically detects the host operating system architecture and downloads the correct portable Bun runtime binary (currently Bun v1.3.14). It then configures local workspace node dependencies and sets up a containerized database before natively starting the frontend and helper microservices.

### 2. Optimization (Storage & Time)
*   **Docker Environment**:
    *   **Size (Storage)**: Fully optimized down to **510MB** for the production bundle using multi-stage builds (`node:20-bookworm-slim`). Production containers run directly from precompiled static build assets and do not mount heavy host volumes.
    *   **Speed (Time)**: Rebuilt the development database container to run with optimized write parameters (`fsync=off`, `synchronous_commit=off`, `full_page_writes=off`). This brought the database seed script completion time from **12+ seconds** down to **less than 1 second**.
*   **Portable Environment**:
    *   **Size (Storage)**: Extremely light since it runs natively on the host filesystem with no container virtualization overhead.
    *   **Speed (Time)**: Utilizing the updated Bun v1.3.14 runtime engine, compilation of the production Next.js static files and routes completed in a blazing fast **4.6 seconds**.

---

## 🛠 Validation Toolchain

Run tests, security checks, linter suites, and document compilers inside the Dockerized toolchain:

*   **Run All Validation Checks**:
    ```bash
    ./run.sh toolchain all
    ```
*   **Run Lint & Format Checks**:
    ```bash
    ./run.sh toolchain lint
    ```
*   **Execute Test Suite with Coverage**:
    ```bash
    ./run.sh toolchain test
    ```
*   **Build the Documentation Site (MkDocs)**:
    ```bash
    ./run.sh toolchain docs
    ```

---

## 📁 Project Documentation & Architecture

Active design specifications, guidelines, and setup documentations are organized in the `docs/` folder:

*   **[Onboarding Analysis Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/onboarding_analysis.md)**: Real evaluation of setup portability, platform quirks, and developer onboarding friction points.
*   **[App Integration & Prototyping](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/app-integration.md)**: Step-by-step tutorial for integrating internal (zero-port-exposure) and externally hosted microservices, using scaffolding scripts, and "Vibe Coding" hot-reloading configurations.
*   **[Installation & Setup](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/installation.md)**: Bootstrapping host databases and runtime engines.
*   **[App Developer Specs](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/app-developer.md)**: Detailed specifications for app manifests, API schemas, and utilizing parent communication SDKs.
*   **[Docker Architecture](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker.md)**: Container services overview and ports mapping.
*   **[Docker Optimization](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker_optimization.md)**: Multi-stage environment builds and parity structures.
*   **[WSL Setup Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/wsl.md)**: Port forwarding and systemd networking inside WSL2.
*   **[Script Folders Overview](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md)**: List of convenience scripts and utility functions.

### 🔍 Core Files to Check:
*   **App Scaffolder CLI**: [scripts/create-forge-app.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/create-forge-app.ts) — Unused port scanning and workspace bootstrapping.
*   **Central Orchestrator**: [run.sh](file:///home/sanket/Desktop/Sanket/org_website/run.sh) — Starts platform targets (Docker or Portable) and containerized linting/testing toolchains.
*   **Local Installer Setup**: [scripts/portable/development/setup.sh](file:///home/sanket/Desktop/Sanket/org_website/scripts/portable/development/setup.sh) — Downloads isolated bun binaries and seeds local database.
*   **Proxy Gateway**: [scripts/developer-proxy.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/developer-proxy.ts) — Internal routing without exposing ports.
*   **Dynamic App Runner**: [scripts/dynamic-app-runner.ts](file:///home/sanket/Desktop/Sanket/org_website/scripts/dynamic-app-runner.ts) — Background runner scanning directory structure.
*   **Manifest Sync Engine**: [core/src/backend/utils/manifestParser.ts](file:///home/sanket/Desktop/Sanket/org_website/core/src/backend/utils/manifestParser.ts) — Automated app registry parser, schema provisioning, and cleanup.
*   **OAuth Auth Exchange**: [core/src/frontend/app/api/v1/auth/exchange/route.ts](file:///home/sanket/Desktop/Sanket/org_website/core/src/frontend/app/api/v1/auth/exchange/route.ts) — Handles backend code exchange for secure JWT session tokens.
