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

Active design specifications and setup documentations are organized in the `docs/` folder:

*   **[Installation & Setup](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/installation.md)**: Bootstrapping host databases and runtime engines.
*   **[Docker Architecture](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker.md)**: Container services overview and ports mapping.
*   **[Docker Optimization](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/docker_optimization.md)**: Multi-stage environment builds and parity structures.
*   **[WSL Setup Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/wsl.md)**: Port forwarding and systemd networking inside WSL2.
*   **[App Developer Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/guides/app-developer.md)**: Creating micro-apps, declaring manifest scopes, and utilizing parent communication SDKs.
*   **[Script Folders Overview](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md)**: List of convenience scripts and utility functions.
