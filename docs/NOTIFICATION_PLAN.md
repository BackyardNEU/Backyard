# Backyard Notification System — Implementation Guide

## Context

Backyard is targeting tens of thousands of users. Notifications must be designed so that thousands of triggers per minute across many event types (friend request, club invite, review upvote, mention, comment reply, event reminder...) can be dispatched without spam, without duplicated logic in every route, and with room to grow into email and push without re-architecture.

The guiding principles:

1. **One choke point** — every notification-worthy event flows through a single service. No feature route writes to the notifications table directly.
2. **Decide, then deliver** — a decision layer sits between "an event happened" and "a notification is stored/sent." It owns preferences, dedup, and (later) rate limits, batching, and quiet hours.
3. **Fan out to channels** — the same event can produce an in-app row, an email, and a push, chosen by preferences. Channels are pluggable.
4. **Queue everything** — dispatch is async through pg-boss (Postgres-based, runs inside the existing Supabase Postgres). Trigger routes return immediately; the worker handles the work with retries and backpressure.

Rollout scope for v1: **in-app + email**. Push (OneSignal) lands later behind the same interface — no re-architecture required.

---

## Architecture

```
trigger route → NotificationService.dispatch(event)
                       │
                       ▼
              pg-boss queue: 'notifications.dispatch'
                       │
                       ▼
         worker → Decision Layer
                  (load user prefs → dedup → future: rate-limit /
                   batch / quiet-hours → pick channels)
                       │
                       ▼
            fan-out: DB insert (in-app)  +  Resend (email)
                              │              │
                              ▼              ▼
                   Supabase Realtime      email sent
                     → client bell
```

**Rules of the system:**

- The **only writer** to `notifications` is `channels/inApp.js`. Direct `INSERT INTO notifications` from feature routes is forbidden.
- Trigger routes are dumb: they call `dispatch({ type, recipientId, actorId, entity, payload })` and return their normal response.
- **One handler per notification type** on the backend (`server/notifications/handlers/*.js`) describes the event → row(s) + channels mapping.
- **One entry per notification type** on the frontend registry (`src/notifications/registry.js`) describes icon, message template, inline actions, and deep link.
- Adding a new notification type = one handler + one registry entry + one call to `dispatch` from the trigger route. No schema changes, no queue changes.

---

## Data model

### `notifications` (in-app feed + audit)

```
notifications
  id             uuid PK
  recipient_id   uuid                      — who sees it
  actor_id       uuid nullable             — who caused it (null for system events)
  type           text                      — 'friend_request', 'friend_accepted',
                                             'club_invite', 'review_upvote', ...
  entity_type    text nullable             — 'friend_request', 'club', 'review', ...
  entity_id      uuid nullable             — row this notification points to
  read_at        timestamptz nullable
  action_taken   text nullable             — 'accepted', 'declined', 'dismissed'
  grouping_key   text nullable             — for later coalescing
  channel_status jsonb                     — { in_app: 'delivered', email: 'sent',
                                             push: 'skipped:disabled' }
  created_at     timestamptz default now()
```

- Indexes: `(recipient_id, created_at DESC)`; partial index `(recipient_id) WHERE read_at IS NULL` for unread count.
- RLS: `recipient_id = auth.uid()` on select/update.
- Writes are service-role only, from `channels/inApp.js`.
- `channel_status` makes "why didn't I get an email for this?" debuggable without a separate audit table.

### `notifications_archive`

Same shape as `notifications`. A nightly pg-boss cron job moves rows where `read_at < now() - interval '90 days'` here. Keeps the hot table small; historical lookups are still possible via UNION when needed.

### `notification_preferences`

```
notification_preferences
  user_id   uuid       — FK profiles.id
  type      text       — matches notifications.type
  channel   text       — 'in_app' | 'email' | 'push'
  enabled   bool
  PRIMARY KEY (user_id, type, channel)
```

- **Default is enabled**: absence of a row = channel is on. No need to backfill for every user × every type.
- Overrides only. The decision layer merges hardcoded defaults with any rows it finds.
- RLS: `user_id = auth.uid()` on select/update; server writes via service role from the settings endpoints.
- v1 does **not** ship a settings UI. The table exists so the decision layer can honor overrides once the settings page lands.

### `friend_requests` (prerequisite — see "Friend-request flow" below)

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

---

## Server pipeline

### `server/notifications/service.js` — the public API

```
NotificationService.dispatch({
  type,           // 'friend_request'
  recipientId,    // uuid
  actorId,        // uuid or null
  entity,         // { kind: 'friend_request', id: <uuid> }
  payload         // free-form JSON passed to the handler
})
```

