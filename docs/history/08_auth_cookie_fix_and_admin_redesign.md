# Milestone 08: Auth Cookie Bug Fix, Passive Event Fix & Admin UI Redesign

## Summary

This milestone fixes two critical runtime bugs discovered during manual QA and delivers
a complete redesign of the Admin Panel tab into a multi-section, premium command center.

---

## Bug 01 — Session Cookie `=` Padding Breaks `atob()` (Root Cause of Login Loop)

### Symptom
- After clicking **Authenticate**, the page appeared to "refresh" and stay on `/login`.
- After completing Force-Reset, the dashboard showed a white screen or infinite spinner.
- The super admin's new password (`Sunil@01`) would not work despite the API returning HTTP 200.

### Root Cause
The session token was stored as a raw **base64** string in the `session_token` cookie.
Base64 strings use `=` as padding characters. The browser and Next.js's `response.cookies.set()`
sometimes double-encoded `=` to `%3D`, then to `%253D`, making the cookie value:

```
eyJ...X0%253D  (double URL-encoded — BROKEN)
```

When the client read `document.cookie` and called `atob(value)`:
- `atob('%3D')` → throws `InvalidCharacterError`
- The `catch` block then called `router.replace('/login')` — creating an **infinite bounce loop**
- The user saw only a page "refresh" because the navigation back to login was instant

### Fix Applied
Switched all cookie session tokens to **base64url** encoding:
- `+` → `-`
- `/` → `_`
- `=` removed entirely (padding stripped)

Base64url is the industry standard for JWT/cookie-safe tokens (RFC 4648 §5).
All four touch-points were updated consistently:

| File | Change |
|------|--------|
| `src/frontend/app/api/auth/login/route.ts` | Encode session with base64url before `cookies.set()` |
| `src/frontend/app/api/auth/reset-password/route.ts` | Same base64url encoding |
| `src/backend/auth/sessionManager.ts` | Decode base64url (restore `-`→`+`, `_`→`/`, re-add `=` padding) before `Buffer.from()` |
| `src/frontend/app/page.tsx` | Same client-side base64url decode before `atob()` |
| `src/frontend/app/force-reset/page.tsx` | Same client-side base64url decode before `atob()` |

### Additional Fixes in This Session
- **Login page stale cookie**: Added `useEffect` on mount to clear any stale `session_token` cookie — prevents old sessions from redirecting new logins to `/force-reset`.
- **Login page pre-fill removed**: Removed hardcoded `admin@acmecorp.com / password123` defaults from input `useState` — was causing confusion after super admin password change.
- **Post-login redirect check**: After successful login, checks `data.user.isPasswordChanged === false` and redirects to `/force-reset` if needed — previously always went to `/`.
- **`router.refresh()` removed from login**: Calling `router.refresh()` after `router.replace()` was re-rendering the login page server components before navigation completed, appearing as a "page refresh".
- **`router.replace()` vs `router.push()`**: Changed all auth redirects to `replace()` so the browser back button cannot loop back to the login or force-reset screens.
- **Dashboard loading guard**: Added `isSessionLoading` state with a spinner guard to prevent the blank white screen between page mount and session cookie resolution.

---

## Bug 02 — `Unable to preventDefault inside passive event listener`

### Symptom
Console warning: `page.tsx:277 Unable to preventDefault inside passive event listener invocation`

### Root Cause
The `onWheel` React synthetic event handler calls `e.preventDefault()` to block page scroll
during canvas zoom. React 17+ attaches wheel event listeners as **passive by default** for
performance — passive listeners cannot call `preventDefault()`.

### Fix Applied
Replaced the `onWheel` React prop with a manual `addEventListener('wheel', handler, { passive: false })`
attached via `useEffect` on the canvas `ref`. This explicitly opts out of passive mode for that
specific element only.

---

## Feature — Admin Panel UI Complete Redesign

### Problem
The old admin panel was a flat two-column grid with minimal visual hierarchy. The bulk
ingestion and structure matrix were crammed together with no clear role-based distinction
or visual priority.

### New Design
Replaced with a **tabbed command center** layout inside the Admin Panel tab:

| Sub-tab | Description |
|---------|-------------|
| **Users** | Full user directory table with role badges, search/filter, and inline actions |
| **Bulk Ingest** | Upgraded drag-drop zone with full validation drawer and commit flow |
| **Structure Matrix** | Metadata manager for Verticals and Job Levels with tree hierarchy display |
| **Audit Logs** | System event log viewer with severity badges and timestamp display |

Design tokens: dark glassmorphic cards, accent gradients, animated status indicators,
sticky table headers, smooth micro-transitions, and hover states on all interactive rows.

---

## Files Modified

- `src/frontend/app/page.tsx` — Auth session guard, passive wheel fix, full admin panel redesign
- `src/frontend/app/login/page.tsx` — Stale cookie clear, empty defaults, smart redirect, no `router.refresh()`
- `src/frontend/app/force-reset/page.tsx` — base64url cookie decode, `router.replace()`
- `src/frontend/app/api/auth/login/route.ts` — base64url cookie encoding
- `src/frontend/app/api/auth/reset-password/route.ts` — base64url cookie encoding
- `src/backend/auth/sessionManager.ts` — base64url decode in middleware
- `docs/history/08_auth_cookie_fix_and_admin_redesign.md` — This document
