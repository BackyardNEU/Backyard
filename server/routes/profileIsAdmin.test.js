import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// GET /api/me/profile carries is_admin so the nav bar can show an admin entry without
// every visitor firing a /admin/is-admin request that 403s for almost all of them.
//
// It is derived per-request from ADMIN_USER_IDS, never read from or written to the
// profiles row — a column would be writable through some future mass-assignment bug,
// and this is the one flag that must not be.
const profileRow = vi.fn();

vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: {
        from: () => ({ select: () => ({ eq: () => ({ single: () => profileRow() }) }) }),
    },
}));

vi.mock('../middleware/checkMuted.js', () => ({
    checkMuted: (_req, _res, next) => next(),
}));

const { default: profilesRouter } = await import('./profiles.js');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/me', profilesRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const tokenFor = (sub) => jwt.sign({ sub, email: `${sub}@x.com`, aud: 'authenticated' }, process.env.SUPABASE_JWT_SECRET);
const get = (sub) => request(makeApp()).get('/api/me/profile').set('Authorization', `Bearer ${tokenFor(sub)}`);

describe('GET /api/me/profile is_admin', () => {
    beforeEach(() => {
        profileRow.mockReset();
        profileRow.mockResolvedValue({ data: { id: 'user-1', username: 'ryan' }, error: null });
        process.env.ADMIN_USER_IDS = 'admin-1, admin-2';
    });

    it('is true for a user in ADMIN_USER_IDS', async () => {
        const res = await get('admin-1');
        expect(res.status).toBe(200);
        expect(res.body.is_admin).toBe(true);
    });

    // Whitespace after the comma is the exact formatting that used to lock out every
    // admin but the first, which is why parseAdminIds trims.
    it('is true for an entry written with a space after the comma', async () => {
        profileRow.mockResolvedValue({ data: { id: 'admin-2' }, error: null });
        expect((await get('admin-2')).body.is_admin).toBe(true);
    });

    it('is false for everyone else', async () => {
        const res = await get('user-1');
        expect(res.status).toBe(200);
        expect(res.body.is_admin).toBe(false);
    });

    // Never absent: the nav bar reads it directly, and undefined would render as
    // not-admin silently rather than failing visibly if the field were ever dropped.
    it('is always present as a boolean', async () => {
        expect(typeof (await get('user-1')).body.is_admin).toBe('boolean');
    });

    // The flag is computed, so a stored column of the same name must not win.
    it('ignores an is_admin column on the stored row', async () => {
        profileRow.mockResolvedValue({ data: { id: 'user-1', is_admin: true }, error: null });
        expect((await get('user-1')).body.is_admin).toBe(false);
    });
});
