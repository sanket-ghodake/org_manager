# Source Directory (`src/`)

This directory houses the primary source code of the Modular Corporate Portal Engine.

## Subdirectories:
* **`/frontend/`:** Next.js App Router workspace housing user interfaces, styling tokens, and pages.
* **`/backend/`:** Authentication, stateless session managers, and administration validation guards.
* **`/database/`:** Drizzle database tables layout schema, client pools, and seed routines.
* **`/apps/`:** Isolated plug-and-play workspace for third-party or sub-routes micro-apps.

## Structural Rules & Guidelines:
1. **Dependency Separation:** Do not import frontend-specific packages (like `next/navigation` or React components) inside backend or database modules.
2. **Relative Cross-Imports:** When importing backend logic (like auth helpers or database connections) inside the Next.js frontend, use relative paths (e.g., `../../backend/...`) rather than bundler path aliases to prevent compilation and environment conflicts.
3. **Type Safety:** Always verify code updates using typescript compiler checks (`bunx tsc --noEmit`) before committing.
