# Docker Environment

Using Docker and Docker Compose, you can launch the SG Forge platform, its PostgreSQL database, and all test reference applications with a single command—with **zero host dependencies** (no local Bun, Python, Go, or Postgres installations required).

---

## ⚡ Quick Start

### 1. Launch the Stack
You can launch the containers in development or production mode using our runner script:

*   **Development Mode**: Mounts local directories for hot-reloading and loads `config/envs/docker.development.env`.
    ```bash
    ./run.sh docker dev
    ```
*   **Production Mode**: Builds the production bundle and loads `config/envs/docker.production.env`.
    ```bash
    ./run.sh docker sandbox
    ```

### 2. Access the Applications
Once the containers are running, the following ports will be mapped on your host:
*   **Host Portal UI**: [http://localhost:3001](http://localhost:3001)
*   **Dev Dashboard**: [http://localhost:3002](http://localhost:3002)
*   **Developer Proxy Gateway**: [http://localhost:3003](http://localhost:3003)
*   **Postgres Database (Direct)**: port `5433` (as defined in `docker-compose.yaml` port mapping under the development or production config)

---

## 🏗 Container Architecture

The project contains two distinct Docker configurations separated into development and production folders for clarity and optimization:

1. **Development Environment (`docker/development/`)**:
   - Dockerfile and Docker Compose mount the host workspace (`../..:/app`) with node_modules overrides.
   - It supports hot-reloading (via `bun --watch` and Next.js dev server).
   - The Docker image does NOT copy source code or compile Next.js at build time, resulting in extremely fast container generation.
2. **Production Environment (`docker/production/`)**:
   - Dockerfile uses multi-stage builds (Go compiling in `go-builder`, Next.js bundling in `js-builder`) to produce a highly optimized, minimal final image with no Go compiler or build dependencies.
   - No host directories are mounted, ensuring absolute sandbox isolation.
   - Run services (Dashboard, Expenses, Python, Proxy, Next.js) in optimized production runtimes.

---

## 📊 Container Management Commands

### Run Tests inside Docker (Development)
Verify container services are fully operational by executing the test suite directly inside the running development container environment:
```bash
docker compose -f docker/development/docker-compose.yaml exec app bun run test
```

### Stop the Containers (Development)
Stop the services and preserve database tables:
```bash
docker compose -f docker/development/docker-compose.yaml down
```

### Reset Database State (Development - Destructive)
Stop services and completely clear the database volume to start fresh:
```bash
docker compose -f docker/development/docker-compose.yaml down -v
```

