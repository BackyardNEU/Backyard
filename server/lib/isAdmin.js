import 'dotenv/config';

// Extracted from server/routes/invites.js so the onboarding admin endpoints can share
// one definition of "admin". The original split on ',' without trimming, so an
// ADMIN_USER_IDS value formatted with spaces after the commas silently locked out
// every admin but the first.
//
// The `raw` parameter defaults to the env var but is injectable, so this is testable
// without mutating process.env.

export function parseAdminIds(raw) {
    return (raw || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

export function isAdmin(userId, raw = process.env.ADMIN_USER_IDS) {
    if (!userId) return false;
    return parseAdminIds(raw).includes(userId);
}

export function requireAdmin(req, res, next, raw = process.env.ADMIN_USER_IDS) {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (!isAdmin(req.user.id, raw)) {
        // Deliberately vague: never echo the allowlist or confirm which ids are admins.
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
