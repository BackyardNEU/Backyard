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

const FILLER_RE = /\b(show me|find me|i want|i need|looking for|search for|give me|get me|list|clubs? for|clubs? about|clubs? that are|clubs? with|clubs? in|some|the|a|an|all|any|me|my|please|can you|could you)\b/gi;

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

    let text = query.slice(0, 200).toLowerCase().trim();

    text = text.replace(FILLER_RE, ' ');
    text = text.replace(/\s+/g, ' ').trim();

    if (!text) return null;

    const categories = new Set();
    const tags = new Set();

    for (const { phrase, key } of this.categoryPhrases) {
      const idx = text.indexOf(phrase);
      if (idx !== -1) {
        const before = idx === 0 || /\W/.test(text[idx - 1]);
        const after = idx + phrase.length >= text.length || /\W/.test(text[idx + phrase.length]);
        if (before && after) {
          categories.add(key);
          text = (text.slice(0, idx) + text.slice(idx + phrase.length)).replace(/\s+/g, ' ').trim();
        }
      }
    }

    for (const { phrase, tag } of this.tagPhrases) {
      const idx = text.indexOf(phrase);
      if (idx !== -1) {
        const before = idx === 0 || /\W/.test(text[idx - 1]);
        const after = idx + phrase.length >= text.length || /\W/.test(text[idx + phrase.length]);
        if (before && after) {
          tags.add(tag);
          text = (text.slice(0, idx) + text.slice(idx + phrase.length)).replace(/\s+/g, ' ').trim();
        }
      }
    }

    const keywords = text.replace(/\s+/g, ' ').trim();

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
