// Central HTTP helper for talking to our Express backend.
//
// Every `supabase.from(...)` / `supabase.rpc(...)` call we migrate gets replaced
// with apiFetch(...). The helper handles three things components shouldn't care about:
//   1. Pulling the current Supabase session and attaching the JWT.
//   2. JSON-encoding bodies / parsing responses.
//   3. Picking the right base URL for dev vs prod.
//
// Why funnel everything through one helper? Auth, error shape, and base URL all
// live in one place. If we change how auth works later (cookies, refresh logic,
// etc.) we change it here, not in 21 components.

import { supabase } from './lib/supabase';

// Dev: '/api' — Vite's proxy (vite.config.js) forwards /api/* to localhost:3001.
// Prod: set VITE_API_URL to your deployed backend, e.g. https://backyard-api.fly.dev/api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function apiFetch(path, options = {}) {
  // getSession() reads from local storage and silently refreshes the access token
  // if it's near expiry. No network round-trip in the common case.
  // We attach the JWT even on public routes — the server simply ignores it where
  // the requireAuth middleware isn't mounted.
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Convenience: if `body` is a plain object, JSON-encode it and set the header.
  // Skip for FormData/Blob — the browser must set its own Content-Type
  // (with the multipart boundary) for those.
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(API_BASE + path, { ...options, headers, body });

  // 204 No Content (e.g. successful DELETE) has no body — don't try to parse it.
  if (res.status === 204) return null;

  // Parse first so we can include the server's error message in the thrown Error.
  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const message = payload?.error || `Request failed: ${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return payload;
}
