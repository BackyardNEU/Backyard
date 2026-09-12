import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

// Key by user ID whenever we know who is calling. A university campus NATs
// thousands of students behind a handful of public addresses, so keying by IP
// throttles the entire school as if it were one person.
export const keyByUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

export const limiter = (max) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    keyGenerator: keyByUser,
    standardHeaders: true,
    legacyHeaders: false,
  });
