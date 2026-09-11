import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// POST /api/clubs/:clubId/announce — fans an in-app notification out to every member.
//
// Its own file rather than clubPage.test.js because that suite's shared mock builder has
// no .neq(), which the member query needs, and widening it would put 600 passing tests at
// risk for one route.
//
// The fan-out runs AFTER the response is sent, so every delivery assertion has to flush
// the microtask/macrotask queue first — see flush() below. That detail is the whole
// reason this route was so hard to observe in the first place.

let results = {};
const queries = [];

function makeBuilder(table) {
    const state = { table, op: 'select', filters: [], negated: [] };
    const resolve = () => {
        queries.push({ ...state, filters: [...state.filters], negated: [...state.negated] });
        const value = results[`${state.table}.${state.op}`];
        const resolved = typeof value === 'function' ? value(state) : value;
        return Promise.resolve(resolved ?? { data: null, error: null });
    };
    const builder = {
        select: () => builder,
        insert: () => { state.op = 'insert'; return builder; },
        eq: (k, v) => { state.filters.push([k, v]); return builder; },
        neq: (k, v) => { state.negated.push([k, v]); return builder; },
        single: resolve,
        maybeSingle: resolve,
        then: (ok, err) => resolve().then(ok, err),
    };
    return builder;
}

vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: { from: (table) => makeBuilder(table) },
}));

vi.mock('../middleware/requireAuth.js', () => ({
    requireAuth: (req, res, next) => {
        const id = req.headers['x-test-user'];
        if (!id) return res.status(401).json({ error: 'Authentication required' });
        req.user = { id };
        next();
    },
    identifyUser: (req, _res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); },
}));

vi.mock('../middleware/checkMuted.js', () => ({ checkMuted: (_req, _res, next) => next() }));

// Rate-limit state is module level, so without this the validation cases below burn
// through announceLimiter's budget of 10 and every later test 429s. The keying itself
// is covered in tests/rateLimit.test.js.
vi.mock('../lib/rateLimit.js', () => ({
    limiter: () => (_req, _res, next) => next(),
    keyByUser: (req) => req.user?.id,
    WINDOW_MS: 15 * 60 * 1000,
}));

// Controlled rather than real so the profanity case is deterministic.
vi.mock('../lib/textModerator.js', () => ({
    default: {
        checkFields: (fields) =>
            Object.values(fields).some((v) => String(v).includes('BADWORD'))
                ? { clean: false, message: 'Watch your language' }
                : { clean: true },
    },
}));

const requireModerator = vi.fn();
vi.mock('../lib/clubPermissions.js', () => ({
    requireModerator: (...a) => requireModerator(...a),
    requireTopModerator: vi.fn(),
}));

const dispatch = vi.fn();
vi.mock('../notifications/service.js', () => ({
    NotificationService: { dispatch: (...a) => dispatch(...a) },
}));

const { default: clubPageRouter } = await import('./clubPage.js');

const CLUB = '11111111-1111-4111-8111-111111111111';
const SENDER = 'sender-1';

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clubs', clubPageRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const post = (body, user = SENDER) => {
    const r = request(makeApp()).post(`/api/clubs/${CLUB}/announce`);
    if (user) r.set('x-test-user', user);
    return r.send(body);
};

// The fan-out is a detached IIFE started after res.json(), so it has not run when
// supertest resolves. Two macrotask turns clears the awaits inside it.
const flush = async () => {
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r));
};

