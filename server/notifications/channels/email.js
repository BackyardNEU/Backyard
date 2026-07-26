import resend from '../../lib/resend.js';
import { supabaseAdmin } from '../../supabaseAdmin.js';

export async function sendEmail(event, handler) {
  if (!handler.emailTemplate) return 'skipped:no-template';

  let template;
  try {
    template = await import(`../emailTemplates/${handler.emailTemplate}.js`);
  } catch {
    return 'skipped:no-template';
  }

  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(event.recipientId);
  if (error || !user?.email) return 'failed:no-email';

  const { subject, html } = template.build(event);

  try {
    await resend.emails.send({
      from: 'Backyard <notifications@getbackyard.app>',
      to: user.email,
      subject,
      html,
    });
    return 'sent';
  } catch (err) {
    console.error('[email] send failed:', err);
    return 'failed';
  }
}
