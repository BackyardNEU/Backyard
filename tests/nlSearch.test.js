import { describe, it, expect } from 'vitest';
import { NLSearchParser } from '../server/lib/nlSearch.js';

const parser = new NLSearchParser();

describe('NLSearchParser', () => {
  describe('category matching', () => {
    it('maps "project based" to engineering', () => {
      const r = parser.parse('show me project based clubs');
      expect(r.categories).toContain('engineering');
    });

    it('maps "dance" to performing', () => {
      const r = parser.parse('dance clubs');
      expect(r.categories).toContain('performing');
    });

    it('maps "coding" to programming', () => {
      const r = parser.parse('coding clubs');
      expect(r.categories).toContain('programming');
    });

    it('maps "computer science" to programming, not science', () => {
      const r = parser.parse('computer science clubs');
      expect(r.categories).toContain('programming');
      expect(r.categories).not.toContain('science');
    });

    it('maps "volunteer" to service', () => {
      const r = parser.parse('i want volunteer opportunities');
      expect(r.categories).toContain('service');
    });

    it('maps "greek life" to fsl', () => {
      const r = parser.parse('greek life');
      expect(r.categories).toContain('fsl');
    });

    it('maps "gaming" to fun', () => {
      const r = parser.parse('gaming clubs');
      expect(r.categories).toContain('fun');
    });

    it('maps "pre-med" to medicine', () => {
      const r = parser.parse('pre-med clubs');
      expect(r.categories).toContain('medicine');
    });

    it('maps "mock trial" to law', () => {
      const r = parser.parse('mock trial');
      expect(r.categories).toContain('law');
    });

    it('maps "book club" to lit', () => {
      const r = parser.parse('book club');
      expect(r.categories).toContain('lit');
    });
  });

  describe('tag matching', () => {
    it('maps "beginner" to Beginner Friendly tag', () => {
      const r = parser.parse('beginner friendly clubs');
      expect(r.tags).toContain('Beginner Friendly');
    });

    it('maps "networking" to Good Networking tag', () => {
      const r = parser.parse('clubs with good networking');
      expect(r.tags).toContain('Good Networking');
    });

    it('maps "career" to Career Focused tag', () => {
      const r = parser.parse('career focused clubs');
      expect(r.tags).toContain('Career Focused');
    });

    it('maps "web dev" to Web Dev tag', () => {
      const r = parser.parse('web dev clubs');
      expect(r.tags).toContain('Web Dev');
    });
  });

  describe('combined category + tag', () => {
    it('extracts both category and tag from "coding clubs for beginners"', () => {
      const r = parser.parse('coding clubs for beginners');
      expect(r.categories).toContain('programming');
      expect(r.tags).toContain('Beginner Friendly');
    });

    it('extracts both from "fun clubs with good networking"', () => {
      const r = parser.parse('fun clubs with good networking');
      expect(r.categories).toContain('fun');
      expect(r.tags).toContain('Good Networking');
    });
  });

  describe('keyword fallback', () => {
    it('returns unmatched text as keywords', () => {
      const r = parser.parse('chess');
      expect(r.categories).toEqual([]);
      expect(r.tags).toEqual([]);
      expect(r.keywords).toBe('chess');
    });

    it('returns null for empty input', () => {
      expect(parser.parse('')).toBeNull();
      expect(parser.parse(null)).toBeNull();
      expect(parser.parse(undefined)).toBeNull();
    });

    it('returns null when only filler words remain', () => {
      expect(parser.parse('show me')).toBeNull();
      expect(parser.parse('find me the')).toBeNull();
    });
  });

  describe('filler stripping', () => {
    it('strips "show me" prefix', () => {
      const r = parser.parse('show me engineering');
      expect(r.categories).toContain('engineering');
      expect(r.keywords).toBe('');
    });

    it('strips "i want" prefix', () => {
      const r = parser.parse('i want music');
      expect(r.categories).toContain('music');
    });

    it('strips "looking for" prefix', () => {
      const r = parser.parse('looking for science');
      expect(r.categories).toContain('science');
    });

    it('strips "clubs" noise word', () => {
      const r = parser.parse('engineering clubs');
      expect(r.keywords).toBe('');
    });
  });

  describe('security', () => {
    it('truncates input to 200 chars', () => {
      const longInput = 'engineering '.repeat(100);
      const r = parser.parse(longInput);
      expect(r).not.toBeNull();
      expect(r.categories).toContain('engineering');
    });
  });
});
