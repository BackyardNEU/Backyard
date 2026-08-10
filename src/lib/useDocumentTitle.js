import { useEffect } from 'react';

// Matches the <title> in index.html. Restoring it on unmount stops a route leaving its
// own title behind on whatever the user navigates to next.
export const DEFAULT_TITLE = "Welcome to your school's Backyard!";

/**
 * Sets the browser tab title for as long as the component is mounted.
 *
 * Pass a falsy title to leave it alone — useful while a page is still resolving the name
 * it wants to show, so the tab does not flash a placeholder first.
 *
 * React runs the previous route's cleanup before the next route's effects, so navigating
 * between two titled pages settles on the new title rather than the default.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return;

    document.title = title;
    return () => { document.title = DEFAULT_TITLE; };
  }, [title]);
}

export default useDocumentTitle;
