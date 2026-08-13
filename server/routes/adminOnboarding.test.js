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
        delete: () => { state.op = 'delete'; return builder; },
        eq: (k, v) => { state.filters.push([k, v]); return builder; },
        in: (k, v) => { state.filters.push([k, v]); return builder; },
        limit: () => builder,
        order: () => builder,
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

vi.mock('../lib/appUrls.js', () => ({
    // ONBOARD_URL is now read before any write, so minting refuses when it is unset
    // rather than writing tokens and then failing to build their URLs.
    ONBOARD_URL: 'https://clubs.example.com',
    onboardingUrl: (t) => `https://clubs.example.com/claim/${t}`,
    inviteUrl: (t) => `https://example.com/join/${t}`,
}));

const ADMIN = 'admin-1';
process.env.ADMIN_USER_IDS = ADMIN;

const { default: adminRouter, toCsv } = await import('./adminOnboarding.js');

const CLUB = 'club-1';

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
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
    results = {};
});

describe('admin gate', () => {
    it('rejects a non-admin', async () => {
        const res = await request(makeApp())
            .get('/api/admin/onboarding/pending')
            .set('x-test-user', 'nobody');
        expect(res.status).toBe(403);
    });

    it('rejects an anonymous caller', async () => {
        const res = await request(makeApp()).get('/api/admin/onboarding/pending');
        expect(res.status).toBe(401);
    });
});

describe('POST /onboarding-links', () => {
    beforeEach(() => {
        results['demo_club_data.select'] = {
            data: [{ id: CLUB, club_name: 'Chess', school: 'Northeastern', email: 'c@n.edu', instagram: 'neuchess' }],
            error: null,
        };
        results['club_invite_links.select'] = { data: [], error: null };
        results['club_invite_links.insert'] = { data: null, error: null };
        results['club_onboarding.upsert'] = { data: null, error: null };
    });

    it('mints a link and returns a claim URL', async () => {
        const res = await request(makeApp())
            .post('/api/admin/onboarding-links')
            .set('x-test-user', ADMIN)
            .send({ club_ids: [CLUB] });

        expect(res.status).toBe(201);
        expect(res.body.rows[0].url).toMatch(/^https:\/\/clubs\.example\.com\/claim\/[0-9a-f]{64}$/);
        expect(res.body.counts.created).toBe(1);
    });

    // Only the hash is stored; the plaintext exists in the response and nowhere else.
    it('stores a hash, never the plaintext token', async () => {
        const res = await request(makeApp())
            .post('/api/admin/onboarding-links')
            .set('x-test-user', ADMIN)
            .send({ club_ids: [CLUB] });

        const inserted = find('club_invite_links', 'insert')[0].row[0];
        const plaintext = res.body.rows[0].url.split('/').pop();

        expect(inserted.token_hash).not.toBe(plaintext);
        expect(inserted.token).toBeUndefined();
        expect(JSON.stringify(inserted)).not.toContain(plaintext);
    });

    // Re-running outreach must not mint a second live link for the same club.
    it('skips clubs that already have a live link', async () => {
        results['club_invite_links.select'] = {
            data: [{ id: 'link-1', club_id: CLUB, token_prefix: 'abcd1234', expires_at: new Date(Date.now() + 8.64e7).toISOString() }],
            error: null,
        };

        const res = await request(makeApp())
            .post('/api/admin/onboarding-links')
            .set('x-test-user', ADMIN)
            .send({ club_ids: [CLUB] });

        expect(res.body.rows[0].result).toBe('existing');
        // Unrecoverable once hashed — the operator has to consult the earlier CSV.
        expect(res.body.rows[0].url).toBeNull();
        expect(find('club_invite_links', 'insert')).toHaveLength(0);
    });

    it('re-mints when rotate is set', async () => {
        results['club_invite_links.select'] = {
            data: [{ id: 'link-1', club_id: CLUB, token_prefix: 'abcd1234', expires_at: new Date(Date.now() + 8.64e7).toISOString() }],
            error: null,
        };

        const res = await request(makeApp())
            .post('/api/admin/onboarding-links')
            .set('x-test-user', ADMIN)
            .send({ club_ids: [CLUB], rotate: true });

        expect(res.body.rows[0].url).not.toBeNull();
        expect(find('club_invite_links', 'update')[0].row).toEqual({ is_revoked: true });
    });

    it('validates days_valid and max_uses', async () => {
        const app = makeApp();
        for (const body of [
            { club_ids: [CLUB], days_valid: 0 },
            { club_ids: [CLUB], days_valid: 500 },
            { club_ids: [CLUB], max_uses: 0 },
            { club_ids: [CLUB], max_uses: 1000 },
        ]) {
            const res = await request(app).post('/api/admin/onboarding-links').set('x-test-user', ADMIN).send(body);
            expect(res.status).toBe(400);
        }
    });

    it('requires club_ids or school', async () => {
        const res = await request(makeApp())
            .post('/api/admin/onboarding-links')
            .set('x-test-user', ADMIN)
            .send({});
        expect(res.status).toBe(400);
    });

    it('serves CSV when asked', async () => {
        const res = await request(makeApp())
            .post('/api/admin/onboarding-links?format=csv')
            .set('x-test-user', ADMIN)
            .send({ club_ids: [CLUB] });

        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text.split('\n')[0]).toContain('club_name');
    });
});

describe('toCsv', () => {
    it('quotes fields containing commas and quotes', () => {
        const csv = toCsv([{ name: 'Chess, Go & Cards', note: 'He said "hi"' }]);
        expect(csv).toContain('"Chess, Go & Cards"');
        expect(csv).toContain('"He said ""hi"""');
    });

    // Excel and Sheets execute a leading =, +, - or @ as a formula. A club named "=cmd..."
    // in an outreach CSV should not become a spreadsheet payload.
    it('defuses formula injection', () => {
        const csv = toCsv([{ name: '=1+1' }, { name: '@SUM(A1)' }]);
        expect(csv).toContain("'=1+1");
        expect(csv).toContain("'@SUM(A1)");
    });

    it('returns an empty string for no rows', () => {
        expect(toCsv([])).toBe('');
    });
});

