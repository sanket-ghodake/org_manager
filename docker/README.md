# Docker Configuration Environment (`docker/`)

This directory contains the Docker configurations for running the SG Forge Platform in isolated container environments. It is separated into two environments: **development** and **production**, to optimize storage, build speed, and runtime characteristics.

---

## 📁 Directory Structure

```
docker/
├── development/
│   ├── Dockerfile             # Development container definition
│   ├── docker-compose.yaml    # Dev compose with volume mounts & hot-reloading
│   └── entrypoint.sh          # Dev bootstrapper (applies migrations, starts dev servers)
├── production/
│   ├── Dockerfile             # Multi-stage production container definition
│   ├── docker-compose.yaml    # Production compose with zero volume bindings
│   └── entrypoint.sh          # Production bootstrapper (runs compiled artifacts)
└── README.md                  # This file
```

---

## 🚀 Execution Instructions

All Docker commands are wrapped by the root orchestrator script `./run.sh` for convenience.

### 1. Development Mode (Hot-Reloading & Live Loading)
Designed for developers to work on the codebase with instant feedback. Changes to host files will immediately update inside the running container.

*   **To start**:
    ```bash
    ./run.sh docker dev
    ```
*   **How it works**:
    - Build is extremely fast (under 30 seconds) because it skips copying the entire codebase or building Next.js at image build time.
    - Mounts the host workspace (`../..:/app`) with anonymous volume overrides for `node_modules` and `.next`.
    - Automatically checks and installs NPM/Bun dependencies inside the entrypoint.
    - Launches all microservices (`reference-expenses`, `reference-python`, `reference-go`, dev-dashboard, portal-proxy) and the Next.js Frontend (`bun run dev`) in watch/dev mode.

### 2. Production Sandbox Mode (Statically Compiled & Isolated)
Designed to run the entire system in a production-ready, fully compiled state with zero host volume bindings.

*   **To start**:
    ```bash
    ./run.sh docker sandbox
    ```
*   **How it works**:
    - Employs multi-stage builds (`go-builder` compiles Go code, `js-builder` installs workspace dependencies and builds Next.js production bundles).
    - The final runner image is highly optimized, containing only minimal runtimes (Python, Node, Bun, `postgresql-client`) and the compiled Go binary. The Go compiler and source codes are completely stripped out to minimize image size.
    - Starts the Next.js Frontend in optimized production mode (`bun run start`).

---

## 📊 Container Management

When running the Docker environments, the following ports are mapped on your host machine:

- **Frontend Portal**: [http://localhost:3001](http://localhost:3001)
- **Developer Dashboard**: [http://localhost:3002](http://localhost:3002)
- **Proxy Gateway**: [http://localhost:3003](http://localhost:3003)
- **Postgres Database (Direct)**: port `5433` (maps to internal PostgreSQL port `5432`)

### Common Management Commands:

*   **Run Test Suite inside Development Container**:
    ```bash
    docker compose -f docker/development/docker-compose.yaml exec app bun test
    ```
*   **Stop the Stack (Development)**:
    ```bash
    docker compose -f docker/development/docker-compose.yaml down
    ```
*   **Tear down & Wipe Database Volumes (Development)**:
    ```bash
    docker compose -f docker/development/docker-compose.yaml down -v
    ```
