import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'Missing SUPABASE_JWT_SECRET. Find it in Supabase Dashboard → Settings → API → JWT Settings → JWT Secret.'
  );
}

// Verifies the Bearer JWT locally (no network call) and attaches { id } to req.user.
// Supabase signs user tokens with HS256 using the project's JWT secret; jwt.verify
// checks the signature, the exp claim, and the audience all at once.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { audience: 'authenticated' });
    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
