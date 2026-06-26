# Frontend Architecture & Modular Design

This document details the interface layout structure, state management, styling configurations, and component logic implemented in the **SG Dashboard** single-page application (SPA).

> [!NOTE]
> This guide is structured for both software developers and non-technical stakeholders. Each section includes a **"In Simple Terms"** callout to explain the concepts in plain English.

---

## 1. Single-Page Application (SPA) Design

The client interface is built using standard web files (HTML/JS/CSS) and runs directly in the user's browser without requiring a compilation build step.

### 1.1 Directory Structure
* **`index.html`**: Defines the physical page structure (headers, columns, overlays, popups, and sidebars).
* **`styles.css`**: Controls the styling (colors, grid spacing, glassmorphism cards, light/dark themes, and hover animations).
* **`js/`**: Contains the JavaScript code files that control logic.

> **In Simple Terms:**
> The frontend runs entirely inside your web browser. Instead of building a complex system that needs to be compiled, the app uses standard web components that run immediately. This ensures pages load quickly.

---

## 2. Dynamic Styling System (CSS Variables)

Styling uses TailwindCSS classes combined with custom CSS theme variables. Themes are applied dynamically by modifying the `data-theme` attribute on the page's `<html>` element.

### 2.1 Color Tokens Configuration
```css
:root, [data-theme="default"] {
  --bg-primary: #0a0f1d;
  --bg-card: #131a30;
  --text-primary: #f8fafc;
}
[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-card: #ffffff;
  --text-primary: #0f172a;
}
```

> **In Simple Terms:**
> When you click the moon/sun icon in the top right, the app changes the theme settings of the web page. This swap changes the color variables (like turning dark blue card backgrounds into white card backgrounds) to update the interface theme.

---

## 3. Core Frontend Components

### 3.1 3-Column Plan Board
Renders the development plan board.
* **Column 1 (Key Skills):** Lists required technical and strategic skills, and supports keyboard autocomplete suggestions.
* **Column 2 (Skill Gaps):** Lists identified gaps. Severity status tags (Low, Medium, Critical) can be cycled on click.
* **Column 3 (Training Plans):** Renders action plans. Includes status toggles, target quarters, and actual completion quarter selections.

> **In Simple Terms:**
> The plan board behaves like a digital whiteboard. You have three columns representing different stages of your development path:
> 1. What skills you need.
> 2. Where you have gaps.
> 3. How you plan to resolve those gaps.
> Clicking on badges lets you cycle through options (like changing severity from "Medium" to "Critical") or link cards together.

### 3.2 Side-by-Side Review Panel
* **Purpose:** Allows managers to review submission requests alongside the active workspace.
* **Functionality:** Keeps the active workspace visible on the left while sliding in a review panel on the right. Binds mouse-drag events, allowing managers to scale the split screen view.

> **In Simple Terms:**
> When a manager reviews an employee's plan, the app opens a split-screen view. The manager can see the employee's board on the left and log feedback/approvals in the panel on the right. Managers can resize this split screen by dragging the separator line.

---

## 4. Org Chart Explorer Implementation

The Org Chart Explorer visualizes reporting relationships relative to the selected employee.

```
           +---------------------------------------------+
           |               Upline Director               |
           |             (L6 Senior Manager)             |
           +---------------------------------------------+
                                  |
                                  v
           +---------------------------------------------+
           |             Focus Manager Node              |
           |             (L5 Manager / Self)             |
           +---------------------------------------------+
             /                  |                      \
            /                   |                       \
           v                    v                        v
+-----------------+   +-----------------+   +-----------------+
|   Team Peer A   |   |   Team Peer B   |   |   Team Peer C   |
| (L4 Software Eng) |   | (L4 Software Eng) |   | (L3 Software Eng) |
+-----------------+   +-----------------+   +-----------------+
                                |
                                v
                      +-------------------+
                      | Direct Report X   |
                      | (L3 Associate Eng)|
                      +-------------------+
```

### 4.1 Rendering Process
* **Focus Node:** Displays the active employee profile.
* **Upline Node:** Displays the employee's direct manager.
* **Sibling & Subordinate Nodes:** Displays peers and direct reports.

> **In Simple Terms:**
> The Org Chart Explorer renders your team structure like a family tree. It centers around the selected user (Focus Node), displaying their manager above them, their peers side-by-side, and their reports below them. You can click on any card in the chart to navigate and center the view on that person.
