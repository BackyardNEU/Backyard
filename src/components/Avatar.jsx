import React from 'react';
import { getInitials, colorFor } from './avatarIdentity';
import './Avatar.css';

// A person's avatar: their photo when they have one, otherwise coloured initials.
//
// Ported from PR #12. The problem it solves is that every user without a photo rendered
// the identical raccoon, so a row of friend avatars was a row of the same picture — no
// way to tell who was in a club at a glance.
//
// The initials and colour logic lives in avatarIdentity.js so it can be tested directly,
// and so this file exports only a component, which Fast Refresh requires.
export default function Avatar({
  url,
  firstName,
  lastName,
  username,
  // Optional on purpose. Most call sites already size their avatar through a class, and
  // forcing inline width/height would silently resize them. Omit it to let CSS win; pass
  // it only where there is no existing rule.
  size,
  className = '',
  alt,
}) {
  const sizing = size ? { width: size, height: size } : undefined;
  const label = alt ?? username ?? 'Profile';

  if (url) {
    return (
      <img
        src={url}
        alt={label}
        className={`avatar ${className}`}
        style={sizing}
      />
    );
  }

  return (
    <div
      className={`avatar avatar-initials ${className}`}
      style={{
        ...sizing,
        backgroundColor: colorFor(firstName, lastName, username),
        ...(size ? { fontSize: size * 0.38 } : null),
      }}
      // The initials are decorative shorthand; the accessible name is the person.
      role="img"
      aria-label={label}
    >
      <span aria-hidden="true">{getInitials(firstName, lastName, username)}</span>
    </div>
  );
}
