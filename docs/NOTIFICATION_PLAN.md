# Backyard Notification System — Design Plan

## Context

Backyard is a React + Vite web SPA on an Express + Supabase backend. The app has no notification surface today, no persistent header, and no realtime data flow. The immediate need is a "friend request received" alert, but the goal is to design a **general notification system** that adapts to future triggers (club invites, event reminders, review upvotes, mentions, comment replies, etc.) without re-architecting.

Two important prerequisites surfaced during exploration:

- **A real friend-request flow does not exist yet.** Today [server/routes/friends.js](server/routes/friends.js) implements a *direct-add* model — user A writes user B into their `friend_list` with no approval step. A meaningful "friend request" notification requires a request/accept flow first, which is included below.
- **There is nothing persistent in the UI shell.** The only always-visible element is the top-right controls in [LoginMorph.jsx](src/login_components/LoginMorph.jsx) (avatar + hamburger, `position: fixed`). The bell icon extends that region rather than introducing a new header.

The desired UX pattern is Instagram-style — an overlay panel triggered by a bell, working responsively on both mobile widths and desktop.

---

## Architecture: one system, many triggers

The design principle is that **the notification pipeline is polymorphic**. Any feature in Backyard can produce a notification by inserting a single row; the frontend renders it by looking up its `type` in a registry. Adding a new trigger later is three small changes, never a schema change.

### Data model — single `notifications` table

```
notifications
  id             uuid PK
  recipient_id   uuid                     — who sees it
  actor_id       uuid nullable            — who caused it (null for system events)
  type           text                     — 'friend_request', 'friend_accepted',
                                            'club_invite', 'review_upvote', ...
  entity_type    text nullable            — 'friend_request','club','review',...
  entity_id      uuid nullable            — row this notification points to
  read_at        timestamptz nullable
  action_taken   text nullable            — 'accepted','declined','dismissed' for
                                            actionable types
  grouping_key   text nullable            — for later coalescing ("3 people
                                            upvoted your review")
  created_at     timestamptz default now()
```

- Indexes: `(recipient_id, created_at DESC)` and a partial index `(recipient_id) WHERE read_at IS NULL` for unread count.
- Row-Level Security policy: `recipient_id = auth.uid()` on select/update.
- Writes come from server-side routes only (service-role); clients never insert.

### Type registry — where new triggers live

A single file `src/notifications/registry.js` maps each `type` to:

- **icon** (from `lucide-react` — already in deps)
- **message builder** (`({ actor, entity }) => string`)
- **inline actions** (optional — e.g. `friend_request` gets Accept/Decline)
- **deep link** (optional — where clicking the row navigates)

Adding a new notification type = one entry here + one server-side insert wherever the event happens. No UI component changes required, no schema changes.

### Realtime delivery

Use **Supabase Realtime** on the `notifications` table, filtered by `recipient_id = current user`. A `useNotifications` hook subscribes on mount, keeps an in-memory list, and exposes `unreadCount`, `notifications`, and mutation helpers (`markRead`, `respondToRequest`). The bell badge updates live without polling. Zustand ([src/lib/store.js](src/lib/store.js)) holds the count so any component can read it.

---

## UI: Instagram-style overlay, responsive

**Trigger:** bell icon added to the persistent `.logged-in-controls` region in [LoginMorph.jsx](src/login_components/LoginMorph.jsx), sitting to the left of the avatar. Shows a red numeric badge (or dot) when `unreadCount > 0`.

**Panel behavior:**

- **Desktop (≥ 768px):** right-anchored slide-out sheet, ~420px wide, full viewport height, with a semi-transparent backdrop matching the existing `.login-card` overlay pattern.
- **Mobile (< 768px):** full-screen sheet with a header row containing title + close (X).
- A single CSS media query switches the two modes — one component, two layouts.

**Content structure (Instagram-inspired):**

1. **Header:** "Activity" title + close button.
2. **Requests block** (only if there are pending actionable items): "Requests (N) →" — friend requests and club invites live here with inline Accept / Decline buttons.
3. **Chronological feed:** grouped by `Today` / `This week` / `Earlier`. Each row has actor avatar, generated sentence from registry, relative timestamp, and (for actionable types) inline buttons.
4. **Marking read:** opening the panel triggers a bulk `PATCH /me/notifications/read-all-visible` so the badge clears; individual `read_at` timestamps are set server-side.

**Styling foundations to reuse:**

