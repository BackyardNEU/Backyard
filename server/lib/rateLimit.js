import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Extracted from server/index.js so routers can build their own buckets without
// re-deriving the key function. clubPage.js had already drifted: its two route-level
// limiters call rateLimit() directly with no keyGenerator, which falls back to req.ip —
// exactly the failure this helper exists to prevent.

export const WINDOW_MS = 15 * 60 * 1000;

// Key by user ID whenever we know who is calling. A university campus NATs thousands of
// students behind a handful of public addresses, so keying by IP throttles the entire
// school as if it were one person. ipKeyGenerator is the library's own helper — it
// normalizes IPv6 to a /56 subnet, which hand-rolled `req.ip` keying gets wrong.
//
// identifyUser is mounted globally on /api before any router, so req.user is populated
// by the time a route-level limiter runs.
export const keyByUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

export const limiter = (max) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    keyGenerator: keyByUser,
    standardHeaders: true, // RateLimit-* headers so the client can back off intelligently
    legacyHeaders: false,
  });
