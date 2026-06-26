# Operational Flows & Working Logic

This document details the step-by-step operational workflows, state changes, and background mechanics of the **SG Dashboard** application.

> [!NOTE]
> This guide is structured for both software developers and non-technical stakeholders. Each section includes a **"In Simple Terms"** callout to explain the concepts in plain English.

---

## 1. Directory Caching & Instant Search Flow

During application startup, the system caches user profiles to optimize lookups:

```
[Main Portal Core] --(1. api/directory list)--> [SG Dashboard Backend]
                                                       |
                                               (2. Upsert Local DB)
                                                       |
[Keystroke Query] <--(3. Client Filter)-- [Browser Cached Memory]
```

1. **Background Pull:** On authentication, the backend pulls the portal user directory and caches it locally.
2. **Memory Indexing:** The client maps numeric IDs to EIDs and populates the global `cachedUsers` array.
3. **Instant Search:** Inputs filter properties in-memory, avoiding round-trip database queries during character entry.

> **In Simple Terms:**
> Instead of querying the database every time you type a character in the search bar, the app downloads a phone directory list once when you log in. When you search, the browser instantly filters this local list in memory. This prevents the database from slowing down when hundreds of people search at the same time.

---

## 2. Formulation & Linkage of Strategy Items

The core planning workflow allows users to link strategic resources:

```
  COLUMN 1: KEY SKILLS       COLUMN 2: SKILL GAPS       COLUMN 3: TRAINING PLANS
+----------------------+   +----------------------+   +----------------------+
|  Card: Kubernetes    |==>| Card: Lack of Scale  |==>| Card: CKA Training   |
|  Section: key_skill  |   | Section: gap         |   | Section: training    |
|  Category: Core      |   | Category: Critical   |   | Category: Strategic  |
+----------------------+   +----------------------+   +----------------------+
```

1. **Card Addition:** Users add plans via inputs at the bottom of the columns.
2. **Category Cycling:** Clicking status indicators cycles item priorities:
   * **Key Skills:** Cycles classification (e.g. Core $\rightarrow$ Strategic).
   * **Skill Gaps:** Cycles severity level (e.g. Low $\rightarrow$ Medium $\rightarrow$ Critical).
   * **Training Plans:** Cycles action type (e.g. TIME $\rightarrow$ TRAIN $\rightarrow$ ACTION $\rightarrow$ DEADLINE).
3. **Relation Mapping:**
   * Clicking a card enters linking mode, highlighting compatible targets.
   * Clicking a target card stores the relationship in `dashboard_item_links`, drawing connection lines between the items.

> **In Simple Terms:**
> This allows you to plan out your development goals step-by-step:
> 1. You add cards detailing the skills you need, gaps you have, and training steps you will take.
> 2. You draw connecting lines between cards to show how they relate. For example, you can connect the skill "Cloud Security" to the gap "Need IAM Knowledge", and then connect that gap to your training plan "Prepare for AWS Certified Security Specialty".
> 3. The lines help you visualize how your training plan directly addresses your skill gaps.

---

## 3. Lock & Review Pipeline

Ensures data integrity during reviews:

```
[ Pending Draft ] --(1. Employee Clicks Submit)--> [ Submitted Plan ]
       |                                                   |
       |                                                   | (Dashboard Locked)
       |<---(3. Manager Requests Revision [Needs Revision])|
       |                                                   v
       |                                           [ Approved Plan ]
       |                                           (Locked Permanently)
       |
       +---(2. Deadline Passes: Background Daemon Auto-Locks)--+
```

1. **Review Request:** A manager sets a submission deadline for an employee.
2. **Auto-Submit Daemon:** When a deadline passes, the background daemon auto-submits the employee's active dashboard.
3. **Submission Lock:** Upon submission, the dashboard state changes to read-only, disabling edits.
4. **Split Screen Review:**
   * The manager inspects the plan side-by-side with feedback controls.
   * **Approved:** Signs off the plan, locking the program version.
   * **Needs Revision:** Reopens edit permissions for the employee and logs the feedback.

> **In Simple Terms:**
> This manages the review process between you and your manager:
> 1. Your manager asks you to complete a plan and sets a deadline.
> 2. Once you submit the plan, it locks to read-only so it cannot be changed during the review.
> 3. If the deadline passes before you submit, the system will automatically submit your latest draft to prevent delays.
> 4. Your manager reviews your plan. If they approve, it is signed off. If they request changes, your board unlocks so you can make updates.

---

## 4. Version Snapshots & Backups

Enables users to checkpoint and restore dashboard states:

```
[Active Workspace] --(1. Serialize JSON)--> [SQLite Snapshot Version]
        ^                                            |
        +------------(2. Restore DB Rows)------------+
```

1. **Create Version:** Clicking "Save Snapshot" serializes the active metadata, cards, and links into a JSON string, saving it to `dashboard_versions`.
2. **Rollback State:** Selecting a previous snapshot restores its data in a single database transaction, resetting the workspace view.

> **In Simple Terms:**
> Think of this as a checkpoint system. You can save a backup of your board before making large changes. If you don't like the changes, you can restore your backup to revert the board to its saved state.

---

## 5. Soft-Deletions & Trash Bin Recovery

Prevents accidental data loss when managing programs:

* **Soft Delete:** Deleting a dashboard sets `is_deleted = 1` and records `deleted_at`. It disappears from the active list but is kept in database storage.
* **History Recovery:** Deleted items are listed in the Trash Bin tab.
* **Restore:** Resets `is_deleted = 0`, restoring the dashboard and its associated items.
* **Destroy Permanently:** Drops all corresponding database records.

> **In Simple Terms:**
> Deleting a dashboard moves it to the trash instead of immediately erasing it. You can open the trash bin to restore deleted dashboards or permanently delete them if they are no longer needed.
