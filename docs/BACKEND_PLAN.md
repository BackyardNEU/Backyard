# Plan: Add a Real Backend to Backyard

## Context

The app currently makes all Supabase database calls directly from React components in the browser. The Supabase anon key is exposed in the browser bundle (via `VITE_SUPABASE_KEY`), there is no authorization layer, and business logic is spread across 21 frontend files. The goal is to add an Express.js API server that sits between the browser and Supabase, so database operations happen server-side with a secret service-role key, and the browser only uses Supabase for authentication.

---

## Tech Stack Decision

**Backend: Express.js (Node.js)**

- Same language as the frontend (JavaScript)
- Most documented Node.js framework; easiest to find examples for
- Straightforward JWT verification using Supabase's own `auth.getUser(token)` — no extra crypto libraries
- Deployable on Railway or Render with zero config

**What stays client-side:** All `supabase.auth.*` calls (`signUp`, `signInWithPassword`, `signInWithOAuth`, `getSession`, `onAuthStateChange`, `signOut`). Supabase Auth is designed to be called from browsers with the anon key. Moving it server-side would break OAuth redirect flows.

---

## New Directory Structure

```
Backyard/                         ← repo root (unchanged)
├── src/                          ← React app (existing, gradually updated)
│   ├── api.js                    ← NEW: central fetch helper (replaces supabase.from calls)
│   ├── supabase.js               ← kept for auth only
│   └── ...
├── server/                       ← NEW
│   ├── index.js                  ← Express app entry + route registration
│   ├── supabaseAdmin.js          ← creates service-role Supabase client
│   ├── middleware/
│   │   └── requireAuth.js        ← verifies Bearer JWT from request header
│   └── routes/
│       ├── clubs.js              ← GET /api/clubs, GET /api/clubs/:id/reviews, GET /api/clubs/:id/stats
│       ├── search.js             ← GET /api/search
│       ├── universities.js       ← GET /api/universities, GET /api/universities/:id
│       ├── favorites.js          ← GET/POST/DELETE /api/me/favorites
│       ├── reviews.js            ← POST /api/reviews
│       ├── votes.js              ← GET/POST/DELETE /api/me/votes
│       ├── profiles.js           ← GET/PUT/POST /api/me/profile, GET /api/me/membership, PUT /api/me/membership
│       ├── friends.js            ← GET/PUT /api/me/friends, GET /api/users/search
│       └── storage.js            ← POST /api/storage/profile-upload-url, POST /api/storage/review-upload-url
├── package.json                  ← add server deps here
├── vite.config.js                ← add proxy config
└── .env                          ← add SUPABASE_SERVICE_ROLE_KEY, PORT=3001
```

**Important:** `package.json` already has `"type": "module"`, so all server files must use `import`/`export` syntax (not `require`). Use `import.meta.url` + `fileURLToPath` anywhere you need `__dirname`.

---

## Step-by-Step Migration

### Phase 1: Structural Setup (no behavior changes yet)

1. **Add server dependencies to `package.json`:**
   - `express`, `cors`, `dotenv` (runtime)
   - `concurrently` (devDependency, for running both servers at once)

2. **Add scripts to `package.json`:**
   - `"dev:server": "node --watch server/index.js"` — run Express with built-in hot reload (Node 18+)
   - `"dev:all": "concurrently \"npm run dev\" \"npm run dev:server\""` — run both at once

3. **Add proxy to `vite.config.js`** (inside the existing `server:` block):
   ```js
   proxy: {
     '/api': { target: 'http://localhost:3001', changeOrigin: true }
   }
   ```
   This makes `fetch('/api/clubs')` in the browser forward to Express during dev — no CORS needed.

4. **Add to `.env`:**
   - `SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>`
   - `PORT=3001`
   - `SUPABASE_URL=<same as VITE_SUPABASE_URL>`
   - In production, also add `FRONTEND_URL=<your Netlify/Vercel URL>`

5. **Create `server/supabaseAdmin.js`:** Initializes a Supabase client with the service-role key. This client bypasses Row Level Security and is never sent to the browser.

