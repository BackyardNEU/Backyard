// The pure half of Avatar: what a person's initials say, and which colour they get.
//
// Separate from Avatar.jsx for two reasons. Exporting non-components from a component
// file breaks React Fast Refresh, and keeping these here means they can be tested
// directly — the repo has no DOM environment, so the component itself cannot be rendered
// in a test.

export const COLORS = [
  '#F44336', '#9C27B0', '#2196F3', '#009688',
  '#FF9800', '#795548', '#607D8B', '#E91E63',
];

export function hashString(str) {
  let hash = 0;
  for (const ch of str) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  // Math.abs matters: without it the hash overflows negative for plenty of ordinary
  // names, the modulo returns a negative index, and the avatar renders with no
  // background colour at all.
  return Math.abs(hash);
}

/**
 * Falls back through name → username → '?'.
 *
 * PR #12's version took first/last only, but many call sites have just a username, and
 * those would all have collapsed to the same '?' — which is the row-of-identical-avatars
 * problem this component exists to fix.
 */
export function getInitials(firstName, lastName, username) {
  const first = (firstName || '').trim()[0] || '';
  const last = (lastName || '').trim()[0] || '';
  if (first || last) return (first + last).toUpperCase();

  const handle = (username || '').trim();
  if (handle) return handle.slice(0, 2).toUpperCase();

  return '?';
}

/**
 * Hashed rather than random, so the same person is the same colour on every render and
 * on every screen. That is what makes it read as identity rather than decoration.
 */
export function colorFor(firstName, lastName, username) {
  const seed = `${firstName || ''}${lastName || ''}${username || ''}` || '?';
  return COLORS[hashString(seed) % COLORS.length];
}
