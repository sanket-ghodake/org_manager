# Modular Corporate Portal Engine

A standalone, plug-and-play organizational workspace engine. It features stateless JSON sessions, forced password update redirection pipelines, and an administrative SQL workbench console with role privilege validation guards.

## 🚀 Getting Started

### Prerequisites
1. **Node.js or Bun:** (Bun version 1.2.0 is fetched locally into `portables/` by the setup script).
2. **PostgreSQL Instance:** A database instance must be running. If using Docker:
   * Connection string is loaded from `.env` (`DATABASE_URL=postgres://<user>:<password>@localhost:5432/<db_name>`).

### Setup and Install
Configure environment dependencies and seed database structure:
```bash
bun run setup
```
*(This triggers `scripts/setup.sh` which downloads Bun, installs root packages, and initializes the local database).*

### Run the Dev Server
Launch the Next.js portal application:
```bash
bun run run-dev
```
*(This triggers `scripts/run.sh` which runs the frontend dev server at `http://localhost:3000`).*

---

## 📁 Project Directory Map
Detailed guides are available inside the `README.md` files of each directory:
* **[docs/history/](file:///home/sanket/Desktop/Sanket/org_website/docs/history/README.md):** Sequential implementation logs.
* **[scripts/](file:///home/sanket/Desktop/Sanket/org_website/scripts/README.md):** Dev environment orchestration scripts.
* **[src/](file:///home/sanket/Desktop/Sanket/org_website/src/README.md):** Main codebase.
  * **[src/frontend/](file:///home/sanket/Desktop/Sanket/org_website/src/frontend/README.md):** Next.js App Router client interface.
  * **[src/backend/](file:///home/sanket/Desktop/Sanket/org_website/src/backend/README.md):** Stateless session logic and middleware guards.
  * **[src/database/](file:///home/sanket/Desktop/Sanket/org_website/src/database/README.md):** Database schemas and migration configurations.
  * **[src/apps/](file:///home/sanket/Desktop/Sanket/org_website/src/apps/README.md):** Plug-and-play sandbox micro-apps.
* **[test/](file:///home/sanket/Desktop/Sanket/org_website/test/README.md):** Quality checks and coverage paths.

---

## 🛠 Features Matrix

### 1. Stateless Authentication & Forced Password Intercept
* **Login Flow:** Users authenticating at `/login` are initially flagged with `isPasswordChanged = false`.
* **Guard Middleware:** The Next.js request pipeline forwards calls to `src/backend/middleware/authGuard.ts`. If the user has not changed their default credentials, they are intercepted and forced into `/force-reset`.
* **Access Grant:** Saving an updated password updates the session token to `isPasswordChanged = true`, granting dashboard clearance.

### 2. Administrative SQL Workbench
An interactive database administration console is hosted directly on the main dashboard (`/`):
* **Simulation Roles:** Swap between `super_admin` (full database access) and `read_only_admin`.
* **Privilege Guard:** In read-only mode, queries matching destructive commands (`DROP`, `DELETE`, `TRUNCATE`, `ALTER`) are blocked, preserving database structure.
* **Log buffer:** Includes quick buttons to insert events into the Postgres logger table, testing the rolling 100,000 log capacity buffer constraint.

### 3. Dynamic Themes Matrix
The layout supports three curated, vibrant design themes:
* **Light Mode:** High contrast, minimal light styling.
* **Dark Mode:** Sleek, high-end dark slate preset.
* **Cyberpunk Mode:** Neon cyan and magenta dark mode.
*(Color switches occur instantly on the client by toggling the `data-theme` attribute on the root HTML document).*

---

## 📊 Developer Tooling

### Graphify Knowledge Graph
Analyze code dependencies and community modules by checking:
* Graph JSON: `graphify-out/graph.json`
* Visualization: `graphify-out/graph.html`
* Freshness report: `graphify-out/GRAPH_REPORT.md`

### RTK (Rust Token Killer)
Optimize token overhead during command execution:
* Run Git status: `rtk git status`
* Commit changes: `rtk git commit -m "message"`
