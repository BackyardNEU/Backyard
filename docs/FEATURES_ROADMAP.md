# Backyard Features Blueprint

> **Deadline:** Live by August move-in week (~12 weeks from May 12)
> **Meeting:** May 11, 2026
> **Authors:** Milo Bell, Connor Friedman, Ben, Ryan Marshall, Ryan Sinha

---

## How to Read This Document

Each feature below includes:
- **What it is** — user-facing description
- **Why it matters for launch** — business justification
- **Technical spec** — database tables, API endpoints, components, and data flow
- **Implementation steps** — ordered checklist a developer can follow
- **Acceptance criteria** — how you know it's done
- **Owner** — assigned at meeting (blank = unassigned)
- **Estimated effort** — in dev-days (1 dev-day = ~4 focused hours)

---

## Phase 1 Features — Infrastructure (May 12 – June 1)

---

### 1.1 Railway Backend Migration

**What:** Move all Supabase data calls from the browser to the Express server. The browser only talks to `/api/*` endpoints. API keys live exclusively on Railway.

**Why:** Right now your Supabase anon key is exposed in the browser bundle. Any user can open DevTools, grab the key, and query your database directly. This is a security dealbreaker for launch.

**Technical Spec:**

```
Browser (React)
    |
    |  fetch('/api/clubs')  <- JWT in Authorization header
    v
Express Server (Railway)
    |
    |  supabaseAdmin.from('demo_club_data').select(...)  <- service-role key
    v
Supabase (PostgreSQL)
```

**Database changes:** None. This is a transport-layer migration.

