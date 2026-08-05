import { describe, it, expect } from 'vitest';
import { validateUsername, USERNAME_REASON } from './validateUsername.js';

describe('validateUsername', () => {
    describe('valid usernames', () => {
        it.each([
            ['abc', 'minimum length (3 chars)'],
            ['a'.repeat(30), 'maximum length (30 chars)'],
            ['user_123', 'letters, digits, underscore'],
            ['ABC_def_123', 'mixed case allowed'],
            ['_____', 'underscores only'],
            ['00000', 'digits only'],
        ])('accepts %j (%s)', (input) => {
            const result = validateUsername(input);
            expect(result.valid).toBe(true);
            expect(result.normalized).toBe(input);
            expect(result.reason).toBeUndefined();
        });

        it('trims surrounding whitespace before validating', () => {
            const result = validateUsername('  alice  ');
            expect(result.valid).toBe(true);
            expect(result.normalized).toBe('alice');
        });
    });

    describe('invalid usernames', () => {
        it.each([
            ['ab', 'too short (2 chars)'],
            ['', 'empty string'],
            ['   ', 'whitespace-only — trims to empty'],
            ['a'.repeat(31), 'too long (31 chars)'],
            ['user name', 'contains space'],
            ['user-name', 'contains hyphen'],
            ['user.name', 'contains dot'],
            ['user!', 'special char'],
            ['usér', 'non-ASCII letter'],
            ['🙂hi', 'emoji'],
        ])('rejects %j (%s)', (input) => {
            const result = validateUsername(input);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe(USERNAME_REASON);
        });

        it.each([
            [null, 'null'],
            [undefined, 'undefined'],
            [{}, 'object — coerces to "[object Object]"'],
        ])('rejects non-string input %j (%s) without throwing', (input) => {
            expect(() => validateUsername(input)).not.toThrow();
            expect(validateUsername(input).valid).toBe(false);
        });

        // Documenting an intentional quirk: numbers coerce to digit strings,
        // and digit-only usernames *are* valid (see the '00000' case above).
        // The route only ever passes strings from req.query, so this never
        // matters in practice — but the test exists so future-you doesn't
        // "fix" it by accident.
        it('coerces numbers to digit strings (which are valid usernames)', () => {
            expect(validateUsername(12345)).toEqual({ valid: true, normalized: '12345' });
        });
    });
});
