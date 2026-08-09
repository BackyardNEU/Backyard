// Regression tests for the two API functions.
//
// Run with: npm test
//
// Every bug this file guards against shipped to production silently, because
// the endpoint returned 200 while doing nothing. The tests replace global
// fetch, so they assert on exactly which Resend calls were made without
// touching the real account.

process.env.RESEND_KEY = 're_test_key';
process.env.ALLOWED_ORIGIN = 'https://explorethebackyard.com';

const ID = '4a1b9c2d-3e4f-5061-7283-94a5b6c7d8e9';
const ORIGIN = 'https://explorethebackyard.com';

let mode = 'ok';
let calls = [];

globalThis.fetch = async (url, opts = {}) => {
  const path = new URL(url).pathname;
  calls.push({ method: opts.method || 'GET', path, body: opts.body ? JSON.parse(opts.body) : null });

  const fail = (name, statusCode, message) =>
    new Response(JSON.stringify({ name, message, statusCode }), {
      status: statusCode, headers: { 'content-type': 'application/json' },
    });

  if (path === '/emails' && mode === 'mail-fails') return fail('validation_error', 422, 'nope');
  if (path === '/contacts' && mode === 'contact-fails') return fail('restricted_api_key', 401, 'send only');

  return new Response(JSON.stringify({ id: ID, object: 'contact' }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};

const subscribe = (await import('../api/subscribe.js')).default;
const unsubscribe = (await import('../api/unsubscribe.js')).default;

function mockRes() {
  const r = { code: 0, body: '' };
  r.setHeader = () => {};
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}

// A fresh forwarded-for per call so the rate limiter never interferes.
const ip = () => Math.random().toString(36).slice(2);

async function callSubscribe(body, m = 'ok') {
  mode = m; calls = [];
  const res = mockRes();
  await subscribe({
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': ip() },
    body,
  }, res);
  return { res, calls: [...calls] };
}

async function callUnsubscribe(req) {
  mode = 'ok'; calls = [];
  const res = mockRes();
  await unsubscribe({ headers: { 'x-forwarded-for': ip() }, ...req }, res);
  return { res, calls: [...calls] };
}

let failures = 0;
const check = (name, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

console.log('\n--- subscribe ---');
const happy = await callSubscribe({ email: 'Ryan@Northeastern.EDU ' });
const email = happy.calls.find((c) => c.path === '/emails');

check('returns ok', happy.res.code === 200 && happy.res.body.ok === true);
check('address normalised', happy.calls[0].body.email === 'ryan@northeastern.edu');
check('confirmation sent', !!email);
check('sends from the waitlist address', email?.body?.from === 'Backyard <waitlist@explorethebackyard.com>');
check('has a plain-text alternative', !!email?.body?.text);
check('List-Unsubscribe header set', !!email?.body?.headers?.['List-Unsubscribe']);
check('one-click header set', email?.body?.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');
check('unsubscribe url carries the contact id', String(email?.body?.headers?.['List-Unsubscribe']).includes(ID));

// The signup is the thing that matters; the email is a courtesy.
const mailFails = await callSubscribe({ email: 'ryan@northeastern.edu' }, 'mail-fails');
check('a failed send still reports success', mailFails.res.code === 200 && mailFails.res.body.ok === true);

// Regression: the SDK resolves with { data, error } rather than throwing, so a
// rejected create once fell through to 200 and the page celebrated nothing.
const contactFails = await callSubscribe({ email: 'ryan@northeastern.edu' }, 'contact-fails');
check('a failed contact create reports 500', contactFails.res.code === 500);
check('a failed contact create sends no email', !contactFails.calls.some((c) => c.path === '/emails'));

const bot = await callSubscribe({ email: 'bot@x.com', website: 'spam' });
check('honeypot reaches Resend not at all', bot.calls.length === 0 && bot.res.code === 200);

const badEmail = await callSubscribe({ email: 'nope' });
check('invalid address rejected before Resend', badEmail.res.code === 400 && badEmail.calls.length === 0);

console.log('\n--- unsubscribe ---');
const scanner = await callUnsubscribe({ method: 'GET', query: { id: ID } });
// Mail providers prefetch links to scan them. A GET that mutated would drop
// people who never clicked.
check('GET does not touch Resend', scanner.calls.length === 0);
check('GET asks for confirmation', /Leave the waitlist/.test(scanner.res.body));

const confirmed = await callUnsubscribe({ method: 'POST', body: { id: ID } });
check('POST unsubscribes', confirmed.calls.length === 1 && /You're unsubscribed/.test(confirmed.res.body));

const oneClick = await callUnsubscribe({ method: 'POST', query: { id: ID } });
check('one-click POST (id in query) works', oneClick.calls.length === 1);

const bad = await callUnsubscribe({ method: 'GET', query: { id: 'not-a-uuid' } });
check('malformed id rejected before Resend', bad.res.code === 400 && bad.calls.length === 0);

const missing = await callUnsubscribe({ method: 'GET', query: {} });
check('missing id rejected before Resend', missing.res.code === 400 && missing.calls.length === 0);

const wrongMethod = await callUnsubscribe({ method: 'PUT', query: { id: ID } });
check('wrong method rejected', wrongMethod.res.code === 405);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
