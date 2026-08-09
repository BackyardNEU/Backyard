import { Resend } from 'resend';
import { renderConfirmPage, renderDonePage, renderInvalidPage } from '../lib/unsubscribePage.js';

const resend = new Resend(process.env.RESEND_KEY);

const rateMap = new Map();
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_MAX = 20;

// The Resend contact id. Unguessable, unique per person, and therefore the
// capability token — which is why it is checked strictly before use.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return entry.count > RATE_MAX;
}

function html(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Nothing here should be cached: the page reflects an action, and a cached
  // copy in a shared proxy would be misleading.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isRateLimited(getClientIp(req))) {
    return html(res, 429, renderInvalidPage());
  }

  // One-Click unsubscribe posts to the URL from the List-Unsubscribe header,
  // so the id arrives in the query string; the on-page form sends it in the
  // body. Accept either.
  const fromQuery = req.query?.id;
  const fromBody = typeof req.body === 'object' && req.body ? req.body.id : undefined;
  const id = String(fromQuery || fromBody || '').trim();

  if (!UUID_RE.test(id)) {
    return html(res, 400, renderInvalidPage());
  }

  // GET must not mutate. Gmail and Outlook prefetch links in mail to scan
  // them, so a GET that unsubscribed would quietly drop people who never
  // clicked. The visible link lands here and asks first.
  if (req.method === 'GET') {
    return html(res, 200, renderConfirmPage(id));
  }

  try {
    const { error } = await resend.contacts.update({ id, unsubscribed: true });

    if (error) {
      // Deliberately still the success page. Reporting "no such contact"
      // would turn this endpoint into a way to test which ids are real.
      console.error('[unsubscribe] resend rejected:', error.name, error.statusCode, error.message);
      return html(res, 200, renderDonePage());
    }

    console.log('[unsubscribe] contact unsubscribed');
    return html(res, 200, renderDonePage());
  } catch (err) {
    console.error('[unsubscribe] unexpected:', err.message || err);
    return html(res, 200, renderDonePage());
  }
}
