# Database Schema & Relational Design

This document details the database architecture of the **SG Dashboard** application. It describes how information is organized, how tables connect, and what automatic database rules are in place.

> [!NOTE]
> This guide is structured for both software developers and non-technical stakeholders. Each section includes a **"In Simple Terms"** callout to explain the concepts in plain English.

---

## 1. Relational Map (Entity-Relationship Diagram)

Below is the visual relationship map of the database tables.

```
 +-----------------+          +-------------------------+
 |      users      |          |   submission_requests   |
 |-----------------|          |-------------------------|
 | id  (PK)        |o1------o{| id  (PK)                |
 | name            |          | manager_id  (FK)        |
 | email           |o1------o{| employee_id (FK)        |
 | role            |          | deadline                |
 | manager_id (FK) |          | status                  |
 | designation     |          +-------------------------+
 +-----------------+                       
          |                                
          | 1                              
          |                                
          o{                               
 +-----------------+          +-------------------------+
 |   dashboards    |          |    dashboard_versions   |
 |-----------------|          |-------------------------|
 | id (PK)         |o1------o{| id (PK)                 |
 | user_id (FK)    |          | dashboard_id (FK)       |
 | program_line    |          | snapshot (JSON)         |
 | is_deleted      |          +-------------------------+
 +-----------------+
          |
          | 1
          +------------------------+
          |                        |
          o{                       o{
 +-----------------+      +-------------------------+
 | dashboard_items |      |  dashboard_item_links   |
 |-----------------|      |-------------------------|
 | id (PK)         |o1--o{| id (PK)                 |
 | section         |      | dashboard_id (FK)       |
 | title           |o1--o{| source_id (FK)          |
 | status          |o1--o{| target_id (FK)          |
 +-----------------+      +-------------------------+
```

### Connector Legend:
* `o1------o{` represents a **One-to-Many** relationship. For example, one user can have multiple dashboard entries or submission requests.
* `PK` = **Primary Key** (the unique identification code for that record).
* `FK` = **Foreign Key** (links a row in this table back to another table).

### In Simple Terms:
* **Users (Employees)** own **Dashboards (Development Plans)**.
* An employee's plan is composed of individual **Dashboard Items (Cards)** representing skills, gaps, or training tasks.
* Users can draw connection lines (**Dashboard Item Links**) between these cards.
* A dashboard can have saved snapshots (**Dashboard Versions**) to back up or restore states.
* Managers can issue **Submission Requests (Verification Deadlines)** to employees to review and lock their active plan.

---

## 2. Table Details

### 2.1 Table: `users`
Syncs profile details and company hierarchies from the main directory.
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('Employee', 'Manager', 'Admin')),
  manager_id TEXT,
  designation TEXT,
  FOREIGN KEY(manager_id) REFERENCES users(id)
);
```

#### Fields Details:
* `id`: Employee's unique ID (EID). Mapped as the primary identifier.
* `name`: Full display name.
* `email`: Organizational e-mail (must be unique).
* `role`: User authority level (`Employee`, `Manager`, or `Admin`).
* `manager_id`: Points to the `id` of the user's manager, defining the reporting chain.
* `designation`: Current job title (e.g. "L5 Software Engineer").

> **In Simple Terms:**
> This table is the company directory. It lists who everyone is, what their job title is, and who their manager is. For example, if employee "John Doe" reports to manager "Sarah Smith", John's profile will list Sarah's ID in the `manager_id` field.

---

### 2.2 Table: `dashboards`
Stores individual program-specific plans.
```sql
CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  program_line TEXT DEFAULT 'Default Program',
  objective TEXT,
  notes TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Fields Details:
* `id`: Unique identifier (UUID) for this dashboard.
* `user_id`: Owner of this dashboard (foreign key linking back to `users`).
* `program_line`: Name of the program (e.g. "Cloud Migration Strategy").
* `objective`: Development objective statement.
* `notes`: Additional comments or manager feedback notes.
* `is_deleted`: Flag tracking if the board has been deleted (0 = Active, 1 = Moved to Trash).
* `deleted_at`: ISO timestamp tracking when it was deleted.
* `updated_at`: Automatically updated timestamp recording the last modification.

> **In Simple Terms:**
> A dashboard is a folder for a specific program goal. An employee can have multiple dashboard folders (for example, one for "Python training" and one for "Agile training"). It holds general metadata, objective goals, and has a trash flag so it can be restored if deleted by mistake.

---

### 2.3 Table: `dashboard_versions`
Holds backups or checkpoint snapshots of historical plans.
```sql
CREATE TABLE IF NOT EXISTS dashboard_versions (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  version_name TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);
```

#### Fields Details:
* `id`: Version checkpoint ID.
* `dashboard_id`: Parent dashboard this version belongs to.
* `version_name`: Label descriptive of this checkpoint (e.g., "Final Q1 Plan").
* `snapshot`: Complete representation of the dashboard's items and links compressed into a JSON text string.
* `created_at`: The date and time the version snapshot was saved.