describe('POST /onboarding/:clubId/approve', () => {
    it('publishes the draft and marks it approved', async () => {
        results['club_onboarding.select'] = {
            data: { club_id: CLUB, status: 'pending_review', draft: { modules: validModules, details: { club_description: 'd' } } },
            error: null,
        };
        results['club_page_data.upsert'] = { data: null, error: null };
        results['club_onboarding.update'] = { data: { club_id: CLUB, status: 'approved' }, error: null };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        expect(res.status).toBe(200);
        expect(find('club_page_data', 'upsert')).toHaveLength(1);
    });

    // The gate the whole review pipeline rests on.
    it('refuses to approve a draft that was never submitted', async () => {
        results['club_onboarding.select'] = {
            data: { club_id: CLUB, status: 'claimed', draft: { modules: validModules } }, error: null,
        };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        expect(res.status).toBe(409);
        expect(find('club_page_data', 'upsert')).toHaveLength(0);
    });

    // A rule may have tightened between save and approval, so the draft is re-checked
    // rather than trusted.
    it('re-validates the stored draft before publishing', async () => {
        results['club_onboarding.select'] = {
            data: {
                club_id: CLUB, status: 'pending_review',
                draft: { modules: [{ type: 'basic_info', data: { club_name: '', description: '' } }] },
            },
            error: null,
        };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        expect(res.status).toBe(400);
        expect(find('club_page_data', 'upsert')).toHaveLength(0);
    });

    it('sanitizes rich text on the way out of the draft', async () => {
        results['club_onboarding.select'] = {
            data: {
                club_id: CLUB, status: 'pending_review',
                draft: {
                    modules: [
                        ...validModules,
                        { type: 'join', data: { tabs: [{ title: 'How', body: '<img src=x onerror=alert(1)>' }] } },
                    ],
                },
            },
            error: null,
        };
        results['club_page_data.upsert'] = { data: null, error: null };
        results['club_onboarding.update'] = { data: { club_id: CLUB, status: 'approved' }, error: null };

        await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        expect(JSON.stringify(find('club_page_data', 'upsert')[0].row)).not.toContain('onerror');
    });

    // approve writes demo_club_data directly, so it must honour the same allowlist as
    // PUT /clubs/:clubId/details rather than becoming a way around it.
    it('does not write draft fields outside the details allowlist', async () => {
        results['club_onboarding.select'] = {
            data: {
                club_id: CLUB, status: 'pending_review',
                draft: { modules: validModules, details: { club_description: 'd', school: 'Harvard', rating: 5 } },
            },
            error: null,
        };
        results['club_page_data.upsert'] = { data: null, error: null };
        results['club_onboarding.update'] = { data: { club_id: CLUB, status: 'approved' }, error: null };

        await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        const written = find('demo_club_data', 'update')[0].row;
        expect(written.school).toBeUndefined();
        expect(written.rating).toBeUndefined();
    });

    // The wizard collects the blurb as basic_info.description, but the public listing
    // and search read demo_club_data.club_description. Without this the approved page
    // showed the club's own words while every card still showed the scraped ones.
    it('publishes the wizard description to the public club_description column', async () => {
        results['club_onboarding.select'] = {
            data: {
                club_id: CLUB, status: 'pending_review',
                draft: { modules: validModules, details: {} },
            },
            error: null,
        };
        results['club_page_data.upsert'] = { data: null, error: null };
        results['club_onboarding.update'] = { data: { club_id: CLUB, status: 'approved' }, error: null };

        await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/approve`)
            .set('x-test-user', ADMIN);

        const written = find('demo_club_data', 'update')[0].row;
        expect(written.club_description).toBe('We play chess.');
        expect(written.club_name).toBe('Chess');
    });
});

describe('POST /onboarding/:clubId/request-changes', () => {
    it('requires a note', async () => {
        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/request-changes`)
            .set('x-test-user', ADMIN)
            .send({ note: '   ' });
        expect(res.status).toBe(400);
    });

    it('sends the page back with the note', async () => {
        results['club_onboarding.update'] = {
            data: { club_id: CLUB, status: 'changes_requested', review_note: 'Add a description' }, error: null,
        };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/request-changes`)
            .set('x-test-user', ADMIN)
            .send({ note: 'Add a description' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('changes_requested');
    });

    it('409s when the club is not awaiting review', async () => {
        results['club_onboarding.update'] = { data: null, error: null };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/request-changes`)
            .set('x-test-user', ADMIN)
            .send({ note: 'nope' });

        expect(res.status).toBe(409);
    });
});

describe('POST /onboarding/:clubId/unclaim', () => {
    it('revokes the link, demotes the claimant, and resets status', async () => {
        results['club_onboarding.select'] = {
            data: { club_id: CLUB, claimed_by: 'wrong-person', status: 'claimed' }, error: null,
        };
        results['club_onboarding.update'] = { data: { club_id: CLUB, status: 'unclaimed' }, error: null };

        const res = await request(makeApp())
            .post(`/api/admin/onboarding/${CLUB}/unclaim`)
            .set('x-test-user', ADMIN);

        expect(res.status).toBe(200);
        expect(find('club_invite_links', 'update')[0].row).toEqual({ is_revoked: true });
        expect(find('club_memberships', 'delete')).toHaveLength(1);
        expect(find('approved_club_accounts', 'delete')).toHaveLength(1);
    });
});
