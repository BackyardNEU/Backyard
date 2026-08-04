# Club Membership & Roles System

## Context

Backyard currently tracks club membership as a flat UUID array (`member_list`) on the `profiles` table, with edit permissions handled by a separate manual `approved_club_accounts` table. This makes it impossible to support role-based permissions, a live roster of real members, or an invite/approval workflow. The goal is to make each club function like a Discord server: members, roles (owner / admin / member), and admin-gated actions (approving join requests, creating events, editing the page).

**Join flow:** Request + approval (users send a request; admins/owners approve or decline).  
**Migration:** Existing `member_list` members carry over as `member` role; existing `approved_club_accounts` holders carry over as `admin`.

---

## Phase 1 — Database

### New file: `supabase/migrations/002_club_memberships.sql`

**Tables to create:**

```sql
CREATE TYPE club_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE club_memberships (
  user_id    uuid       NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  club_id    uuid       NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  role       club_role  NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  invited_by uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, club_id)
);

CREATE TABLE club_join_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  club_id      uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','declined')),
  message      text,
  reviewed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (user_id, club_id)
);
```

**Seed data migration (run at end of same migration file):**

```sql
-- Existing members → role='member'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT p.id, unnest(p.member_list)::uuid, 'member'
FROM profiles p WHERE array_length(p.member_list, 1) > 0
ON CONFLICT (user_id, club_id) DO NOTHING;

-- Approved editors → upgrade to 'admin'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT user_id, club_id, 'admin'
FROM approved_club_accounts
ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'admin';
```

**Keep `profiles.member_list` intact** during transition (dual-write); drop it in Phase 5 cleanup after all callsites are migrated.

---

## Phase 2 — Backend

### New file: `server/lib/clubPermissions.js`

Reusable helpers for every protected route:

- `getClubRole(userId, clubId)` → `'owner' | 'admin' | 'member' | null`
- `requireClubRole(userId, clubId, minRole)` → throws 403 if insufficient
- `canManage(actorRole, targetRole)` → boolean (owner can manage anyone; admin can manage members only)

Role rank: `owner > admin > member`.

### New file: `server/routes/clubMembers.js` → mounted at `/api/clubs`

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/:clubId/members` | optional | public | List members with username + avatar; role visible to admins/owners only |
| GET | `/:clubId/members/me` | required | any | Fast check: `{ role }` for caller |
| DELETE | `/:clubId/members/me` | required | any member | Leave club; owners must transfer first; dual-writes `member_list` |
| PATCH | `/:clubId/members/:userId` | required | admin/owner | Change role; admin can't promote to admin, owner can (not to owner) |
| DELETE | `/:clubId/members/:userId` | required | admin/owner | Remove member; `canManage` check; dual-writes `member_list` |
| POST | `/:clubId/members/transfer-ownership` | required | owner | Atomically makes `newOwnerId` owner, demotes self to admin |
| GET | `/:clubId/join-requests` | required | admin/owner | List pending requests with requester profile |
| POST | `/:clubId/join-requests` | required | non-member | Submit join request; 409 if already member or request pending |
| PATCH | `/:clubId/join-requests/:reqId` | required | admin/owner | `{ status: 'approved' \| 'declined' }`; on approval inserts into `club_memberships` + dual-writes `member_list` |

**Register in `server/index.js`:**
```js
import clubMembersRouter from './routes/clubMembers.js';
app.use('/api/clubs', writeLimiter, clubMembersRouter);
```

### Modify `server/routes/clubPage.js`

- Replace `approved_club_accounts` checks in `POST /:id/page/init` and `PUT /:id/page` with `await requireClubRole(req.user.id, clubId, 'admin')`
- Keep `GET /:id/is-approved` working but derive from `club_memberships` (return `{ approved: role === 'admin' || role === 'owner' }`) — backward compat shim

### Modify `server/routes/clubEvents.js`

Replace the `profiles.select('member_list')` membership check with a `club_memberships` row lookup:
```js
const { data } = await supabaseAdmin
  .from('club_memberships')
  .select('role')
  .eq('user_id', req.user.id)
  .eq('club_id', clubId)
  .maybeSingle();