> **In Simple Terms:**
> Think of this as a "Save Game" slot. When you click "Save Snapshot", the app records exactly what cards and links were on your board and packs them into a single string. If you make a mistake later, you can click "Restore" to load this state.

---

### 2.4 Table: `dashboard_items`
Contains the individual cards on the 3-column plan board.
```sql
CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  section TEXT NOT NULL CHECK(section IN ('key_skill', 'gap', 'training_plan')),
  category TEXT,
  title TEXT NOT NULL,
  description TEXT,
  deadline TEXT,
  status TEXT DEFAULT 'not_started',
  target_quarter TEXT,
  completed_quarter TEXT,
  FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);
```

#### Fields Details:
* `id`: Unique identifier for the card.
* `dashboard_id`: Dashboard folder this card is placed in.
* `section`: Board column where the card resides:
  * `key_skill`: Column 1 (Key Skills Required)
  * `gap`: Column 2 (Skill Gaps)
  * `training_plan`: Column 3 (Training Plans)
* `category`: Sub-categories or priority badges (e.g. "Core:Critical", "Strategic:Low").
* `title`: Text written on the card.
* `description`: Additional detailed descriptions.
* `deadline`: Due dates.
* `status`: Progress indicators (e.g. `not_started`, `in_progress`, `completed`).
* `target_quarter` / `completed_quarter`: Quarters tracking target goals vs actual completion.

> **In Simple Terms:**
> These are the digital sticky cards you place on your board. They go in one of three columns: Skills (what you need to know), Gaps (what you need to improve), and Plans (how you are going to learn it). Each card tracks its status (not started, in progress, done) and has targets like "Q3-2026".

---

### 2.5 Table: `dashboard_item_links`
Represents the connection lines mapping dependencies between cards.
```sql
CREATE TABLE IF NOT EXISTS dashboard_item_links (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  UNIQUE(source_id, target_id),
  FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
  FOREIGN KEY(source_id) REFERENCES dashboard_items(id) ON DELETE CASCADE,
  FOREIGN KEY(target_id) REFERENCES dashboard_items(id) ON DELETE CASCADE
);
```

#### Fields Details:
* `id`: Unique ID of the connection line.
* `dashboard_id`: Parent dashboard this link belongs to.
* `source_id`: Starting card (e.g. a Key Skill).
* `target_id`: Destination card (e.g. an identified Skill Gap).
* `UNIQUE(source_id, target_id)`: Prevents creating duplicate redundant connection lines between the same two cards.

> **In Simple Terms:**
> These are the mapping strings connecting your cards. If you have a skill card like "Kubernetes" and a gap card like "Needs High Scale Knowledge", you can draw a line between them. This table logs that connection line so it gets rendered on screen.

---

### 2.6 Table: `submission_requests`
Manages formal deadlines and review sign-offs requested by managers.
```sql
CREATE TABLE IF NOT EXISTS submission_requests (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  dashboard_id TEXT,
  deadline TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Submitted', 'Approved', 'Needs Revision')),
  feedback TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  FOREIGN KEY(manager_id) REFERENCES users(id),
  FOREIGN KEY(employee_id) REFERENCES users(id),
  FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE SET NULL
);
```

#### Fields Details:
* `id`: Unique ID of the submission cycle request.
* `manager_id` / `employee_id`: The manager issuing the request and the employee completing it.
* `dashboard_id`: Dashboard targeted for submission review.
* `deadline`: Due date (YYYY-MM-DD) by which the plan must be finalized.
* `status`: Verification status:
  * `Pending`: Plan is editable by the employee.
  * `Submitted`: Dashboard is locked. Awaiting manager review.
  * `Approved`: Plan approved. Locked permanently.
  * `Needs Revision`: Manager requested updates. Dashboard is unlocked for editing.
* `feedback`: Evaluation comments logged by the manager.
* `submitted_at` / `reviewed_at`: ISO timestamp tracking when actions occurred.

> **In Simple Terms:**
> This table is the review log. A manager issues a request: "Please submit your Python Plan by July 31st". The employee works on the plan, then clicks submit. The board locks, the manager adds feedback, and either signs it off (Approved) or asks for changes (Needs Revision).

---

## 3. Database Triggers (Automatic Rules)

SQLite triggers run automatically in the background to update metadata:

### 3.1 Touch Updated At on Dashboard Items (Insert, Update, Delete)
```sql
CREATE TRIGGER trg_dashboard_items_update AFTER UPDATE ON dashboard_items BEGIN
  UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.dashboard_id;
END;
```
> **In Simple Terms:**
> Think of this as an automatic "Last Modified" timestamp. You don't have to change it yourself. Whenever you edit, add, or delete a card, this rule triggers in the background to update the date on your dashboard so managers see when changes were last made.
