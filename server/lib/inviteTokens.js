import crypto from 'crypto';

// Invite tokens are stored hashed. The threat is not brute force — 256 bits from
// crypto.randomBytes settles that — it is that club_invite_links is reachable through
// PostgREST with the anon key that ships in the browser bundle. RLS is enabled with no
// policies today, but a missing policy should not be the only thing standing between
// an attacker and club admin on every club.
//
// SHA-256 rather than bcrypt/argon2: the input is already high-entropy random, so
// there is nothing for a slow KDF to protect against, and it would make every lookup
// expensive. Unsalted, because a per-row salt would force a table scan to find a token.
//
// The cost this buys: a link can never be re-displayed after minting, only rotated.

export function mintToken() {
    return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
    if (!token || typeof token !== 'string') {
        throw new Error('hashToken requires a non-empty token string');
    }
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Stored in the clear so an outreach CSV row can be matched back to a database row.
// 8 hex chars leaks 32 bits, leaving 224 — not a meaningful reduction.
export function tokenPrefix(token) {
    return String(token ?? '').slice(0, 8);
}
