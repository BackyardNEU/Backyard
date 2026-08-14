import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const calls = [];
let results = {};

function makeBuilder(table) {
    const state = { table, op: 'select', filters: [], row: null };

    const resolve = () => {
        calls.push({ ...state, filters: [...state.filters] });
        const value = results[`${state.table}.${state.op}`];
        const resolved = typeof value === 'function' ? value(state) : value;
        return Promise.resolve(resolved ?? { data: null, error: null });
    };

    const builder = {
        select: () => builder,
        insert: (row) => { state.op = 'insert'; state.row = row; return builder; },
        update: (row) => { state.op = 'update'; state.row = row; return builder; },
        upsert: (row) => { state.op = 'upsert'; state.row = row; return builder; },
        eq: (k, v) => { state.filters.push([k, v]); return builder; },
        single: resolve,
        maybeSingle: resolve,
        then: (onOk, onErr) => resolve().then(onOk, onErr),
    };
    return builder;
}

vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: { from: (table) => makeBuilder(table) },
}));

vi.mock('../middleware/requireAuth.js', () => ({
    requireAuth: (req, _res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); },
    identifyUser: (req, _res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); },
}));

vi.mock('../middleware/checkMuted.js', () => ({
    checkMuted: (_req, _res, next) => next(),
}));

const { default: clubPageRouter } = await import('./clubPage.js');

const CLUB = 'club-1';
const USER = 'user-1';

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clubs', clubPageRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const find = (table, op) => calls.filter((c) => c.table === table && c.op === op);

const validModules = [{
    type: 'basic_info', order: 0, isDisplayed: true,
    data: { club_name: 'Chess', description: 'We play chess.', links: [] },
}];

beforeEach(() => {
    calls.length = 0;
    results = {
        'club_memberships.select': { data: { role: 'top_moderator' }, error: null },
        'club_page_data.upsert': { data: { club_id: CLUB, modules: [] }, error: null },
        'club_onboarding.select': { data: null, error: null },
    };
});

describe('PUT /:clubId/page — authorization', () => {
    it('rejects a non-member', async () => {
        results['club_memberships.select'] = { data: null, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(403);
    });

    it('rejects a plain member', async () => {
        results['club_memberships.select'] = { data: { role: 'member' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(403);
    });
});

describe('PUT /:clubId/page — the onboarding review gate', () => {
    // Redeeming an onboarding link grants top_moderator, which is exactly what this
    // endpoint checks. Without this gate a club could skip the wizard entirely and PUT
    // straight to their public page, which is the one thing review is supposed to prevent.
    it('refuses a direct page write while onboarding is still in progress', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(409);
        expect(find('club_page_data', 'upsert')).toHaveLength(0);
    });

    it('refuses a direct page write while awaiting review', async () => {
        results['club_onboarding.select'] = { data: { status: 'pending_review' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(409);
        expect(find('club_page_data', 'upsert')).toHaveLength(0);
    });

    it('allows direct writes once the page has been approved', async () => {
        results['club_onboarding.select'] = { data: { status: 'approved' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(200);
        expect(find('club_page_data', 'upsert')).toHaveLength(1);
    });

    // Clubs that never went through outreach have no onboarding row and must keep
    // working exactly as before.
    it('allows direct writes for clubs with no onboarding record', async () => {
        results['club_onboarding.select'] = { data: null, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(200);
    });
});

describe('PUT /:clubId/page — content safety', () => {
    it('rejects modules that fail structural validation', async () => {
        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: [{ type: 'basic_info', data: { club_name: '', description: '' } }] });

        expect(res.status).toBe(400);
    });

    it('rejects an unknown module type', async () => {
        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({ modules: [{ type: 'evil', data: {} }] });

        expect(res.status).toBe(400);
    });

    it('sanitizes join-tab HTML before storing', async () => {
        await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({
                modules: [
                    ...validModules,
                    { type: 'join', data: { tabs: [{ title: 'How', body: '<img src=x onerror=alert(1)>hi' }] } },
                ],
            });

        const stored = JSON.stringify(find('club_page_data', 'upsert')[0].row);
        expect(stored).not.toContain('onerror');
        expect(stored).not.toContain('<img');
    });

    it('sanitizes member bios before storing', async () => {
        await request(makeApp())
            .put(`/api/clubs/${CLUB}/page`)
            .set('x-test-user', USER)
            .send({
                modules: [
                    ...validModules,
                    { type: 'member_roster', data: { members: [{ name: 'A', bio: '<script>alert(1)</script>ok' }] } },
                ],
            });

        const stored = JSON.stringify(find('club_page_data', 'upsert')[0].row);
        expect(stored).not.toContain('<script');
    });
});
