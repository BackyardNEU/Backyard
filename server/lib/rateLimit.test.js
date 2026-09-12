import { describe, it, expect, vi } from 'vitest';

// express-rate-limit is mocked so tests don't need a running Express app or
// real timing. We verify that limiter() passes the right config to rateLimit().
const rateLimitSpy = vi.fn((opts) => opts);
vi.mock('express-rate-limit', () => ({
    default: rateLimitSpy,
    ipKeyGenerator: (ip) => ip,
}));

const { keyByUser, limiter } = await import('./rateLimit.js');

describe('keyByUser()', () => {
    it('returns the user id when req.user is populated', () => {
        const req = { user: { id: 'user-123' }, ip: '1.2.3.4' };
        expect(keyByUser(req)).toBe('user-123');
    });

    it('falls back to IP when req.user is absent', () => {
        const req = { user: null, ip: '1.2.3.4' };
        expect(keyByUser(req)).toBe('1.2.3.4');
    });

    it('falls back to IP when req.user.id is undefined', () => {
        const req = { user: {}, ip: '5.6.7.8' };
        expect(keyByUser(req)).toBe('5.6.7.8');
    });
});

describe('limiter()', () => {
    it('passes max to rateLimit()', () => {
        limiter(42);
        const opts = rateLimitSpy.mock.calls.at(-1)[0];
        expect(opts.max).toBe(42);
    });

    it('enables standard headers so clients can read RateLimit-* fields', () => {
        limiter(10);
        const opts = rateLimitSpy.mock.calls.at(-1)[0];
        expect(opts.standardHeaders).toBe(true);
    });
});
