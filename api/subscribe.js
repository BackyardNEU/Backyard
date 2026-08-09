import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_KEY);
// Resend replaced per-list "audiences" with a single account-level audience
// that segments subdivide; the audiences API is now an alias for segments.
// Contacts land in the account audience either way, so this is optional — it
// only files them under a segment, and a stale value must not cost a signup.
// RESEND_AUDIENCE_ID is still read so an existing deployment keeps working.
const SEGMENT_ID = process.env.RESEND_SEGMENT_ID || process.env.RESEND_AUDIENCE_ID || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

const rateMap = new Map();
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_MAX = 5;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_MAX) return true;
  return false;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported content type' });
  }

  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { email, website } = req.body || {};

  if (website) {
    return res.status(200).json({ ok: true });
  }

  const cleaned = stripHtml((email || '').trim().toLowerCase());

  if (!isValidEmail(cleaned)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    // The SDK resolves with { data, error } instead of throwing on an API
    // failure, so the error arrives here rather than in the catch below.
    // Without this check every rejected call fell through to a 200 and the
    // page celebrated a signup that was never recorded.
    let { data, error } = await resend.contacts.create({
      email: cleaned,
      unsubscribed: false,
      ...(SEGMENT_ID ? { segments: [SEGMENT_ID] } : {}),
    });

    // Getting the address is what matters; the segment is filing. If the
    // segment is what Resend objected to, save the contact without it rather
    // than lose a subscriber to a misconfigured id.
    if (error && SEGMENT_ID && error.statusCode !== 409) {
      console.error('[subscribe] segment rejected, retrying unsegmented:', error.name, error.message);
      ({ data, error } = await resend.contacts.create({
        email: cleaned,
        unsubscribed: false,
      }));
    }

    if (error) {
      // Already subscribed is a success as far as the subscriber is
      // concerned, and saying so avoids confirming who is on the list.
      if (error.statusCode === 409) {
        return res.status(200).json({ ok: true });
      }

      console.error('[subscribe] resend rejected:', error.name, error.statusCode, error.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    console.log('[subscribe] created contact', data?.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Only genuine network or runtime faults reach here now.
    console.error('[subscribe] unexpected:', err.message || err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