**New files to create:**
| File | Purpose |
|------|---------|
| `server/supabaseAdmin.js` | Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY` |
| `server/middleware/requireAuth.js` | Extracts JWT from `Authorization: Bearer <token>`, verifies via `supabaseAdmin.auth.getUser(token)`, attaches `req.user` |
| `server/routes/clubs.js` | `GET /api/clubs`, `GET /api/clubs/:id/reviews`, `GET /api/clubs/:id/stats` |
| `server/routes/search.js` | `GET /api/search?q=&school=` |
| `server/routes/universities.js` | `GET /api/universities`, `GET /api/universities/:id` |
| `server/routes/favorites.js` | `GET/POST/DELETE /api/me/favorites` |
| `server/routes/reviews.js` | `POST /api/reviews` |
| `server/routes/votes.js` | `GET/POST/DELETE /api/me/votes` |
| `server/routes/profiles.js` | `GET/PUT/POST /api/me/profile`, `GET/PUT /api/me/membership` |
| `server/routes/friends.js` | `GET/PUT /api/me/friends`, `GET /api/users/search` |
| `server/routes/storage.js` | `POST /api/storage/profile-upload-url`, `POST /api/storage/review-upload-url` |
| `src/lib/api.js` | Frontend fetch helper — attaches JWT, handles errors, hits `/api/*` |

**Files to modify:**
| File | Change |
|------|--------|
| `vite.config.js` | Add `server.proxy: { '/api': 'http://localhost:3001' }` |
| `package.json` | Add `helmet`, ensure `cors`, `dotenv`, `express`, `concurrently` |
| `src/context/ClubDataProvider.jsx` | Replace all `supabase.from()` calls with `apiFetch()` |
| `src/uni_components/UniversityPage.jsx` | Replace university lookup |
| `src/uni_components/UniSearchBar.jsx` | Replace search RPC call |
| `src/uni_components/ExpandedTile.jsx` | Replace reviews/stats/membership fetches |
| `src/uni_components/ClubGrid.jsx` | Replace favorites toggle |
| `src/review_components/ReviewPage.jsx` | Replace image upload + review insert |
| `src/review_components/ReviewList.jsx` | Replace votes fetch/write |
| `src/profile_components/ProfilePage.jsx` | Replace profile + avatar fetch |
| `src/profile_components/ProfileSetupPage.jsx` | Replace all supabase calls |
| `src/profile_components/FriendDiscoveryList.jsx` | Replace friend list calls |
| `src/login_components/AuthListener.jsx` | Replace profile upsert |

**Implementation steps:**
1. Add Railway environment variables: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `PORT`, `FRONTEND_URL`
2. Create `server/supabaseAdmin.js`
3. Create `server/middleware/requireAuth.js`
4. Create public route files (clubs, search, universities) — no auth needed
5. Create `src/lib/api.js` — `apiFetch(path, opts)` that grabs session token and adds Bearer header
6. Migrate `ClubDataProvider.jsx` first (highest impact, touches all pages)
7. Migrate remaining read-only components one at a time
8. Create authenticated route files (favorites, profiles, friends, votes)
9. Migrate write operations (reviews, favorites toggle, profile update, friend list)
10. Create storage routes (signed upload URLs)
11. Migrate image uploads (profile photos, review images)
12. Verify: grep `src/` for any remaining `supabase.from(` — should return zero results
13. Deploy server to Railway, test with production Supabase instance

**Acceptance criteria:**
- [ ] `grep -r "supabase.from|supabase.rpc|supabase.storage" src/` returns 0 matches
- [ ] Only `supabase.auth.*` calls remain in frontend code
- [ ] `.env` / `.env.example` has no Supabase service-role key
- [ ] `VITE_SUPABASE_KEY` is the anon key only (safe to expose for auth)
- [ ] All existing features work identically through the new API layer
- [ ] Railway deployment is accessible and returns 200 on `/api/health`

**Owner:**  
**Effort:** 8-10 dev-days

---

### 1.2 Security Hardening

**What:** Add production security middleware to the Express server — helmet headers, CORS lockdown, rate limiting, and input validation.

**Why:** Without rate limiting, a single script can spam your reviews endpoint 10,000 times. Without helmet, you're missing basic headers that prevent clickjacking, XSS, and MIME sniffing attacks.

**Technical Spec:**

```javascript
// server/index.js additions
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

// Global rate limit: 100 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// Strict limit on write operations: 10 per 15 min
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
app.use('/api/reviews', writeLimiter);
app.use('/api/me/votes', writeLimiter);
```

**Input validation rules:**
| Field | Max Length | Validation |
|-------|-----------|------------|
| Review body | 2000 chars | Strip HTML, trim whitespace |
| Review title | 100 chars | Alphanumeric + basic punctuation |
| Username | 30 chars | Alphanumeric + underscores only |
| Search query | 100 chars | Strip special chars |
| Bio | 500 chars | Strip HTML |

**New dependencies:** `helmet`, `express-rate-limit`

**Implementation steps:**
1. `npm install helmet express-rate-limit`
2. Add helmet middleware as first middleware in `server/index.js`
3. Add global rate limiter after CORS
4. Add strict rate limiter on write endpoints
5. Create `server/middleware/validate.js` — reusable validation functions
6. Add validation to each write route before database operations
7. Lock CORS origin to your actual domain in production (not `*`)

**Acceptance criteria:**
- [ ] `curl -I` shows helmet security headers
- [ ] Sending 101 requests in 15 min returns 429 Too Many Requests
- [ ] Sending a 3000-char review body returns 400 Bad Request
- [ ] CORS rejects requests from unauthorized origins

**Owner:**  
**Effort:** 2 dev-days

---

### 1.3 Custom SMTP (Resend + Supabase)

**What:** Replace Supabase default email sender with Resend so emails come from `@yourbackyard.app` instead of a generic Supabase address.

**Why:** Default Supabase emails have a 4/hour rate limit and look like spam. With Resend, you get 100 emails/day free and proper deliverability.

**Implementation steps:**
1. Create account at resend.com
2. Add and verify your domain (DNS records: SPF, DKIM, DMARC)
3. Generate API key in Resend dashboard
4. In Supabase Dashboard > Authentication > Email Templates — design branded templates
5. In Supabase Dashboard > Project Settings > Auth > SMTP Settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<your Resend API key>`
   - Sender email: `hello@yourbackyard.app`
   - Sender name: `Backyard`
6. Send test email, verify it arrives branded and not in spam

**Acceptance criteria:**
- [ ] Emails arrive from `hello@yourbackyard.app`
- [ ] Email renders with Backyard branding
- [ ] Does NOT land in spam folder

**Owner:**  
**Effort:** 1 dev-day

---

### 1.4 CI/CD Pipeline

**What:** Automated deployment — push to `main` = preview deploy, push to `production` = live deploy.

**Why:** Manual deploys are error-prone. Broken code shouldn't hit production without review.

**Setup:**
- **Frontend:** Vercel (auto-deploys on push, preview URLs per PR)
- **Backend:** Railway (auto-deploys from GitHub)

**Implementation steps:**
1. Connect GitHub repo to Vercel — production branch = `production`, preview = `main`
2. Configure Vercel env vars (VITE_SUPABASE_URL, VITE_SUPABASE_KEY, VITE_API_URL)
3. Connect GitHub repo to Railway — deploy `server/` directory
4. Configure Railway env vars
5. Test: push trivial change to `main`, verify preview updates
6. Create `production` branch, verify live deployment works

**Acceptance criteria:**
- [ ] Push to `main` triggers preview deploy within 3 minutes
- [ ] Push to `production` triggers live deploy within 3 minutes
- [ ] PRs show Vercel preview link in comments
- [ ] Failed builds do NOT deploy

**Owner:**  
**Effort:** 2 dev-days

---

## Phase 2 — Decisions & Design (June 2 – June 15)

> NO CODE in Phase 2. Only decisions and wireframes.

### 2.1 Feature Scope Lock (Due: June 10)

Decide what ships in v1 vs. gets deferred. Fill in this table as a team:

| Feature | Ship in v1? | Reason |
|---------|-------------|--------|
| This Week Calendar | | |
| Friends System | | |
| Club Admin Panel | | |
| Mobile Responsive | | |
| Onboarding Flow | | |
| Notifications | | |
| Event RSVP | | |
| Multi-school | | |
| Dark mode | | |
| Recommendation engine | | |

**Rule:** After June 15, NO new features added to v1. Full stop.

### 2.2 Wireframes — All v1 Pages (Due: June 15)

Milo produces high-fidelity wireframes for every launch page. Desktop + mobile variants.

| Page | Status |
|------|--------|
| Landing page (mobile) | |
| University hub (mobile) | |
| Club expanded view | |
| This Week calendar | |
| Profile page (with friends) | |
| Onboarding flow | |
| Club admin panel | |
| Mobile navigation | |

### 2.3 Monetization Decision (Due: June 8)

Recommended: **Free at launch.** Get 500+ users, prove value, monetize in September.

### 2.4 Analytics Setup (Due: June 10)

Pick a tool (PostHog recommended — free 1M events/mo). Install before Phase 3 so you track everything from day 1.

---

## Phase 3 Features — Build Sprint (June 16 – July 20)

---

### 3.1 This Week Calendar

**What:** Day-by-day view (Mon-Fri) showing club activities, interest counts, and friend activity.

**Why:** This is THE differentiator. It answers "what should I do today?" — the #1 question during move-in.

**New database tables:**

```sql
CREATE TABLE club_weekly_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES demo_club_data(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  monday_summary TEXT,
  tuesday_summary TEXT,
  wednesday_summary TEXT,
  thursday_summary TEXT,
  friday_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, week_start_date)
);

CREATE TABLE user_weekly_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES club_weekly_activities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id, day_of_week)
);
```

**API endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/weekly?week=2026-06-16` | No | Get all activities for a week |
| POST | `/api/weekly/interest` | Yes | Toggle interest |
| DELETE | `/api/weekly/interest` | Yes | Remove interest |
| POST | `/api/weekly/activities` | Yes (admin) | Create/update week activities |

**New components:**
- `src/uni_components/WeeklySchedule.jsx` — 5 day columns
- `src/uni_components/WeeklyClubCard.jsx` — card per club per day
- `src/uni_components/InterestButton.jsx` — optimistic toggle

**Data flow:**
```
Click "This Week" in IconBar
  -> UniversityPage sets category = "this_week"
  -> GET /api/weekly?week=<current Monday>
  -> Server returns activities joined with club data + interest counts
  -> WeeklySchedule groups by day, renders cards
  -> User clicks "Interested" -> POST /api/weekly/interest
  -> Optimistic UI updates count
```

**Implementation steps:**
1. Create tables in Supabase SQL editor
2. Add RLS policies (anyone reads, authenticated writes interests, admins write activities)
3. Create `server/routes/weekly.js`
4. Build `WeeklySchedule.jsx` — responsive grid (5 cols desktop, swipe on mobile)
5. Build `WeeklyClubCard.jsx` — club image, name, summary, interest count, friend avatars
6. Build `InterestButton.jsx` — toggle with optimistic update
7. Update `IconBar.jsx` — add calendar icon
8. Update `UniversityPage.jsx` — render WeeklySchedule when category = "this_week"
9. Seed 10 clubs with test activities
10. Test on mobile (horizontal scroll)

**Acceptance criteria:**
- [ ] Mon-Fri grid displays with club activities
- [ ] "Interested" button toggles and updates count in real time
- [ ] Friends' avatars appear on activities they're interested in
- [ ] Empty days show placeholder
- [ ] Works on mobile (swipe between days)

**Owner:**  
**Effort:** 5-6 dev-days

---

### 3.2 Friends System

**What:** Send/accept friend requests, view friends' profiles, see friends' activity.

**Why:** Social proof drives engagement. "3 friends are in this club" is more compelling than any description.

**New database table:**

```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);
```

> **Migration:** Deprecate the current `profiles.friend_list` array column in favor of this table.

**API endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/friends` | Yes | List accepted friends |
| GET | `/api/me/friends/pending` | Yes | List incoming requests |
| POST | `/api/me/friends/request` | Yes | Send request |
| PUT | `/api/me/friends/:id/accept` | Yes | Accept request |
| DELETE | `/api/me/friends/:id` | Yes | Remove/reject |
| GET | `/api/users/search?q=` | Yes | Search users |

**User flow:**
```
User A searches for User B -> clicks "Add Friend"
  -> POST /api/me/friends/request { user_id: B }
  -> User B sees pending request in profile
  -> User B clicks "Accept"
  -> Both see each other in friend lists + activity
```

**Implementation steps:**
1. Create `friendships` table with RLS
2. Create `server/routes/friends.js`
3. Rewrite `FriendDiscoveryList.jsx` — pending requests, search, current friends
4. Update `ProfilePage.jsx` — show friend count
5. Update `WeeklyClubCard.jsx` — show friend avatars on interests
6. Update `ExpandedTile.jsx` — show "X friends are members"
7. Add notification indicator for pending requests
8. Migrate data from `friend_list` column to new table
9. Remove `friend_list` column after migration verified

**Acceptance criteria:**
- [ ] Can search users, send/accept/reject friend requests
- [ ] Friends appear in each other's lists
- [ ] Friend avatars show on This Week activities
- [ ] Club views show "X friends are members"
- [ ] Cannot friend yourself or send duplicate requests

**Owner:**  
**Effort:** 5 dev-days

---

### 3.3 Club Admin Panel

**What:** Club leaders can edit their club info, post weekly activities, and upload photos.

**Why:** Without this, YOUR team manually updates all club data. That doesn't scale past 10 clubs.

**New database table:**

```sql
CREATE TABLE club_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES demo_club_data(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'editor')) DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);
```

**API endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/admin-clubs` | Yes | List clubs you manage |
| PUT | `/api/clubs/:id` | Yes (admin) | Update club info |
| POST | `/api/clubs/:id/activities` | Yes (admin) | Post weekly activities |
| POST | `/api/clubs/:id/admins` | Yes (owner) | Invite admin |

**New components:**
- `src/admin_components/AdminDashboard.jsx`
- `src/admin_components/ClubEditor.jsx`
- `src/admin_components/ActivityEditor.jsx`

**Implementation steps:**
1. Create `club_admins` table, seed your team as test admins
2. Create `server/middleware/requireClubAdmin.js`
3. Create admin API routes
4. Build `AdminDashboard.jsx` — list your clubs
5. Build `ClubEditor.jsx` — edit form with save
6. Build `ActivityEditor.jsx` — Mon-Fri inputs, week picker
7. Add `/admin` route to `App.jsx`
8. Add "Manage" button on club tiles (visible only to admins)

**Acceptance criteria:**
- [ ] Admins see "Manage" on their clubs
- [ ] Can edit description, links, meeting times
- [ ] Can post weekly activities
- [ ] Non-admins get 403 on admin endpoints
- [ ] Changes reflect immediately on public view

**Owner:**  
**Effort:** 5 dev-days

---

### 3.4 Mobile Responsive

**What:** Every page designed for mobile-first. Not "doesn't break" — actually great on phones.

**Why:** 70%+ of move-in traffic will be mobile. If it doesn't work on phones, you've lost most users.

**Breakpoints:**
- < 640px: Mobile (PRIORITY)
- 640-1024px: Tablet
- > 1024px: Desktop (current)

**Key changes:**
| Page | Mobile Solution |
|------|----------------|
| University hub | Single-column cards, bottom tab navigation |
| Club expanded view | Full-screen bottom sheet |
| This Week | Horizontal swipe between days OR tab-per-day |
| Profile | Stack all sections vertically |
| Search | Full-width input, dismiss keyboard on scroll |

**Implementation steps:**
1. Wait for Milo's mobile wireframes (Phase 2 deliverable)
2. Add viewport meta tag if missing
3. Build mobile bottom tab navigation
4. Convert club grid to responsive (1 col mobile, 2 tablet, 3 desktop)
5. Convert expanded view to bottom sheet on mobile
6. Make This Week swipeable on mobile
7. Fix all touch targets to 44px minimum
8. Test on real devices
9. Lighthouse mobile audit > 80

**Acceptance criteria:**
- [ ] All pages usable on 375px width
- [ ] No horizontal scroll anywhere
- [ ] All touch targets >= 44px
- [ ] Bottom tab nav works on mobile
- [ ] Lighthouse mobile > 80

**Owner:** Milo +  
**Effort:** 6-8 dev-days

---

### 3.5 Onboarding Flow

**What:** New users: pick school -> select interests -> get personalized recommendations.

**Why:** A blank homepage means nothing to new users. Onboarding shows value in 60 seconds.

**Flow:**
```
Sign up -> Google OAuth
  -> Step 1: "What's your school?" (search/select)
  -> Step 2: "What are you into?" (pick 3-5 categories)
  -> Step 3: "Clubs for you" (8-12 recommendations, can save)
  -> Redirect to university page
```

**Database change:**
```sql
ALTER TABLE profiles ADD COLUMN interests TEXT[] DEFAULT '{}';
```

**New components:**
- `src/onboarding/OnboardingFlow.jsx` — step wizard
- `src/onboarding/SchoolPicker.jsx`
- `src/onboarding/InterestPicker.jsx`
- `src/onboarding/RecommendedClubs.jsx`

**Implementation steps:**
1. Add `interests` column to profiles
2. Create recommendation API — clubs matching interests at user's school
3. Build 3-step wizard with Framer Motion transitions
4. Update `AuthListener.jsx` — redirect new users to `/onboarding`
5. Add `/onboarding` route
6. Test full flow on mobile

**Acceptance criteria:**
- [ ] New users redirected to onboarding
- [ ] Can pick school, select 3-5 interests
- [ ] Recommendations show relevant clubs
- [ ] Can save clubs from recommendations screen
- [ ] Returning users skip onboarding
- [ ] Works on mobile

**Owner:**  
**Effort:** 4 dev-days

---

### 3.6 Notifications

**What:** In-app notification bell + email alerts for friend requests, event reminders, and weekly digests.

**Why:** Without notifications, users forget Backyard exists. Notifications pull them back.

**New database table:**

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Notification types:**
| Type | Trigger | Channel |
|------|---------|---------|
| Friend request | Someone adds you | In-app + email |
| Friend accepted | Someone accepts | In-app |
| Event tomorrow | RSVP'd activity is tomorrow | Email |
| Weekly digest | Sunday evening | Email |

**New components:**
- `src/notifications/NotificationBell.jsx` — icon with unread badge
- `src/notifications/NotificationPanel.jsx` — dropdown list

**Implementation steps:**
1. Create `notifications` table
2. Create notification API (GET, mark read, mark all read)
3. Build bell icon + panel
4. Trigger notifications from friend request / review / RSVP flows
5. Set up Resend templates for email notifications
6. Build daily cron job for event reminders
7. Build weekly digest job

**Acceptance criteria:**
- [ ] Bell shows unread count
- [ ] Panel lists notifications, marks read on click
- [ ] Friend requests trigger notifications
- [ ] Email arrives for event reminders
- [ ] Users can opt out of emails

**Owner:**  
**Effort:** 5 dev-days

---

### 3.7 Event RSVP

**What:** Users confirm "Going" to events. Club leaders see headcount.

**Why:** "Interested" is soft. RSVP gives real attendance data and increases show-up rates.

**Database:**
```sql
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES club_weekly_activities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
  status TEXT CHECK (status IN ('going', 'maybe')) DEFAULT 'going',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id, day_of_week)
);
```

**Implementation steps:**
1. Create table
2. Add RSVP endpoints to `server/routes/weekly.js`
3. Update `WeeklyClubCard.jsx` — add "Going" button, show count
4. Add RSVP list in admin panel
5. Integrate with notifications (remind day before)

**Acceptance criteria:**
- [ ] Users can RSVP going/maybe
- [ ] Count shows on cards
- [ ] Admins see who's going
- [ ] RSVP'd events show on profile

**Owner:**  
**Effort:** 3 dev-days

---

### 3.8 Search Improvements

**What:** Autocomplete, fuzzy matching, trending clubs, recent searches.

**Why:** Current search is exact-match. Misspellings = zero results = frustrated users.

**Database changes:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_club_name_trgm ON demo_club_data USING gin (name gin_trgm_ops);

CREATE TABLE club_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES demo_club_data(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation steps:**
1. Enable pg_trgm extension, create trigram index
2. Update search RPC to use `similarity()` for fuzzy matching
3. Create `club_views` table, log views on club expand
4. Create trending endpoint (most-viewed this week)
5. Update SearchBar — debounced autocomplete, trending on empty, recent from localStorage

**Acceptance criteria:**
- [ ] Results appear as user types (300ms debounce)
- [ ] Misspellings return relevant results
- [ ] Empty search shows trending
- [ ] Results in < 200ms

**Owner:**  
**Effort:** 3 dev-days

---

## Phase 4 — Polish & QA (July 21 – Aug 3)

---

### Launch Checklist (Every box = required to ship)

**Functionality:**
- [ ] All "Must Ship" features merged and working
- [ ] Works on mobile (iPhone SE, iPhone 14, Pixel 7)
- [ ] Works on desktop (Chrome, Safari, Firefox)
- [ ] Sign-up -> onboarding -> browse -> save -> RSVP works end-to-end
- [ ] Error states handled (no blank screens)
- [ ] Loading states on all async operations
- [ ] Empty states for all lists

**Performance:**
- [ ] Lighthouse mobile > 80
- [ ] Largest Contentful Paint < 2.5s
- [ ] Images lazy loaded
- [ ] Bundle < 500KB gzipped

**Security:**
- [ ] No API keys in frontend code
- [ ] All write endpoints require auth
- [ ] Rate limiting active
- [ ] Input validation on all user content
- [ ] CORS locked to production domain
- [ ] HTTPS only

**Infrastructure:**
- [ ] Custom domain with SSL
- [ ] Railway backend auto-deploying
- [ ] Frontend auto-deploying
- [ ] Error tracking (Sentry) catching exceptions
- [ ] Database backups enabled

**Content:**
- [ ] All NEU clubs have data (name, desc, category, image)
- [ ] 20+ clubs have weekly activities seeded
- [ ] 5+ clubs have real reviews
- [ ] All placeholder text removed
- [ ] Email templates proofread

**Go/No-Go:**
- [ ] Load test: 500 concurrent users, <500ms p95, 0% errors
- [ ] Bug bash complete: zero critical/high bugs open
- [ ] Rollback plan documented and tested
- [ ] Entire team can deploy independently

---

### Bug Bash Process (July 21-22)

1. Each member spends 4 hours breaking the app
2. Test on YOUR actual phone
3. Log in GitHub Issues: steps to reproduce, expected vs actual, screenshot, severity
4. Triage together July 23: fix Critical/High by July 27, defer Low to post-launch

---

## Phase 5 — Launch (Aug 4 – Move-in)

### Pre-Launch (1 week before)
| Task | Owner |
|------|-------|
| Teaser Instagram — "Something's coming to NEU" | |
| Teaser TikTok — 15s UI reveal | |
| Print 200 QR code flyers for dorms | |
| Prep activities fair demo (phone + laptop) | |

### Launch Day
| Task | Owner |
|------|-------|
| Flip DNS to production | |
| Monitor error tracking first 2 hours | |
| Coordinate social posts | |
| Emergency hotfix rotation (4hr shifts, 48hrs) | |

### Post-Launch Week 1
| Task | Owner |
|------|-------|
| Activities fair demo | |
| User feedback survey (Google Forms) | |
| Track: sign-ups/day, DAU, clubs viewed | |
| Get 10+ club leaders to post activities | |
| Hotfix critical bugs same-day | |

---

## Effort Summary

| Phase | Dev-Days | Weeks | Notes |
|-------|----------|-------|-------|
| Phase 1 | 15 | 3 | Railway + Security + SMTP can run in parallel |
| Phase 2 | 0 | 2 | Decisions only |
| Phase 3 | 35 | 5 | Features 3.1-3.3 are independent, parallelize |
| Phase 4 | 10 | 2 | Bug fixes parallel, load test sequential |
| Phase 5 | 5 | 1 | Marketing tasks independent |

**Total: ~65 dev-days / 4 devs = ~16 days each over 12 weeks. Very doable.**

---

## PR Buddy Reference

| Dev | Buddy | Backup |
|-----|-------|--------|
| Connor | Ryan Sinha | Anyone |
| Ryan Sinha | Connor | Anyone |
| Ben | Ryan Marshall | Anyone |
| Ryan Marshall | Ben | Anyone |
| Milo (frontend) | Anyone | — |

**Commit format:**
```
[PHASE-X.Y] Short description

- Detail if needed
```

Example:
```
[PHASE-3.1] Add WeeklySchedule component with day columns

- Fetches from /api/weekly
- Responsive grid, stacks on mobile
```
