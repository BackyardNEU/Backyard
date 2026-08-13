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

let role = 'top_moderator';
vi.mock('../lib/clubPermissions.js', () => ({
    requireModerator: async () => {
        if (!['moderator', 'top_moderator'].includes(role)) throw { status: 403, message: 'Moderator only' };
        return role;
    },
    requireTopModerator: async () => {
        if (role !== 'top_moderator') throw { status: 403, message: 'Top moderator only' };
    },
}));

const { default: onboardingRouter } = await import('./onboarding.js');

const CLUB = 'club-1';
const USER = 'user-1';

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clubs', onboardingRouter);
    app.use((err, _req, res, _next) => {
        res.status(err.status || 500).json({ error: err.message });
    });
    return app;
}

const validModules = [{
    type: 'basic_info', order: 0, isDisplayed: true,
    data: { club_name: 'Chess', description: 'We play chess.', links: [] },
}];

beforeEach(() => {
    calls.length = 0;
    results = {};
    role = 'top_moderator';
});

describe('PUT /:clubId/onboarding/draft', () => {
    it('saves a valid module draft', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed', draft: {} }, error: null };
        results['club_onboarding.upsert'] = { data: { club_id: CLUB, status: 'claimed' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(200);
    });

    // The draft is what a reviewer approves, so it must not move under them.
    it('refuses edits while the page is awaiting review', async () => {
        results['club_onboarding.select'] = { data: { status: 'pending_review', draft: {} }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(409);
    });

    it('refuses edits once approved', async () => {
        results['club_onboarding.select'] = { data: { status: 'approved', draft: {} }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(409);
    });

    // A club that was sent back should be able to fix things and resubmit.
    it('allows edits after changes were requested', async () => {
        results['club_onboarding.select'] = { data: { status: 'changes_requested', draft: {} }, error: null };
        results['club_onboarding.upsert'] = { data: { club_id: CLUB, status: 'claimed' }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(200);
        // Back to 'claimed' so it drops out of the review queue until resubmitted.
        expect(calls.find((c) => c.op === 'upsert').row.status).toBe('claimed');
    });

    it('rejects modules that fail structural validation', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed', draft: {} }, error: null };

        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: [{ type: 'basic_info', data: { club_name: '', description: '' } }] });

        expect(res.status).toBe(400);
    });

    // The layer curl cannot skip.
    it('sanitizes rich text before storing it', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed', draft: {} }, error: null };
        results['club_onboarding.upsert'] = { data: { club_id: CLUB }, error: null };

        await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({
                modules: [
                    ...validModules,
                    { type: 'join', data: { tabs: [{ title: 'How', body: '<img src=x onerror=alert(1)>hi' }] } },
                ],
            });

        const stored = JSON.stringify(calls.find((c) => c.op === 'upsert').row);
        expect(stored).not.toContain('onerror');
        expect(stored).not.toContain('<img');
    });

    it('rejects a non-moderator', async () => {
        role = 'member';
        const res = await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ modules: validModules });

        expect(res.status).toBe(403);
    });

    it('drops fields outside the details allowlist', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed', draft: {} }, error: null };
        results['club_onboarding.upsert'] = { data: { club_id: CLUB }, error: null };

        await request(makeApp())
            .put(`/api/clubs/${CLUB}/onboarding/draft`)
            .set('x-test-user', USER)
            .send({ details: { club_description: 'ok', school: 'Harvard', rating: 5 } });

        const stored = calls.find((c) => c.op === 'upsert').row.draft.details;
        expect(stored).toEqual({ club_description: 'ok' });
    });
});

describe('POST /:clubId/onboarding/submit', () => {
    it('moves a complete draft to pending_review', async () => {
        results['club_onboarding.select'] = {
            data: { status: 'claimed', draft: { modules: validModules } }, error: null,
        };
        results['club_onboarding.update'] = {
            data: { club_id: CLUB, status: 'pending_review' }, error: null,
        };

        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/onboarding/submit`)
            .set('x-test-user', USER);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('pending_review');
    });

    it('refuses an empty draft', async () => {
        results['club_onboarding.select'] = { data: { status: 'claimed', draft: {} }, error: null };

        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/onboarding/submit`)
            .set('x-test-user', USER);

        expect(res.status).toBe(400);
    });

    it('refuses a draft missing a club description', async () => {
        results['club_onboarding.select'] = {
            data: {
                status: 'claimed',
                draft: { modules: [{ type: 'basic_info', data: { club_name: 'Chess', description: '' } }] },
            },
            error: null,
        };

        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/onboarding/submit`)
            .set('x-test-user', USER);

        expect(res.status).toBe(400);
    });

    it('is not double-submittable', async () => {
        results['club_onboarding.select'] = {
            data: { status: 'pending_review', draft: { modules: validModules } }, error: null,
        };

        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/onboarding/submit`)
            .set('x-test-user', USER);

        expect(res.status).toBe(409);
    });

    // Only the club owner hands the page over for review.
    it('rejects a plain moderator', async () => {
        role = 'moderator';
        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/onboarding/submit`)
            .set('x-test-user', USER);

        expect(res.status).toBe(403);
    });
});
