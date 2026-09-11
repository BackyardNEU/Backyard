import { describe, it, expect } from 'vitest';
import { keyByUser, WINDOW_MS } from '../server/lib/rateLimit.js';

// The bucket key is the whole point of this helper. Keying by IP throttles an entire
// campus as one person, because a university NATs thousands of students behind a handful
// of addresses — clubPage.js had drifted to exactly that by calling rateLimit() directly
// with no keyGenerator.
describe('keyByUser', () => {
    it('keys by user id when the caller is identified', () => {
        expect(keyByUser({ user: { id: 'user-1' }, ip: '1.2.3.4' })).toBe('user-1');
    });

    // identifyUser runs before the limiters but never rejects, so an anonymous caller
    // reaches them with no req.user and still has to land in some bucket.
    it('falls back to the IP when there is no user', () => {
        expect(keyByUser({ ip: '1.2.3.4' })).toBe('1.2.3.4');
        expect(keyByUser({ user: null, ip: '1.2.3.4' })).toBe('1.2.3.4');
    });

    // ipKeyGenerator normalizes IPv6 to a /56 subnet. Hand-rolled req.ip keying treats
    // every address in a client's prefix as a separate bucket, which makes an IPv6 client
    // effectively unlimited.
    it('normalizes IPv6 rather than using the raw address', () => {
        const key = keyByUser({ ip: '2001:db8:1234:5600:abcd:ef01:2345:6789' });
        expect(key).not.toBe('2001:db8:1234:5600:abcd:ef01:2345:6789');
        expect(key.startsWith('2001:db8:1234')).toBe(true);
    });

    it('does not throw when there is neither a user nor an ip', () => {
        expect(() => keyByUser({})).not.toThrow();
    });

    it('uses a 15 minute window', () => {
        expect(WINDOW_MS).toBe(15 * 60 * 1000);
    });
});