6. **Create `server/middleware/requireAuth.js`:** Extracts the JWT from `Authorization: Bearer <token>`, calls `supabaseAdmin.auth.getUser(token)`, and attaches the user to `req.user`. If no/invalid token, returns `401`. Apply this middleware only to authenticated routes.

7. **Create `src/api.js`:** A small helper (`apiFetch(path, options)`) that:
   - Calls `supabase.auth.getSession()` to get the current JWT
   - Adds `Authorization: Bearer <token>` to headers (skips header for public routes)
   - Calls `fetch('/api' + path, ...)`
   - Returns parsed JSON
   - This is the only file frontend components will import instead of `supabase.from()`

8. **Create `server/index.js`:** Sets up Express, registers CORS (`origin: process.env.FRONTEND_URL || 'http://localhost:5173'`), parses JSON, and mounts route files.

---

### Phase 2: Public Read Routes (clubs, universities, search)

Implement and test these first — they require no auth and are safe to migrate without breaking anything.

**Routes to create:**
- `GET /api/clubs` → `from('demo_club_data').select('*')`
- `GET /api/clubs/:clubId/reviews` → `from('reviews').select('*').eq('club_id', clubId)`
- `GET /api/clubs/:clubId/review-tags` → `from('reviews').select('club_id, review_tags').eq('club_id', clubId)`
- `GET /api/clubs/:clubId/stats` → `rpc('get_averages', { p_club_id: clubId })`
- `GET /api/search?q=...&school=...` → `rpc('search_clubs', { search_query, filter_school })`
- `GET /api/universities` → `from('uni_names').select('*').order('uni_name')`
- `GET /api/universities/:id` → `from('uni_names').select('*').eq('id', id).single()`

**Frontend files to update:**
- `src/context/ClubDataProvider.jsx` — replace club fetch and review-tags fetch
- `src/uni_components/UniSearchBar.jsx` — replace `rpc('search_clubs')` and direct club fetch
- `src/uni_components/UniversityPage.jsx` — replace university lookup
- `src/components/SearchBar.jsx` — replace university fetch
- `src/profile_components/ProfileSetupPage.jsx` — replace `uni_names` fetch

---

### Phase 3: Authenticated Read Routes

Apply `requireAuth` middleware to these routes. The middleware extracts `req.user.id` from the verified JWT so the server — not the browser — determines whose data to fetch.

**Routes to create:**
- `GET /api/me/favorites` → `from('user_favorites').select('club_id').eq('user_id', userId)`
- `GET /api/me/profile` → `from('profiles').select('*').eq('id', userId).single()`
- `GET /api/me/membership` → `from('profiles').select('member_list').eq('id', userId).single()`
- `GET /api/me/friends` → fetch friend_list, then fetch friend profiles in one combined response
- `GET /api/me/votes?reviewIds=...` → `from('user_votes').select(...).eq('user_id', userId).in('review_id', ids)`
- `GET /api/users/search?q=...` → `from('profiles').select('id, username, avatar_url').ilike('username', '%q%').neq('id', userId)`

**Frontend files to update:**
- `src/context/ClubDataProvider.jsx` — replace favorites, friend-list, friend-profiles fetches
- `src/uni_components/ExpandedTile.jsx` — replace reviews, stats, membership fetches
- `src/profile_components/ProfilePage.jsx` — replace profile fetch
- `src/profile_components/ClubMembershipPanel.jsx` — replace membership fetch
- `src/review_components/ReviewList.jsx` — replace votes fetch
- `src/profile_components/FriendDiscoveryList.jsx` — replace friend list + search fetches
- `src/login_components/LoginMorph.jsx` — replace avatar fetch

---

### Phase 4: Write Routes + Storage

