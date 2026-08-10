const CATEGORY_SYNONYMS = [
  { key: 'fsl', phrases: ['greek life', 'fraternity sorority', 'fsl', 'rush', 'pledge'] },
  { key: 'intramural_sports', phrases: ['intramural', 'intramurals', 'rec sports', 'pickup sports', 'sports', 'athletics'] },
  { key: 'affiliation', phrases: ['affinity', 'multicultural', 'cultural', 'identity', 'diversity'] },
  { key: 'nature', phrases: ['environment', 'sustainability', 'outdoors', 'hiking', 'gardening', 'nature'] },
  { key: 'lit', phrases: ['literature', 'book club', 'reading', 'writing', 'poetry', 'literary', 'books'] },
  { key: 'programming', phrases: ['computer science', 'comp sci', 'web dev', 'app dev', 'data science', 'hackathon', 'coding', 'programming', 'software', 'tech'] },
  { key: 'performing', phrases: ['performing arts', 'stand up', 'theater', 'theatre', 'drama', 'dance', 'improv', 'acting', 'comedy'] },
  { key: 'music', phrases: ['a cappella', 'acapella', 'orchestra', 'music', 'band', 'choir', 'instruments', 'singing', 'jazz'] },
  { key: 'visual_arts', phrases: ['visual arts', 'graphic design', 'photography', 'painting', 'drawing', 'design', 'sculpture', 'ceramics', 'art'] },
  { key: 'engineering', phrases: ['project based', 'hands-on', 'hands on', 'engineering', 'robotics', 'mechanical', 'electrical', 'civil', 'aerospace', 'maker'] },
  { key: 'science', phrases: ['science', 'research', 'biology', 'chemistry', 'physics', 'lab', 'stem'] },
  { key: 'resources', phrases: ['career services', 'resources', 'support', 'tutoring', 'mentoring', 'academic', 'advising'] },
  { key: 'business', phrases: ['entrepreneurship', 'business', 'finance', 'marketing', 'consulting', 'startup', 'investing'] },
  { key: 'medicine', phrases: ['public health', 'pre-med', 'premed', 'medicine', 'health', 'nursing', 'anatomy', 'clinical'] },
  { key: 'math', phrases: ['mathematics', 'statistics', 'calculus', 'algebra', 'math'] },
  { key: 'law', phrases: ['pre-law', 'prelaw', 'moot court', 'mock trial', 'law', 'legal', 'politics', 'government', 'policy', 'debate'] },
  { key: 'fun', phrases: ['gaming', 'hobby', 'foodie', 'hangout', 'fun', 'social', 'casual', 'food', 'chill'] },
  { key: 'service', phrases: ['community service', 'volunteer', 'nonprofit', 'charity', 'philanthropy', 'outreach', 'service'] },
];

const TAG_SYNONYMS = [
  { tag: 'Beginner Friendly', phrases: ['no experience', 'beginner friendly', 'beginner', 'beginners', 'newbie', 'starter', 'introductory'] },
  { tag: 'Advanced', phrases: ['advanced', 'experienced', 'expert', 'competitive'] },
  { tag: 'Friendly', phrases: ['welcoming', 'friendly'] },
  { tag: 'Supportive', phrases: ['safe space', 'supportive', 'inclusive'] },
  { tag: 'Good Networking', phrases: ['good networking', 'networking', 'connections'] },
  { tag: 'Flexible Attendance', phrases: ['casual attendance', 'drop in', 'flexible'] },
  { tag: 'Strict Attendance', phrases: ['strict attendance', 'mandatory', 'strict'] },
  { tag: 'Time Intensive', phrases: ['time intensive', 'time commitment', 'demanding'] },
  { tag: 'Fun', phrases: ['exciting', 'enjoyable'] },
  { tag: 'Career Focused', phrases: ['career focused', 'professional development', 'career', 'internship'] },
  { tag: 'High Energy', phrases: ['high energy', 'energetic', 'intense'] },
  { tag: 'Tight-knit', phrases: ['tight-knit', 'tight knit', 'small group', 'close knit'] },
  { tag: 'Collaborative', phrases: ['collaborative', 'teamwork', 'group projects'] },
  { tag: 'Web Dev', phrases: ['web development', 'web dev', 'frontend', 'backend', 'full stack'] },
  { tag: 'Fraternity', phrases: ['fraternity', 'frat'] },
  { tag: 'Sorority', phrases: ['sorority'] },
];