- Publishes a `notifications.dispatch` job to pg-boss.
- Returns immediately. Trigger route continues its normal response.
- Never throws to the caller for delivery errors — the queue owns retries.

### `server/notifications/queue.js` — pg-boss instance

- Uses the same Postgres URL as Supabase (service-role connection string).
- `boss.start()` wired into [server/index.js](server/index.js) boot sequence.
- Runs in-process in the existing Express server. Can be split into a dedicated worker later without changing callers.
- Registered jobs:
  - `notifications.dispatch` — main worker
  - `notifications.archive` — nightly cron (`0 3 * * *` UTC) to move read rows to archive

### `server/notifications/decisionLayer.js` — pure function

Signature: `(event, prefs, recentHistory) → { channels: string[], skip?: reason }`.

**v1 implements:**
- **Preferences lookup**: merge defaults with `notification_preferences` rows for the user; drop any channel where `enabled = false`.
- **Dedup**: skip if a row already exists for `(recipient_id, type, entity_id)` within a short window (default 5 minutes). Prevents double-fire from retries or accidental double-clicks.

**v1 stubs (return "allow"), wire up later:**
- `rateLimit(event, prefs, recentHistory)` — e.g., max 3 push/day per user unless high-priority.
- `batch(event, prefs, recentHistory)` — coalesce by `grouping_key` inside a rolling window (e.g., upvotes on one review → one notification every 15 min).
- `quietHours(event, prefs)` — no push between 10pm–8am user local; queue for a morning digest instead.

Keep these as named functions in the file with clear input/output contracts so filling them in later is a scoped change.

### `server/notifications/handlers/` — one file per type

Each handler exports:

```
{
  buildRow(event)                → notifications row (minus channel_status)
  channels(event, prefs)         → string[]  // subset of ['in_app', 'email', 'push']
  emailTemplate?                 → template name for channels/email.js
}
```

v1 handlers to create:
- `friendRequest.js`
- `friendAccepted.js`

### `server/notifications/channels/` — one file per channel

- `inApp.js` — inserts the row via `supabaseAdmin`. Supabase Realtime pushes to the client. Sets `channel_status.in_app = 'delivered'`.
- `email.js` — renders the template from `emailTemplates/<type>.jsx` (or `.hbs`), calls [server/lib/resend.js](server/lib/resend.js) (already installed but currently unused). Sets `channel_status.email` accordingly.
- `push.js` — **v1 stub**. Exports a no-op with a `TODO: OneSignal` comment. When push lands, this file wires up OneSignal and everything else stays the same.

### `server/notifications/emailTemplates/`

One file per type that ships email. v1: `friend_request.jsx`, `friend_accepted.jsx`. Missing template = email channel is auto-skipped for that type.

---

## Frontend

### `src/notifications/registry.js` — type → UI map

For each type: icon (from `lucide-react`), message builder `({ actor, entity }) => string`, optional inline actions (e.g. Accept/Decline for `friend_request`), optional deep link.

Starts with `friend_request` and `friend_accepted`.

### `src/notifications/useNotifications.js`

- Fetches initial page from `GET /api/me/notifications`.
- Subscribes to Supabase Realtime on `notifications` filtered by `recipient_id = current user`.
- Exposes `unreadCount`, `notifications`, `markRead(id)`, `respondToRequest(id, action)`.
- Backs `unreadCount` in the Zustand store ([src/lib/store.js](src/lib/store.js)) so any component can read it.

### `src/notifications/NotificationBell.jsx`

- Mounted inside `.logged-in-controls` in [src/login_components/LoginMorph.jsx](src/login_components/LoginMorph.jsx), sitting to the left of the avatar.
- Shows a red numeric badge when `unreadCount > 0`.

### `src/notifications/NotificationsPanel.jsx` — Instagram-style overlay

- **Desktop (≥ 768px)**: right-anchored slide-out sheet, ~420px wide, full viewport height, semi-transparent backdrop.
- **Mobile (< 768px)**: full-screen sheet with a header row (title + X close).
- Single CSS media query switches the two modes.

**Content:**
1. Header: "Activity" + close.
2. Requests block (only if there are pending actionable items): friend requests and club invites with inline Accept / Decline buttons.
3. Chronological feed grouped by `Today` / `This week` / `Earlier`. Each row: actor avatar, generated sentence, relative timestamp, optional inline buttons.
4. Opening the panel triggers `POST /api/me/notifications/read-all-visible` — badge clears; individual `read_at` timestamps set server-side.

### `src/notifications/NotificationItem.jsx`

One row. Dispatches on `type` via the registry.

### `src/notifications/notifications.css`

