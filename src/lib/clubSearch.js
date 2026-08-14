// Search for the outreach worksheet.
//
// A plain substring test fails the way people actually type. "husky programming" misses
// "Husky Competitive Programming Club" because of the word in between, "hcpc" misses it
// entirely, and "st johns" misses "St. John's" over an apostrophe. With 150 clubs whose
// official names are long and rarely what anyone calls them, that is most searches.
//
// Results are scored rather than filtered so the closest match sorts first: someone
// typing "chess" wants Chess Club above Chess and Strategy Society.

const normalize = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const initials = (s) =>
    (s ?? '')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((w) => w[0].toLowerCase())
        .join('');

/**
 * Every query character appears in order, though not necessarily adjacently. This is what
 * catches "husky programming", and it is also the loosest rule here, so it scores lowest
 * and is tightened by how far apart the matches landed.
 */
function subsequenceScore(haystack, needle) {
    let i = 0;
    let first = -1;
    let last = -1;

    for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
        if (haystack[j] === needle[i]) {
            if (first === -1) first = j;
            last = j;
            i += 1;
        }
    }
    if (i < needle.length) return null;

    // A match spread across the whole name is weaker than a tight one.
    const span = last - first + 1;
    return Math.max(1, 40 - Math.round((span - needle.length) / 2));
}

/**
 * @returns {number|null} higher is a better match, null means no match at all
 */
export function scoreClub(club, query) {
    const q = normalize(query);
    if (!q) return 0;

    const name = normalize(club?.club_name);
    const acronym = initials(club?.club_name);
    const school = normalize(club?.school);

    if (name === q) return 120;
    if (name.startsWith(q)) return 100;
    if (acronym === q) return 95;          // "hcpc"
    if (name.includes(q)) return 80;
    if (acronym.includes(q)) return 70;
    // Only worth searching the school when the query is specific enough to mean it.
    if (q.length >= 3 && school.includes(q)) return 50;

    return subsequenceScore(name, q);
}

/**
 * Matching clubs, best first.
 *
 * Ties break on name length before alphabetically. "Chess Club" and "Chess and Strategy
 * Society" both score as prefix matches for "chess", but the shorter name is the closer
 * one, and sorting those alphabetically puts the wrong club on top.
 */
export function searchClubs(clubs, query) {
    if (!normalize(query)) return clubs ?? [];

    return (clubs ?? [])
        .map((club) => ({ club, score: scoreClub(club, query) }))
        .filter((r) => r.score !== null)
        .sort((a, b) => b.score - a.score
            || (a.club.club_name ?? '').length - (b.club.club_name ?? '').length
            || (a.club.club_name ?? '').localeCompare(b.club.club_name ?? ''))
        .map((r) => r.club);
}
