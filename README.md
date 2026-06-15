# SG Forge (Modular Corporate Portal Engine) - v0.1.0

SG Forge is an installable, understandable, stable, and extensible organizational workspace portal and secure sandboxing engine. It enables organizations to orchestrate internal micro-frontends (Forge Apps) written in any language (Go, Python, TypeScript) under strict sandbox boundaries and unified, stateless authentication.

---

## ⚡ Quick Start

### 1. Docker (Zero-dependency Setup)
Run the entire platform, its database, and all test reference applications with a single command:
```bash
docker-compose up --build
```
Access the services:
* **Host Portal UI:** [http://localhost:3001](http://localhost:3001)
* **Dev Dashboard / SQL Workbench:** [http://localhost:3002](http://localhost:3002)

For detailed docker instructions, see [Docker Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/DOCKER.md).

### 2. Local Installation (Linux & WSL)
Prerequisites: Postgres instance running locally. Then execute:
```bash
# Setup environment and database structure
bun run setup

# Launch Next.js portal and micro-apps in development mode
bun run run-dev
```
For detailed steps, see [Installation Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/INSTALLATION.md).

---

## 📁 Project Directory Map
Detailed guides are available in the `docs` folder:
* **[Project Vision](file:///home/sanket/Desktop/Sanket/org_website/docs/PROJECT_VISION.md):** Core philosophies and long-term strategic roadmap.
* **[System Architecture](file:///home/sanket/Desktop/Sanket/org_website/docs/ARCHITECTURE.md):** Topology diagrams, authentication sequence, and database schemas.
* **[App Developer Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/APP_DEVELOPER_GUIDE.md):** Designing apps, manifest JSON fields, and SDK helpers.
* **[Security Guidelines](file:///home/sanket/Desktop/Sanket/org_website/docs/SECURITY.md):** Threat modeling, iframe sandboxing, and connection locks.
* **[WSL Guide](file:///home/sanket/Desktop/Sanket/org_website/docs/WSL.md):** Service management and networking configurations in WSL/WSL2.
* **[Release Notes v0.1.0](file:///home/sanket/Desktop/Sanket/org_website/docs/RELEASE_NOTES_v0.1.0.md):** Highlights and runtime dependency matrix.
* **[Forge App Security Rules](file:///home/sanket/Desktop/Sanket/org_website/FORGE_APP_SECURITY_RULES.md):** Global platform security policies.

---

## 🛠 Features Matrix

### 1. Stateless Authentication & Secure Handshake
* **Zero-Cookie Sharing:** Forge Apps run on distinct origins/ports and do not read parent cookies.
* **Exchange flow:** The portal issues a short-lived authorization code. The app's backend trades it via a secure API request for a JWT access token.
* **Role Gating:** Hierarchical permissions resolved using recursive CTE queries in PostgreSQL.

### 2. Strict Iframe Sandboxing
* **Isolation:** Apps load in iframes with `sandbox="allow-scripts allow-forms"`, blocking access to parent DOM, cookies, and preventing top-level page redirection.
* **PostMessage SDK:** Real-time parent navigation notifications and theme-syncing capabilities.

### 3. Administrative SQL Workbench
* **Privilege Guard:** Restricts workbench execution to administrative roles (`super_admin`, `admin`, `read_only_admin`).
* **Command Filter:** Blocks destructive queries (`DROP`, `DELETE`, `ALTER`) on read-only profiles.
* **Read-Only Connection Pool:** Restricts write transactions at the PostgreSQL driver layer.
