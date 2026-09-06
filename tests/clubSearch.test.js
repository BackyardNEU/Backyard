import { describe, it, expect } from 'vitest';
import { scoreClub, searchClubs } from '../src/lib/clubSearch.js';

// The names in demo_club_data are official ones, which is rarely what anyone types.
const clubs = [
    { club_name: 'Husky Competitive Programming Club', school: 'Northeastern' },
    { club_name: 'Chess Club', school: 'Northeastern' },
    { club_name: 'Chess and Strategy Society', school: 'Northeastern' },
    { club_name: "St. John's Debate Union", school: 'Northeastern' },
    { club_name: 'Alpha Chi Omega', school: 'Northeastern' },
];

const names = (q) => searchClubs(clubs, q).map((c) => c.club_name);

describe('searchClubs', () => {
    it('returns everything for an empty query', () => {
        expect(searchClubs(clubs, '').length).toBe(clubs.length);
        expect(searchClubs(clubs, '   ').length).toBe(clubs.length);
    });

    it('finds a plain substring', () => {
        expect(names('chess')).toContain('Chess Club');
    });

    // The closest match has to come first, or the ranking is not worth doing.
    it('puts the tighter match first', () => {
        expect(names('chess')[0]).toBe('Chess Club');
    });

    // The words are right but not adjacent, which a substring test misses entirely.
    it('matches words with others in between', () => {
        expect(names('husky programming')).toContain('Husky Competitive Programming Club');
    });

    it('matches an acronym', () => {
        expect(names('hcpc')).toContain('Husky Competitive Programming Club');
    });

    // Punctuation in the official name should never be something anyone has to reproduce.
    it('ignores punctuation and spacing', () => {
        expect(names('stjohns')).toContain("St. John's Debate Union");
        expect(names('st johns')).toContain("St. John's Debate Union");
        expect(names('chessclub')).toContain('Chess Club');
    });

    it('is case insensitive', () => {
        expect(names('CHESS')).toContain('Chess Club');
    });

    it('returns nothing when there is genuinely no match', () => {
        expect(names('zzzzqq')).toEqual([]);
    });

    it('matches on school when the query is specific enough', () => {
        expect(names('northeastern').length).toBe(clubs.length);
    });
});

describe('scoreClub', () => {
    it('ranks an exact name above a prefix above a substring', () => {
        const exact = scoreClub({ club_name: 'Chess' }, 'chess');
        const prefix = scoreClub({ club_name: 'Chess Club' }, 'chess');
        const inside = scoreClub({ club_name: 'The Chess Club' }, 'chess');
        expect(exact).toBeGreaterThan(prefix);
        expect(prefix).toBeGreaterThan(inside);
    });

    it('ranks a real substring above a scattered subsequence', () => {
        const substring = scoreClub({ club_name: 'Programming Club' }, 'programming');
        const scattered = scoreClub({ club_name: 'Husky Competitive Programming Club' }, 'hpc');
        expect(substring).toBeGreaterThan(scattered);
    });

    it('scores a tight subsequence above a scattered one', () => {
        const tight = scoreClub({ club_name: 'Chess Club' }, 'chesclb');
        const loose = scoreClub({ club_name: 'Chess and Strategy Society for Everyone' }, 'cse');
        expect(tight).toBeGreaterThan(loose);
    });

    it('returns null when nothing matches', () => {
        expect(scoreClub({ club_name: 'Chess Club' }, 'zzz')).toBeNull();
    });

    it('does not fall over on missing fields', () => {
        expect(() => scoreClub({}, 'chess')).not.toThrow();
        expect(scoreClub({}, 'chess')).toBeNull();
    });
});
