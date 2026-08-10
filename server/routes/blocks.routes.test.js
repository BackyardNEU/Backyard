import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

// In-memory stand-in for the three tables POST /blocks touches, so we can assert the
// side effects — friendship severed on BOTH sides, pending requests dropped.
const db = {
    profiles: new Map(),
    user_blocks: [],
    friend_requests: [],
};

vi.mock('../supabaseAdmin.js', () => {
    const from = (table) => {
        if (table === 'profiles') {
            return {
                select: () => ({
                    eq: (_c, id) => ({
                        maybeSingle: async () => ({ data: db.profiles.get(id) ?? null, error: null }),
                        single: async () => ({ data: db.profiles.get(id) ?? null, error: null }),
                    }),
                    in: async (_c, ids) => ({
                        data: ids.map((id) => db.profiles.get(id)).filter(Boolean),
                        error: null,
                    }),
                    order: async () => ({ data: [], error: null }),
                }),
                update: (patch) => ({
                    eq: async (_c, id) => {
                        const row = db.profiles.get(id);
                        if (row) db.profiles.set(id, { ...row, ...patch });
                        return { error: null };
                    },
                }),
            };
        }

        if (table === 'user_blocks') {
            return {
                select: () => ({
                    eq: () => ({ order: async () => ({ data: db.user_blocks, error: null }) }),
                    or: () => Promise.resolve({ data: db.user_blocks, error: null }),
                }),
                upsert: async (row) => {
                    const dup = db.user_blocks.some(
                        (b) => b.blocker_id === row.blocker_id && b.blocked_id === row.blocked_id
                    );
                    if (!dup) db.user_blocks.push(row);
                    return { error: null };
                },
                delete: () => ({
                    eq: (_c1, v1) => ({
                        eq: async (_c2, v2) => {
                            db.user_blocks = db.user_blocks.filter(
                                (b) => !(b.blocker_id === v1 && b.blocked_id === v2)
                            );
                            return { error: null };
                        },
                    }),
                }),
            };
        }

        // friend_requests
        return {
            delete: () => ({
                or: async () => {
                    db.friend_requests = [];
                    return { error: null };
                },
            }),
        };
    };

    return { supabaseAdmin: { from } };
});

const { default: blocksRouter } = await import('./blocks.js');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/me/blocks', blocksRouter);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    return app;
}

const token = (sub) =>
    jwt.sign({ sub, email: `${sub}@x.com`, aud: 'authenticated' }, process.env.SUPABASE_JWT_SECRET);

const post = (body, as = ALICE) =>
    request(makeApp()).post('/api/me/blocks').set('Authorization', `Bearer ${token(as)}`).send(body);

describe('POST /api/me/blocks', () => {
    beforeEach(() => {
        db.profiles = new Map([
            [ALICE, { id: ALICE, friend_list: [BOB] }],
            [BOB, { id: BOB, friend_list: [ALICE] }],
        ]);
        db.user_blocks = [];
        db.friend_requests = [{ sender_id: BOB, recipient_id: ALICE, status: 'pending' }];
    });

    it('requires authentication', async () => {
        const res = await request(makeApp()).post('/api/me/blocks').send({ blockedId: BOB });
        expect(res.status).toBe(401);
    });

    it('creates the block', async () => {
        const res = await post({ blockedId: BOB });
        expect(res.status).toBe(204);
        expect(db.user_blocks).toEqual([{ blocker_id: ALICE, blocked_id: BOB }]);
    });

    // The reason this route does not reuse DELETE /me/friends/:id, which is one-directional.
    it('severs the friendship on BOTH sides', async () => {
        await post({ blockedId: BOB });
        expect(db.profiles.get(ALICE).friend_list).toEqual([]);
        expect(db.profiles.get(BOB).friend_list).toEqual([]);
    });

    it('drops pending friend requests in either direction', async () => {
        await post({ blockedId: BOB });
        expect(db.friend_requests).toEqual([]);
    });

    it('is idempotent', async () => {
        await post({ blockedId: BOB });
        const second = await post({ blockedId: BOB });
        expect(second.status).toBe(204);
        expect(db.user_blocks).toHaveLength(1);
    });

    it('rejects blocking yourself', async () => {
        const res = await post({ blockedId: ALICE });
        expect(res.status).toBe(400);
        expect(db.user_blocks).toHaveLength(0);
    });

    it('rejects a non-uuid blockedId', async () => {
        for (const bad of ['not-a-uuid', '', null, `${BOB},blocker_id.eq.${ALICE}`]) {
            const res = await post({ blockedId: bad });
            expect(res.status).toBe(400);
        }
        expect(db.user_blocks).toHaveLength(0);
    });

    it('404s for a user that does not exist', async () => {
        const ghost = '99999999-9999-4999-8999-999999999999';
        const res = await post({ blockedId: ghost });
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/me/blocks/:blockedId', () => {
    beforeEach(() => {
        db.profiles = new Map([[ALICE, { id: ALICE, friend_list: [] }], [BOB, { id: BOB, friend_list: [] }]]);
        db.user_blocks = [{ blocker_id: ALICE, blocked_id: BOB }];
    });

    it('removes the block', async () => {
        const res = await request(makeApp())
            .delete(`/api/me/blocks/${BOB}`)
            .set('Authorization', `Bearer ${token(ALICE)}`);

        expect(res.status).toBe(204);
        expect(db.user_blocks).toHaveLength(0);
    });

    // Unblocking is not "undo" — it restores visibility, not the friendship.
    it('does not restore the friendship', async () => {
        await request(makeApp())
            .delete(`/api/me/blocks/${BOB}`)
            .set('Authorization', `Bearer ${token(ALICE)}`);

        expect(db.profiles.get(ALICE).friend_list).toEqual([]);
        expect(db.profiles.get(BOB).friend_list).toEqual([]);
    });

    it('rejects a non-uuid id', async () => {
        const res = await request(makeApp())
            .delete('/api/me/blocks/not-a-uuid')
            .set('Authorization', `Bearer ${token(ALICE)}`);

        expect(res.status).toBe(400);
        expect(db.user_blocks).toHaveLength(1);
    });
});
