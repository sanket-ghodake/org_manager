# REST API Reference Manual

This document details the backend REST API specifications for the **SG Dashboard** application.

> [!NOTE]
> This guide is structured for both software developers and non-technical stakeholders. Each section includes a **"In Simple Terms"** callout to explain the concepts in plain English.

---

## 1. Core Authentication APIs

### 1.1 Federated SSO Handshake (`POST /api/auth`)
* **Request:** `{ "code": "ss_code_value" }`
* **Response (200 OK):**
  ```json
  { "success": true, "token": "eyJhbGciOi...", "user": { "id": "EID-1234", "name": "Arthur" } }
  ```

> **In Simple Terms:**
> When you log in, this is the connection endpoint that converts your temporary verification code into a permanent digital badge (session token) that proves who you are.

### 1.2 User Directory Lookups (`GET /api/directory`)
* **Params:** `q` (search term), `managerId` (retrieve reports)
* **Response:** `{ "users": [...] }`

> **In Simple Terms:**
> This behaves like an internal directory query. The app calls this to look up employee details, designation titles, or manager reporting lines when rendering org chart profiles.

---

## 2. Plan Board APIs

### 2.1 Fetch Active Dashboard Structure (`GET /api/dashboard`)
* **Params:** `dashboardId` (Optional UUID)
* **Response:** `{ "dashboard": { ... }, "items": [ ... ], "links": [ ... ] }`

> **In Simple Terms:**
> This retrieves all the cards and connection lines on your active board. If you open the dashboard page, this endpoint loads the objective statements, skill cards, skill gaps, and connection links to draw them on your screen.

### 2.2 Add Plan Card (`POST /api/dashboard/:id/items`)
* **Request:** `{ "section": "gap", "category": "Critical", "title": "Database Scaling" }`

> **In Simple Terms:**
> This creates a new card on your board. For example, if you type "Database Scaling" under the Skill Gaps column and hit enter, this endpoint saves the card to the database.

### 2.3 Update Plan Card (`PUT /api/dashboard/items/:itemId`)
* **Request:** `{ "title": "AWS Cloud Orchestration", "status": "in_progress" }`

> **In Simple Terms:**
> This saves edits you make to an existing card, such as editing its title, moving its status from "Not Started" to "In Progress", or changing its target quarter.

### 2.4 Delete Plan Card (`DELETE /api/dashboard/items/:itemId`)

> **In Simple Terms:**
> This removes a card from your board, deleting it and any connection lines pointing to or from it.

### 2.5 Save Dashboard Version (`POST /api/dashboard/:id/versions`)
* **Request:** `{ "version_name": "Q3 Final Draft" }`

> **In Simple Terms:**
> Creates a snapshot checkpoint of your board. It captures the arrangement of your cards and links at that specific moment, allowing you to rollback or restore it later.

---

## 3. Submissions & Approval APIs

### 3.1 Create Submission Request (`POST /api/submissions`)
* **Request:** `{ "employee_id": "EID-1234", "deadline": "2026-07-31" }`

> **In Simple Terms:**
> Used by managers to request a review. It sets a deadline (e.g. "Submit by July 31st") for the employee and logs the request.

### 3.2 Submit Plan (`POST /api/submissions/:id/submit`)

> **In Simple Terms:**
> Submitted by the employee. It locks the dashboard to a read-only state and flags it for the manager's review.

### 3.3 Review Decision (`POST /api/submissions/:id/review`)
* **Request:** `{ "status": "Approved" | "Needs Revision", "feedback": "Nice job!" }`

> **In Simple Terms:**
> Used by managers to log their review. They can select **Approve** (locking the plan permanently for the cycle) or **Request Revision** (unlocking the plan so the employee can make changes).
