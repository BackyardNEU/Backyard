import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Phase 2 (public reads): clubs, search, universities
// Phase 3 (authenticated reads): favorites, profiles, friends, votes, users/search
// Phase 4 (writes + storage): reviews, votes, favorites, profile, friends, storage upload URLs
//
// Route modules will be mounted here as they are added under server/routes/.
// Example: app.use('/api/clubs', clubsRouter);

app.use((err, req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
