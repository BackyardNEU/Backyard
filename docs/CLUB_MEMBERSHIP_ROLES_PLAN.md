# Club Membership & Roles System

## Context

Backyard currently tracks club membership as a flat UUID array (`member_list`) on the `profiles` table, with edit permissions handled by a separate manual `approved_club_accounts` table. This makes it impossible to support role-based permissions, a live roster, or an invite/approval workflow. The goal is to rebuild membership with a proper role hierarchy and moderator-defined custom roles.

**Mechanical role hierarchy:** `top_moderator > moderator > member`

- `top_moderator` — one per club (the owner). Full control: page edit, member management, promote/demote moderators, and exclusive control over privileged custom roles.
- `moderator` — page edit, add/remove members, assign non-privileged custom roles to members. Cannot touch mechanical roles.
- `member` — no page control.

**Custom roles** are display labels created per-club. Each custom role has a `grants_moderator_privileges` flag:
- `false` (default) — any moderator or top_moderator can create and assign. Label only.
- `true` — only top_moderator can create or assign. Assigning one to a member also sets their `club_memberships.role` to `moderator`. Deleting the role (ON DELETE SET NULL) removes the display label but does **not** auto-revoke their `moderator` status — top_moderator must demote them explicitly.

**Join flow:** One-click open join, school-gated.
**Join requests / notifications:** Deferred — see Phase 5.

**Migration:** Existing `member_list` members → `member`; existing `approved_club_accounts` holders → `moderator`. Top moderators must be designated manually after migration.

---

## Phase 1 — Database

### New file: `supabase/migrations/002_club_memberships.sql`

**Tables to create:**

```sql
CREATE TYPE club_role AS ENUM ('top_moderator', 'moderator', 'member');

CREATE TABLE club_memberships (
  user_id    uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  club_id    uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  role       club_role   NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);

-- Custom roles are display labels created per-club.
-- grants_moderator_privileges=true: top_moderator only can create/assign.
-- grants_moderator_privileges=false: any moderator or top_moderator can create/assign.
CREATE TABLE club_custom_roles (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                   uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  name                      text        NOT NULL,
  grants_moderator_privileges boolean   NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

-- Nullable — not every member has a custom role label.
-- ON DELETE SET NULL: deleting a custom role removes the label from members
-- but does not change their club_memberships.role.
ALTER TABLE club_memberships
  ADD COLUMN custom_role_id uuid REFERENCES club_custom_roles(id) ON DELETE SET NULL;
```

**Row-level security:**

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

-- Non-privileged roles: moderator or top_moderator may create.
-- Privileged roles: top_moderator only.
CREATE POLICY "role creation based on privilege level"
ON club_custom_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.club_id = club_custom_roles.club_id
      AND (
        cm.role = 'moderator' AND club_custom_roles.grants_moderator_privileges = false
        OR cm.role = 'top_moderator'
      )
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

-- Approved editors → upgrade to 'moderator'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT user_id, club_id, 'moderator'
FROM approved_club_accounts
ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'moderator';
```

> Top moderators are not auto-assigned during migration. Designate them manually via the DB or a one-time script after verifying the seeded data.

**Keep `profiles.member_list` intact** during transition (dual-write); drop in Phase 6 cleanup after all callsites are migrated.

---

## Phase 2 — Public Member List + Open Join/Leave

### New file: `server/routes/clubMembers.js` → mounted at `/api/clubs`

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/:clubId/members` | none | public | List members with username, avatar, role, and custom role name (if any); sorted top_moderator → moderator → member |
| POST | `/:clubId/members/me` | required | any | One-click join; school-match guard; 409 if already a member; dual-writes `member_list` |
| DELETE | `/:clubId/members/me` | required | any member | Leave club; top_moderator must transfer ownership first; dual-writes `member_list` |
| POST | `/:clubId/members/transfer-ownership` | required | top_moderator | Atomically promotes `newTopModeratorId` to top_moderator, demotes self to moderator |
| PATCH | `/:clubId/members/:userId/role` | required | top_moderator | Promote a member to `moderator` or demote a moderator to `member`; cannot set `top_moderator` (use transfer-ownership) |

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
    club_custom_roles ( name, grants_moderator_privileges ),
    profiles ( username, avatar_url )
  `)
  .eq('club_id', clubId)
  .order('role'); // enum order: top_moderator, moderator, member
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
if (!data || !['top_moderator', 'moderator'].includes(data.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

Keep `GET /:id/is-approved` working but derive from `club_memberships`:
```js
{ approved: ['top_moderator', 'moderator'].includes(role) }
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
- Member list: avatar + username + role badge + custom role label (if set); sorted top_moderator → moderator → member
- Join / Leave button (gated by school match; leave blocked for top_moderator without transferring ownership)

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
3. Replace `isApproved` check with `myRole === 'moderator' || myRole === 'top_moderator'`

