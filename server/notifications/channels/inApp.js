import { supabaseAdmin } from '../../supabaseAdmin.js';

export async function sendInApp(row) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({ ...row, channel_status: {} })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