const FILLER_RE = /\b(show me|find me|i want|i need|looking for|search for|give me|get me|list|clubs? for|clubs? about|clubs? that are|clubs? with|clubs? in|clubs?|organizations?|groups?|some|the|a|an|all|any|me|my|please|can you|could you|and|or)\b/gi;

// Index of `phrase` in `text` only when it sits on word boundaries, so "art" does not
// match inside "cartography". Returns -1 otherwise.
function matchIndex(text, phrase) {
  const idx = text.indexOf(phrase);
  if (idx === -1) return -1;
  const before = idx === 0 || /\W/.test(text[idx - 1]);
  const after = idx + phrase.length >= text.length || /\W/.test(text[idx + phrase.length]);
  return before && after ? idx : -1;
}

// Collects every matching phrase into `into` and returns the text with those matches
// removed. Consuming as it goes is what makes longest-match-first meaningful: once
// "computer science" is taken, the shorter "science" can no longer match the same words.
function extractPhrases(text, phrases, valueKey, into) {
  let residue = text;
  for (const entry of phrases) {
    const idx = matchIndex(residue, entry.phrase);
    if (idx === -1) continue;
    into.add(entry[valueKey]);
    residue = (residue.slice(0, idx) + residue.slice(idx + entry.phrase.length))
      .replace(/\s+/g, ' ')
      .trim();
  }
  return residue;
}

class NLSearchParser {
  constructor() {
    this.categoryPhrases = [];
    for (const { key, phrases } of CATEGORY_SYNONYMS) {
      for (const phrase of phrases) {
        this.categoryPhrases.push({ phrase: phrase.toLowerCase(), key });
      }
    }
    this.categoryPhrases.sort((a, b) => b.phrase.length - a.phrase.length);

    this.tagPhrases = [];
    for (const { tag, phrases } of TAG_SYNONYMS) {
      for (const phrase of phrases) {
        this.tagPhrases.push({ phrase: phrase.toLowerCase(), tag });
      }
    }
    this.tagPhrases.sort((a, b) => b.phrase.length - a.phrase.length);
  }

  parse(query) {
    if (!query || typeof query !== 'string') return null;

    // Filler is deliberately NOT stripped here. Several synonyms legitimately contain
    // filler words — "book club", "mock trial" — and removing "club" up front made those
    // phrases impossible to match at all.
    const base = query.slice(0, 200).toLowerCase().trim().replace(/\s+/g, ' ');
    if (!base) return null;

    const categories = new Set();
    const tags = new Set();

    // Both passes start from the same text. Each consumes only its own matches, which
    // keeps longest-match-first exclusivity within a pass ("computer science" still beats
    // "science"), while letting a phrase listed under both — "web dev" is a programming
    // category *and* a Web Dev tag — register as each. Threading one shared residue
    // through both passes meant whichever ran first swallowed the words outright.
    const categoryResidue = extractPhrases(base, this.categoryPhrases, 'key', categories);
    const tagResidue = extractPhrases(base, this.tagPhrases, 'tag', tags);

    // Keywords are the tokens neither pass claimed, with filler removed last.
    const unclaimedByCategories = new Set(categoryResidue.split(' ').filter(Boolean));
    const keywords = tagResidue
      .split(' ')
      .filter((token) => token && unclaimedByCategories.has(token))
      .join(' ')
      .replace(FILLER_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (categories.size === 0 && tags.size === 0 && !keywords) return null;

    return {
      categories: [...categories],
      tags: [...tags],
      keywords,
    };
  }
}

const nlSearchParser = new NLSearchParser();
export { NLSearchParser, nlSearchParser };
export default nlSearchParser;
