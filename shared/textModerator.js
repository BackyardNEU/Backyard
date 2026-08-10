// Content moderation for user-submitted text.
//
// POLICY: profanity is allowed. This is a social product for college students, and
// blocking "this club is fucking great" reads as childish while doing nothing for
// anyone's safety. What gets blocked is abuse: slurs, threats, sexual content aimed at
// a person, and doxxing.
//
// This replaced a 450-word `bad-words` dictionary that flagged all profanity equally and
// had no concept of who the text was aimed at.
//
// Checks are ordered tiers, each returning a category. That shape is deliberate: it is
// the seam for adding an LLM adjudication pass for the things rules genuinely cannot
// judge — veiled threats, sarcasm, coded harassment — without restructuring any caller.
//
// Single source of truth. src/lib/textModerator.js and server/lib/textModerator.js are
// both thin re-exports of this file. They used to be two byte-identical copies kept in
// sync by hand, so a word added to one silently did not apply to the other.

const LEET_MAP = {
  '@': 'a', '4': 'a',
  '1': 'i', '!': 'i',
  '0': 'o',
  '$': 's', '5': 's',
  '3': 'e',
  '7': 't', '+': 't',
};

const LEET_RE = /[@41!0$537+]/g;

// Invisible and zero-width characters, used to break a word up so it stops matching.
//
// Written as escapes rather than literals on purpose: the literal forms are by definition
// invisible in source, so nobody can review, diff or safely edit them. The literal version
// also tripped eslint's no-misleading-character-class, because several of those codepoints
// combine into single grapheme clusters when they sit next to each other.
//
// The rule below fires because the class contains combining marks (U+034F). That is
// exactly the intent here: we match those codepoints individually in order to strip them,
// rather than composing a grapheme out of them.
/* eslint-disable no-misleading-character-class */
const INVISIBLE_RE = new RegExp(
  '[' +
  '\\u0000' +          // null
  '\\u00AD' +          // soft hyphen
  '\\u034F' +          // combining grapheme joiner
  '\\u061C' +          // arabic letter mark
  '\\u200B-\\u200F' +  // zero-width space / non-joiner / joiner, LTR + RTL marks
  '\\u2028\\u2029' +   // line and paragraph separators
  '\\u202A-\\u202E' +  // bidi embedding and override
  '\\u2060-\\u2064' +  // word joiner, invisible times / separator / plus
  '\\u206A-\\u206F' +  // deprecated format characters
  '\\uFEFF' +          // BOM / zero-width no-break space
  ']',
  'gu'
);
/* eslint-enable no-misleading-character-class */

// Separators people insert between letters to dodge filters (f.u.c.k, f_u_c_k)
const SEPARATOR_RE = /([a-zA-Z])[.\-_*~|]+(?=[a-zA-Z])/g;

// ─── Tier 1: slurs ───────────────────────────────────────────────────────────────────
// Blocked outright — there is no context in this product where these are acceptable.
//
// Matched on word boundaries only. That matters more than it looks: the app's mascot is
// a raccoon, and "raccoon" contains "coon". A substring match would flag the mascot.
const SLURS = [
  // Racial / ethnic
  'nigger', 'niggers', 'nigga', 'niggas', 'chink', 'chinks', 'gook', 'gooks',
  'spic', 'spics', 'beaner', 'beaners', 'wetback', 'wetbacks', 'kike', 'kikes',
  'raghead', 'ragheads', 'towelhead', 'towelheads', 'coon', 'coons',
  'jigaboo', 'wop', 'wops', 'dago', 'dagos',
  // Homophobic / transphobic
  'faggot', 'faggots', 'fag', 'fags', 'dyke', 'dykes', 'tranny', 'trannies', 'shemale',
  // Ableist
  'retard', 'retards', 'retarded', 'mongoloid', 'spastic',
];

