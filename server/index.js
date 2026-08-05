import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
import { startQueue } from './notifications/queue.js';
import friendRequestsRouter from './routes/friend-requests.js';
import notificationsRouter from './routes/notifications.js';


const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Public reads
app.use('/api/clubs', clubsRouter);
app.use('/api/clubs', clubPageRouter);
app.use('/api/clubs', questionsRouter);
app.use('/api/clubs', clubEventsRouter);
app.use('/api/search', searchRouter);
app.use('/api/universities', universitiesRouter);

// Authenticated writes/reads scoped to the current user (req.user from JWT)
app.use('/api/reviews', writeLimiter, reviewsRouter);
app.use('/api/me/favorites', writeLimiter, favoritesRouter);
app.use('/api/me/votes', writeLimiter, votesRouter);
app.use('/api/me/friends', writeLimiter, friendsRouter);
app.use('/api/friend-requests', writeLimiter, friendRequestsRouter);
app.use('/api/me/notifications', writeLimiter, notificationsRouter);
app.use('/api/me', profilesRouter); // serves /profile and /membership
app.use('/api/users', usersRouter);
app.use('/api/events', writeLimiter, eventsRouter);

// Signed upload URLs (auth required; service role stays on the server)
app.use('/api/storage', writeLimiter, storageRouter);

// Support tickets
app.use('/api/support', writeLimiter, supportRouter);

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
