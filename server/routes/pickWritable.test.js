import { describe, it, expect } from 'vitest';
import { pickWritable, PROFILE_WRITABLE } from './profiles.js';

describe('PROFILE_WRITABLE whitelist', () => {
    // This test deliberately pins the *exact* set of writable fields.
    // If you add a column to the whitelist, this test fails — forcing you
    // to ask: "should the user really be able to overwrite this?"
    it('contains exactly the expected fields', () => {
        expect([...PROFILE_WRITABLE].sort()).toEqual(
            [
                'username',
                'first_name',
                'last_name',
                'avatar_url',
                'biography',
                'photos',
                'school',
                'graduation_year',
                'major',
            ].sort()
        );
    });
});

describe('pickWritable', () => {
    it('keeps all whitelisted fields', () => {
        const body = {
            username: 'alice',
            first_name: 'Alice',
            last_name: 'Anderson',
            biography: 'hi',
            school: 'NEU',
            graduation_year: 2027,
            major: 'CS',
        };
        expect(pickWritable(body)).toEqual(body);
    });

    it('drops unknown fields entirely', () => {
        const body = { username: 'alice', unknown_field: 'x', another: 1 };
        expect(pickWritable(body)).toEqual({ username: 'alice' });
    });

    // The whole point of the whitelist — these are the privilege-escalation
    // vectors mentioned in the source comment.
    it.each([
        ['id', '00000000-0000-0000-0000-000000000000'],
        ['is_admin', true],
        ['email', 'attacker@evil.com'],
        ['member_list', ['someone-else']],
        ['created_at', '1970-01-01'],
    ])('strips dangerous field %s', (key, value) => {
        const result = pickWritable({ username: 'alice', [key]: value });
        expect(result).not.toHaveProperty(key);
        expect(result).toEqual({ username: 'alice' });
    });

    it('returns empty object for empty body', () => {
        expect(pickWritable({})).toEqual({});
    });

    it.each([
        [null],
        [undefined],
    ])('returns empty object for %j body without throwing', (body) => {
        expect(() => pickWritable(body)).not.toThrow();
        expect(pickWritable(body)).toEqual({});
    });

    // A user clearing their bio submits biography: '' — that must survive.
    // (Regression guard: easy to accidentally write `if (body[key])` which
    // would drop empty strings and nulls.)
    it('preserves falsy values for whitelisted fields', () => {
        expect(pickWritable({ biography: '', avatar_url: null, graduation_year: 0 })).toEqual({
            biography: '',
            avatar_url: null,
            graduation_year: 0,
        });
    });
});
