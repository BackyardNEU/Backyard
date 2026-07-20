import { supabaseAdmin } from '../supabaseAdmin.js';

const ALL_CHANNELS = ['in_app', 'email', 'push'];
const DEDUP_WINDOW_MINUTES = 5;

export async function decide(event) {
  const { type, recipientId, entity } = event;
  const entityId = entity?.id ?? null;

  // Dedup: skip if an identical notification was already sent recently
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('recipient_id', recipientId)
    .eq('type', type)
    .eq('entity_id', entityId)
    .gte('created_at', windowStart)
    .limit(1);

  if (existing?.length > 0) {
    return { channels: [], skip: 'dedup' };
  }

  // Preferences: load any explicit overrides for this user + type
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('channel, enabled')
    .eq('user_id', recipientId)
    .eq('type', type);

  const disabledChannels = new Set(
    (prefs ?? []).filter((p) => !p.enabled).map((p) => p.channel)
  );

  const channels = ALL_CHANNELS.filter((c) => !disabledChannels.has(c));

  return { channels };
}
