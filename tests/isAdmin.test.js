import { describe, it, expect, vi } from 'vitest';
import { parseAdminIds, isAdmin, requireAdmin } from '../server/lib/isAdmin.js';

// Extracted from invites.js, where it was a local helper. Seven endpoints across two
// route files now need it, and the original never trimmed — so ADMIN_USER_IDS="a, b"
// silently failed to recognise "b" as an admin.

describe('parseAdminIds', () => {
    it('splits a comma-separated list', () => {
        expect(parseAdminIds('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    // The bug in the original implementation: no trim, so a list formatted with spaces
    // after the commas locked out every admin except the first.
    it('trims whitespace around each id', () => {
        expect(parseAdminIds('a, b ,  c')).toEqual(['a', 'b', 'c']);
    });

    it('drops empty entries rather than producing an empty-string admin', () => {
        expect(parseAdminIds('a,,b,')).toEqual(['a', 'b']);
    });

    it('returns an empty list for an unset value', () => {
        expect(parseAdminIds(undefined)).toEqual([]);
        expect(parseAdminIds('')).toEqual([]);
    });

    it('returns an empty list when the value is only separators', () => {
        expect(parseAdminIds(', ,,')).toEqual([]);
    });
});

describe('isAdmin', () => {
    it('recognises a listed id', () => {
        expect(isAdmin('user-1', 'user-1,user-2')).toBe(true);
    });

    it('rejects an unlisted id', () => {
        expect(isAdmin('user-3', 'user-1,user-2')).toBe(false);
    });

    it('rejects everyone when the allowlist is unset', () => {
        expect(isAdmin('user-1', undefined)).toBe(false);
    });

    // Guards against an empty userId matching an empty allowlist entry, which would
    // make an anonymous caller an admin.
    it('rejects an empty or missing userId', () => {
        expect(isAdmin('', 'user-1')).toBe(false);
        expect(isAdmin(undefined, 'user-1')).toBe(false);
        expect(isAdmin('', ',,')).toBe(false);
    });
});

describe('requireAdmin middleware', () => {
    const mockRes = () => {
        const res = {};
        res.status = vi.fn(() => res);
        res.json = vi.fn(() => res);
        return res;
    };

    it('calls next() for a listed admin', () => {
        const next = vi.fn();
        const res = mockRes();
        requireAdmin({ user: { id: 'user-1' } }, res, next, 'user-1,user-2');
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('responds 403 for an authenticated non-admin', () => {
        const next = vi.fn();
        const res = mockRes();
        requireAdmin({ user: { id: 'nobody' } }, res, next, 'user-1');
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    // requireAuth normally runs first, but the middleware must not throw if it doesn't.
    it('responds 401 when there is no authenticated user', () => {
        const next = vi.fn();
        const res = mockRes();
        requireAdmin({}, res, next, 'user-1');
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('does not leak the allowlist in the error body', () => {
        const res = mockRes();
        requireAdmin({ user: { id: 'nobody' } }, res, vi.fn(), 'secret-admin-id');
        const body = JSON.stringify(res.json.mock.calls[0][0]);
        expect(body).not.toContain('secret-admin-id');
    });
});