isMember = !!data;
```

### Modify `server/routes/events.js`

Upgrade the membership check for event creation to require `admin` role:
```js
await requireClubRole(req.user.id, clubId, 'admin');
```

### Modify `server/routes/reviews.js`

Replace membership check in `PATCH /:reviewId` (review hide/show) with `admin` role check.

### Modify `server/routes/profiles.js`

- `GET /membership` (line 114): read from `club_memberships` instead of `profiles.member_list`, reconstruct array for backward compat
- `PUT /membership` (line 130): keep working for now (callers will be replaced in Phase 5)

---

## Phase 3 — Frontend

### Modify `src/uni_components/ExpandedTile.jsx`

1. Add `myRole` state: `const [myRole, setMyRole] = useState(null)`
2. In `fetchAll()`, add call to `GET /api/clubs/:id/members/me` → set `myRole`
3. Replace `handleMembership()` join path: call `POST /clubs/:id/join-requests` (creates a pending request); update UI to show "Request sent" state
4. Leave path: call `DELETE /clubs/:id/members/me`
5. Replace `isApproved` check with `myRole === 'admin' || myRole === 'owner'`
6. Add tab switcher between current page content and new `ClubMembersPanel`:
   - `'page'` tab — existing module content
   - `'members'` tab — renders `ClubMembersPanel`; tab visible to all, admin-only actions gated inside

### New file: `src/club_page_components/ClubMembersPanel.jsx`

Props: `{ clubId, myRole, currentUserId }`

**What it renders:**
- Member list: avatar + username + role badge; sorted owners → admins → members
- For admins/owners: role dropdown and "Remove" button per member card (respecting `canManage`)
- For owners only: "Transfer Ownership" option
- Pending join requests section (admin/owner only) — each request shows requester profile + Approve/Decline buttons
- Join request count badge on the tab label when there are pending requests

**Data fetching:**
```js
const [members, setMembers] = useState([]);
const [requests, setRequests] = useState([]);
// Fetch both in parallel on mount; refresh after any mutation
```

**Mutations (all via `apiFetch`):**
- `PATCH /clubs/:clubId/members/:userId` — role change
- `DELETE /clubs/:clubId/members/:userId` — remove member
- `PATCH /clubs/:clubId/join-requests/:reqId` — approve/decline
- `POST /clubs/:clubId/members/transfer-ownership` — transfer

---

## Phase 4 — Notifications

Two new notification types fired from `server/routes/clubMembers.js`, using the existing `NotificationService.dispatch()` pattern from `server/notifications/service.js`.

### New file: `server/notifications/handlers/clubJoinRequest.js`

Fired when a user submits a join request (`POST /:clubId/join-requests`).

- **Recipients:** all `admin` and `owner` members of the club — query `club_memberships` for the club, then loop and dispatch one job per admin/owner
- **Actor:** the requester (`req.user.id`)
- **Entity:** `{ id: request.id, clubId, clubName }`

```js
// In clubMembers.js, after inserting the join request row:
const { data: admins } = await supabaseAdmin
  .from('club_memberships')
  .select('user_id')
  .eq('club_id', clubId)
  .in('role', ['admin', 'owner']);

for (const { user_id } of admins ?? []) {
  await NotificationService.dispatch({
    type: 'club_join_request',
    recipientId: user_id,
    actorId: req.user.id,
    entity: { id: joinRequest.id, clubId, clubName },
  });
}
```

Handler `buildRow`:
```js
export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'club_join_request',
    entity_type: 'club_join_request',
    entity_id: event.entity?.id ?? null,
  };
}
export const emailTemplate = null;
```

### New file: `server/notifications/handlers/clubJoinApproved.js`

Fired when an admin/owner approves a join request (`PATCH /:clubId/join-requests/:reqId` with `status: 'approved'`).

- **Recipient:** the original requester (`joinRequest.user_id`)
- **Actor:** the approving admin/owner (`req.user.id`)
- **Entity:** `{ clubId, clubName }`

```js
// In clubMembers.js, after approving the request:
await NotificationService.dispatch({
  type: 'club_join_approved',
  recipientId: joinRequest.user_id,
  actorId: req.user.id,
  entity: { clubId, clubName },
});
```

Handler `buildRow`:
```js
export function buildRow(event) {
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId,
    type: 'club_join_approved',
    entity_type: 'club_membership',
    entity_id: event.entity?.clubId ?? null,
  };
}
export const emailTemplate = null;
```

### Register both in `server/notifications/queue.js`

```js
const HANDLERS = {
  friend_request:    () => import('./handlers/friendRequest.js'),
  friend_accepted:   () => import('./handlers/friendAccepted.js'),
  club_join_request: () => import('./handlers/clubJoinRequest.js'),   // new
  club_join_approved: () => import('./handlers/clubJoinApproved.js'), // new
};
```

---

## Phase 5 — Cleanup (after Phase 3 is stable)

- Remove `profiles.member_list` column (requires updating `friends.js` to join `club_memberships` for member data)
- Remove `approved_club_accounts` table and the `is-approved` shim endpoint
- Remove `PUT /me/membership` endpoint

---

## Verification Checklist

1. Run migration; verify seeding with `SELECT count(*) FROM club_memberships`
2. Existing member-only event filtering still works
3. Existing club page editors can still edit (seeded as admins)
4. New user submits a join request → pending row in `club_join_requests`; all admins/owners receive a `club_join_request` in-app notification
5. Admin approves request → row in `club_memberships`, `member_list` dual-written, user sees member-only events, requester receives a `club_join_approved` notification
6. Admin removes a member → row deleted from both tables
7. Owner changes role → reflected in DB and UI
8. Non-admin member cannot create events (403)
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
| `server/routes/events.js` | Modify (tighten to admin role) |
| `server/routes/reviews.js` | Modify (tighten to admin role) |
| `server/routes/profiles.js` | Modify (GET /membership reads from new table) |
| `src/uni_components/ExpandedTile.jsx` | Modify (myRole state, tab switcher, new join flow) |
| `src/club_page_components/ClubMembersPanel.jsx` | New |
| `server/notifications/handlers/clubJoinRequest.js` | New |
| `server/notifications/handlers/clubJoinApproved.js` | New |
| `server/notifications/queue.js` | Modify (register 2 new handlers) |
