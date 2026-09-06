import { describe, it, expect } from 'vitest';
import { validateInterests, INTEREST_LIMITS } from '../shared/clubInterestsValidation.js';

// club_interests stores one category and its subcategory ids. The wizard requires two
// subcategories because one word rarely describes a club well enough for search, and a
// taxonomy is only useful when everyone fills it in to the same depth.

const ok = () => ({
    category_id: 'cat-1',
    subcategories: [{ id: 'sub-1', name: 'Chess' }, { name: 'Strategy games' }],
});

describe('validateInterests', () => {
    it('accepts a category with two subcategories', () => {
        expect(validateInterests(ok())).toEqual({ valid: true, errors: [] });
    });

    // One from our list, one typed. That is the whole point of the combobox.
    it('accepts a mix of an existing row and a typed name', () => {
        const r = validateInterests({
            category_id: 'cat-1',
            subcategories: [{ id: 'sub-1', name: 'Chess' }, { name: 'Something new' }],
        });
        expect(r.valid).toBe(true);
    });

    it('requires a category', () => {
        const r = validateInterests({ ...ok(), category_id: undefined });
        expect(r.valid).toBe(false);
        expect(r.errors.join(' ')).toMatch(/category/i);
    });

    it('requires exactly two subcategories', () => {
        expect(validateInterests({ ...ok(), subcategories: [] }).valid).toBe(false);
        expect(validateInterests({ ...ok(), subcategories: [{ name: 'One' }] }).valid).toBe(false);
    });

    it('rejects more than two', () => {
        const r = validateInterests({
            ...ok(),
            subcategories: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
        });
        expect(r.valid).toBe(false);
    });

    // Two identical entries would store as one and quietly leave the club with a single
    // tag, which looks like the form silently dropped an answer.
    it('rejects two subcategories with the same name', () => {
        const r = validateInterests({
            category_id: 'cat-1',
            subcategories: [{ name: 'Chess' }, { name: '  chess ' }],
        });
        expect(r.valid).toBe(false);
        expect(r.errors.join(' ')).toMatch(/same/i);
    });

    it('enforces the same name bounds as the interests API', () => {
        expect(validateInterests({
            category_id: 'c', subcategories: [{ name: 'a' }, { name: 'Fine' }],
        }).valid).toBe(false);

        expect(validateInterests({
            category_id: 'c',
            subcategories: [{ name: 'x'.repeat(INTEREST_LIMITS.NAME_MAX + 1) }, { name: 'Fine' }],
        }).valid).toBe(false);
    });

    it('does not nag about empty fields while still drafting', () => {
        expect(validateInterests({}, { partial: true }).valid).toBe(true);
        expect(validateInterests({ category_id: 'c', subcategories: [{ name: 'One' }] },
            { partial: true }).valid).toBe(true);
    });

    it('still catches an over-long name while drafting', () => {
        const r = validateInterests(
            { category_id: 'c', subcategories: [{ name: 'x'.repeat(80) }] },
            { partial: true }
        );
        expect(r.valid).toBe(false);
    });

    it('rejects a non-array', () => {
        expect(validateInterests({ category_id: 'c', subcategories: 'nope' }).valid).toBe(false);
    });

    it('does not repeat the same message twice', () => {
        const r = validateInterests({
            category_id: 'c',
            subcategories: [{ name: 'a' }, { name: 'b' }],
        });
        expect(r.errors.length).toBe(new Set(r.errors).size);
    });
});
