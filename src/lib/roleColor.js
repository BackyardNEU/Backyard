// Shared color scheme for custom club-role badges — used by ClubMembersPanel
// (managing/assigning roles) and BasicInfoModule (showing them in the friends
// modal). Border in the solid color, background at 40%, text a darker shade
// of the same color (for legibility over the translucent fill).

export const DEFAULT_ROLE_COLOR = '#a39a96';

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darkenHex(hex, amount = 0.35) {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export function roleColorStyle(color) {
  const c = color || DEFAULT_ROLE_COLOR;
  return { background: hexToRgba(c, 0.4), borderColor: c, color: darkenHex(c) };
}
