import React from 'react';
import './Skeleton.css';

// Placeholder blocks shaped like the content they stand in for.
//
// The point is not decoration — it is that a skeleton occupying the same space as the
// real thing means nothing moves when the data lands. A centred "Loading…" string is a
// different size and position from the content that replaces it, so every load ends in a
// jump.
//
// aria-hidden throughout, with the loading state announced once by the container via
// aria-busy, so a screen reader hears "loading" rather than a run of empty boxes.

export function Skeleton({ width = '100%', height = '1rem', radius = 6, className = '', style }) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** A paragraph. The last line is short so it reads as prose rather than a block. */
export function SkeletonText({ lines = 3, width = '100%', lastWidth = '62%', gap = 8 }) {
  return (
    <span className="skeleton-stack" style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastWidth : width} height="0.9rem" />
      ))}
    </span>
  );
}

export function SkeletonCircle({ size = 40 }) {
  return <Skeleton width={size} height={size} radius="50%" />;
}

/** Wraps a loading region so assistive tech gets one announcement, not many. */
export function SkeletonRegion({ label = 'Loading', className = '', children }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

export default Skeleton;