describe('POST /api/clubs/:clubId/announce', () => {
    beforeEach(() => {
        queries.length = 0;
        dispatch.mockReset();
        dispatch.mockResolvedValue({ ok: true });
        requireModerator.mockReset();
        requireModerator.mockResolvedValue('moderator');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        results = {
            'demo_club_data.select': { data: { club_name: 'Chess Club', image_url: 'https://img/c.png', school: 'Northeastern' }, error: null },
            'club_memberships.select': { data: [{ user_id: 'm1' }, { user_id: 'm2' }], error: null },
            'uni_names.select': { data: { id: 'uni-1' }, error: null },
        };
    });

    afterEach(() => vi.restoreAllMocks());

    // ---- authorization -------------------------------------------------------

    it('rejects an anonymous caller', async () => {
        const res = await request(makeApp()).post(`/api/clubs/${CLUB}/announce`).send({ message: 'hi' });
        expect(res.status).toBe(401);
    });

    it('rejects a non-moderator and never fans out', async () => {
        requireModerator.mockRejectedValue({ status: 403, message: 'Moderator only' });

        const res = await post({ message: 'hi' });
        await flush();

        expect(res.status).toBe(403);
        expect(dispatch).not.toHaveBeenCalled();
    });

    // ---- validation ----------------------------------------------------------

    it('requires a non-empty message', async () => {
        for (const body of [{}, { message: '' }, { message: '   ' }, { message: 42 }]) {
            const res = await post(body);
            expect(res.status).toBe(400);
        }
    });

    // Regression: destructuring req.body threw a TypeError and surfaced as a 500.
    it('returns 400, not 500, when there is no parsable body', async () => {
        const res = await request(makeApp())
            .post(`/api/clubs/${CLUB}/announce`)
            .set('x-test-user', SENDER)
            .set('Content-Type', 'text/plain')
            .send('');
        expect(res.status).toBe(400);
    });

    it('caps the message at 500 characters and the title at 80', async () => {
        expect((await post({ message: 'a'.repeat(501) })).status).toBe(400);
        expect((await post({ message: 'ok', title: 'b'.repeat(81) })).status).toBe(400);
        expect((await post({ message: 'a'.repeat(500), title: 'b'.repeat(80) })).status).toBe(200);
    });

    it('runs both fields through the moderator', async () => {
        expect((await post({ message: 'BADWORD' })).status).toBe(422);
        expect((await post({ message: 'fine', title: 'BADWORD' })).status).toBe(422);
    });

    // ---- fan-out -------------------------------------------------------------

    it('notifies every member except the sender', async () => {
        await post({ message: 'Meeting at 7pm' });
        await flush();

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls.map(([e]) => e.recipientId).sort()).toEqual(['m1', 'm2']);

        const memberQuery = queries.find((q) => q.table === 'club_memberships');
        expect(memberQuery.negated).toContainEqual(['user_id', SENDER]);
    });

    // The regression that made corrections vanish: decide() dedups on
    // (recipient_id, type, entity_id) for five minutes, so a constant entity id meant the
    // second announcement inside that window was dropped for everyone.
    it('gives each announcement a distinct entity id', async () => {
        await post({ message: 'Meeting at 7pm' });
        await flush();
        await post({ message: 'Correction: 8pm' });
        await flush();

        const ids = dispatch.mock.calls.map(([e]) => e.entity.id);
        expect(ids).toHaveLength(4);

        // Every recipient of ONE announcement shares its id — that is the announcement's
        // identity. What must differ is one announcement from the next, which is what
        // decide()'s (recipient_id, type, entity_id) dedup key turns on.
        const [a1, a2, b1, b2] = ids;
        expect(a1).toBe(a2);
        expect(b1).toBe(b2);
        expect(a1).not.toBe(b1);
        expect(ids.every((id) => id && id !== CLUB)).toBe(true);
    });

    it('carries the club id so the notification can link back to it', async () => {
        await post({ message: 'hi' });
        await flush();

        const [event] = dispatch.mock.calls[0];
        expect(event.payload.clubId).toBe(CLUB);
        expect(event.payload.uniId).toBe('uni-1');
        expect(event.payload).toMatchObject({ clubName: 'Chess Club', message: 'hi', title: null });
    });

    it('passes an optional title through, trimmed', async () => {
        await post({ message: 'body', title: '  Practice  ' });
        await flush();
        expect(dispatch.mock.calls[0][0].payload.title).toBe('Practice');
    });

    // ---- failure paths, all previously silent --------------------------------

    it('does not fan out when the member lookup fails, and says so', async () => {
        results['club_memberships.select'] = { data: null, error: { message: 'connection reset' } };

        await post({ message: 'hi' });
        await flush();

        expect(dispatch).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('[announce] member lookup failed', expect.objectContaining({ clubId: CLUB }));
    });

    // Without the club there is no name, avatar or link — the member cannot tell who
    // sent it, so sending an anonymous notification is worse than sending none.
    it('does not fan out when the club lookup fails', async () => {
        results['demo_club_data.select'] = { data: null, error: { message: 'gone' } };

        await post({ message: 'hi' });
        await flush();

        expect(dispatch).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('[announce] club lookup failed', expect.objectContaining({ clubId: CLUB }));
    });

    it('warns rather than silently returning when a club has no other members', async () => {
        results['club_memberships.select'] = { data: [], error: null };

        await post({ message: 'hi' });
        await flush();

        expect(dispatch).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('[announce] no recipients', expect.objectContaining({ clubId: CLUB }));
    });

    // uni_names.uni_name is matched by exact string, not a foreign key, so a miss is
    // routine. It must not abort the announcement — only make it non-clickable.
    it('still sends when no university matches, with a null link', async () => {
        results['uni_names.select'] = { data: null, error: null };

        await post({ message: 'hi' });
        await flush();

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0][0].payload.uniId).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
            '[announce] no uni_names match — notification will not be clickable',
            expect.objectContaining({ school: 'Northeastern' }),
        );
    });

    it('reports how many deliveries failed instead of reporting nothing', async () => {
        dispatch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'PGRST204' });

        await post({ message: 'hi' });
        await flush();

        expect(console.error).toHaveBeenCalledWith(
            '[announce] fan-out completed with failures',
            expect.objectContaining({ recipients: 2, delivered: 1, failed: 1, firstError: 'PGRST204' }),
        );
    });

    // A rejecting dispatch must not abort the rest of the fan-out.
    it('keeps going when one recipient throws', async () => {
        dispatch.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ ok: true });

        await post({ message: 'hi' });
        await flush();

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenCalledWith(
            '[announce] fan-out completed with failures',
            expect.objectContaining({ failed: 1 }),
        );
    });
});
