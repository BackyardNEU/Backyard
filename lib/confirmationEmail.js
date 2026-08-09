// The waitlist confirmation email.
//
// Two constraints drive every choice here:
//
// 1. Mail clients strip <style> blocks and ignore most modern CSS, so the
//    layout is tables with inline styles. This looks dated on purpose.
// 2. Outlook and many other clients block images by default. The message must
//    therefore be complete with no images at all — colour, type and spacing
//    carry the branding, and the raccoon is decoration rather than content.

const SITE = 'https://explorethebackyard.com';

const RED = '#C53B3F';
const PAPER = '#f5f1ea';
const INK = '#2b2724';
const MUTED = '#6f6862';

// Barlow Condensed will not load in mail, so fall back to a condensed stack and
// lean on uppercase and letter-spacing to keep the brand's voice.
const DISPLAY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function renderConfirmationEmail({ unsubscribeUrl }) {
  const subject = "You're on the Backyard list";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#E2C9B0;">
  <!-- Preheader: the grey preview line in the inbox. Hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    We'll let you know the moment Backyard opens up at your school.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#E2C9B0;padding:32px 12px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background-color:${PAPER};border-radius:14px;overflow:hidden;">

          <tr>
            <td align="center" style="padding:36px 32px 8px 32px;">
              <img src="${SITE}/assets/email/logo.png" width="240" alt="Backyard"
                   style="display:block;width:240px;max-width:70%;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:8px 32px 0 32px;">
              <img src="${SITE}/assets/email/raccoon.png" width="140" alt=""
                   style="display:block;width:140px;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 32px 0 32px;">
              <h1 style="margin:0;font-family:${DISPLAY};font-size:30px;line-height:1.15;
                         font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:${INK};">
                You're on the list
              </h1>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:14px 40px 0 40px;">
              <p style="margin:0;font-family:${DISPLAY};font-size:16px;line-height:1.6;color:${MUTED};">
                Thanks for signing up. Backyard is where you'll discover clubs,
                find events and explore what's actually happening on campus.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px 0 40px;">
              <p style="margin:0;font-family:${DISPLAY};font-size:16px;line-height:1.6;color:${MUTED};">
                We'll email you the moment it opens at your school. That's it —
                no newsletters in the meantime.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 32px 36px 32px;">
              <div style="height:3px;width:56px;background-color:${RED};border-radius:2px;"></div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <p style="margin:0;font-family:${DISPLAY};font-size:13px;line-height:1.6;color:${MUTED};">
                Built with care at Northeastern
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding:20px 24px 8px 24px;">
              <p style="margin:0;font-family:${DISPLAY};font-size:12px;line-height:1.7;color:#7d6f60;">
                You're receiving this because you joined the waitlist at explorethebackyard.com.<br>
                <a href="${unsubscribeUrl}" style="color:#7d6f60;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&#8226;&nbsp;
                <a href="${SITE}/privacy" style="color:#7d6f60;text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  // Sent alongside the HTML. Some clients prefer it, and spam filters treat a
  // missing text alternative as a signal.
  const text = [
    "YOU'RE ON THE LIST",
    '',
    'Thanks for signing up. Backyard is where you\'ll discover clubs, find',
    'events and explore what\'s actually happening on campus.',
    '',
    "We'll email you the moment it opens at your school. That's it — no",
    'newsletters in the meantime.',
    '',
    'Built with care at Northeastern',
    '',
    '---',
    "You're receiving this because you joined the waitlist at explorethebackyard.com.",
    `Unsubscribe: ${unsubscribeUrl}`,
    `Privacy policy: ${SITE}/privacy`,
  ].join('\n');

  return { subject, html, text };
}

export { SITE };
