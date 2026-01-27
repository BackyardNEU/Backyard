import { useEffect } from "react";
import { supabase } from "../supabase";
import { useGlobalStore } from "../store";

//this listener runs asynchronusly (idk how to spell that word) from the login function. Whenever our login itself has an issue, it could screw up the data behind whether a user is logged in, so instead we
//have this listener to always check whether or not the user is logged in with google auth, or that the user's "session" is still active

function AuthListener() {
  const setGlobalValue = useGlobalStore((state) => state.setGlobalValue);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setGlobalValue(!!data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setGlobalValue(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default AuthListener;