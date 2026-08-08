import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    cachedFetch, readCached, invalidateKey, invalidatePrefix, invalidateAllQueries,
} from '../src/lib/queryCache.js';

describe('queryCache', () => {
    beforeEach(() => { invalidateAllQueries(); });
    afterEach(() => { vi.useRealTimers(); });

    it('runs the loader once and caches the result', async () => {
        const loader = vi.fn().mockResolvedValue({ v: 1 });
        expect(await cachedFetch('k', loader)).toEqual({ v: 1 });
        expect(await cachedFetch('k', loader)).toEqual({ v: 1 });
        expect(loader).toHaveBeenCalledOnce();
    });

    // Two components mounting at once must not both fetch.
    it('dedupes concurrent callers onto one promise', async () => {
        const loader = vi.fn().mockResolvedValue({ v: 1 });
        const [a, b] = await Promise.all([cachedFetch('k', loader), cachedFetch('k', loader)]);
        expect(a).toBe(b);
        expect(loader).toHaveBeenCalledOnce();
    });

    it('keys are independent', async () => {
        await cachedFetch('a', () => Promise.resolve(1));
        await cachedFetch('b', () => Promise.resolve(2));
        expect(readCached('a')).toBe(1);
        expect(readCached('b')).toBe(2);
    });

    it('readCached is null when absent', () => {
        expect(readCached('nope')).toBeNull();
    });

    it('expires on the TTL', async () => {
        vi.useFakeTimers();
        await cachedFetch('k', () => Promise.resolve('v'));
        expect(readCached('k')).toBe('v');
        vi.advanceTimersByTime(61_000);
        expect(readCached('k')).toBeNull();
    });

    it('honours a custom ttl', async () => {
        vi.useFakeTimers();
        await cachedFetch('k', () => Promise.resolve('v'), { ttl: 5_000 });
        vi.advanceTimersByTime(6_000);
        expect(readCached('k', { ttl: 5_000 })).toBeNull();
    });

    // A failure must be retryable rather than remembered as the answer.
    it('does not cache rejections', async () => {
        const loader = vi.fn()
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce('ok');

        await expect(cachedFetch('k', loader)).rejects.toThrow('boom');
        expect(readCached('k')).toBeNull();
        expect(await cachedFetch('k', loader)).toBe('ok');
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('invalidateKey drops just that key', async () => {
        await cachedFetch('a', () => Promise.resolve(1));
        await cachedFetch('b', () => Promise.resolve(2));
        invalidateKey('a');
        expect(readCached('a')).toBeNull();
        expect(readCached('b')).toBe(2);
    });

    // Blocking someone changes what every profile returns, not just theirs.
    it('invalidatePrefix drops a family of keys', async () => {
        await cachedFetch('user:1', () => Promise.resolve(1));
        await cachedFetch('user:2', () => Promise.resolve(2));
        await cachedFetch('me:blocks', () => Promise.resolve([]));
        invalidatePrefix('user:');
        expect(readCached('user:1')).toBeNull();
        expect(readCached('user:2')).toBeNull();
        expect(readCached('me:blocks')).toEqual([]);
    });

    it('invalidateAllQueries clears everything', async () => {
        await cachedFetch('a', () => Promise.resolve(1));
        await cachedFetch('b', () => Promise.resolve(2));
        invalidateAllQueries();
        expect(readCached('a')).toBeNull();
        expect(readCached('b')).toBeNull();
    });

    it('ignores an empty key without calling the loader', async () => {
        const loader = vi.fn();
        expect(await cachedFetch('', loader)).toBeNull();
        expect(loader).not.toHaveBeenCalled();
    });
});
