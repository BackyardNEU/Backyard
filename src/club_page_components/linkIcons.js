import { FaInstagram, FaFacebookF } from 'react-icons/fa';
import { FaTiktok, FaSlack, FaLinkedinIn } from 'react-icons/fa6';
import { IoIosMail } from 'react-icons/io';
import { SlSocialSpotify } from 'react-icons/sl';
import { SiLinktree } from 'react-icons/si';
import { TbBrandDiscord } from 'react-icons/tb';
import { FiYoutube, FiGlobe } from 'react-icons/fi';

// Platform is recognised from the link's NAME only — never its URL. The name is what a
// club types and controls, so it is what the icon should follow.
//
// Shared because the public links bar (BasicInfoModule) and the editor preview
// (LinksModule) render the same links and previously each kept their own copy of this
// logic. They drifted: one matched names, the other matched URL fragments, so the same
// link could show a globe in the editor and an Instagram glyph on the live page.
const NAME_KEYWORDS = [
  ['instagram', 'instagram'],
  ['facebook',  'facebook'],
  ['discord',   'discord'],
  ['spotify',   'spotify'],
  ['tiktok',    'tiktok'],
  ['linktree',  'linktree'],
  ['youtube',   'youtube'],
  ['linkedin',  'linkedin'],
  ['slack',     'slack'],
  ['email',     'email'],
  ['mail',      'email'],
];

export function getLinkKeyword(name) {
  if (!name) return 'external';
  const n = name.toLowerCase();
  for (const [fragment, platform] of NAME_KEYWORDS) {
    if (n.includes(fragment)) return platform;
  }
  return 'external';
}

// Each of these renders a logo instead of the platform name text. Icons default to
// 1em, so they auto-match .link-btn's font-size at every breakpoint.
export const LINK_ICONS = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  email: IoIosMail,
  youtube: FiYoutube,
  discord: TbBrandDiscord,
  spotify: SlSocialSpotify,
  tiktok: FaTiktok,
  linktree: SiLinktree,
  slack: FaSlack,
  linkedin: FaLinkedinIn,
  external: FiGlobe,
};

// Spotify's icon keeps the same green .link-btn--spotify already uses for its text,
// instead of the white used everywhere else.
export const LINK_ICON_COLORS = { spotify: '#65D46E' };
