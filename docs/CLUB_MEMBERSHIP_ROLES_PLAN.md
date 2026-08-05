# Club Membership & Roles System

## Context

Backyard currently tracks club membership as a flat UUID array (`member_list`) on the `profiles` table, with edit permissions handled by a separate manual `approved_club_accounts` table. This makes it impossible to support role-based permissions, a live roster, or an invite/approval workflow. The goal is to rebuild membership with a proper role hierarchy and, eventually, moderator-defined custom roles.

**Role hierarchy (fixed):** `moderator > officer > member`  
Custom roles will slot between `officer` and `member` as display labels — no mechanical distinction yet.

**Join flow:** One-click open join, school-gated (user's `profiles.school` must match club's `demo_club_data.school`).  
**Join requests / notifications:** Deferred — see Phase 5.

**Migration:** Existing `member_list` members → `member`; existing `approved_club_accounts` holders → `officer`. Moderators must be designated manually after migration (no automatic inference).

---

## Phase 1 — Database

### New file: `supabase/migrations/002_club_memberships.sql`

**Tables to create:**

```sql
CREATE TYPE club_role AS ENUM ('moderator', 'officer', 'member');

CREATE TABLE club_memberships (
  user_id    uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  club_id    uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  role       club_role   NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);

-- Custom roles are display labels created per-club by the moderator.
-- They have no mechanical permissions at this stage.
CREATE TABLE club_custom_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

-- Added after club_custom_roles exists; nullable — not every member has a custom role label.
ALTER TABLE club_memberships
  ADD COLUMN custom_role_id uuid REFERENCES club_custom_roles(id) ON DELETE SET NULL;
```

**Row-level security — school-scoped membership:**

```sql
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can only join clubs at their own school"
ON club_memberships
FOR INSERT
WITH CHECK (
  (SELECT school FROM profiles WHERE id = user_id) =
  (SELECT school FROM demo_club_data WHERE id = club_id)
);

ALTER TABLE club_custom_roles ENABLE ROW LEVEL SECURITY;

-- Only the club's moderator may create custom roles (enforced at API layer too).
CREATE POLICY "only moderator can create custom roles"
ON club_custom_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_memberships
    WHERE user_id = auth.uid()
      AND club_id = club_custom_roles.club_id
      AND role = 'moderator'
  )
);
```

> **Note:** `supabaseAdmin` bypasses RLS — API-layer guards (Phases 2 & 4) are the primary enforcement. RLS is defense-in-depth.

**Seed data migration (run at end of same migration file):**

```sql
-- Existing members → role='member'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT p.id, unnest(p.member_list)::uuid, 'member'
FROM profiles p WHERE array_length(p.member_list, 1) > 0
ON CONFLICT (user_id, club_id) DO NOTHING;

-- Approved editors → upgrade to 'officer'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT user_id, club_id, 'officer'
FROM approved_club_accounts
ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'officer';
```

> Moderators are not auto-assigned during migration. Designate them manually via the DB or a one-time script after verifying the seeded data.

**Keep `profiles.member_list` intact** during transition (dual-write); drop in Phase 6 cleanup after all callsites are migrated.

---

## Phase 2 — Public Member List + Open Join/Leave

The first user-visible feature: a public roster on each club page, plus a one-click join/leave button for school-matched users.

### New file: `server/routes/clubMembers.js` → mounted at `/api/clubs`

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/:clubId/members` | none | public | List members with username, avatar, role, and custom role name (if any); sorted moderator → officer → member |
| POST | `/:clubId/members/me` | required | any | One-click join; school-match guard; 409 if already a member; dual-writes `member_list` |
| DELETE | `/:clubId/members/me` | required | any member | Leave club; moderator must transfer ownership first; dual-writes `member_list` |
| POST | `/:clubId/members/transfer-moderator` | required | moderator | Atomically promotes `newModeratorId` to moderator, demotes self to officer |

**School-match guard (apply in `POST /:clubId/members/me` before inserting):**

```js
const [{ data: userProfile }, { data: club }] = await Promise.all([
  supabaseAdmin.from('profiles').select('school').eq('id', req.user.id).single(),
  supabaseAdmin.from('demo_club_data').select('school').eq('id', clubId).single(),
]);
if (!userProfile?.school || userProfile.school !== club?.school) {
  return res.status(403).json({ error: 'You can only join clubs at your own school.' });
}
```

**`GET /:clubId/members` query (join custom role name):**

```js
const { data } = await supabaseAdmin
  .from('club_memberships')
  .select(`
    role,
    custom_role_id,
    club_custom_roles ( name ),
    profiles ( username, avatar_url )
  `)
  .eq('club_id', clubId)
  .order('role'); // enum order: moderator, officer, member
```

**Register in `server/index.js`:**
```js
import clubMembersRouter from './routes/clubMembers.js';
app.use('/api/clubs', writeLimiter, clubMembersRouter);
```

### Modify `server/routes/clubPage.js`

Replace `approved_club_accounts` checks in `POST /:id/page/init` and `PUT /:id/page` with:
```js
const { data } = await supabaseAdmin
  .from('club_memberships')
  .select('role')
  .eq('user_id', req.user.id)
  .eq('club_id', clubId)
  .maybeSingle();
