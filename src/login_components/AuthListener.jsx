import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";
import { useGlobalStore } from "../lib/store";
import { invalidateCalendar } from "../lib/calendarCache";
import { invalidateAllClubPages } from "../lib/clubPageCache";
import { invalidateAllQueries } from "../lib/queryCache";

//this listener runs asynchronusly (idk how to spell that word) from the login function. Whenever our login itself has an issue, it could screw up the data behind whether a user is logged in, so instead we
//have this listener to always check whether or not the user is logged in with google auth, or that the user's "session" is still active

// Ensure a profiles row exists for the authenticated user
async function ensureProfile(user) {
  if (!user) return;
  const meta = user.user_metadata || {};

  // Only send what the identity provider actually gave us.
  //
  // This previously sent empty strings whenever metadata had no name — which is every
  // email/password signup — and the route below upserts, so each call overwrote the
  // user's real first and last name with "". ensureProfile runs on every auth state
  // change, so a name entered during setup was blanked again on the next page load.
  const body = {};
  const first = meta.first_name || meta.given_name;
  const last = meta.last_name || meta.family_name;
  if (first) body.first_name = first;
  if (last) body.last_name = last;

  try {
    await apiFetch("/me/profile", { method: "POST", body });
  } catch (err) {
    console.error("Profile upsert failed:", err.message);
  }
}

function AuthListener() {
  const setGlobalValue = useGlobalStore((state) => state.setGlobalValue);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setGlobalValue(!!data.session);
      if (data.session?.user) ensureProfile(data.session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setGlobalValue(!!session);
        if (session?.user) ensureProfile(session.user);

        // The prefetch caches hold viewer-specific data — the calendar payload carries
        // the signed-in user's own RSVPs. Signing in or out has to drop them, or the next
        // open would render the previous session's state for as long as the TTL lasts.
        invalidateCalendar();
        invalidateAllClubPages();
        invalidateAllQueries();
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default AuthListener;