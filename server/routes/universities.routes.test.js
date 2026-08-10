import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const NEU = { id: '38500bfc-e606-46a7-840d-720b11ad2e8b', uni_name: 'Northeastern' };
const BU = { id: '11111111-1111-4111-8111-111111111111', uni_name: 'Boston University' };
const STJ = { id: '22222222-2222-4222-8222-222222222222', uni_name: "St. John's College" };

let rows = [NEU, BU, STJ];
const eqSingle = vi.fn();

vi.mock('../supabaseAdmin.js', () => {
    const from = () => ({
        select: () => ({
            order: async () => ({ data: rows, error: null }),
            eq: () => ({ single: eqSingle }),
            // The slug path selects without .eq/.order and awaits the builder directly.
            then: (resolve) => resolve({ data: rows, error: null }),
        }),
    });
    return { supabaseAdmin: { from } };
});

const { default: universitiesRouter } = await import('./universities.js');

function makeApp() {
    const app = express();
    app.use('/api/universities', universitiesRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const get = (path) => request(makeApp()).get(path);

describe('GET /api/universities', () => {
    beforeEach(() => { rows = [NEU, BU, STJ]; eqSingle.mockReset(); });

    it('includes a slug for each university', async () => {
        const res = await get('/api/universities');
        expect(res.status).toBe(200);
        expect(res.body.map((u) => u.slug)).toEqual([
            'Northeastern', 'Boston-University', 'St-Johns-College',
        ]);
    });
});

describe('GET /api/universities/:idOrSlug', () => {
    beforeEach(() => { rows = [NEU, BU, STJ]; eqSingle.mockReset(); });

    it('resolves a readable slug', async () => {
        const res = await get('/api/universities/Northeastern');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: NEU.id, uni_name: 'Northeastern', slug: 'Northeastern' });
    });

    it('resolves a multi-word slug', async () => {
        const res = await get('/api/universities/Boston-University');
        expect(res.body.uni_name).toBe('Boston University');
    });

    it('resolves regardless of case', async () => {
        expect((await get('/api/universities/northeastern')).body.uni_name).toBe('Northeastern');
        expect((await get('/api/universities/NORTHEASTERN')).body.uni_name).toBe('Northeastern');
    });

    it('resolves a name whose punctuation the slug drops', async () => {
        expect((await get('/api/universities/St-Johns-College')).body.uni_name).toBe("St. John's College");
    });

    // Every link in the app used a UUID before slugs existed — bookmarks, the stored
    // lastPath and anything already shared would break if these stopped resolving.
    it('still resolves a legacy UUID', async () => {
        eqSingle.mockResolvedValueOnce({ data: NEU, error: null });
        const res = await get(`/api/universities/${NEU.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ uni_name: 'Northeastern', slug: 'Northeastern' });
        expect(eqSingle).toHaveBeenCalledOnce();
    });

    it('404s an unknown slug without touching the id lookup', async () => {
        const res = await get('/api/universities/Hogwarts');
        expect(res.status).toBe(404);
        expect(eqSingle).not.toHaveBeenCalled();
    });

    it('404s an unknown UUID', async () => {
        eqSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows', code: 'PGRST116' } });
        expect((await get(`/api/universities/${'99999999-9999-4999-8999-999999999999'}`)).status).toBe(404);
    });
});
