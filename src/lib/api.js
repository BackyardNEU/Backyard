import { supabase } from './supabase';

// In dev, '/api/...' is proxied to the Express server by vite.config.js.
// In prod, set VITE_API_URL to the deployed backend origin (e.g. https://api.backyard.app).
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

// Central fetch helper. All frontend code should use this instead of supabase.from(...).
// Set { auth: false } for routes that don't need a logged-in user (clubs, search, universities).
// `retry` defaults to true for GET/HEAD (safe to repeat) and false for everything else
// (POST/PUT/PATCH/DELETE aren't idempotent — retrying could double-write). Pass `retry: true`
// explicitly for a mutation you know is safe to repeat.
export async function apiFetch(path, { method = 'GET', body, headers = {}, auth = true, retry } = {}) {
  const finalHeaders = { ...headers };

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      finalHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  const isIdempotent = ['GET', 'HEAD'].includes(method.toUpperCase());
  const shouldRetry = retry ?? isIdempotent;
  const retryDelays = shouldRetry ? [150, 400, 1000] : [];
  const maxAttempts = 1 + retryDelays.length;
  const requestBody = body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined;

  let res;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: finalHeaders,
        body: requestBody,
      });
      // 503 from the dev proxy means upstream is bouncing — back off and try again.
      if (res.status === 503 && attempt < maxAttempts - 1) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      break;
    } catch (err) {
      // fetch() throws on network failure (ECONNREFUSED/RESET before proxy responds).
      if (attempt < maxAttempts - 1) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      throw err;
    }
  }

  // Rate limited. Deliberately not retried: retrying a throttled request is precisely what
  // turns a brief limit into a sustained one. Surface how long to wait so callers can show
  // something useful — before this, a 429 reached the UI as an unexplained silent failure.
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || null;
    const err = new Error(
      retryAfter
        ? `You're going a little fast. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
        : "You're going a little fast. Give it a moment and try again."
    );
    err.status = 429;
    err.retryAfter = retryAfter;
    throw err;
  }

  const text = await res.text();
  const data = text ? safeParseJson(text) : null;

  if (!res.ok) {
    const message = data?.error || data?.message || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}
