# System Architecture & Topology: SG Dashboard

This document details the high-performance design, service communication patterns, network configuration, and optimization strategies for the **SG Dashboard** microservice.

> [!NOTE]
> This guide is structured for both software developers and non-technical stakeholders. Each section includes a **"In Simple Terms"** callout to explain the concepts in plain English.

---

## 1. System Topology & Data Integration

The SG Dashboard is built as an isolated microservice within the Forge application network. It functions as a satellite database and API worker that connects securely back to the parent Organization Portal Core.

```
+------------------------------------------------------------+
|                       CLIENT BROWSER                       |
|  +------------------+  +-----------------+  +------------+ |
|  | Vanilla UI       |  | App Controller  |  | API Client | |
|  | (ui.js)          |  | (app.js)        |  | (api.js)   | |
|  +------------------+  +-----------------+  +------------+ |
+------------------------------------------------------------+
                                |
                   HTTPS / JSON | API Requests
                                v
+------------------------------------------------------------+
|                    SG DASHBOARD BACKEND                    |
|                    (Fastify Server @ 8095)                 |
|                                                            |
|          +-----------------+   +----------------+          |
|          | JWT Validation  |-->| API Route      |          |
|          | (auth.ts)       |   | Handler        |          |
|          +-----------------+   +----------------+          |
|                                        |                   |
|                   Local Transaction    | S2S Directory     |
|                   Read/Write           | Sync (OAuth2)     |
|                   v                    v                   |
|           +---------------+    +----------------+          |
|           | SQLite DB     |    | Portal Client  |          |
|           | (local.db)    |    | (portal.ts)    |          |
|           +---------------+    +----------------+          |
+----------------------------------------|-------------------+
                                         |
                                         | Server-to-Server
                                         | API Exchange
                                         v
+------------------------------------------------------------+
|                     ORG PORTAL CORE                        |
|                  (Next.js Server @ 3001)                   |
|           +---------------+    +----------------+          |
|           | Core Database |<---| Directory API  |          |
|           | (Postgres)    |    | /api/directory |          |
|           +---------------+    +----------------+          |
+------------------------------------------------------------+
```

### In Simple Terms:
Think of the system as a satellite office:
* **The Main Office (Org Portal Core):** Holds the master copy of all company data, employee directories, and security systems.
* **The Satellite Office (SG Dashboard Backend):** Has its own file cabinet (**Local SQLite DB**). It handles all day-to-day transactions (editing cards, priority updates) locally without having to call the main office.
* **The Web Page (Browser):** The user interface displaying information to the employee or manager.
* **S2S Connection:** A private, secure phone line connecting the satellite office database to the main office database to synchronize employee lists.

---

## 2. Authentication & Security Handshake

The application uses a secure single-sign-on (SSO) system. Once a user logs in, they are issued a secure passkey (JWT) to authenticate their requests.

```
 Employee Browser             SG Dashboard App             Dashboard Backend            Org Portal Core
        |                            |                            |                            |
        |--- (1. Clicks Login) ----->|                            |                            |
        |                            |--- (2. Auth Redirect) --------------------------------->|
        |<-- (3. User Credentials) ------------------------------------------------------------|
        |--- (4. Enter password) ------------------------------------------------------------->|
        |<-- (5. Redirect with Code) ----------------------------------------------------------|
        |--- (6. Send Code) -------->|                            |                            |
        |                            |---- (7. Exchange Code) --->|                            |
        |                            |                            |--- (8. Verify Code) ------>|
        |                            |                            |<-- (9. User Profile EID) --|
        |                            |                            |---- [Save User locally]    |
        |                            |                            |---- [Issue Local JWT]      |
        |                            |<--- (10. Return JWT) ------|                            |
        |<-- (11. Session Ready) ----|                            |                            |
```

### In Simple Terms:
Logging in is like getting a secure security badge at an office building:
1. You request to enter the application.
2. The app redirects you to the main company login page (**Org Portal Core**).
3. You enter your credentials (username/password).
4. The main portal confirms who you are and sends a digital code to the dashboard app.
5. The dashboard backend exchanges this code with the main portal for your user profile.
6. The dashboard backend prints a signed digital badge (**JWT token**) and hands it to your browser.
7. For the rest of the day, your browser shows this digital badge to the backend database to prove who you are, avoiding the need to retype your password.

---

## 3. High-Performance Caching & Search Strategy

To support **1,000+ concurrent users** without slowing down, the system shifts search workloads to the client's browser.

### 3.1 Local User Directory Cache
* **Single Batch Sync:** At startup, the frontend downloads the synchronized user directory structure (`GET /api/directory`) and stores it in browser memory.
* **Keystroke Search:** Autocomplete inputs search directly within this in-memory list, eliminating database query delay.

> **In Simple Terms:**
> Instead of querying the database every time you type a character in the search bar, the app downloads a phone directory list once when you log in. When you search, the browser instantly filters this local list in memory. This prevents the database from slowing down when hundreds of people search at the same time.

---

## 4. WAL (Write-Ahead Logging) Database Setup
The SQLite database engine is optimized with concurrent processing configurations:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
```

### In Simple Terms:
In standard databases, if someone is writing a document, other people are locked out of reading it. The SG Dashboard database operates in **WAL (Write-Ahead Logging) Mode**, which is like having two separate books: a read ledger and a draft log.
* Multiple people can write to the draft log at the same time others are reading the ledger.
* This avoids "database busy" lockups and makes sure the system remains responsive.
