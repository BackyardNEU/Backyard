import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_KEY);
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
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

  if (!AUDIENCE_ID) {
    console.error('[subscribe] RESEND_AUDIENCE_ID not configured');
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  try {
    await resend.contacts.create({
      audienceId: AUDIENCE_ID,
      email: cleaned,
      unsubscribed: false,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(200).json({ ok: true });
    }

    console.error('[subscribe]', err.message || err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
