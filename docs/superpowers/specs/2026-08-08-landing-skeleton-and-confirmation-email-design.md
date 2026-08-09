# Landing page: skeleton loading + confirmation email

**Date:** 2026-08-08
**Branch:** `landing-page`
**Status:** approved, ready for implementation planning

## Problem

Two unrelated gaps in the waitlist landing page.

**Loading.** The page weighs ~9.9MB in images. `.bg-wood` declares only a
`background-image`, so nothing paints until a 3.1MB JPEG arrives and the
backdrop appears blank, then snaps in. The card's logo and mascot pop in
individually afterwards.

**No confirmation.** A subscriber gets an on-page success state and nothing
else. There is no record in their inbox that they joined, and no way to leave
the list — which the privacy policy promises ("Every email we send includes an
unsubscribe link").

## Constraints

- Static site on an orphan branch, deployed to Vercel. No build step; the only
  server code is Vercel functions under `api/`.
- CSP is `default-src 'self'; script-src 'self'` with no inline allowance. Any
  HTML this feature serves must be script-free. An inline `<script>` is silently
  refused — this exact policy broke the signup form and must not be reintroduced.
- `RESEND_KEY` and `ALLOWED_ORIGIN` are the only configured variables. This
  design adds none.
- `explorethebackyard.com` is already verified for sending: DKIM at
  `resend._domainkey`, SPF `v=spf1 include:amazonses.com ~all` and MX
  `feedback-smtp.us-east-1.amazonses.com` on `send.`.
- Available image tooling: `sips` and `cwebp`. No ImageMagick or pngquant.

## Part 1 — Instant backdrop and card skeleton

### Backdrop

Give `.bg-wood` a `background-color` sampled from the JPEG's average tone. The
backdrop then paints on the first frame with a colour that already looks
correct, and the photograph fades in over it. No layout depends on the image,
so nothing shifts when it lands.

### Asset compression

The real fix. A skeleton drawn over a 5.6MB image only decorates the wait.

| Asset | Current | Target |
| --- | --- | --- |
| `neu_flag.png` | 5.6MB | ~60KB |
| `ghibili_background.jpg` | 3.1MB | ~250KB |
| `raccoon.png` | 732KB | ~40KB |
| `header_logo.png` | 300KB | ~25KB |
| **Total** | **~9.9MB** | **~400KB** |

Resize to roughly twice display size with `sips`, emit WebP with `cwebp`, and
keep the resized original as the fallback via `<picture>`. Originals stay
recoverable in git history.

### Card skeleton

Shimmer blocks sized to each image's final dimensions, so content swaps in
without moving anything. Images fade in on load. Because the script is
deferred, an image may already be complete before the handler attaches, so the
`complete` flag is checked rather than relying on the `load` event alone.

`prefers-reduced-motion` drops the shimmer animation and keeps the flat
placeholder colour.

## Part 2 — Confirmation email

Sent after the contact is created, from `Backyard <waitlist@explorethebackyard.com>`.

- Table-based HTML with fully inline styles. Email clients strip `<style>`
  blocks, so no stylesheet survives the trip.
- **The message must be complete with images blocked.** Outlook and many
  clients suppress images by default. Colour, type and borders carry the
  branding; the raccoon is decoration, not content. Every image gets real alt
  text.
- Two small images served from a new `assets/email/` directory, compressed for
  mail rather than reusing the page assets.
- A plain-text alternative accompanies the HTML, for deliverability and for
  clients that prefer text.
- Headers carry `List-Unsubscribe` and `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`, so Gmail and Apple Mail render their native
  unsubscribe affordance.

### Failure handling

A failed send must never fail the signup. The contact already exists by the
time the send is attempted, so the send gets its own `try`/`catch`: it logs and
still returns `200`. Losing a confirmation email is an annoyance; losing the
subscriber is not acceptable.

This mirrors a bug already fixed in this endpoint — the Resend SDK resolves
with `{ data, error }` rather than throwing, so the send result is checked for
`error` explicitly instead of relying on `catch`.

## Part 3 — Unsubscribe

New `api/unsubscribe.js`, keyed on the Resend contact UUID returned by
`contacts.create`. The UUID is unguessable and unique per person, so it serves
as the capability token. No secret and no HMAC, therefore no new env var.

### Two-step by necessity

Gmail and Outlook prefetch links in mail to scan for malware. A bare
`GET /api/unsubscribe?id=…` that mutated state would silently unsubscribe
people who never clicked.

- `GET` renders a branded confirmation page with a POST button. It changes
  nothing, so a scanner touching it is harmless.
- `POST` performs the unsubscribe via `resend.contacts.update({ id,
  unsubscribed: true })`.
- The `List-Unsubscribe-Post` header sends `POST` directly, which is the RFC
  8058 one-click contract and needs no page.

The confirmation page is a plain HTML form with no JavaScript, because the CSP
forbids inline script.

### Hardening

- Reject any `id` that is not a well-formed UUID before calling Resend.
- Rate limit per IP, reusing the pattern already in `api/subscribe.js`.
- Return an identical response whether or not the contact existed, so the
  endpoint cannot be used to test which addresses are on the list.

## Out of scope

- Double opt-in. The consent checkbox plus this confirmation is single opt-in,
  which matches the privacy policy as written.
- A resubscribe flow. Someone who unsubscribes by mistake can rejoin through
  the form; the endpoint returns 409, which is already treated as success.
- DMARC. The root domain has no `_dmarc` record. It does not block sending at
  this volume and belongs to a separate deliverability task.

## Verification

- Page: measure transferred bytes before and after; confirm the backdrop colour
  paints with images throttled, and that no element moves as images resolve.
- Email: render the HTML with images blocked and confirm it still reads;
  confirm the plain-text alternative is present.
- Unsubscribe: `GET` must not mutate (simulating a scanner prefetch); `POST`
  must flip the contact and be visible in the Resend dashboard; a malformed
  `id` must be rejected without reaching Resend.
- CSP: load every new page through the production headers and confirm zero
  violations, the same harness that caught the signup form breakage.
