import { supabase } from './supabase';

// In dev, '/api/...' is proxied to the Express server by vite.config.js.
// In prod, set VITE_API_URL to the deployed backend origin (e.g. https://api.backyard.app).
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

// Central fetch helper. All frontend code should use this instead of supabase.from(...).
// Set { auth: false } for routes that don't need a logged-in user (clubs, search, universities).
export async function apiFetch(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

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

function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}