**Routes to create:**
- `POST /api/reviews` (body: review fields + image URLs) → `from('reviews').insert({...})`
- `PUT /api/me/membership` (body: `{ member_list }`) → `from('profiles').update({member_list}).eq('id', userId)`
- `PUT /api/me/profile` (body: profile fields) → `from('profiles').update({...}).eq('id', userId)`
- `POST /api/me/profile` (body: upsert fields) → `from('profiles').upsert({...}, { onConflict: ['id'] })`
- `POST /api/me/favorites` (body: `{ club_id }`) → `from('user_favorites').insert({...})`
- `DELETE /api/me/favorites/:clubId` → `from('user_favorites').delete().match({...})`
- `POST /api/me/votes` (body: `{ review_id, vote }`) → `from('user_votes').upsert({...})`
- `DELETE /api/me/votes/:reviewId` → `from('user_votes').delete()...`
- `PUT /api/me/friends` (body: `{ friend_list }`) → `from('profiles').update({friend_list}).eq('id', userId)`
- `POST /api/storage/profile-upload-url` → `supabaseAdmin.storage.from('profile_images').createSignedUploadUrl(fileName)`, returns `{ signedUrl, publicUrl }`
- `POST /api/storage/review-upload-url` → same for `review_images`

**Storage upload flow (signed URLs):**
Instead of uploading images directly from the browser to Supabase, the browser:
1. Calls `POST /api/storage/profile-upload-url` with a filename
2. Gets back a signed URL + public URL from the server
3. Uses `fetch(signedUrl, { method: 'PUT', body: file })` to upload directly to Supabase Storage
4. Uses the returned `publicUrl` in the profile update call

This keeps the service-role key on the server while avoiding routing large files through Express.

**Frontend files to update:**
- `src/uni_components/ExpandedTile.jsx` — replace membership write
- `src/uni_components/ClubGrid.jsx` — replace favorites add/remove
- `src/review_components/ReviewList.jsx` — replace vote upsert/delete and upvote count update
- `src/review_components/ReviewPage.jsx` — replace image upload + review insert
- `src/profile_components/ProfilePage.jsx` — replace avatar upload + profile update
- `src/profile_components/ProfileSetupPage.jsx` — replace all supabase calls
- `src/profile_components/FriendDiscoveryList.jsx` — replace friend list write
- `src/login_components/AuthListener.jsx` — replace profile upsert

---

### Phase 5: Cleanup

- Verify the only remaining `supabase.*` calls in `src/` are `supabase.auth.*` operations
- Remove unused `supabase` imports from migrated files
- Add `.env.example` listing all required variables for future contributors

---

## Deployment

**Option A (recommended): Frontend on Vercel/Netlify, backend on Railway/Render**

- Frontend: `npm run build` → deploy `dist/` to Vercel or Netlify. Set `VITE_API_URL=https://your-backend.railway.app` as an env var.
- Backend: Deploy `server/` on Railway (connect GitHub repo, set start command to `node server/index.js`). Set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `PORT`, and `FRONTEND_URL` as environment secrets.
- Update `src/api.js` to use `import.meta.env.VITE_API_URL` as base URL in production, `/api` in development.

**Option B: Single deployment on Railway**

- Build step: `npm run build` (outputs to `dist/`)
- Start step: `node server/index.js`
- In `server/index.js`, serve `dist/` as static files and add a catch-all `res.sendFile('dist/index.html')` after all API routes.

---

## Critical Files

| File | Change |
|---|---|
| `vite.config.js` | Add proxy block |
| `package.json` | Add express, cors, dotenv, concurrently; add dev scripts |
| `.env` | Add SUPABASE_SERVICE_ROLE_KEY, PORT, SUPABASE_URL |
| `src/supabase.js` | Unchanged; kept for auth only |
| `src/api.js` | New: central fetch helper for all API calls |
| `src/context/ClubDataProvider.jsx` | Highest-impact migration target |
| `server/index.js` | New: Express entry point |
| `server/supabaseAdmin.js` | New: service-role client |
| `server/middleware/requireAuth.js` | New: JWT verification |

---

## Verification

1. Run `npm run dev:all` — both Vite (port 5173) and Express (port 3001) start
2. Open `http://localhost:5173` — app loads and club grid populates (data coming through `/api/clubs`)
3. Log in — profile page loads user-specific data
4. Toggle a favorite — `POST /api/me/favorites` returns 200
5. Post a review — image uploads via signed URL, review inserts via `/api/reviews`
6. Confirm the browser's Network tab shows requests to `/api/...` not to `*.supabase.co` (except for auth)
