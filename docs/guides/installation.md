# Installation & Setup

Follow these steps to set up and launch the SG Forge platform on your local machine (Linux/WSL).

---

## 📋 Prerequisites

### 1. Runtimes & Tooling
*   **Git**: Required to clone the repository.
*   **Bun**: Bun is used for fast JS/TS dependency management and running tests.
*   **Go** (Optional): Required to run the Go reference micro-app (`sandbox/apps/reference-go`).
*   **Python 3** (Optional): Required to run the Python reference micro-app (`sandbox/apps/reference-python`).

### 2. Database (Postgres)
Ensure a PostgreSQL database is available. 
*   **For Portable execution**: The setup launches a Postgres container automatically inside Docker, mapping port `5433` locally.
*   **For Docker execution**: The database is fully automated within the docker network on port `5432`.

---

## 🚀 Step-by-Step Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/sanket-ghodake/org_manager.git sgforge
cd sgforge
```

### Step 2: Initialize dependencies
The setup script configures dependencies and runs database initializers:
```bash
bun run setup
```
*(Alternatively, run `bash scripts/portable/development/setup.sh` directly).*

### Step 3: Run Tests to Verify Setup
Run the unified test suite to make sure the platform, authorization guard, and permissions work correctly:
```bash
bun run test
```

### Step 4: Run the Development Server
You can launch the stack either natively (`portable` mode) or inside containers (`docker` mode):

#### A. Run in Portable Mode (Recommended for Local Dev)
Runs Node/Bun processes directly on your host machine while pointing to a dockerized database container.
```bash
bun run run-dev
```
*(Alternatively, run `./run.sh portable dev`)*

#### B. Run in Full Docker Mode
Builds and runs all core services and micro-apps in isolated Docker containers.
```bash
bun run run-docker
```
*(Alternatively, run `./run.sh docker dev`)*

Once started:
*   **Portal UI**: `http://localhost:3001`
*   **Dev Dashboard**: `http://localhost:3002`
*   **Developer Proxy Gateway**: `http://localhost:3003`
