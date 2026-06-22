import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useGlobalStore } from "../lib/store";

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