Panel + row styling. Reuse:
- Modal/backdrop pattern from [src/login_components/LoginMorph.css](src/login_components/LoginMorph.css) (`.login-card` overlay).
- Row layout from [src/profile_components/FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) (`.friend-modal-row`).
- Existing colors: `#16193C` panel bg, `#CFD2E5` text, `#ef5a4d` for the unread badge.

No dedicated `/notifications` route in v1. Instagram doesn't have one on mobile either. Can be added later if history depth becomes a use case.

---

## Friend-request flow (prerequisite)

Today [server/routes/friends.js](server/routes/friends.js) implements a *direct-add* model — user A writes user B into their `friend_list` with no approval step. A meaningful "friend request" notification requires a request/accept flow first.

- **Send**: [src/profile_components/FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) `handleAddFriend` no longer writes `friend_list` directly. It calls `POST /api/friend-requests`, which inserts a `pending` row **and** calls `NotificationService.dispatch({ type: 'friend_request', ... })`. UI shows "Requested" instead of "Added."
- **Accept**: `PATCH /api/friend-requests/:id { status: 'accepted' }` — server updates status, appends each user to the other's `friend_list`, and dispatches `friend_accepted` back to the sender.
- **Decline**: sets `status = 'declined'`; no notification back to the sender (matches Instagram / LinkedIn norms).
- **Cancel** (sender rescinds): `DELETE /api/friend-requests/:id`.

---

## Files to add or modify

### Database migrations (Supabase SQL)

- Create `notifications` table + indexes + RLS + `channel_status` column.
- Create `notifications_archive` table (same shape).
- Create `notification_preferences` table + RLS.
- Create `friend_requests` table + unique constraint + RLS.

### Backend

**New:**
- `server/notifications/service.js` — `NotificationService.dispatch()` API.
- `server/notifications/queue.js` — pg-boss instance + job registration.
- `server/notifications/decisionLayer.js` — prefs + dedup (v1); rateLimit/batch/quietHours stubs.
- `server/notifications/handlers/friendRequest.js`
- `server/notifications/handlers/friendAccepted.js`
- `server/notifications/channels/inApp.js`
- `server/notifications/channels/email.js`
- `server/notifications/channels/push.js` — no-op stub with TODO for OneSignal.
- `server/notifications/emailTemplates/friend_request.jsx`
- `server/notifications/emailTemplates/friend_accepted.jsx`
- `server/routes/notifications.js` — `GET /me/notifications`, `PATCH /me/notifications/:id`, `POST /me/notifications/read-all-visible`.
- `server/routes/friend-requests.js` — `POST`, `PATCH /:id`, `DELETE /:id`; mutating handlers call `NotificationService.dispatch()`.

**Modify:**
- [server/index.js](server/index.js) — call `boss.start()` during boot.
- [server/routes/friends.js](server/routes/friends.js) — deprecate direct-add PUT of `friend_list`; keep GET. Removal-of-friend stays.
- `package.json` — add `pg-boss` dependency.

**Already exists (reuse, do not duplicate):**
- [server/supabaseAdmin.js](server/supabaseAdmin.js) — service-role client for `channels/inApp.js`.
- [server/lib/resend.js](server/lib/resend.js) — Resend wrapper; `channels/email.js` consumes this.
- [server/middleware/requireAuth.js](server/middleware/requireAuth.js) — JWT auth for the new routes.

### Frontend

**New (`src/notifications/`):**
- `NotificationBell.jsx`
- `NotificationsPanel.jsx`
- `NotificationItem.jsx`
- `registry.js`
- `useNotifications.js`
- `notifications.css`

**Modify:**
- [src/login_components/LoginMorph.jsx](src/login_components/LoginMorph.jsx) — mount `<NotificationBell />` inside `.logged-in-controls`.
- [src/profile_components/FriendDiscoveryList.jsx](src/profile_components/FriendDiscoveryList.jsx) — call the new friend-request endpoint on add; render "Requested" state for outbound pending requests.
- [src/lib/store.js](src/lib/store.js) — add `unreadCount` to the Zustand store.

---

## Adding a new trigger type (e.g. "someone upvoted your review")

1. In the upvote server route:
   `await NotificationService.dispatch({ type: 'review_upvote', recipientId, actorId, entity: { kind: 'review', id: reviewId } })`
2. Create `server/notifications/handlers/reviewUpvote.js` — row shape + which channels.
3. Add a `review_upvote` entry to [src/notifications/registry.js](src/notifications/registry.js) — icon, message template, deep link.
4. (Optional) Add `server/notifications/emailTemplates/review_upvote.jsx` if email delivery is desired. Missing template = email channel is auto-skipped.

