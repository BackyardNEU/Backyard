import { apiFetch } from './api';
import { supabase } from './supabase';

// Warms the weekly calendar before the user opens it.
//
// Same problem the club-page prefetch solves: the panel faded in showing "Loading events…"
// and swapped to real content once three requests came back, so opening the calendar read
// as two separate events rather than one.
//
// It was also worse than it needed to be. The original init ran getUser, then the weekly
// events, then the RSVPs strictly in series — but only the RSVP call actually depends on
// anything before it (it needs the event ids). The first two are independent and run in
// parallel here, which shortens the chain from three round trips to two even on a miss.

const TTL_MS = 30_000;

let entry = null;     // { data, at }
let inflight = null;

function isFresh(e) {
  return e && Date.now() - e.at < TTL_MS;
}

async function load() {
  // Independent of each other — the previous sequential await chain gained nothing.
  const [authResult, eventsResult] = await Promise.allSettled([
    supabase.auth.getUser(),
    apiFetch('/events/weekly'),
  ]);

  const user = authResult.status === 'fulfilled' ? authResult.value?.data?.user : null;
  if (!user) return { userId: null, events: [], rsvps: [] };

  const events = eventsResult.status === 'fulfilled' ? (eventsResult.value || []) : [];
  if (events.length === 0) return { userId: user.id, events, rsvps: [] };

  // This one genuinely has to wait — it is keyed by the ids above.
  let rsvps = [];
  try {
    const ids = events.map((e) => e.id);
    rsvps = (await apiFetch(`/events/rsvps?eventIds=${ids.join(',')}`)) || [];
  } catch (err) {
    console.error('[calendarCache] rsvp fetch failed:', err);
  }

  return { userId: user.id, events, rsvps };
}

/** Start (or join) a fetch of the weekly calendar. Safe to call on every hover. */
export function prefetchCalendar() {
  if (isFresh(entry)) return Promise.resolve(entry.data);
  if (inflight) return inflight;

  inflight = load()
    .then((data) => {
      entry = { data, at: Date.now() };
      inflight = null;
      return data;
    })
    .catch((err) => {
      // Never cache a failure; the next hover should retry.
      inflight = null;
      console.error('[calendarCache] prefetch failed:', err);
      return null;
    });

  return inflight;
}

/** Synchronous read, for seeding state on the first render. */
export function readCalendar() {
  return isFresh(entry) ? entry.data : null;
}

export function invalidateCalendar() {
  entry = null;
  inflight = null;
}
