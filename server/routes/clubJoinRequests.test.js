import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// clubMembers.js chains Supabase calls a dozen different ways (select/insert/update/
// delete, single/maybeSingle/awaited, with and without a count), so stubbing each path
// individually would be unreadable. Instead this is a tiny thenable query builder: every
// method records what it was asked for and returns itself, and awaiting it hands back
// whatever `results` says that table should return.
const calls = [];
let results = {};

function makeBuilder(table) {
  const state = { table, op: 'select', filters: [], row: null, opts: null };

  const resolve = () => {
    calls.push({ ...state, filters: [...state.filters] });
    const key = `${state.table}.${state.op}`;
    const value = results[key];
    const resolved = typeof value === 'function' ? value(state) : value;
    return Promise.resolve(resolved ?? { data: null, error: null });
  };

  const builder = {
    select: (_cols, opts) => { state.op = 'select'; state.opts = opts; return builder; },
    insert: (row) => { state.op = 'insert'; state.row = row; return builder; },
    update: (row) => { state.op = 'update'; state.row = row; return builder; },
    delete: () => { state.op = 'delete'; return builder; },
    eq: (k, v) => { state.filters.push([k, v]); return builder; },
    order: () => builder,
    in: (k, v) => { state.filters.push([k, v]); return builder; },
    single: resolve,
    maybeSingle: resolve,
    then: (onOk, onErr) => resolve().then(onOk, onErr),
  };
  return builder;
}

vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: { from: (table) => makeBuilder(table) },
}));

// requireAuth verifies a real JWT; the routes under test only care that req.user.id is
// set, so it is replaced with a stub that trusts an x-test-user header.
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); },
  identifyUser: (req, _res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); },
}));

const { default: clubMembersRouter } = await import('./clubMembers.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clubs', clubMembersRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

const CLUB = 'club-1';
const USER = 'user-1';
const OWNER = 'owner-1';

const find = (table, op) => calls.filter((c) => c.table === table && c.op === op);

// club_memberships.select serves two different questions — "what role does the caller
// have" (requireModerator) and "is this person already in" (admitMember) — so the mock
// has to answer per user id rather than return one fixed row, or the second lookup
// reports everyone as already a member and short-circuits every admission.
let memberships = {};
let memberCount = 3;

beforeEach(() => {
  calls.length = 0;
  memberships = { [OWNER]: 'top_moderator' };
  memberCount = 3;

  results = {
    // Same school, so the school guard passes and never masks the behaviour under test.
    'profiles.select': { data: { school: 'Northeastern', member_list: [] }, error: null },
    'profiles.update': { data: null, error: null },
    'demo_club_data.select': { data: { school: 'Northeastern', join_policy: 'open' }, error: null },
    'demo_club_data.update': { data: null, error: null },
    'club_memberships.select': (state) => {
      const uid = state.filters.find(([k]) => k === 'user_id')?.[1];
      // No user_id filter means the head:true count query.
      if (uid === undefined) return { data: null, error: null, count: memberCount };
      const role = memberships[uid];
      return { data: role ? { role } : null, error: null, count: memberCount };
    },
    'club_memberships.insert': { data: null, error: null },
    'club_join_requests.select': { data: null, error: null },
    'club_join_requests.insert': { data: null, error: null },
    'club_join_requests.update': { data: null, error: null },
    'club_join_requests.delete': { data: null, error: null },
  };
});

describe('POST /api/clubs/:clubId/members/me', () => {
  it('joins outright when the club is open', async () => {
    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('joined');
    expect(find('club_memberships', 'insert')).toHaveLength(1);
    expect(find('club_join_requests', 'insert')).toHaveLength(0);
  });

  it('queues a request instead of joining when the club requires approval', async () => {
    results['demo_club_data.select'] = {
      data: { school: 'Northeastern', join_policy: 'request' }, error: null,
    };

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'requested' });
    // The whole point: no membership was created.
    expect(find('club_memberships', 'insert')).toHaveLength(0);
    expect(find('club_join_requests', 'insert')).toHaveLength(1);
  });

  it('lets the first member into an empty club even when approval is required', async () => {
    // Otherwise a brand-new club set to request-only has nobody who could approve
    // anything and can never be joined by anyone, ever.
    results['demo_club_data.select'] = {
      data: { school: 'Northeastern', join_policy: 'request' }, error: null,
    };
    memberCount = 0;

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('top_moderator');
    expect(find('club_join_requests', 'insert')).toHaveLength(0);
  });

  // The deadlock only exists for request-policy clubs. Granting ownership to the first
  // joiner of any empty club would let any student claim every scraped zero-member club
  // on the platform — and scraped rows default to join_policy 'open'.
  it('does not hand ownership to the first joiner of an empty OPEN club', async () => {
    results['demo_club_data.select'] = {
      data: { school: 'Northeastern', join_policy: 'open' }, error: null,
    };
    memberCount = 0;

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('member');
  });

  it('treats a duplicate request as already-asked rather than an error', async () => {
    results['demo_club_data.select'] = {
      data: { school: 'Northeastern', join_policy: 'request' }, error: null,
    };
    // The partial unique index rejects the second pending row.
    results['club_join_requests.insert'] = { data: null, error: { code: '23505', message: 'dupe' } };

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'requested' });
  });

  it('still refuses a club at another school', async () => {
    results['demo_club_data.select'] = {
      data: { school: 'Boston University', join_policy: 'request' }, error: null,
    };

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/members/me`)
      .set('x-test-user', USER);

    expect(res.status).toBe(403);
    expect(find('club_join_requests', 'insert')).toHaveLength(0);
  });
});

describe('approving a request', () => {
  beforeEach(() => {
    results['club_join_requests.select'] = { data: { id: 'req-1' }, error: null };
  });

  it('creates the membership and keeps profiles.member_list in step', async () => {
    // member_list is legacy but still read by clubEvents.js — a membership written
    // without it leaves someone who cannot see their own club's events.
    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/join-requests/${USER}/approve`)
      .set('x-test-user', OWNER);

    expect(res.status).toBe(200);
    expect(find('club_memberships', 'insert')).toHaveLength(1);
    expect(find('profiles', 'update')).toHaveLength(1);
    expect(find('club_join_requests', 'update')[0].row.status).toBe('approved');
  });

  it('does not fail when the requester joined by some other route while queued', async () => {
    // Request to join, get added through an invite link while still pending, then have
    // the original request approved. A second insert violates the primary key, and the
    // moderator would see a 502 for someone who is already a member.
    memberships[USER] = 'member';

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/join-requests/${USER}/approve`)
      .set('x-test-user', OWNER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    // No duplicate insert attempted.
    expect(find('club_memberships', 'insert')).toHaveLength(0);
  });

  it('404s when there is no pending request', async () => {
    results['club_join_requests.select'] = { data: null, error: null };

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/join-requests/${USER}/approve`)
      .set('x-test-user', OWNER);

    expect(res.status).toBe(404);
    expect(find('club_memberships', 'insert')).toHaveLength(0);
  });

  it('refuses a plain member', async () => {
    memberships[USER] = 'member';

    const res = await request(makeApp())
      .post(`/api/clubs/${CLUB}/join-requests/${USER}/approve`)
      .set('x-test-user', USER);

    expect(res.status).toBe(403);
    expect(find('club_memberships', 'insert')).toHaveLength(0);
  });
});

