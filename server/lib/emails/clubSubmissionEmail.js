// Sent when a club submits their page for review.
//
// Same constraints as the waitlist email on the landing-page branch, and the same palette
// so a club that saw one recognises the other:
//
// 1. Mail clients strip <style> blocks and ignore most modern CSS, so this is tables with
//    inline styles. It looks dated on purpose.
// 2. Images are blocked by default in Outlook and others, so the message has to read
//    completely without them. Colour, type and spacing carry the brand; the logo is
//    decoration.

const SITE = 'https://explorethebackyard.com';

const SAND = '#E2C9B0';
const PAPER = '#f5f1ea';
const RED = '#C53B3F';
const INK = '#2b2724';
const MUTED = '#6f6862';

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Club names come from people we contacted over Instagram and land inside HTML, so they
// are escaped here rather than trusted. Mail clients render HTML; a stray angle bracket
// in a club name would otherwise break the layout at best.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function renderClubSubmissionEmail({ clubName, firstName }) {
    const club = escapeHtml(clubName || 'your club');
    const greeting = firstName ? `Thanks, ${escapeHtml(firstName)}` : 'Thanks';
    const subject = `We've got ${clubName || 'your club'}'s page`;

    const text = [
        `${greeting.replace(/<[^>]*>/g, '')} — we've got ${clubName || 'your club'}'s page.`,
        '',
        'Someone on our team reads every page before it goes live, so give us a couple of days.',
        'If anything needs changing we\'ll email you with a note, and nothing you wrote gets lost.',
        '',
        'Questions? Just reply to this email.',
        '',
        'Backyard',
        SITE,
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${SAND};">
  <!-- Preheader: the grey preview line in the inbox. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    We read every page before it goes live. We'll be in touch within a couple of days.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${SAND};padding:32px 12px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background-color:${PAPER};border-radius:14px;overflow:hidden;">

          <tr>
            <td align="center" style="padding:36px 32px 4px 32px;">
              <img src="${SITE}/assets/email/logo.png" width="220" alt="Backyard"
                   style="display:block;width:220px;max-width:70%;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 32px 0 32px;">
              <h1 style="margin:0;font-family:${FONT};font-size:26px;line-height:1.2;
                         color:${INK};font-weight:700;">
                ${greeting}
              </h1>
              <p style="margin:10px 0 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK};">
                We've got ${club}'s page.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">
                Someone on our team reads every page before it goes live, so give us a
                couple of days. If anything needs changing we'll email you with a note,
                and nothing you wrote gets lost.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #ddd6c9;padding-top:18px;">
                    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};">
                      Spotted something you want to change? Reply to this email and we'll
                      sort it out before your page goes live.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:26px 32px 34px 32px;">
              <p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};">
                <span style="color:${RED};font-weight:700;letter-spacing:0.08em;">BACKYARD</span><br>
                <a href="${SITE}" style="color:${MUTED};text-decoration:underline;">explorethebackyard.com</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject, html, text };
}
