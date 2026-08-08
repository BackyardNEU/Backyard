import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const USER = '11111111-1111-4111-8111-111111111111';

const upsertMock = vi.fn();

vi.mock('../supabaseAdmin.js', () => {
    const from = () => ({
        upsert: (row, opts) => {
            upsertMock(row, opts);
            return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        },
        select: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) }),
    });
    return { supabaseAdmin: { from } };
});

vi.mock('../middleware/checkMuted.js', () => ({ checkMuted: (_r, _s, next) => next() }));

const { default: profilesRouter } = await import('./profiles.js');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/me', profilesRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const token = jwt.sign({ sub: USER, email: 'a@b.com', aud: 'authenticated' }, process.env.SUPABASE_JWT_SECRET);
const post = (body) =>
    request(makeApp()).post('/api/me/profile').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/me/profile', () => {
    beforeEach(() => upsertMock.mockReset());

    // The bug this guards: AuthListener calls this on every auth state change, and for
    // email/password signups user_metadata has no name, so it sent first_name: "".
    // The upsert then overwrote the user's real name with an empty string — on every
    // page load, silently, permanently.
    it('never writes a blank string over an existing field', async () => {
        await post({ first_name: '', last_name: '' });

        const [row] = upsertMock.mock.calls[0];
        expect(row).not.toHaveProperty('first_name');
        expect(row).not.toHaveProperty('last_name');
    });

    it('drops whitespace-only values too', async () => {
        await post({ first_name: '   ', biography: '\t' });
        const [row] = upsertMock.mock.calls[0];
        expect(row).not.toHaveProperty('first_name');
        expect(row).not.toHaveProperty('biography');
    });

    it('still writes real values', async () => {
        await post({ first_name: 'Ryan', last_name: 'Sinha' });
        expect(upsertMock.mock.calls[0][0]).toMatchObject({ first_name: 'Ryan', last_name: 'Sinha' });
    });

    it('keeps only the supplied field when the other is blank', async () => {
        await post({ first_name: 'Ryan', last_name: '' });
        const [row] = upsertMock.mock.calls[0];
        expect(row.first_name).toBe('Ryan');
        expect(row).not.toHaveProperty('last_name');
    });

    // Still has to create the row for a brand new account, which is its whole purpose.
    it('creates the row with an empty body', async () => {
        const res = await post({});
        expect(res.status).toBe(200);
        expect(upsertMock.mock.calls[0][0]).toMatchObject({ id: USER, email: 'a@b.com' });
    });

    // id and email come from the verified JWT, never the body.
    it('ignores an attempt to set someone else as the owner', async () => {
        await post({ id: 'someone-else', email: 'attacker@evil.com', first_name: 'Ryan' });
        const [row] = upsertMock.mock.calls[0];
        expect(row.id).toBe(USER);
        expect(row.email).toBe('a@b.com');
    });

    it('requires auth', async () => {
        const res = await request(makeApp()).post('/api/me/profile').send({ first_name: 'Ryan' });
        expect(res.status).toBe(401);
    });
});
