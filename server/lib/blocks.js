import { supabaseAdmin } from '../supabaseAdmin.js';

// Blocking is mutually invisible: once either party blocks the other, neither sees the
// other's profile, events, reviews or friend list. Every read path that can expose a
// user's identity goes through this module so the rule lives in exactly one place.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The .or() filters below are built by string interpolation, and PostgREST parses that
// string as a filter expression. One of the inputs is req.params.id on
// GET /users/:id/profile — attacker-controlled — so a value like
// "x,blocker_id.eq.<someone>" would inject extra clauses. Anything that is not a
// well-formed UUID cannot match a real row anyway, so rejecting early is both safe and
// correct.
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Every user id that must be hidden from `userId`, in either direction.
 *
 * The union is what makes the block mutual — rows where the user is the blocker hide the
 * people they blocked, and rows where they are the target hide the people who blocked
 * them. Returning both from one query keeps callers from having to remember the
 * distinction.
 *
 * Fails closed to an empty set on a database error: a moderation outage should not take
 * the whole app down, and the surfaces this guards are reads.
 *
 * @returns {Promise<Set<string>>}
 */
export async function getBlockedIds(userId) {
  if (!isUuid(userId)) return new Set();

  const { data, error } = await supabaseAdmin
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    console.error('[blocks] lookup failed:', error.message);
    return new Set();
  }

  const hidden = new Set();
  for (const row of data || []) {
    hidden.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return hidden;
}

/**
 * Whether a block exists between two users in either direction.
 *
 * Cheaper than getBlockedIds when there is only one person to check, which is the common
 * case for single-target routes like GET /users/:id/profile.
 *
 * @returns {Promise<boolean>}
 */
export async function isBlockedBetween(a, b) {
  if (!isUuid(a) || !isUuid(b) || a === b) return false;

  const { data, error } = await supabaseAdmin
    .from('user_blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),` +
      `and(blocker_id.eq.${b},blocked_id.eq.${a})`
    )
    .limit(1);

  if (error) {
    console.error('[blocks] pair lookup failed:', error.message);
    return false;
  }

  return (data || []).length > 0;
}

/**
 * Removes rows whose user id is blocked relative to `userId`.
 *
 * `pick` pulls the user id out of each row, so this works for both plain profile rows
 * (r => r.id) and join rows like attendees (r => r.user_id).
 */
export function filterBlocked(rows, blockedIds, pick = (r) => r.id) {
  if (!blockedIds || blockedIds.size === 0) return rows || [];
  return (rows || []).filter((row) => !blockedIds.has(pick(row)));
}
