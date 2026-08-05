# Testing

This doc covers the unit tests written for the login/signup batch (Resend, forgot-password, OAuth profile setup, server hardening). It's both a reference and a learning aid — read top to bottom the first time, skim it later.

---

## Running the tests

```bash
npm test           # one-shot run, exits with status code
npm run test:watch # vitest in watch mode — re-runs on file change
```

The suite currently has **44 tests across 4 files**, all passing. Total runtime ~1 second.

---

## Infrastructure

### `vitest.config.js`
Backend tests only for now. `environment: 'node'` (no jsdom), test files matched by `server/**/*.test.js`.

Kept separate from `vite.config.js` because the frontend Vite config is about React/JSX/bundling concerns — mixing in test config would couple them unnecessarily. When we add React component tests later, this is where a second test project goes.

### `vitest.setup.js`
Sets three env vars before *any* server module loads:

```js
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
```

**Why this file exists:** [server/middleware/requireAuth.js](../server/middleware/requireAuth.js) and [server/supabaseAdmin.js](../server/supabaseAdmin.js) both read env vars at module-load time and `throw` if missing. Without a setup file, the first `import` in any test crashes the run. Vitest's `setupFiles` runs before test files are evaluated, so the env is ready by the time imports resolve.

---

## Test files

### 1. [server/lib/validateUsername.test.js](../server/lib/validateUsername.test.js)

Tests the pure validator extracted from the `/api/users/check-username` route.

| Group | What it pins down |
|---|---|
| Valid usernames | Length 3 (min) and 30 (max) boundaries, mixed-case, digits-only, underscores-only |
| Whitespace handling | `"  alice  "` trims to `"alice"` and validates |
| Invalid usernames | Length 2 and 31 (off-by-one guards), empty, whitespace-only, spaces/hyphens/dots/special chars, non-ASCII letters, emoji |
| Type safety | `null`, `undefined`, `{}` return `valid: false` without throwing |
| Documented quirk | `validateUsername(12345)` returns `valid: true` because numbers coerce to digit-strings, and digit-strings *are* valid usernames |

**Why this matters:** length boundaries and regex behavior are the off-by-one hiding spots. `it.each([...])` runs the same assertion across many inputs — cheap exhaustive coverage.

### 2. [server/routes/pickWritable.test.js](../server/routes/pickWritable.test.js)

Tests `pickWritable()` and the `PROFILE_WRITABLE` whitelist from [profiles.js](../server/routes/profiles.js).

| Group | What it pins down |
|---|---|
| Whitelist contents | The set is *exactly* `{username, first_name, last_name, avatar_url, biography, photos, school, graduation_year, major}` — adding a column makes the test fail on purpose |
| Field passthrough | All 9 whitelisted fields survive `pickWritable` unchanged |
| Privilege-escalation strips | `id`, `is_admin`, `email`, `member_list`, `created_at` are dropped if posted in the body |
| Edge cases | Empty body → `{}`; `null`/`undefined` body don't throw |
| Falsy preservation | `biography: ''`, `avatar_url: null`, `graduation_year: 0` all survive (regression guard against accidentally writing `if (body[key])`) |

**Why the whitelist test is intentionally rigid:** every time you add a writable column, you must update this test. That forces you to consciously decide "should the user be able to overwrite this?" — which is the entire point of the whitelist.

### 3. [server/routes/users.routes.test.js](../server/routes/users.routes.test.js)

Tests `GET /api/users/check-username` end-to-end through Express, with Supabase mocked.

| Test | What it pins down |
|---|---|
| Bad format short-circuit | Username `"ab"` returns `{available: false, reason}` **and never hits the database** |
| Available | Empty data array → `{available: true}` |
| Taken | One row returned → `{available: false}` |
| Database error | Supabase returns `{error: {message}}` → 502 with the message bubbled up |

**The mock pattern (worth memorizing):**

```js
const limitMock = vi.fn();
vi.mock('../supabaseAdmin.js', () => {
    const eqMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    return { supabaseAdmin: { from: fromMock } };
});

const { default: usersRouter } = await import('./users.js');
```

Two things to understand:
1. **`vi.mock` is hoisted.** Vitest moves this call to the very top of the file, before other imports run. That's why the mock is set up before `users.js` loads.
2. **The chain matches the production call.** `supabaseAdmin.from('profiles').select('id').eq('username', x).limit(1)` — each `.x()` returns an object exposing the next method. Only `limit()` is the leaf where the test controls `{data, error}`.

The router is mounted on a fresh, minimal Express app (with an error handler) inside the test — we don't import `server/index.js` because it calls `app.listen()` at module load.

### 4. [server/middleware/requireAuth.test.js](../server/middleware/requireAuth.test.js)

Tests the JWT middleware using *real* `jsonwebtoken` calls (no mocking).

| Test | What it pins down |
|---|---|
| Valid token | `req.user` is set to `{id, email}` from the JWT payload, `next()` is called |
| Missing header | 401 with `{error: 'Missing Authorization bearer token'}` |
| Wrong scheme | `Basic <token>` is rejected even if the token is otherwise valid |
| Expired token | Signed with `expiresIn: '-1s'`, returns 401 |
| Wrong secret | Token signed with a different secret → 401 |
| Wrong audience | Token signed with `audience: 'someone-else'` → 401 |
| Malformed token | `Bearer not-a-real-jwt` → 401 |

**Why real `jsonwebtoken` instead of mocking:** mocking `jwt.verify` would only prove "we called the library." Real signing exercises the actual verification path — signature, expiry, audience — so the test catches a real regression if any of those checks gets accidentally weakened.

The `makeReqRes` helper builds a tiny fake req/res pair so the middleware can be called directly (no Express app needed). This is faster and clearer than spinning up supertest for unit-level middleware tests.

---

## Patterns to reuse

1. **Pure function first, route second.** When testing a route, extract any interesting logic into a pure helper (`validateUsername`, `pickWritable`) and unit-test it there. The route test then only verifies "the helper is wired in correctly" — much smaller surface.

2. **Real libraries when feasible, mocks at the boundary.** Mock the database (slow, stateful, external). Don't mock JWT, regex, or stdlib calls (cheap and deterministic — mocking them adds risk without removing it).

3. **Pin contracts that matter.** The `PROFILE_WRITABLE` test exists so changes to a security-critical set can't slip in silently. Most tests verify behavior; a few should verify *invariants*.

4. **`it.each([...])` for exhaustive boundary checks.** Cheaper and more readable than 10 `it()` blocks. Use it for length boundaries, format variants, type coercion.

---

## What's not yet tested

- **`POST /api/me/profile`** — the upsert that takes `id` and `email` from the JWT, not the body. This is the security claim from the changelog and only partially covered (by `pickWritable`). Worth a supertest case that sends `{ id: 'attacker-uuid', email: 'attacker@evil.com' }` in the body and verifies the inserted row uses the JWT values.
- **`requireAuth` with a `sub`-less token.** Currently `req.user.id` would be `undefined`; needs a decision on whether that should 401.
- **Frontend components.** `LoginMorph` view-state machine, `ForgotPasswordForm` happy path, debounced username check in the signup form. All require jsdom + React Testing Library — separate setup.
- **Resend integration.** No test yet; would need to mock the SDK.
- **OAuth callback profile-setup redirect** in `AuthCallbackPage.jsx`. Requires React component test infrastructure.
