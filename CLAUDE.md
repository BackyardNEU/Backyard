# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev:all      # Run frontend (Vite :5173) + backend (Express :3001) concurrently
npm run dev          # Frontend only
npm run dev:server   # Backend only (--watch)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (server tests only)
npm run test:watch   # Watch mode
```

Vite proxies `/api` requests to `localhost:3001`, so the frontend never needs to know the backend port.

## Environment Variables

**Frontend** (`.env` — VITE_ prefix, safe to expose):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Backend** (`.env` in root, server-only):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `PORT`, `FRONTEND_URL`

## Architecture

### Stack
- **Frontend**: React 19 + React Router v7 + Vite 7 + Tailwind CSS 4 + Framer Motion
- **Backend**: Express 5 + Supabase (PostgreSQL) + JWT auth
- **State**: Zustand (client store) + React Context (ClubDataProvider)

### Data Flow

All frontend→backend calls go through `src/lib/api.js:apiFetch()`, which automatically attaches the Supabase JWT. Never call Supabase directly from the frontend for data mutations — use the Express API.

`ClubDataProvider` (`src/context/ClubDataProvider.jsx`) fetches and caches clubs, user profile, favorites, and friends on mount. Most components read from this context rather than making their own API calls.

### Frontend Route Structure
- `/` — Landing/home
- `/uni/:uniId` — University hub (club list, calendar, search)
- `/uni/:uniId/clubs/:clubId` — Club detail page (modular: stats, FAQ, members, events, reviews)
- `/profile/:userId` — User profile (friends, polaroid cards)
- `/login`, `/signup`, `/reset-password` — Auth flows
- `/join/:inviteCode` — Invite link handler

### Backend Route Structure (`server/routes/`)
All routes are mounted under `/api`. Auth middleware (`server/middleware/requireAuth.js`) verifies the Supabase JWT on protected routes and sets `req.user = { id, email }` — read `req.user.id`, not `req.userId`.

`identifyUser` (same file) is mounted globally on `/api` and attaches `req.user` when a valid token is present without rejecting anonymous callers. Rate limiters rely on it to key by user rather than IP.

Key route files: `clubs.js`, `reviews.js`, `favorites.js`, `friends.js`, `users.js`, `events.js`, `media.js`, `email.js`

### Club Page Modularity
Club detail pages are composed from swappable modules under `src/club_page_components/`. Each module is a self-contained component (e.g., `StatsModule`, `FAQModule`, `MembersModule`) that receives club data as props.

## Testing

Tests live in `server/**/*.test.js` and run with Vitest. The pattern is:
1. Test pure helper functions directly
2. Test routes using mocked Supabase client (mock at the boundary — `server/supabaseAdmin.js`)
3. Use real `jsonwebtoken` for JWT verification tests

See `docs/testing-guide.md` for setup patterns and examples.

## Key Utilities

- `src/lib/api.js` — `apiFetch(path, options)`: authenticated fetch wrapper
- `src/lib/store.js` — Zustand global store
- `server/supabaseAdmin.js` — Service-role Supabase client (server-only)
- `server/middleware/requireAuth.js` — JWT verification: `requireAuth` (rejects anonymous), `identifyUser` (populates `req.user`, never rejects), `verifyBearer` (returns user or null)
- `server/lib/validation.js` — Input validation helpers
