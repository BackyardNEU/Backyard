import { supabaseAdmin } from '../supabaseAdmin.js';

export async function checkMuted(req, res, next) {
  if (!req.user?.id) return next();

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('muted_until')
      .eq('id', req.user.id)
      .single();

    if (error) return next();

    if (data?.muted_until && new Date(data.muted_until) > new Date()) {
      return res.status(403).json({
        error: 'You are temporarily muted due to content policy violations',
        muted_until: data.muted_until,
      });
    }

    // Lazy cleanup of expired mutes
    if (data?.muted_until && new Date(data.muted_until) <= new Date()) {
      supabaseAdmin
        .from('profiles')
        .update({ muted_until: null })
        .eq('id', req.user.id)
        .then(() => {})
        .catch(() => {});
    }
  } catch {
    // Fail open: moderation outage should not break writes
  }

  next();
}
