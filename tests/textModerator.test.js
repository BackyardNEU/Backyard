import { describe, it, expect } from 'vitest';
import { TextModerator } from '../shared/textModerator.js';

const mod = new TextModerator();
const check = (s) => mod.check(s);
const isClean = (s) => mod.check(s).clean;
const categoryOf = (s) => mod.check(s).category;

describe('TextModerator policy', () => {
  // The whole point of the rewrite. The previous filter blocked all of these.
  describe('profanity is allowed', () => {
    const allowed = [
      'this club is fucking awesome',
      'the workload is bullshit but honestly worth it',
      'shit exec board, great members',
      'damn this was a good time',
      'the meetings are ass but the people are great',
      'holy crap they actually pulled it off',
      'piss poor organization, still fun',
      'we got absolutely wrecked lol',
    ];

    for (const text of allowed) {
      it(`allows ${JSON.stringify(text)}`, () => {
        expect(isClean(text)).toBe(true);
      });
    }
  });

  describe('slurs are blocked', () => {
    it('blocks a racial slur', () => {
      expect(categoryOf('go away nigger')).toBe('slur');
    });

    it('blocks a homophobic slur', () => {
      expect(categoryOf('what a faggot')).toBe('slur');
    });

    it('blocks an ableist slur', () => {
      expect(categoryOf('this is retarded')).toBe('slur');
    });

    it('sees through leetspeak', () => {
      expect(categoryOf('n1gg3r')).toBe('slur');
    });

    it('sees through separators', () => {
      expect(categoryOf('f.a.g.g.o.t')).toBe('slur');
    });

    it('sees through stretched letters', () => {
      expect(categoryOf('faggggot')).toBe('slur');
    });

    it('sees through zero-width characters', () => {
      expect(categoryOf('fa​ggot')).toBe('slur');
    });
  });

  // Word-boundary matching. The app mascot is a raccoon, and "raccoon" contains "coon" —
  // a substring match would flag the mascot on sight.
  describe('does not false-positive on innocent words', () => {
    const innocent = [
      'the raccoon mascot is adorable',
      'we met at the raccoon statue',
      'bring graham crackers to the meeting',
      'we set off firecrackers after the game',
      'the nutcracker performance was sold out',
      'assignment deadlines are brutal',
      'class was cancelled',
      'i love analysis',
      'she is a fantastic president',
      'scunthorpe united',
    ];

    for (const text of innocent) {
      it(`allows ${JSON.stringify(text)}`, () => {
        expect(isClean(text)).toBe(true);
      });
    }
  });

  describe('threats are blocked', () => {
    const threats = [
      "i'm going to kill you",
      'im gonna beat you',
      'i will hurt you',
      "i'll stab you",
      'kill yourself',
      'kys',
      'watch your back',
      'i know where you live',
      'hope you die',
    ];

    for (const text of threats) {
      it(`blocks ${JSON.stringify(text)}`, () => {
        expect(categoryOf(text)).toBe('threat');
      });
    }

    // Deliberately narrow: these read as threats to a keyword matcher but are ordinary
    // speech. Catching them is the job of the deferred LLM pass, not regex.
    it('does not block "you\'re dead wrong"', () => {
      expect(isClean("you're dead wrong about that")).toBe(true);
    });

    it('does not block "this workout kills me"', () => {
      expect(isClean('this workout kills me every week')).toBe(true);
    });
  });

  describe('doxxing', () => {
    it('blocks an SSN', () => {
      expect(categoryOf('his ssn is 123-45-6789')).toBe('doxxing');
    });

    it('blocks explicit address disclosure', () => {
      expect(categoryOf('her address is 12 Elm Street')).toBe('doxxing');
    });

    it('blocks "@user lives at"', () => {
      expect(categoryOf('@sarah lives at the blue house on Hemenway')).toBe('doxxing');
    });

    // Club pages legitimately list a location and an office number, and reviews mention
    // where a club meets. Blocking these outright would break real content.
    it('allows a club meeting location', () => {
      expect(isClean('we meet at 360 Huntington Ave every Tuesday')).toBe(true);
    });

    it('allows a club contact number', () => {
      expect(isClean('questions? call the office at 617-373-2000')).toBe(true);
    });
  });

  describe('harassment aimed at a person', () => {
    it('blocks a sexual term aimed at "you"', () => {
      expect(categoryOf('you are a slut')).toBe('harassment');
    });

    it('blocks a sexual term aimed at an @handle', () => {
      expect(categoryOf('@sarah is a whore')).toBe('harassment');
    });

    it('blocks "she is such a skank"', () => {
      expect(categoryOf('she is such a skank')).toBe('harassment');
    });

    it('blocks a racial epithet aimed at a person', () => {
      expect(categoryOf('you are a cracker')).toBe('harassment');
    });

    // Crude, but not aimed at anyone — allowed under the same policy that permits
    // profanity generally.
    it('allows an untargeted crude word', () => {
      expect(isClean('that party was a whole thot fest lol')).toBe(true);
    });
  });

  describe('check() contract', () => {
    it('treats empty and non-string input as clean', () => {
      expect(isClean('')).toBe(true);
      expect(mod.check(null).clean).toBe(true);
      expect(mod.check(undefined).clean).toBe(true);
      expect(mod.check(42).clean).toBe(true);
    });

    it('returns a category and message on failure', () => {
      const r = check('you fucking retard');
      expect(r.clean).toBe(false);
      expect(r.category).toBe('slur');
      expect(r.message).toEqual(expect.any(String));
    });
  });

  describe('checkFields()', () => {
    it('passes when every field is clean', () => {
      const r = mod.checkFields({ bio: 'i love chess', username: 'alice' });
      expect(r.clean).toBe(true);
      expect(r.violations).toEqual([]);
    });

    it('skips null and undefined values', () => {
      expect(mod.checkFields({ bio: null, name: undefined }).clean).toBe(true);
    });

    // Previously this short-circuited, so someone fixing a flagged bio only then learned
    // their username was flagged too.
    it('reports every violation, not just the first', () => {
      const r = mod.checkFields({
        bio: 'i will hurt you',
        username: 'faggot',
        title: 'perfectly fine',
      });

      expect(r.clean).toBe(false);
      expect(r.violations).toHaveLength(2);
      expect(r.violations.map((v) => v.field)).toEqual(['bio', 'username']);
      expect(r.violations.map((v) => v.category)).toEqual(['threat', 'slur']);
    });

    it('keeps the legacy single-violation shape callers destructure', () => {
      const r = mod.checkFields({ bio: 'kys' });
      expect(r.field).toBe('bio');
      expect(r.category).toBe('threat');
      expect(r.message).toEqual(expect.any(String));
    });
  });
});