---

## Phase 3 — Role Display (Visual Only)

The three mechanical roles are visually distinct in the member list. No permission gates are changed yet.

**What to add in `ClubMembersPanel`:**
- Role badge component: `top_moderator` → distinct colour/label (e.g. "Owner"), `moderator` → second colour/label, `member` → default
- Custom role label displayed as a subtitle under the member's name (if `custom_role_id` is set)
- If a member has a custom role, the custom role name takes visual priority over the mechanical role label

No backend changes in this phase.

---

## Phase 4 — Custom Roles System

Top moderators can create privileged custom role labels; any moderator can create non-privileged ones. Assignment rules mirror creation rules.

### Permission helpers — `server/lib/clubPermissions.js`

```js
export async function requireModerator(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (!['moderator', 'top_moderator'].includes(data?.role)) {
    throw { status: 403, message: 'Moderator only' };
  }
  return data.role;
}

export async function requireTopModerator(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (data?.role !== 'top_moderator') {
    throw { status: 403, message: 'Top moderator only' };
  }
}
```

### New endpoints (add to `server/routes/clubMembers.js`)

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/:clubId/roles` | none | public | List all custom roles for the club |
| POST | `/:clubId/roles` | required | moderator (non-privileged) / top_moderator (privileged) | Create a custom role (`{ name, grants_moderator_privileges }`); 409 if name already exists for club |
| DELETE | `/:clubId/roles/:roleId` | required | top_moderator if privileged, else moderator | Delete custom role; ON DELETE SET NULL removes label from members but does not change their `role` |
| PATCH | `/:clubId/members/:userId` | required | top_moderator if privileged role, else moderator | Assign or remove a custom role (`{ customRoleId: uuid \| null }`); assigning a privileged role also sets target's `role` to `moderator` |

**Assigning a privileged custom role (inside PATCH handler):**

```js
const { data: customRole } = await supabaseAdmin
  .from('club_custom_roles')
  .select('grants_moderator_privileges')
  .eq('id', customRoleId)
  .single();

if (customRole.grants_moderator_privileges) {
  await requireTopModerator(req.user.id, clubId);
  // Atomically set both the display label and the mechanical role
  await supabaseAdmin
    .from('club_memberships')
    .update({ custom_role_id: customRoleId, role: 'moderator' })
    .eq('user_id', userId)
    .eq('club_id', clubId);
} else {
  await requireModerator(req.user.id, clubId);
  await supabaseAdmin
    .from('club_memberships')
    .update({ custom_role_id: customRoleId })
    .eq('user_id', userId)
    .eq('club_id', clubId);
}
```

> Removing a privileged custom role label (`customRoleId: null`) does NOT auto-demote the member. The top_moderator must demote them separately via `PATCH /:clubId/members/:userId/role`.

### Modify `src/club_page_components/ClubMembersPanel.jsx`

Add controls visible only to moderators and top_moderators:

- **"Manage Roles" button** (moderators + top_moderators) → opens a panel listing existing custom roles with:
  - Role name
  - Privilege indicator ("grants moderator access") — visible but not editable after creation
  - Delete button (top_moderator for privileged roles; any moderator for non-privileged)
  - "Add role" input with privilege toggle (toggle only enabled for `myRole === 'top_moderator'`)

- **Per-member card** (moderators + top_moderators):
  - Custom role dropdown: shows available roles. Moderators only see non-privileged roles in the dropdown. Top_moderators see all roles.
  - "Promote to Moderator" / "Demote to Member" button — visible only when `myRole === 'top_moderator'`, hidden for other top_moderators

**Data fetching additions:**
```js
const [customRoles, setCustomRoles] = useState([]);
// fetch GET /api/clubs/:clubId/roles on mount (alongside members)
// filter displayed roles in dropdown by grants_moderator_privileges if myRole !== 'top_moderator'
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
4. Existing club page editors (seeded as moderators) can still edit the page
5. Regular moderator cannot access top_moderator-only endpoints (403)
6. Top moderator can create a privileged custom role, assign it to a member, and that member's `role` updates to `moderator`
7. Top moderator can create a non-privileged custom role; regular moderator can also create one
8. Regular moderator can assign non-privileged custom roles but gets 403 when assigning a privileged one
9. Deleting a privileged custom role sets affected members' `custom_role_id` to NULL but their `role` stays `moderator`
10. Top moderator transfer works atomically; original top_moderator becomes moderator
11. `GET /me/membership` still returns correct club IDs (backward compat)

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
