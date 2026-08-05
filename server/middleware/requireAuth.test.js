import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth } from './requireAuth.js';

// vitest.setup.js sets SUPABASE_JWT_SECRET before this module loads.
const SECRET = process.env.SUPABASE_JWT_SECRET;

function sign(payload, opts = {}) {
    return jwt.sign(payload, SECRET, { audience: 'authenticated', ...opts });
}

function makeReqRes(headers = {}) {
    const req = { headers };
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(b) { this.body = b; return this; },
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('requireAuth', () => {
    it('accepts a valid token and attaches id + email to req.user', () => {
        const token = sign({ sub: 'user-123', email: 'alice@example.com' });
        const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

        requireAuth(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.user).toEqual({ id: 'user-123', email: 'alice@example.com' });
        expect(res.statusCode).toBe(200);
    });

    it('rejects when the Authorization header is missing', () => {
        const { req, res, next } = makeReqRes({});
        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Missing Authorization bearer token' });
    });

    it('rejects when the scheme is not Bearer', () => {
        const token = sign({ sub: 'user-123' });
        const { req, res, next } = makeReqRes({ authorization: `Basic ${token}` });
        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('rejects an expired token', () => {
        // expiresIn: '-1s' → already expired
        const token = sign({ sub: 'user-123' }, { expiresIn: '-1s' });
        const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid or expired session' });
    });

    it('rejects a token signed with the wrong secret', () => {
        const token = jwt.sign({ sub: 'user-123' }, 'a-different-secret', { audience: 'authenticated' });
        const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('rejects a token with the wrong audience', () => {
        const token = jwt.sign({ sub: 'user-123' }, SECRET, { audience: 'someone-else' });
        const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('rejects a syntactically malformed token', () => {
        const { req, res, next } = makeReqRes({ authorization: 'Bearer not-a-real-jwt' });
        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });
});
