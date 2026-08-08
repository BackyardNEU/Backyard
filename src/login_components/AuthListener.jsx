import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";
import { useGlobalStore } from "../lib/store";
import { invalidateCalendar } from "../lib/calendarCache";
import { invalidateAllClubPages } from "../lib/clubPageCache";

//this listener runs asynchronusly (idk how to spell that word) from the login function. Whenever our login itself has an issue, it could screw up the data behind whether a user is logged in, so instead we
//have this listener to always check whether or not the user is logged in with google auth, or that the user's "session" is still active

// Ensure a profiles row exists for the authenticated user
async function ensureProfile(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  try {
    await apiFetch("/me/profile", {
      method: "POST",
      body: {
        first_name: meta.first_name || meta.given_name || "",
        last_name: meta.last_name || meta.family_name || "",
      },
    });
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
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default AuthListener;