Nothing in the queue, decision layer, or Realtime hook changes.

---

## What we are deliberately NOT building yet

- **No ML relevance scoring.** Rule-based decision layer only. Revisit at millions of events/day.
- **No multi-datacenter redundancy.** Single Supabase region is fine below ~100k DAU.
- **No custom stream processing (Kafka, Flink, etc.).** pg-boss covers v1 through v3.
- **No sub-second latency SLAs.** Realtime is near-realtime for in-app; email/push are best-effort.
- **No settings UI in v1.** The `notification_preferences` table exists so the decision layer can honor overrides once the settings page is built.
- **No push in v1.** `channels/push.js` is a stub. When it's time, wiring OneSignal is a one-file addition — no changes elsewhere.
- **No rate-limit / batching / quiet-hours logic in v1.** The stubs exist in `decisionLayer.js` with clear contracts. Fill them in when spam or delivery-window issues are observed.

---

## Verification

### End-to-end two-account flow

Sign in as user A and user B in two browsers.

1. From A, send a friend request to B → confirm B's bell badge lights up **live** (no refresh). Overlay shows the request with Accept/Decline.
2. Click Accept → both `friend_list`s update, A gets a `friend_accepted` notification live.
3. If both users have email enabled in prefs, confirm Resend sent an email to B (friend_request) and A (friend_accepted).

### Choke-point enforcement

Grep the server for `.from('notifications').insert` — the **only** match must be inside `server/notifications/channels/inApp.js`.

### Dedup

Send the same friend request twice within 5 minutes → the second one is skipped by the decision layer, no duplicate row, no duplicate email.

### Preferences honored

Manually insert `{ user_id, type: 'friend_request', channel: 'email', enabled: false }` → send a friend request → in-app row appears, no Resend call fires. Verify via `channel_status`.

### Queue durability

Kill the Node process mid-dispatch (before the worker picks up the job), restart → job is still in pg-boss, is processed, notification lands.

### Archive job

Manually seed a row with `read_at = now() - interval '95 days'` → trigger the archive job (or wait for nightly cron) → row is now in `notifications_archive` and gone from `notifications`.

### Responsive UI

DevTools → viewport ≤ 768px → overlay is full-screen with X close. Viewport > 768px → right-anchored ~420px sheet with backdrop.

### Read state

Open overlay → all visible items' `read_at` populates server-side; close overlay → badge is 0. Reopen → items still visible but no longer bold.

### RLS

Signed-in user cannot select another user's notification rows via a direct Supabase query with the anon key.

### Extensibility smoke test

Temporarily add a fake `type: 'test_ping'` entry to `registry.js`, register a handler, and call `NotificationService.dispatch({ type: 'test_ping', ... })` from a debug endpoint. Confirm it renders in the panel and clears without any component changes.


## File Structure

NewBackyard/
├── server/
│   ├── notifications/                     ← already created
│   │   ├── service.js                     ✅ exists
│   │   ├── queue.js                       ✅ exists
│   │   ├── decisionLayer.js               🆕 new
│   │   ├── handlers/
│   │   │   ├── friendRequest.js           🆕 new
│   │   │   └── friendAccepted.js          🆕 new
│   │   ├── channels/
│   │   │   ├── inApp.js                   🆕 new
│   │   │   ├── email.js                   🆕 new
│   │   │   └── push.js                   🆕 new (stub)
│   │   └── emailTemplates/
│   │       ├── friend_request.jsx         🆕 new
│   │       └── friend_accepted.jsx        🆕 new
│   ├── routes/
│   │   ├── friends.js                     ✅ exists → modify
│   │   ├── friend-requests.js             🆕 new
│   │   ├── notifications.js               🆕 new
│   │   └── ... (all other routes)         ✅ untouched
│   ├── middleware/
│   │   └── requireAuth.js                 ✅ exists → reuse
│   ├── lib/
│   │   └── resend.js                      ✅ exists → reuse
│   ├── supabaseAdmin.js                   ✅ exists → reuse
│   └── index.js                           ✅ exists → modify
│
├── src/
│   ├── notifications/                     🆕 entire folder is new
│   │   ├── registry.js
│   │   ├── useNotifications.js
│   │   ├── NotificationBell.jsx
│   │   ├── NotificationsPanel.jsx
│   │   ├── NotificationItem.jsx
│   │   └── notifications.css
│   ├── lib/
│   │   └── store.js                       ✅ exists → modify (add unreadCount)
│   ├── login_components/
│   │   └── LoginMorph.jsx                 ✅ exists → modify (mount bell)
│   └── profile_components/
│       └── FriendDiscoveryList.jsx        ✅ exists → modify (request flow)