import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the Supabase admin client *before* importing the router.
// vi.mock is hoisted to the top of the file by vitest, so this runs first.
//
// The route calls: supabaseAdmin.from('profiles').select('id').eq('username', x).limit(1)
// We expose `limitMock` so each test can control what that final call returns.
const limitMock = vi.fn();
vi.mock('../supabaseAdmin.js', () => {
    const eqMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    return { supabaseAdmin: { from: fromMock } };
});

// Import AFTER vi.mock is registered.
const { default: usersRouter } = await import('./users.js');

function makeApp() {
    const app = express();
    app.use('/api/users', usersRouter);
    // Minimal error handler so thrown errors don't crash the test process.
    app.use((err, _req, res, _next) => {
        res.status(err.status || 500).json({ error: err.message });
    });
    return app;
}

describe('GET /api/users/check-username', () => {
    beforeEach(() => {
        limitMock.mockReset();
    });

    it('rejects badly-formatted usernames without hitting the database', async () => {
        const res = await request(makeApp()).get('/api/users/check-username?username=ab');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            available: false,
            reason: expect.stringContaining('3-30'),
        });
        // Critical: we never queried Supabase for an obviously-invalid name.
        expect(limitMock).not.toHaveBeenCalled();
    });

    it('returns available:true when no row matches', async () => {
        limitMock.mockResolvedValueOnce({ data: [], error: null });

        const res = await request(makeApp()).get('/api/users/check-username?username=alice');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: true });
        expect(limitMock).toHaveBeenCalledOnce();
    });

    it('returns available:false when a row matches', async () => {
        limitMock.mockResolvedValueOnce({ data: [{ id: 'some-uuid' }], error: null });

        const res = await request(makeApp()).get('/api/users/check-username?username=alice');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ available: false });
    });

    it('bubbles a 502 when Supabase returns an error', async () => {
        limitMock.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });

        const res = await request(makeApp()).get('/api/users/check-username?username=alice');
        expect(res.status).toBe(502);
        expect(res.body).toEqual({ error: 'db down' });
    });
});
