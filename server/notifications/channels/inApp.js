import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../supabaseAdmin.js';

export async function sendInApp(row) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({ id: randomUUID(), ...row, channel_status: {} })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
