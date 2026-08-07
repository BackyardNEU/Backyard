import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { identifyUser } from './middleware/requireAuth.js';

import clubsRouter from './routes/clubs.js';
import searchRouter from './routes/search.js';
import universitiesRouter from './routes/universities.js';
import reviewsRouter from './routes/reviews.js';
import favoritesRouter from './routes/favorites.js';
import votesRouter from './routes/votes.js';
import friendsRouter from './routes/friends.js';
import profilesRouter from './routes/profiles.js';
import usersRouter from './routes/users.js';
import storageRouter from './routes/storage.js';
import eventsRouter from './routes/events.js';
import supportRouter from './routes/support.js';
import clubEventsRouter from './routes/clubEvents.js';
import clubPageRouter from './routes/clubPage.js';
import questionsRouter from './routes/questions.js';
import invitesRouter from './routes/invites.js';
import { startQueue } from './notifications/queue.js';
import friendRequestsRouter from './routes/friend-requests.js';
import notificationsRouter from './routes/notifications.js';
import clubMembersRouter from './routes/clubMembers.js';


const app = express();
const port = process.env.PORT || 3001;

// Railway terminates TLS and forwards through exactly one proxy hop, so req.ip must be
// read from X-Forwarded-For. Without this Express (default `false` in v5) resolves
// req.ip to the proxy's own address and *every user of the product shares one
// rate-limit bucket*. Use 1 rather than `true`: trusting the entire forwarded chain
// would let any client spoof the header and sidestep limits altogether.
app.set('trust proxy', 1);

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

const WINDOW_MS = 15 * 60 * 1000;

// Key by user ID whenever we know who is calling. A university campus NATs thousands of
// students behind a handful of public addresses, so keying by IP throttles the entire
// school as if it were one person. ipKeyGenerator is the library's own helper — it
// normalizes IPv6 to a /56 subnet, which hand-rolled `req.ip` keying gets wrong.
const keyByUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

const limiter = (max) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    keyGenerator: keyByUser,
    standardHeaders: true, // RateLimit-* headers so the client can back off intelligently
    legacyHeaders: false,
  });

// Populate req.user before any limiter runs. requireAuth lives inside the routers, which
// is too late for keyGenerator to see it.
app.use('/api', identifyUser);

// Overall ceiling. Generous, because opening a single club card costs ~8 requests.
app.use('/api', limiter(1000));

// Each write surface gets its own bucket. Previously one shared limiter instance backed
// all ten mounts, so a burst of image uploads would exhaust the same 60-request budget
// that favoriting a club needed.
const reviewsLimiter = limiter(100);
const favoritesLimiter = limiter(300); // hearts get toggled rapidly while browsing
const votesLimiter = limiter(300);
const friendsLimiter = limiter(150);
const friendRequestsLimiter = limiter(100);
const notificationsLimiter = limiter(300); // mostly reads (mark-as-seen polling)
const eventsLimiter = limiter(150);
const storageLimiter = limiter(100); // uploads are expensive downstream (Vision API)
const invitesLimiter = limiter(100);
const supportLimiter = limiter(30); // abuse-prone, and nobody files 30 tickets legitimately

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Public reads
app.use('/api/clubs', clubMembersRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/clubs', clubPageRouter);
app.use('/api/clubs', questionsRouter);
app.use('/api/clubs', clubEventsRouter);
app.use('/api/search', searchRouter);
app.use('/api/universities', universitiesRouter);

// Authenticated writes/reads scoped to the current user (req.user from JWT)
app.use('/api/reviews', reviewsLimiter, reviewsRouter);
app.use('/api/me/favorites', favoritesLimiter, favoritesRouter);
app.use('/api/me/votes', votesLimiter, votesRouter);
app.use('/api/me/friends', friendsLimiter, friendsRouter);
app.use('/api/friend-requests', friendRequestsLimiter, friendRequestsRouter);
app.use('/api/me/notifications', notificationsLimiter, notificationsRouter);
app.use('/api/me', profilesRouter); // serves /profile and /membership
app.use('/api/users', usersRouter);
app.use('/api/events', eventsLimiter, eventsRouter);

// Signed upload URLs (auth required; service role stays on the server)
app.use('/api/storage', storageLimiter, storageRouter);

// Invite links: generate (POST /api/clubs/:clubId/invite-link) + validate/redeem
// (GET|POST /api/invite/:token) + admin (/api/admin/*).
//
// The router's own paths are relative to /api, so it stays mounted there. The limiter,
// however, is scoped to the invite prefixes instead of riding on the bare '/api' mount —
// previously it ran for every request that fell through unmatched, so each /api 404
// burned write budget. /api/invite is the surface actually worth limiting: it is where
// someone would brute-force invite tokens.
app.use('/api/invite', invitesLimiter);
app.use('/api/admin', invitesLimiter);
app.use('/api', invitesRouter);
// Support tickets
app.use('/api/support', supportLimiter, supportRouter);

app.use((err, req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

startQueue().catch((err) => {
  console.error('[queue] failed to start — notifications disabled:', err.message);
});
