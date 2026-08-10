import { describe, it, expect } from 'vitest';
import { getInitials, hashString, colorFor, COLORS } from '../src/components/avatarIdentity.js';

// Avatar itself cannot be rendered here — the repo has no DOM test environment — but this
// is the behaviour that actually matters: what the initials say, and that a person's
// colour never moves.

describe('getInitials', () => {
    it('uses first and last initial when both exist', () => {
        expect(getInitials('Ryan', 'Sinha')).toBe('RS');
    });

    it('uses whichever name is present', () => {
        expect(getInitials('Ryan', '')).toBe('R');
        expect(getInitials('', 'Sinha')).toBe('S');
    });

    // PR #12's version took first/last only, so every username-only call site would have
    // collapsed to the same '?' — which is the row-of-identical-avatars problem again.
    it('falls back to the username when there is no name', () => {
        expect(getInitials('', '', 'connorf')).toBe('CO');
    });

    it('prefers the name over the username', () => {
        expect(getInitials('Milo', 'Bell', 'zzz')).toBe('MB');
    });

    it('ignores whitespace-only names', () => {
        expect(getInitials('   ', '  ', 'alice')).toBe('AL');
    });

    it('falls back to ? with nothing to work from', () => {
        expect(getInitials('', '', '')).toBe('?');
        expect(getInitials(null, undefined, null)).toBe('?');
    });

    it('always uppercases', () => {
        expect(getInitials('ryan', 'sinha')).toBe('RS');
    });
});

describe('colour assignment', () => {
    // The point of hashing rather than randomising: the same person is the same colour
    // everywhere, on every render.
    it('is stable for the same identity', () => {
        expect(colorFor('Ryan', 'Sinha')).toBe(colorFor('Ryan', 'Sinha'));
    });

    it('always lands on a real palette entry', () => {
        for (const name of ['Ryan', 'Milo', 'Connor', 'A', '', 'zzzzzzzzzz', '你好']) {
            expect(COLORS).toContain(colorFor(name, '', ''));
        }
    });

    // hashString overflows into negatives without the Math.abs, which would index off the
    // end of the palette and render a circle with no background at all.
    it('never produces a negative index', () => {
        for (const s of ['a'.repeat(200), 'Zoë Q', '💥']) {
            expect(hashString(s)).toBeGreaterThanOrEqual(0);
        }
    });

    it('separates different people', () => {
        const colors = [['Ryan', 'Sinha'], ['Milo', 'Bell'], ['Connor', 'Friedman']]
            .map(([f, l]) => colorFor(f, l));
        expect(new Set(colors).size).toBeGreaterThan(1);
    });
});
