import { useState, useCallback } from 'react';

// One-shot editor walkthrough: shown the first time someone opens a club page they can
// edit, never again.
//
// localStorage rather than a profile column, deliberately. This teaches the editor UI,
// which is the same on every club page — so "have I been shown this" is closer to a
// device preference than an account fact, and it is not worth a migration, a write
// endpoint, and a round trip to remember something purely cosmetic. The trade is that a
// new browser or a cleared cache replays it once, which is harmless.
//
// Same shape as useCardSize.js, the app's other localStorage preference.

const STORAGE_KEY = 'backyard.seenFeaturesDemo';

// A version string, not `true`, so a future second walkthrough can re-fire for everyone
// by bumping this instead of burning a new key and leaving this one orphaned.
const CURRENT_VERSION = 'v1';

// localStorage throws in Safari private browsing and wherever storage is blocked
// outright. This is a cosmetic popup — failing to read or write it must never take the
// club page down, so both directions swallow.
function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === CURRENT_VERSION;
  } catch (e) {
    // Treat unreadable storage as "already seen": showing the demo on every single load
    // is far worse than never showing it.
    return true;
  }
}

function writeStored() {
  try {
    window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
  } catch (e) {
    // Will not persist; the session still works and the demo just replays next time.
  }
}

/** Wipe the flag so the demo fires again. Exposed for testing — see below. */
export function clearSeenFeaturesDemo() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Nothing to clear if storage is unavailable.
  }
}

// A once-ever feature is close to untestable without a reset, and reaching for devtools
// to remember an exact key is friction every time. Dev builds only — this never ships.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__resetDemo = () => {
    clearSeenFeaturesDemo();
    console.log('[featuresDemo] flag cleared — reload to see the demo again');
  };
}

/**
 * @returns {[boolean, () => void]} `[shouldShow, markSeen]`
 */
export function useFeaturesDemo() {
  // Lazy initialiser so storage is read once on mount rather than every render.
  const [seen, setSeen] = useState(readStored);

  const markSeen = useCallback(() => {
    setSeen(true);
    writeStored();
  }, []);

  return [!seen, markSeen];
}
