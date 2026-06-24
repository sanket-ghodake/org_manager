# Isolated SG_Dashboard Forge App

## 1. Context Profile
* **Domain:** Independent Containerized Third-Party Application.
* **Role:** Serves as a standalone isolated demonstration application running on port 8095 with its own backend and frontend code to demonstrate secure SSO/OAuth authorization flows and TRR Strategy Dashboard features.

## 2. Network Target Mappings
* **Active Port:** `8095`
* **Routing Mode:** `standalone`
* **Environment Keys Required:**
  * `PORT`: `8095`
  * `CLIENT_ID`: `client_sg_dashboard`
  * `CLIENT_SECRET`: `secret_sg_dashboard`
  * `PORTAL_INTERNAL_URL`: Internal backchannel to the portal framework (e.g. `http://app:3001` or `http://localhost:3001`).

## 3. Storage Tier Isolation
* **Schema Namespace:** N/A (Connects to its own isolated libSQL/SQLite database instance rather than using PostgreSQL schema namespaces in the main DB).

## 4. Independent Execution Command
To run this application independently, execute the orchestration script from the root:
```bash
./test/scripts/run-sg-dashboard.sh
```
Or run its docker compose directly from the test folder:
```bash
docker compose -f test/apps/sg-dashboard/docker-compose.yml up -d --build
```
