import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'Missing SUPABASE_JWT_SECRET. Find it in Supabase Dashboard → Settings → API → JWT Settings → JWT Secret.'
  );
}

// Verifies the Bearer JWT locally (no network call) and returns { id, email }, or null
// if the header is absent or the token fails verification. Supabase signs user tokens
// with HS256 using the project's JWT secret; jwt.verify checks the signature, the exp
// claim, and the audience all at once.
export function verifyBearer(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET, { audience: 'authenticated' });
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// Attaches req.user when a valid token is present, but never rejects.
//
// Mounted globally ahead of the rate limiters so they can key by user ID. requireAuth
// lives inside each router, which runs *after* the limiter middleware — without this,
// req.user is still undefined at key-generation time and every caller falls back to
// sharing an IP bucket.
export function identifyUser(req, _res, next) {
  const user = verifyBearer(req);
  if (user) req.user = user;
  next();
}

// Rejects anonymous callers. Reuses req.user when identifyUser already resolved it.
export function requireAuth(req, res, next) {
  if (req.user) return next();

  if (!(req.headers.authorization || '').startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  const user = verifyBearer(req);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  next();
}