if (!data || !['moderator', 'officer'].includes(data.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

Keep `GET /:id/is-approved` working but derive from `club_memberships`:
```js
{ approved: ['moderator', 'officer'].includes(role) }
```

### Modify `server/routes/clubEvents.js`

Replace the `profiles.select('member_list')` membership check:
```js
const { data } = await supabaseAdmin
  .from('club_memberships')
  .select('role')
  .eq('user_id', req.user.id)
  .eq('club_id', clubId)
  .maybeSingle();
isMember = !!data;
```

### Modify `server/routes/profiles.js`

- `GET /membership` (line 114): read from `club_memberships` instead of `profiles.member_list`, reconstruct array for backward compat
- `PUT /membership` (line 130): keep for now; removed in Phase 6

### New file: `src/club_page_components/ClubMembersPanel.jsx`

Props: `{ clubId, myRole, currentUserId }`

**What it renders (Phase 2 scope):**
- Member list: avatar + username + role badge + custom role label (if set); sorted moderator → officer → member
- Join / Leave button (gated by school match; leave blocked for moderator without transferring)

**Data fetching:**
```js
const [members, setMembers] = useState([]);
// fetch GET /api/clubs/:clubId/members on mount; refresh after join/leave
```

### Modify `src/uni_components/ExpandedTile.jsx`

1. Add `myRole` state: `const [myRole, setMyRole] = useState(null)`
2. Add tab switcher between existing page content and `ClubMembersPanel`:
   - `'page'` tab — existing module content
   - `'members'` tab — renders `ClubMembersPanel`
3. Replace `isApproved` check with `myRole === 'officer' || myRole === 'moderator'`

---

## Phase 3 — Role Display (Internal Distinction, No Mechanical Gates)

The three roles are visually distinct in the member list UI. No permission gates are changed yet — this phase is purely presentational so the data model is visible to users before mechanical differences are enforced.

**What to add in `ClubMembersPanel`:**
- Role badge component: `moderator` → distinct colour/label, `officer` → second colour/label, `member` → default
- Custom role label displayed as a subtitle under the member's name (if `custom_role_id` is set)

No backend changes in this phase.

---

## Phase 4 — Custom Roles System

Moderators can create named role labels per club and assign them to members. Labels have no mechanical permissions at this stage — they are display-only titles that slot between `officer` and `member` in the UI.

### New endpoints (add to `server/routes/clubMembers.js`)

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/:clubId/roles` | none | public | List all custom roles for the club |
| POST | `/:clubId/roles` | required | moderator | Create a custom role (`{ name }`); 409 if name already exists for club |
| DELETE | `/:clubId/roles/:roleId` | required | moderator | Delete custom role; any member holding it has `custom_role_id` set to NULL (ON DELETE SET NULL) |
| PATCH | `/:clubId/members/:userId` | required | moderator | Assign or remove a custom role (`{ customRoleId: uuid \| null }`); moderator cannot assign/remove roles from other moderators |

**Permission helper — add to `server/lib/clubPermissions.js`:**

```js
export async function requireModerator(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (data?.role !== 'moderator') throw { status: 403, message: 'Moderator only' };
}
```

### Modify `src/club_page_components/ClubMembersPanel.jsx`

Add moderator-only controls (visible only when `myRole === 'moderator'`):
- "Manage roles" button → opens a panel listing existing custom roles with a delete button per role and an "Add role" input
- Per-member card: role dropdown showing available custom roles (+ "None"); updates via `PATCH /:clubId/members/:userId`

**Data fetching additions:**
```js
const [customRoles, setCustomRoles] = useState([]);
// fetch GET /api/clubs/:clubId/roles on mount (alongside members)
```

---

## Phase 5 — Join Requests & Notifications (Deferred)

Design this phase once Phases 1–4 are stable. Scope will include:
- `club_join_requests` table with `pending / approved / declined` status
- Request submission flow (replaces one-click join for clubs that opt in)
- Approval/decline UI for moderators and officers
- In-app notifications: `club_join_request` (to admins) and `club_join_approved` (to requester)

---

## Phase 6 — Mechanical Permissions (Deferred)

Wire up actual permission gates based on role. Scope TBD — depends on what actions each role tier should be able to perform.

---

## Phase 7 — Cleanup (After Phase 3 is stable)

- Remove `profiles.member_list` column
- Remove `approved_club_accounts` table and the `is-approved` shim endpoint
- Remove `PUT /me/membership` endpoint

---

## Verification Checklist

1. Run migration; verify seeding with `SELECT role, count(*) FROM club_memberships GROUP BY role`
2. `GET /api/clubs/:id/members` returns full roster with no auth required
3. User from the same school can one-click join; user from a different school receives 403
4. Existing club page editors (seeded as officers) can still edit the page
5. Officer cannot access moderator-only endpoints (403)
6. Moderator can create a custom role, assign it to a member, see it in the list
7. Deleting a custom role sets affected members' `custom_role_id` to NULL (no orphan references)
8. Moderator transfer works atomically; original moderator becomes officer
9. `GET /me/membership` still returns correct club IDs (backward compat)

---

## Critical Files

| File | Action |
|------|--------|
| `supabase/migrations/002_club_memberships.sql` | New |
| `server/lib/clubPermissions.js` | New |
| `server/routes/clubMembers.js` | New |
| `server/index.js` | Modify (register new router) |
| `server/routes/clubPage.js` | Modify (swap permission check, update is-approved) |
| `server/routes/clubEvents.js` | Modify (swap member check) |
| `server/routes/profiles.js` | Modify (GET /membership reads from new table) |
| `src/uni_components/ExpandedTile.jsx` | Modify (myRole state, tab switcher) |
| `src/club_page_components/ClubMembersPanel.jsx` | New |
