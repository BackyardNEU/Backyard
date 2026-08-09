// Pages served by the unsubscribe endpoint.
//
// These are rendered by a function rather than served as static files, so they
// carry the site's Content-Security-Policy: script-src 'self' with no inline
// allowance. There is deliberately no JavaScript here — the confirmation is a
// plain form POST. An inline <script> would be refused silently, which is
// exactly how the signup form broke.

const SITE = 'https://explorethebackyard.com';
const DISPLAY = "'Barlow Condensed', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Backyard | ${title}</title>
<link rel="icon" type="image/png" href="/assets/neu_flag.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;min-height:100vh;background-color:#E2C9B0;display:flex;align-items:center;justify-content:center;padding:24px;font-family:${DISPLAY};">
  <main style="width:100%;max-width:440px;background:#f5f1ea;border-radius:14px;padding:40px 32px;text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.12);">
    <img src="/assets/header_logo.png" alt="Backyard" style="width:200px;max-width:70%;height:auto;mix-blend-mode:multiply;">
    ${inner}
    <p style="margin:28px 0 0 0;font-size:13px;color:#7d6f60;">
      <a href="${SITE}" style="color:#7d6f60;">explorethebackyard.com</a>
      &nbsp;&#8226;&nbsp;
      <a href="${SITE}/privacy" style="color:#7d6f60;">Privacy Policy</a>
    </p>
  </main>
</body>
</html>`;
}

// Shown on GET. Changes nothing, which is the point: mail providers prefetch
// links to scan them, so the click itself must not unsubscribe anyone.
export function renderConfirmPage(id) {
  return shell('Unsubscribe', `
    <h1 style="margin:24px 0 0 0;font-size:26px;text-transform:uppercase;letter-spacing:0.04em;color:#2b2724;">
      Leave the waitlist?
    </h1>
    <p style="margin:14px 0 0 0;font-size:16px;line-height:1.6;color:#6f6862;">
      You'll stop receiving launch updates from Backyard. You can rejoin any
      time from the site.
    </p>
    <form method="post" action="/api/unsubscribe" style="margin:26px 0 0 0;">
      <input type="hidden" name="id" value="${escapeAttr(id)}">
      <button type="submit"
              style="width:100%;padding:13px 22px;background:#C53B3F;color:#fff;font-family:inherit;
                     font-weight:600;font-size:15px;text-transform:uppercase;letter-spacing:0.06em;
                     border:none;border-radius:999px;cursor:pointer;box-shadow:0 4px 0 #942C2F;">
        Yes, unsubscribe
      </button>
    </form>
    <p style="margin:18px 0 0 0;font-size:14px;">
      <a href="${SITE}" style="color:#6f6862;">No, keep me on the list</a>
    </p>`);
}

export function renderDonePage() {
  return shell('Unsubscribed', `
    <h1 style="margin:24px 0 0 0;font-size:26px;text-transform:uppercase;letter-spacing:0.04em;color:#2b2724;">
      You're unsubscribed
    </h1>
    <p style="margin:14px 0 0 0;font-size:16px;line-height:1.6;color:#6f6862;">
      We won't email you again. If that was a mistake, you're welcome back on
      the waitlist whenever you like.
    </p>`);
}

export function renderInvalidPage() {
  return shell('Link not recognised', `
    <h1 style="margin:24px 0 0 0;font-size:26px;text-transform:uppercase;letter-spacing:0.04em;color:#2b2724;">
      That link looks wrong
    </h1>
    <p style="margin:14px 0 0 0;font-size:16px;line-height:1.6;color:#6f6862;">
      The unsubscribe link seems incomplete. Try clicking it again from the
      email, or write to us at explorethebackyard2025@gmail.com and we'll take
      care of it.
    </p>`);
}

// The id is validated as a UUID before it reaches here, so this is belt and
// braces rather than the primary defence.
function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
