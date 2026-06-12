# Milestone 07: Semantic Org Canvas, Onboarding Wizard, and Bulk Ingestion

## Summary of Changes

Implemented a set of interactive tools for the enterprise organization portal to elevate the user experience from static corporate pages to a high-density, tactile desktop application.

### Key Features Implemented

1. **Semantic Zoom Workspace Canvas**:
   - An infinite-canvas style org layout equipped with drag-to-pan and mousewheel-to-zoom controls.
   - Dynamic layouts calculated on client render via a parent-centering hierarchical tree-layout algorithm.
   - Three distinct semantic zoom states:
     - **Macro View (<80% zoom)**: Summarizes departments (verticals) in large bento-box panels with employee counts and directory lists.
     - **Meso View (80%-140% zoom)**: Displays manager clusters connected via bezier curves.
     - **Micro View (>=140% zoom)**: Displays high-fidelity card profiles with Name, Designation, EID, and a glowing active indicator dot.
   - **Where Am I? Navigation**: Floating locator button that centers, zooms in on the logged-in user, and highlights the reporting line path up to the CEO.

2. **Onboarding reset password flow**:
   - A centered configuration modal wizard loaded on initial login if `isPasswordChanged === false`:
     - **Step 1**: Welcome card displaying user EID.
     - **Step 2**: Temporary password validation step.
     - **Step 3**: Interactive password strength checker displaying color shifts (warning amber to success green) and score meters.
     - **Step 4**: Celebratory micro-transition and immediate transition to the main dashboard.

3. **Admin Ingestion & Validation Drawer**:
   - Drag-and-drop CSV upload panel.
   - A split-screen validation drawer showing raw text inputs (left) and editable visual checklist cells (right).
   - Allows inline editing to resolve invalid data directly in the browser before committing data.
   - Connects to a bulk ingestion endpoint that inserts or updates users and automatically registers designation and vertical links in the structural metadata table.

4. **SQL Workbench Studio**:
   - A developer console in dark styling:
     - **Left panel**: Schema tree listing tables (`users`, `structural_metadata`, `system_logs`), column details, indexes, and a capacity gauge measuring rows against the 100k cap.
     - **Right top panel**: SQL terminal with syntax keyword color highlighting.
     - **Right bottom panel**: Paginated results table with sticky headers.

5. **Keyboard Omni-Search**:
   - Search modal overlay activated globally via `Cmd + K` or `Ctrl + K`.
   - Links to pages, theme toggles, density shifts, and employee search (clicking an employee pans and focuses the canvas on their node).

6. **Density Settings**:
   - Toggles layout between Comfortable and Compact styles, modifying text sizes, paddings, and borders.

## File Level Modifications

- **`src/database/initialize-local-db.ts`**: Upgraded database seeding logic to build a rich corporate hierarchy structure with vertical divisions, designation links, and reports reporting to managers.
- **`src/frontend/app/globals.css`**: Configured custom CSS variables under Tailwind `@theme` tag mapping primary text, secondary text, border, success, and warning colors.
- **`src/frontend/app/page.tsx`**: Replaced dashboard view with the interactive canvas, bulk ingestion panel, metadata configuration table, database console, density manager, and search.
- **`src/frontend/app/force-reset/page.tsx`**: Created the centered multi-step onboarding wizard.
- **`src/frontend/app/api/admin/bulk-ingest/route.ts`**: Implemented CSV parser endpoint resolving metadata IDs.
- **`src/frontend/app/api/admin/metadata/route.ts`**: Implemented CRUD API supporting metadata updates.
