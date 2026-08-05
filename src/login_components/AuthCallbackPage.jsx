import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

export default function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function resolveAuthReturn() {
      const searchParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
      const flow = searchParams.get('flow');
      const authType = searchParams.get('type') || hashParams.get('type');
      const isSignupReturn = flow === 'signup' || authType === 'signup';

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        navigate('/', { replace: true });
        return;
      }

      if (isSignupReturn) {
        navigate('/profile-setup', { replace: true });
        return;
      }

      try {
        const profile = await apiFetch('/me/profile');
        const username = (profile?.username || '').trim();
        const needsSetup = !username || /\s/.test(username);
        navigate(needsSetup ? '/profile-setup' : '/profile', { replace: true });
      } catch {
        navigate('/profile-setup', { replace: true });
      }
    }

    resolveAuthReturn();
  }, [location.search, navigate]);

  return <div>Signing you in...</div>;
}
