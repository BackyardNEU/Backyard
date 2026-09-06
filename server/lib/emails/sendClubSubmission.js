import { supabaseAdmin } from '../../supabaseAdmin.js';
import { renderClubSubmissionEmail } from './clubSubmissionEmail.js';

// clubs@ rather than notifications@: replies to this go to whoever is running outreach,
// and the email invites them. A club noticing a typo the moment they hit send should be
// able to just reply.
const FROM = 'Backyard <clubs@explorethebackyard.com>';

/**
 * Fire and forget. Never throws, and is never awaited by the request that triggers it.
 *
 * A club has already submitted successfully by the time this runs. Failing their request
 * because Resend had a bad minute would be the wrong trade, and there is nothing they
 * could do about it anyway.
 */
export async function sendClubSubmissionEmail({ to, clubName, userId }) {
    if (!to) return { sent: false, reason: 'no-recipient' };

    // Same posture as image moderation: absent config degrades to a warning rather than
    // an error, but says so loudly enough that a missing Railway variable is noticed.
    if (!process.env.RESEND_KEY) {
        console.warn('[email] RESEND_KEY is not set — no club submission email was sent.');
        return { sent: false, reason: 'no-key' };
    }

    try {
        // Only for the greeting, so a missing profile is not worth failing over.
        let firstName = null;
        if (userId) {
            const { data } = await supabaseAdmin
                .from('profiles').select('first_name').eq('id', userId).maybeSingle();
            firstName = data?.first_name || null;
        }

        const { subject, html, text } = renderClubSubmissionEmail({ clubName, firstName });

        // Imported here rather than at module scope: server/lib/resend.js constructs the
        // client on import and throws when RESEND_KEY is absent, which would take the
        // whole server down at boot over an optional feature.
        const { default: resend } = await import('../resend.js');
        const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });

        if (error) {
            console.error('[email] club submission email failed:', error.message ?? error);
            return { sent: false, reason: 'send-failed' };
        }
        return { sent: true };
    } catch (err) {
        console.error('[email] club submission email threw:', err.message);
        return { sent: false, reason: 'threw' };
    }
}
