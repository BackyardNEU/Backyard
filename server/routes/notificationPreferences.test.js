import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const USER = '11111111-1111-4111-8111-111111111111';

let prefRows = [];
const upsertMock = vi.fn();

vi.mock('../supabaseAdmin.js', () => {
    const from = (table) => {
        if (table === 'notification_preferences') {
            const chain = {
                select: () => chain,
                eq: () => chain,
                then: (resolve) => resolve({ data: prefRows, error: null }),
            };
            return {
                ...chain,
                upsert: async (rows, opts) => {
                    upsertMock(rows, opts);
                    return { error: null };
                },
            };
        }
        return { select: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) }) };
    };
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
const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('GET /api/me/notification-preferences', () => {
    beforeEach(() => { prefRows = []; upsertMock.mockReset(); });

    // Absence of a row means enabled — rows are negative overrides only.
    it('defaults every settable channel to enabled', async () => {
        const res = await auth(request(makeApp()).get('/api/me/notification-preferences'));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ in_app: true, email: true });
    });

    it('reflects a disabling row', async () => {
        prefRows = [{ channel: 'email', enabled: false }];
        const res = await auth(request(makeApp()).get('/api/me/notification-preferences'));
        expect(res.body).toEqual({ in_app: true, email: false });
    });

    // push is a stub channel; exposing a toggle for it would be a lie.
    it('never reports push as settable', async () => {
        prefRows = [{ channel: 'push', enabled: false }];
        const res = await auth(request(makeApp()).get('/api/me/notification-preferences'));
        expect(res.body).not.toHaveProperty('push');
    });

    it('requires auth', async () => {
        const res = await request(makeApp()).get('/api/me/notification-preferences');
        expect(res.status).toBe(401);
    });
});

describe('PUT /api/me/notification-preferences', () => {
    beforeEach(() => { prefRows = []; upsertMock.mockReset(); });

    // The wildcard is what makes a per-channel master toggle cover types added later.
    it('writes wildcard rows', async () => {
        const res = await auth(request(makeApp()).put('/api/me/notification-preferences')).send({ email: false });

        expect(res.status).toBe(204);
        expect(upsertMock).toHaveBeenCalledWith(
            [{ user_id: USER, type: '*', channel: 'email', enabled: false }],
            { onConflict: 'user_id,type,channel' }
        );
    });

    it('writes several channels at once', async () => {
        await auth(request(makeApp()).put('/api/me/notification-preferences')).send({ in_app: false, email: true });
        expect(upsertMock.mock.calls[0][0]).toHaveLength(2);
    });

    it('ignores push and any unknown channel', async () => {
        const res = await auth(request(makeApp()).put('/api/me/notification-preferences'))
            .send({ push: false, sms: true });

        expect(res.status).toBe(400);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('ignores non-boolean values', async () => {
        const res = await auth(request(makeApp()).put('/api/me/notification-preferences')).send({ email: 'nope' });
        expect(res.status).toBe(400);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('requires auth', async () => {
        const res = await request(makeApp()).put('/api/me/notification-preferences').send({ email: false });
        expect(res.status).toBe(401);
    });
});