// Words whose slur sense is swamped by an innocent one. "cracker" is deliberately absent
// from SLURS for this reason — graham cracker, firecracker, nutcracker, "crackers" as in
// crazy. When it is genuinely used against someone it is caught by the harassment tier
// below, which requires a target.
const SEXUAL_TERMS = [
  'slut', 'sluts', 'whore', 'whores', 'hoe', 'hoes', 'thot', 'thots',
  'cunt', 'cunts', 'skank', 'skanks', 'nympho',
];

// Terms that are only abusive when aimed at a person.
const TARGETED_TERMS = [...SEXUAL_TERMS, 'cracker', 'crackers'];

// ─── Tier 2: threats ─────────────────────────────────────────────────────────────────
// Kept narrow on purpose. Patterns like "you're dead" are omitted because "you're dead
// wrong" and "you're dead tired" are ordinary speech, and a false block on a review is
// worse than a miss the LLM pass can pick up later.
const THREAT_PATTERNS = [
  // "i'm going to kill you", "im gonna beat you", "i'll hurt you"
  /\b(?:i(?:'?m|\s+am)?\s+(?:gonna|going\s+to)|i'?ll|i\s+will)\s+(?:\w+\s+){0,3}?(?:kill|murder|stab|shoot|beat|jump|hurt|choke|strangle)\s+(?:you|u|ya|him|her|them)\b/,
  // "kill yourself" and its abbreviation
  /\bkill\s*your\s*self\b/,
  /\bkys\b/,
  /\bwatch\s+(?:your|ur)\s+back\b/,
  /\bi\s+know\s+where\s+(?:you|u)\s+(?:live|sleep|work|stay)\b/,
  /\b(?:hope|wish)\s+(?:you|u)\s+(?:die|died|get\s+hurt)\b/,
];

// ─── Tier 3: doxxing ─────────────────────────────────────────────────────────────────
// An SSN has no legitimate use here, so it is blocked unconditionally.
//
// Phone numbers and street addresses are NOT blocked on sight. Club pages legitimately
// list an office number and a meeting location, and a review saying "they meet at 360
// Huntington Ave" is not doxxing. Rules cannot tell those apart from an actual dox, so
// only explicit disclosure phrasing is caught. This is the single clearest case for the
// deferred LLM pass.
const SSN_RE = /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/;

// Note the leading (?:^|[^\w@]) rather than \b. A \b before an alternation containing
// "@handle" can never match at the start of a string, because '@' is a non-word character
// and there is no boundary between it and the string start.
const DOX_DISCLOSURE_PATTERNS = [
  // "her address is", "@sarah's phone number is", "their dorm room is"
  /(?:^|[^\w@])(?:his|her|their|@\w+(?:'s)?)\s+(?:home\s+|personal\s+|cell\s+)?(?:address|phone|number|dorm|dorm\s+room)\s+is\b/,
  // "@sarah lives at", "she lives in room 214"
  /(?:^|[^\w@])(?:@\w+|he|she|they)\s+lives?\s+(?:at|in\s+room)\b/,
];

// ─── Tier 4: harassment aimed at a person ────────────────────────────────────────────
// A sexual term on its own is crude, not abusive. The same term pointed at someone is
// harassment. The subject must be a pronoun or an @handle — matching any noun would flag
// "the party was a shitshow" style writing.
const TARGET_SUBJECT =
  String.raw`(?:you(?:'?re|\s+are)?|u\s+r|ur|@\w+(?:'?s)?|he(?:'?s|\s+is)?|she(?:'?s|\s+is)?|they(?:'?re|\s+are)?)`;

// Leading (?:^|[^\w@]) for the same reason as the doxxing patterns: \b cannot match
// before an '@' at the start of a string.
const TARGETED_HARASSMENT_RE = new RegExp(
  String.raw`(?:^|[^\w@])${TARGET_SUBJECT}\s+(?:such\s+)?(?:a\s+|an\s+|the\s+)?(?:\w+\s+){0,2}?(?:${TARGETED_TERMS.join('|')})\b`
);

const MESSAGES = {
  slur: 'That contains a slur. Please rewrite it before posting.',
  threat: 'That reads as a threat. Please rewrite it before posting.',
  doxxing: "Please don't share someone's personal information.",
  harassment: 'That targets someone personally. Please rewrite it before posting.',
};

// Word-boundary membership test. Avoids the substring trap ("coon" inside "raccoon").
function containsWord(text, words) {
  for (const word of words) {
    const re = new RegExp(`(?:^|[^a-z])${word}(?:[^a-z]|$)`);
    if (re.test(text)) return word;
  }
  return null;
}

class TextModerator {
  // Lowercase, strip invisible characters, collapse whitespace. Digits and '@' survive —
  // the doxxing and @handle checks depend on them.
  sanitize(text) {
    return text.toLowerCase().replace(INVISIBLE_RE, '').replace(/\s+/g, ' ');
  }

  // Undo the remaining evasion tricks: leetspeak, stretched letters, and separators
  // between letters.
  //
  // Destructive by design — it maps '@'→a and digits→letters, which is what makes
  // "n1gg3r" catchable. That also means "123-45-6789" becomes "ies-as-6789" and "@sarah"
  // becomes "asarah", so anything matching on digits or handles must use sanitize()
  // instead. Getting this backwards silently broke all three doxxing checks.
  normalize(text) {
    let s = this.sanitize(text);
    s = s.replace(LEET_RE, (ch) => LEET_MAP[ch] || ch);
    s = s.replace(/(.)\1{2,}/g, '$1$1');
    s = s.replace(SEPARATOR_RE, '$1');
    return s;
  }

  // Returns { clean: true } or { clean: false, category, message }.
  check(text) {
    if (!text || typeof text !== 'string') return { clean: true };

    const sanitized = this.sanitize(text);
    const normalized = this.normalize(text);
    // Also test with every run of repeats flattened, so "niiiigger" is caught. Checking
    // both is necessary: collapsing to one letter would turn legitimate doubles into
    // different words, while collapsing to two misses triples.
    const collapsed = normalized.replace(/(.)\1+/g, '$1');

    // Slurs are pure word matching, so the aggressively normalized forms are right.
    for (const variant of [normalized, collapsed]) {
      if (containsWord(variant, SLURS)) return this.#fail('slur');
    }

    // Threats and harassment are checked against every form: sanitized preserves the
    // '@' in "@sarah is a ...", while the normalized forms catch leetspeak.
    const phraseVariants = [sanitized, normalized, collapsed];

    for (const variant of phraseVariants) {
      for (const pattern of THREAT_PATTERNS) {
        if (pattern.test(variant)) return this.#fail('threat');
      }
    }

    // Doxxing runs on sanitized text only — normalize() would have eaten the digits.
    if (SSN_RE.test(sanitized)) return this.#fail('doxxing');
    for (const pattern of DOX_DISCLOSURE_PATTERNS) {
      if (pattern.test(sanitized)) return this.#fail('doxxing');
    }

    for (const variant of phraseVariants) {
      if (TARGETED_HARASSMENT_RE.test(variant)) return this.#fail('harassment');
    }

    return { clean: true };
  }

  #fail(category) {
    return { clean: false, category, message: MESSAGES[category] };
  }

  // Checks every field and reports ALL of them. The previous version short-circuited on
  // the first failure, so someone fixing a flagged bio only then discovered their
  // username was flagged too.
  //
  // `message` and `field` describe the first violation, preserving the shape callers
  // already destructure; `violations` carries the full list.
  checkFields(fields) {
    const violations = [];

    for (const [field, value] of Object.entries(fields)) {
      if (value == null) continue;
      const result = this.check(String(value));
      if (!result.clean) {
        violations.push({ field, category: result.category, message: result.message });
      }
    }

    if (violations.length === 0) return { clean: true, violations: [] };

    return {
      clean: false,
      field: violations[0].field,
      category: violations[0].category,
      message: violations[0].message,
      violations,
    };
  }
}

const textModerator = new TextModerator();
export { TextModerator, textModerator, SLURS, TARGETED_TERMS };
export default textModerator;
