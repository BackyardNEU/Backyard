import { supabaseAdmin } from '../supabaseAdmin.js';

const ALL_CHANNELS = ['in_app', 'email', 'push'];
const DEDUP_WINDOW_MINUTES = 5;

// Sentinel `type` meaning "every notification type". See the preference lookup below.
export const WILDCARD_TYPE = '*';

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

  // Preferences: rows are negative overrides only, so no row means enabled.
  //
  // WILDCARD_TYPE rows apply to every notification type and are what the settings page
  // writes — its toggles are per-channel, not per-type. Writing one row per known type
  // instead would silently fail to cover any type added later, since a missing row
  // defaults back to enabled. A row for the specific type still wins over the wildcard,
  // which leaves room for per-type toggles later without a schema change.
  const { data: prefs, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('type, channel, enabled')
    .eq('user_id', recipientId)
    .in('type', [type, WILDCARD_TYPE]);

  // Previously only { data } was destructured, so a missing table or a failed query was
  // indistinguishable from "this user has no overrides" — every channel silently stayed
  // on and nothing surfaced. Still fails open (a preferences outage should not stop
  // notifications) but says so.
  if (error) {
    console.error('[notifications] preference lookup failed:', error.message);
  }

  const disabled = new Set();
  // Apply the wildcard first so a specific-type row can override it either way.
  for (const pref of (prefs ?? []).filter((p) => p.type === WILDCARD_TYPE)) {
    if (!pref.enabled) disabled.add(pref.channel);
  }
  for (const pref of (prefs ?? []).filter((p) => p.type === type)) {
    if (pref.enabled) disabled.delete(pref.channel);
    else disabled.add(pref.channel);
  }

  const channels = ALL_CHANNELS.filter((c) => !disabled.has(c));

  return { channels };
}
