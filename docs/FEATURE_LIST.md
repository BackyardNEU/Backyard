# Backyard — Feature List

---

## Club Discovery
- Browse all clubs at your university in a visual grid
- Filter by category (sports, arts, tech, business, community service, academic, social, music, political)
- Search with autocomplete and fuzzy matching (handles typos)
- Trending clubs section (most viewed this week)
- Recent searches saved locally
- Club comparison — side-by-side view of similar clubs

## Club Profiles
- Club description, meeting times, location
- Photo gallery (uploaded by club admins)
- Category tags
- Member count
- Links to socials (Instagram, Discord, GroupMe, website)
- "Save" / heart to add to your favorites

## Reviews & Ratings
- Students can write text reviews for clubs
- Star ratings (overall, community, commitment level, etc.)
- Upvote/downvote system — best reviews rise to the top
- Photo attachments on reviews
- Review stats (averages, total count)
- "Verified member" badge on reviews from actual members

## This Week (Live Event Calendar)
- Day-by-day view (Monday through Friday)
- Each club posts a 1-line summary of what they're doing that day
- "I'm Interested" button with live count
- "Going" RSVP with headcount for club leaders
- See which friends are interested/going
- Week navigation (view next week's schedule)
- Empty day placeholders ("Nothing scheduled")

## Friends & Social
- Search for users by username
- Send/accept/reject friend requests
- Pending requests notification
- Mutual friends indicator
- See friends' club memberships
- See friends' activity on This Week calendar
- Block users

## Profiles
- Profile photo upload
- Username and bio
- University affiliation
- Interest tags (selected during onboarding)
- Club membership badges
- Activity feed (joined club, wrote review, RSVP'd)
- Friends list with count
- Stats (clubs joined, reviews written, events attended)

## Onboarding
- Step 1: Select your university
- Step 2: Pick 3-5 interest categories
- Step 3: Personalized club recommendations
- Save clubs directly from recommendations
- Skip option for returning users

## Notifications
- In-app notification bell with unread count
- Friend request received alert
- Friend request accepted alert
- Event reminder (day before RSVP'd activity)
- New review on your club (for admins)
- Weekly digest email (Sunday — "Here's what's happening this week")
- Notification preferences (opt out per type)

## Club Admin Panel
- Edit club description, links, meeting times
- Upload/change club photos
- Post weekly activities (Mon-Fri summaries)
- View RSVP list (who's coming to your events)
- Invite other admins/editors
- Role system (owner, admin, editor)

## Moderation
- Profanity filter on reviews and bios
- AI image scanning (block inappropriate uploads)
- Report users (with reason selection)
- Report reviews (spam, inappropriate, fake)
- Block users (hide their content from your feed)
- Admin review queue (flagged content for manual approval)
- Rate limiting on all write actions (prevent spam bots)
- Character limits on all text inputs
- Auto-flag accounts with multiple reports

## Authentication & Security
- Google OAuth one-click sign-in (university accounts)
- JWT-based session management
- All API keys server-side only (never exposed to browser)
- Helmet security headers
- CORS locked to production domain
- HTTPS enforced
- Input sanitization on all endpoints
- Bot protection (rate limiting per IP)

## Mobile Experience
- Fully responsive on all screen sizes (375px+)
- Bottom tab navigation on mobile
- Touch-friendly targets (44px minimum)
- Swipeable This Week calendar
- Full-screen bottom sheet for club details
- No horizontal scroll anywhere
- Optimized for move-in week (phone-first usage)

## Analytics & Insights (Internal)
- Daily active users tracking
- Sign-up funnel metrics
- Most viewed/saved clubs
- Search query tracking (what are people looking for?)
- Review submission rate
- Event RSVP conversion rate
- Friend connection rate

## Infrastructure
- Express backend on Railway
- Supabase PostgreSQL database
- Resend custom email (branded @yourbackyard.app)
- Auto-deploy: push to main = preview, push to production = live
- Error tracking (Sentry)
- Database backups
- Load tested for 500 concurrent users

## Future (Post-Launch v1.1)
- Multi-school support (BU, MIT, BC)
- Club analytics dashboard for leaders
- Push notifications (PWA)
- Recommendation engine ("Clubs like this")
- Verified club badges (from university activities office)
- Dark mode
- Native mobile app
