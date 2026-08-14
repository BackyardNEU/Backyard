# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev:all      # Run frontend (Vite :5173) + backend (Express :3001) concurrently
npm run dev          # Frontend only
npm run dev:server   # Backend only (--watch)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (server/ and tests/)
npm run test:watch   # Watch mode
npm start            # Production server (node server/index.js)
```

Vite proxies `/api` requests to `localhost:3001`, so the frontend never needs to know the backend port. When `VITE_API_URL` is set the frontend calls that origin directly instead (`src/lib/api.js`) — that's the deployed split-origin setup.

## Environment Variables

**Frontend** (`.env` — VITE_ prefix, ships in the browser bundle):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (note: `_KEY`, not `_ANON_KEY`)
- `VITE_API_URL` (optional; when unset, calls go to `/api` via the Vite proxy)

**Backend** (`.env` in root, server-only):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `PORT`
- `FRONTEND_URL` — **comma-separated CORS allowlist**, not a single URL. Do not interpolate it into a link.
- `ADMIN_USER_IDS` — comma-separated user UUIDs; backs `isAdmin()` in `server/routes/invites.js`
- `RESEND_KEY`, `CLOUD_VISION_API` — optional; both features degrade silently when unset

## Architecture

### Stack

- **Frontend**: React 19 + React Router v7 + Vite 7 + Tailwind CSS 4 + Framer Motion

- **Backend**: Express 5 + Supabase (PostgreSQL) + JWT auth + pg-boss (notification queue)

- **State**: Zustand (client store) + React Context (ClubDataProvider)

### Data Flow

All frontend→backend calls go through `src/lib/api.js:apiFetch()`, which attaches the Supabase JWT. Never call Supabase directly from the frontend for data mutations — use the Express API.

`ClubDataProvider` (`src/context/ClubDataProvider.jsx`) fetches and caches clubs, user profile, favorites, and friends on mount. Most components read from this context rather than making their own API calls.

Code shared by both frontend and backend lives in `shared/` (`slug.js`, `textModerator.js`), re-exported by thin shims in `src/lib/` and `server/lib/`.

### Frontend Route Structure (`src/App.jsx`)
- `/` — redirects to `DEFAULT_UNIVERSITY_PATH`; there is no root landing route
- `/university/:id` — university hub (club list, calendar, search)
- `/reviews/:id`, `/profile`, `/settings`, `/friend/:id`, `/admin`
- `/profile/setup` and `/profile-setup` — both render `ProfileSetupPage`
- `/auth/callback` — Supabase email-confirm and OAuth landing
- `/reset-password`, `/join/:token` — invite redemption

There are **no `/login` or `/signup` routes** — auth is the `LoginMorph` modal, mounted globally in `App.jsx` alongside `NavBar` and `AuthListener`. There is also no `*` / 404 route.

Club detail pages are **not** a separate route; they render inside `src/uni_components/ExpandedTile.jsx` on the university page.

### Backend Route Structure (`server/routes/`)
All routes mount under `/api` (see `server/index.js`). Auth middleware (`server/middleware/requireAuth.js`) verifies the Supabase JWT and sets `req.user = { id, email }` — read `req.user.id`, not `req.userId`.

`identifyUser` is mounted globally on `/api` and attaches `req.user` when a valid token is present without rejecting anonymous callers. Rate limiters rely on it to key by user rather than IP.

**Mount-order gotcha:** narrower rate limiters must be registered *before* the router they protect (see `/api/users/check-username` in `server/index.js`), or the broader bucket wins.

Note that four separate routers mount on `/api/clubs`: `clubs.js` (public reads), `clubMembers.js`, `clubPage.js`, `questions.js`, `clubEvents.js`.

### Database

Table names do not match the domain language — this trips people up:

| Concept | Table |
|---|---|
| Clubs | **`demo_club_data`** (not `clubs`) |
| Club page content | `club_page_data.modules` (jsonb) |
| Universities | `uni_names` (`id`, `uni_name`) |
| Club roles | `club_memberships.role` — enum `top_moderator \| moderator \| member` |

- A club belongs to a university via **`demo_club_data.school` exact-string-matching `uni_names.uni_name`** — not a foreign key. `university_id` exists but no code reads it.
- **Two coexisting permission systems.** `club_memberships.role` is authoritative for page editing (`clubPage.js`) and is what new code should use via `server/lib/clubPermissions.js`. `approved_club_accounts` is legacy, still read by the interests routes and written by invite redemption. Migration `002` seeded one into the other **once**; nothing keeps them in sync.
- `server/lib/publicColumns.js` allowlists columns for public reads — but the `search_clubs` RPC returns a column list fixed **in the database**, outside that allowlist. Adding a sensitive column to `demo_club_data` requires auditing that function too.
- Migrations live in `supabase/migrations/`, but `demo_club_data`, `club_page_data`, `approved_club_accounts`, and `club_invite_links` **have no migration** — they were created by hand in the Supabase dashboard. Their real shape is only verifiable against the live DB.

### Club Page Modularity
Club pages are composed from modules under `src/club_page_components/`, driven by the `club_page_data.modules` jsonb array and dispatched by `renderModule` in `src/uni_components/ExpandedTile.jsx`. Each entry is `{ type, order, isDisplayed, data }`.

Module types: `basic_info`, `links`, `club_media`, `join`, `faqs`, `stats`, `member_roster`, `calendar`, `comments`. `DEFAULT_MODULES` in `server/routes/clubPage.js` seeds a complete placeholder page on `POST /clubs/:clubId/page/init`.

Most modules read from the `modules` blob, not from `demo_club_data` — only `id`, `club_name`, and `image_url` cross over, and `PUT /clubs/:clubId/page` syncs the latter two back.

## Testing

Tests live in `server/**/*.test.js` and `tests/**/*.test.js`, run with Vitest:
1. Test pure helper functions directly
2. Test routes using a mocked Supabase client (mock at the boundary — `server/supabaseAdmin.js`)
3. Use real `jsonwebtoken` for JWT verification tests

See `docs/testing-guide.md` for setup patterns and examples.

## Key Utilities

- `src/lib/api.js` — `apiFetch(path, options)`: authenticated fetch wrapper; retries idempotent calls, never retries 429
- `src/lib/store.js` — Zustand global store
- `src/lib/sanitizeHtml.js` — `sanitizeBioHtml`; **DOM-dependent, browser-only**
- `server/supabaseAdmin.js` — service-role Supabase client (server-only; **bypasses RLS**)
- `server/middleware/requireAuth.js` — `requireAuth` (rejects anonymous), `identifyUser` (populates `req.user`, never rejects), `verifyBearer` (returns user or null)
- `server/lib/clubPermissions.js` — `requireModerator`, `requireTopModerator` (throw `{status, message}`)
- `server/lib/publicColumns.js` — public-read column allowlists
- `shared/textModerator.js` — `checkFields(obj)` → `{clean, message, field}`
- `server/routes/profiles.js` — `pickWritable` + a `Set` allowlist is **the repo's mass-assignment pattern**; copy it for any new write endpoint and pin the field set with a test

There is no `server/lib/validation.js`. Validation helpers are scattered: `validateUsername.js`, `blocks.js` (`isUuid`), `shared/slug.js`, plus the client-side module validators in `ExpandedTile.jsx`.
