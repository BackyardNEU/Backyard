import { supabaseAdmin } from '../supabaseAdmin.js';

export async function requireModerator(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (!['moderator', 'top_moderator'].includes(data?.role)) {
    throw { status: 403, message: 'Moderator only' };
  }
  return data.role;
}

export async function requireTopModerator(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (data?.role !== 'top_moderator') {
    throw { status: 403, message: 'Top moderator only' };
  }
}