describe('PATCH /api/clubs/:clubId/join-policy', () => {
  it('admits everyone still queued when the club is reopened', async () => {
    results['club_join_requests.select'] = {
      data: [{ id: 'r1', user_id: 'u1' }, { id: 'r2', user_id: 'u2' }], error: null,
    };

    const res = await request(makeApp())
      .patch(`/api/clubs/${CLUB}/join-policy`)
      .set('x-test-user', OWNER)
      .send({ join_policy: 'open' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ join_policy: 'open', auto_approved: 2, failed: 0 });
    expect(find('club_memberships', 'insert')).toHaveLength(2);
  });

  it('keeps admitting the rest of the queue when one row fails', async () => {
    // The policy row is committed before this loop runs, so an unhandled throw would
    // leave the club open with everyone behind the failure still queued — the exact
    // state auto-approval exists to prevent.
    results['club_join_requests.select'] = {
      data: [{ id: 'r1', user_id: 'u1' }, { id: 'r2', user_id: 'u2' }, { id: 'r3', user_id: 'u3' }],
      error: null,
    };
    let attempt = 0;
    results['club_memberships.insert'] = () => {
      attempt += 1;
      return attempt === 2
        ? { data: null, error: { message: 'boom' } }
        : { data: null, error: null };
    };

    const res = await request(makeApp())
      .patch(`/api/clubs/${CLUB}/join-policy`)
      .set('x-test-user', OWNER)
      .send({ join_policy: 'open' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ join_policy: 'open', auto_approved: 2, failed: 1 });
    // All three were attempted; the middle failure did not abort the loop.
    expect(find('club_memberships', 'insert')).toHaveLength(3);
  });

  it('does not touch pending requests when switching to request-only', async () => {
    const res = await request(makeApp())
      .patch(`/api/clubs/${CLUB}/join-policy`)
      .set('x-test-user', OWNER)
      .send({ join_policy: 'request' });

    expect(res.status).toBe(200);
    expect(res.body.auto_approved).toBe(0);
    expect(find('club_memberships', 'insert')).toHaveLength(0);
  });

  it('refuses a moderator who is not the owner', async () => {
    memberships[USER] = 'moderator';

    const res = await request(makeApp())
      .patch(`/api/clubs/${CLUB}/join-policy`)
      .set('x-test-user', USER)
      .send({ join_policy: 'request' });

    expect(res.status).toBe(403);
    expect(find('demo_club_data', 'update')).toHaveLength(0);
  });

  it('rejects an unknown policy value before any permission check', async () => {
    const res = await request(makeApp())
      .patch(`/api/clubs/${CLUB}/join-policy`)
      .set('x-test-user', OWNER)
      .send({ join_policy: 'invite-only' });

    expect(res.status).toBe(400);
    expect(find('demo_club_data', 'update')).toHaveLength(0);
  });
});