- Modal/backdrop pattern from [LoginMorph.css](src/login_components/LoginMorph.css) (`.login-card` overlay).
- Row layout from [FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) (`.friend-modal-row`).
- Existing colors: `#16193C` panel bg, `#CFD2E5` text, `#ef5a4d` for the unread badge.

No dedicated `/notifications` route in v1 — Instagram doesn't have one on mobile either. Can be added later if history depth becomes a use case.

---

## Prerequisite: real friend-request flow

Today's direct-add model is replaced with a request/accept flow so the notification is meaningful.

### New table

```
friend_requests
  id            uuid PK
  sender_id     uuid
  recipient_id  uuid
  status        text  — 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at    timestamptz default now()
  responded_at  timestamptz nullable
  UNIQUE (sender_id, recipient_id)
```

### Flow changes

- **Send:** [FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) `handleAddFriend` no longer writes `friend_list`. It calls `POST /api/friend-requests`, which inserts a `pending` row **and** a `notifications` row for the recipient (`type: 'friend_request'`). UI updates to show "Requested" instead of "Added."
- **Accept:** `PATCH /api/friend-requests/:id { status: 'accepted' }` — server updates status, appends each user to the other's `friend_list`, and inserts a `friend_accepted` notification back to the sender.
- **Decline:** sets `status = 'declined'`; no notification back to the sender (matches Instagram / LinkedIn norms).
- **Cancel** (sender rescinds): `DELETE /api/friend-requests/:id`.

---

## Files to add or modify

**Database migrations** (Supabase SQL):
- Create `notifications` table + indexes + RLS.
- Create `friend_requests` table + unique constraint + RLS.

**Backend** ([server/routes/](server/routes/)):
- New: `notifications.js` — `GET /me/notifications`, `PATCH /me/notifications/:id` (read / action_taken), `POST /me/notifications/read-all-visible`.
- New: `friend-requests.js` — `POST`, `PATCH /:id`, `DELETE /:id`; each mutating handler also inserts into `notifications`.
- Modify: [server/routes/friends.js](server/routes/friends.js) — deprecate direct-add PUT of `friend_list`; keep the GET for reading current friends. Removal-of-friend behavior stays.

**Frontend** — new `src/notifications/` directory:
- `NotificationBell.jsx` — icon + badge, mounted inside [LoginMorph.jsx](src/login_components/LoginMorph.jsx) `.logged-in-controls`.
- `NotificationsPanel.jsx` — the Instagram-style responsive overlay.
- `NotificationItem.jsx` — one row; dispatches on `type` via the registry.
- `registry.js` — the type → icon/message/actions/deep-link map. Starts with `friend_request` and `friend_accepted` entries.
- `useNotifications.js` — fetch + Supabase Realtime subscription + mark-read helpers.
- `notifications.css` — panel + row styling.

**Frontend modifications:**
- [LoginMorph.jsx](src/login_components/LoginMorph.jsx) — mount `<NotificationBell />` inside `.logged-in-controls`.
- [FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) — call the new friend-request endpoint on add; render "Requested" state for outbound pending requests.
- [src/lib/store.js](src/lib/store.js) — add `unreadCount` to the Zustand store.

---

## How future triggers plug in

To wire up e.g. "someone upvoted your review":

1. In the upvote server route, `INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id) VALUES (...)` with `type = 'review_upvote'`.
2. Add a `review_upvote` entry to `src/notifications/registry.js` (icon, message template, deep link to the review).
3. Done. Realtime, badge, panel rendering, read-tracking all work automatically.

The same three steps cover every future notification type: `club_invite`, `event_reminder`, `comment_reply`, `mention`, `friend_of_friend_joined`, etc.

---

## Verification

- **Two-account flow:** sign in as user A and user B in two browsers. From A, send a friend request to B → confirm B's bell badge lights up **live** (no refresh), overlay shows the request with Accept/Decline. Click Accept → both `friend_list`s update, A gets a `friend_accepted` notification live.
- **Responsive check:** DevTools → viewport ≤ 768px → overlay is full-screen with X close; viewport > 768px → right-anchored ~420px sheet.
- **Read state:** open overlay → all visible items' `read_at` populates server-side; close overlay → badge is 0. Reopen → items still visible but no longer bold.
- **Extensibility smoke test (optional):** temporarily add a fake `type: 'test_ping'` entry to the registry and insert a row directly in Supabase; confirm it renders and clears without any component changes.
- **RLS check:** signed-in user cannot select another user's notification rows via a direct query.
