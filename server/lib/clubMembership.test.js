import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same thenable query-builder stub as clubJoinRequests.test.js: every method records
// what it was asked for and returns itself, and awaiting it hands back whatever
// `results` says that table should return.
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
        upsert: (row) => { state.op = 'upsert'; state.row = row; return builder; },
        delete: () => { state.op = 'delete'; return builder; },
        eq: (k, v) => { state.filters.push([k, v]); return builder; },
        in: (k, v) => { state.filters.push([k, v]); return builder; },
        order: () => builder,
        limit: resolve,
        single: resolve,
        maybeSingle: resolve,
        then: (onOk, onErr) => resolve().then(onOk, onErr),
    };
    return builder;
}

vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: { from: (table) => makeBuilder(table) },
}));

const { grantClubRole, hasTopModerator, admitMember, ROLE_RANK } =
    await import('./clubMembership.js');

const USER = 'user-1';
const CLUB = 'club-1';

const find = (table, op) => calls.filter((c) => c.table === table && c.op === op);

beforeEach(() => {
    calls.length = 0;
    results = { 'profiles.select': { data: { member_list: [] }, error: null } };
});

describe('grantClubRole', () => {
    it('inserts a membership with the requested role when none exists', async () => {
        results['club_memberships.select'] = { data: null, error: null };

        const result = await grantClubRole(USER, CLUB, 'top_moderator');

        expect(result).toEqual({ role: 'top_moderator', changed: true });
        expect(find('club_memberships', 'insert')[0].row).toMatchObject({
            user_id: USER, club_id: CLUB, role: 'top_moderator',
        });
    });

    it('raises an existing lower role', async () => {
        results['club_memberships.select'] = { data: { role: 'member' }, error: null };

        const result = await grantClubRole(USER, CLUB, 'top_moderator');

        expect(result).toEqual({ role: 'top_moderator', changed: true });
        expect(find('club_memberships', 'update')[0].row).toMatchObject({ role: 'top_moderator' });
    });

    // Without this, an invite link becomes a demotion primitive: anyone could hand the
    // club owner an editor link and quietly drop them to moderator.
    it('never lowers an existing higher role', async () => {
        results['club_memberships.select'] = { data: { role: 'top_moderator' }, error: null };

        const result = await grantClubRole(USER, CLUB, 'moderator');

        expect(result).toEqual({ role: 'top_moderator', changed: false });
        expect(find('club_memberships', 'update')).toHaveLength(0);
    });

    it('is a no-op when the role already matches', async () => {
        results['club_memberships.select'] = { data: { role: 'moderator' }, error: null };

        const result = await grantClubRole(USER, CLUB, 'moderator');

        expect(result).toEqual({ role: 'moderator', changed: false });
        expect(find('club_memberships', 'update')).toHaveLength(0);
    });

    // club_memberships is the modern source of truth, but plenty of code still reads
    // profiles.member_list. Writing only one of them is how memberships end up invisible.
    it('dual-writes profiles.member_list', async () => {
        results['club_memberships.select'] = { data: null, error: null };

        await grantClubRole(USER, CLUB, 'member');

        expect(find('profiles', 'update')[0].row.member_list).toContain(CLUB);
    });

    it('does not duplicate an existing member_list entry', async () => {
        results['club_memberships.select'] = { data: null, error: null };
        results['profiles.select'] = { data: { member_list: [CLUB] }, error: null };

        await grantClubRole(USER, CLUB, 'member');

        expect(find('profiles', 'update')).toHaveLength(0);
    });

    // Two redeems racing each other must not surface a 502 to someone who is, in fact,
    // now a member.
    it('treats a duplicate-key insert as success', async () => {
        results['club_memberships.select'] = { data: null, error: null };
        results['club_memberships.insert'] = { data: null, error: { code: '23505' } };

        await expect(grantClubRole(USER, CLUB, 'member')).resolves.toMatchObject({
            role: 'member',
        });
    });

    it('rejects an unknown role rather than writing it', async () => {
        await expect(grantClubRole(USER, CLUB, 'admin')).rejects.toThrow(/role/i);
        expect(find('club_memberships', 'insert')).toHaveLength(0);
    });
});

describe('ROLE_RANK', () => {
    it('orders roles so comparisons are unambiguous', () => {
        expect(ROLE_RANK.top_moderator).toBeGreaterThan(ROLE_RANK.moderator);
        expect(ROLE_RANK.moderator).toBeGreaterThan(ROLE_RANK.member);
    });
});

describe('hasTopModerator', () => {
    it('is true when the club already has an owner', async () => {
        results['club_memberships.select'] = { data: [{ user_id: 'someone' }], error: null };
        await expect(hasTopModerator(CLUB)).resolves.toBe(true);
    });

    it('is false for a club with no owner', async () => {
        results['club_memberships.select'] = { data: [], error: null };
        await expect(hasTopModerator(CLUB)).resolves.toBe(false);
    });

    // maybeSingle() errored on more than one row and the error was discarded, so two
    // owners read as none — inverting the very check that stops an invite from
    // displacing an existing owner.
    it('is true when a club somehow has two owners', async () => {
        results['club_memberships.select'] = {
            data: [{ user_id: 'a' }, { user_id: 'b' }], error: null,
        };
        await expect(hasTopModerator(CLUB)).resolves.toBe(true);
    });
});

describe('admitMember', () => {
    it('still admits as a plain member, preserving existing callers', async () => {
        results['club_memberships.select'] = { data: null, error: null };
        await expect(admitMember(USER, CLUB)).resolves.toBe('member');
    });

    it('returns the existing role without downgrading', async () => {
        results['club_memberships.select'] = { data: { role: 'top_moderator' }, error: null };
        await expect(admitMember(USER, CLUB)).resolves.toBe('top_moderator');
    });
});
