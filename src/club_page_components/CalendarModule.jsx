import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import {
  startOfDay, addDays, format, isSameDay, parseISO,
  getDay, getDaysInMonth, isToday, isBefore,
} from 'date-fns';
import borderImg from '../assets/border.svg';
import borderHorizontalImg from '../assets/border-horizontal.svg';
import { apiFetch } from '../lib/api';
import { CalendarExportRow } from './CalendarExportRow';
import './CalendarModule.css';

/**
 * Calendar / Events module — simplified "Coming Up" list. Read-only display
 * (RSVP + lightbox) only — adding events lives in the separate, always-on-top
 * AddEventPanel so the two can't be confused with each other.
 *
 * data shape: { filterByMembership: boolean }
 * @param {Object}   club          - club record (used for its image_url, as a
 *                                    poster placeholder for events with no image)
 * @param {Object}   data          - module data
 * @param {boolean}  editing       - page edit mode
 * @param {Function} onChange      - (updatedData) => void
 * @param {string}   warning       - displays a warning for invalid fields not entered in by page editor
 * @param {Array}    events        - upcoming events fetched by ExpandedTile, sorted by start_time
 * @param {Set}      myRsvpSet     - event IDs the current user has RSVPd to
 * @param {Map}      friendRsvpMap - event ID → [{ username, ... }]
 * @param {Function} onRsvp        - (eventId, isCurrentlyGoing) => void
 * @param {string}   userId        - null if not logged in
 */
export function CalendarModule({
  club,
  editing,
  warning,
  events = [],
  myRsvpSet = new Set(),
  friendRsvpMap = new Map(),
  onRsvp,
  userId,
}) {
  const [overlayEvent, setOverlayEvent] = useState(null);
  const [overlayHasMore, setOverlayHasMore] = useState(false);

  // Which format "Add to calendar" uses, set in Settings. Defaults to 'ics' — which every
  // calendar app imports — so this renders correctly before the fetch resolves and for
  // signed-out visitors, who get no profile at all.
  const [calendarPreference, setCalendarPreference] = useState('ics');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/me/profile')
      .then((profile) => {
        if (!cancelled && profile?.calendar_preference) {
          setCalendarPreference(profile.calendar_preference);
        }
      })
      .catch(() => { /* signed out, or profile unavailable — the 'ics' default stands */ });
    return () => { cancelled = true; };
  }, []);
  const overlayScrollRef = useRef(null);
  const overlayItemRefs = useRef({});

  useLayoutEffect(() => {
    if (!overlayEvent || !overlayScrollRef.current) return;
    const el = overlayItemRefs.current[overlayEvent.id];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
    // check after scroll settles
    const el2 = overlayScrollRef.current;
    setTimeout(() => {
      setOverlayHasMore(el2.scrollHeight - el2.scrollTop - el2.clientHeight > 10);
    }, 50);
  }, [overlayEvent]);

  const handleOverlayScroll = () => {
    const el = overlayScrollRef.current;
    if (!el) return;
    setOverlayHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 10);
  };

  // ── view toggle ──────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('week');

  // ── weekly view refs ─────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const imageInputRef = useRef(null);

  // ── monthly view state ───────────────────────────────────────────────────
  const todayDate = startOfDay(new Date());
  const [displayYear, setDisplayYear] = useState(todayDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(todayDate.getMonth() + 1); // 1-12
  const [monthlyEvents, setMonthlyEvents] = useState([]);
  const [monthlyMyRsvpSet, setMonthlyMyRsvpSet] = useState(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // ── day detail overlay ───────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState(null); // day number or null

  // ── add event form ───────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', date: '', startTime: '', endTime: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formWarning, setFormWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── weekly scroll ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (containerRef.current) containerRef.current.scrollLeft += e.deltaX;
  }, []);
  const handleMouseEnter = () => containerRef.current?.addEventListener('wheel', handleWheel, { passive: false });
  const handleMouseLeave = () => containerRef.current?.removeEventListener('wheel', handleWheel);

  const today = startOfDay(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const dayEvents = events
      .filter((event) => isSameDay(parseISO(event.start_time), date))
      .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
    return { date, label: format(date, 'EEE'), sublabel: format(date, 'd'), isToday: i === 0, events: dayEvents };
  });

  // ── monthly data fetch ───────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'month' || !club?.id) return;
    let cancelled = false;
    const fetchMonthly = async () => {
      console.log("UseEffect running!");
      setMonthlyLoading(true);
      try {
        const eventsData = await apiFetch(
          `/clubs/${club.id}/events/monthly?year=${displayYear}&month=${displayMonth}`
        );
        if (cancelled) return;
        setMonthlyEvents(eventsData || []);

        if (!eventsData || eventsData.length === 0) return;
        const eventIds = eventsData.map((e) => e.id);
        const rsvpData = await apiFetch(
          `/clubs/${club.id}/events/rsvps?eventIds=${eventIds.join(',')}`
        );
        if (cancelled) return;
        setMonthlyMyRsvpSet(
          new Set((rsvpData || []).filter((r) => r.user_id === userId).map((r) => r.event_id))
        );
        console.log(eventsData);
      } catch (err) {
        console.error('Failed to fetch monthly events:', err);
      } finally {
        if (!cancelled) setMonthlyLoading(false);
      }
    };
    fetchMonthly();
    return () => { cancelled = true; };
  }, [viewMode, displayYear, displayMonth, club?.id, userId]);

  // ── build events-by-day map for the displayed month ──────────────────────
  const monthlyEventsByDay = new Map();
  for (const event of monthlyEvents) {
    const d = parseISO(event.start_time);
    if (d.getFullYear() === displayYear && d.getMonth() + 1 === displayMonth) {
      const dayNum = d.getDate();
      if (!monthlyEventsByDay.has(dayNum)) monthlyEventsByDay.set(dayNum, []);
      monthlyEventsByDay.get(dayNum).push(event);
    }
  }
  for (const [, evts] of monthlyEventsByDay) {
    evts.sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
  }

  // ── monthly navigation ───────────────────────────────────────────────────
  function navigateMonth(delta) {
    
    const newDate = new Date(displayYear, displayMonth - 1 + delta, 1);
    setDisplayYear(newDate.getFullYear());
    setDisplayMonth(newDate.getMonth() + 1);
    setSelectedDay(null);
  }

  function getMonthGrid() {
    const firstDay = new Date(displayYear, displayMonth - 1, 1);
    const offset = getDay(firstDay); // 0 = Sunday
    const totalDays = getDaysInMonth(firstDay);
    return [
      ...Array(offset).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ];
  }

  function getDayClass(dayNum) {
    const date = new Date(displayYear, displayMonth - 1, dayNum);
    const hasEvents = monthlyEventsByDay.has(dayNum);
    if (isBefore(date, today)) return 'cal-day-past';
    if (isToday(date)) return hasEvents ? 'cal-day-today-events' : 'cal-day-today';
    return hasEvents ? 'cal-day-has-events' : 'cal-day-normal';
  }

  // ── overlay helpers ──────────────────────────────────────────────────────
  function openDayOverlay(dayNum) {
    if (!monthlyEventsByDay.has(dayNum)) return;
    const date = new Date(displayYear, displayMonth - 1, dayNum);
    if (isBefore(date, today)) return; // past days are grey and not clickable
    setSelectedDay(dayNum);
  }

  function closeOverlay() {
    setSelectedDay(null);
  }

  async function handleMonthlyRsvp(eventId, isCurrentlyGoing) {
    if (!userId || !club?.id) return;
    try {
      if (isCurrentlyGoing) {
        await apiFetch(`/clubs/${club.id}/events/${eventId}/rsvp`, { method: 'DELETE' });
        setMonthlyMyRsvpSet((prev) => { const next = new Set(prev); next.delete(eventId); return next; });
      } else {
        await apiFetch(`/clubs/${club.id}/events/${eventId}/rsvp`, { method: 'POST' });
        setMonthlyMyRsvpSet((prev) => new Set([...prev, eventId]));
      }
    } catch (err) {
      console.error('Monthly RSVP failed:', err);
    }
  }

  // ── add-event form helpers ───────────────────────────────────────────────
  function validateForm() {
    const { description, date, startTime, endTime } = formData;
    if (!description.trim()) { setFormWarning('Description is required.'); return false; }
    if (description.length > 200) { setFormWarning('Description must be 200 characters or fewer.'); return false; }
    if (!date || !startTime || !endTime) { setFormWarning('Please fill in all date and time fields.'); return false; }
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (isNaN(start) || isNaN(end)) { setFormWarning('Invalid date or time format.'); return false; }
    if (start < new Date()) { setFormWarning('Event cannot begin in the past.'); return false; }
    if (start >= end) { setFormWarning('Start time must be before end time.'); return false; }
    if (end - start > 12 * 60 * 60 * 1000) { setFormWarning('Event cannot last more than 12 hours.'); return false; }
    setFormWarning('');
    return true;
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const { signedUrl, publicUrl } = await apiFetch('/storage/event-poster-upload-url', {
          method: 'POST',
          body: { ext },
        });
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          body: imageFile,
          headers: { 'Content-Type': imageFile.type || 'application/octet-stream' },
        });
        if (!uploadRes.ok) throw new Error('Image upload failed.');

        const verification = await apiFetch('/storage/verify-image', {
          method: 'POST',
          body: { publicUrl },
        });
        if (!verification.ok) {
          throw new Error(verification.error || 'Image rejected by content policy');
        }

        imageUrl = publicUrl;
      }
      await onAddEvent?.({
        description: formData.description,
        startTime: `${formData.date}T${formData.startTime}:00`,
        endTime: `${formData.date}T${formData.endTime}:00`,
        imageUrl,
      });
      setShowForm(false);
      setFormData({ description: '', date: '', startTime: '', endTime: '' });
      setImageFile(null);
      setImagePreview(null);
      setFormWarning('');
    } catch (err) {
      setFormWarning(err.message || 'Failed to add event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // sorting events passed in through events prop by closest to current date
  const sorted = [...events].sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="cal-module">
      <p className="divider-header">Coming Up</p>
      {editing && warning && <p className="module-warning">{warning}</p>}

      {sorted.length === 0 ? (
        <p className="cal-empty">No upcoming events.</p>
      ) : (
        <div className="cal-event-list">
          {sorted.map((event) => {
            const start = parseISO(event.start_time);
            const end = parseISO(event.end_time);
            const friends = friendRsvpMap.get(event.id);
            const isGoing = myRsvpSet.has(event.id);

            return (
              <div
                key={event.id}
                className="cal-event-item cal-event-item--clickable"
                onClick={() => setOverlayEvent(event)}
              >
                <img src={borderImg} alt="" className="cal-event-item-border cal-event-item-border-left" />
                <img src={borderImg} alt="" className="cal-event-item-border cal-event-item-border-right" />
                <div
                  className="cal-event-item-border-h cal-event-item-border-h-top"
                  style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                />
                <div
                  className="cal-event-item-border-h cal-event-item-border-h-bottom"
                  style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                />
                <img
                  className="cal-event-img"
                  src={event.event_image_url || club?.image_url || '/raccoon_pfp.png'}
                  alt=""
                />
                <div className="cal-event-body">
                  <p className="cal-event-date">{format(start, 'EEE, MMM d').toUpperCase()}</p>
                  <p className="cal-event-time">
                    {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                  </p>
                  <p className="cal-event-desc">{event.event_description}</p>
                  {event.is_members_only && (
                    <span className="cal-members-badge">Members only</span>
                  )}
                  {friends && friends.length > 0 && (
                    <p className="friend-rsvp-callout">
                      {friends.length === 1
                        ? `${friends[0].username} is going`
                        : `${friends[0].username} and ${friends.length - 1} ${friends.length - 1 === 1 ? 'other' : 'others'} you know are going`}
                    </p>
                  )}
                  {userId && (
                    <button
                      className={`rsvp-button${isGoing ? ' rsvp-going' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onRsvp?.(event.id, isGoing); }}
                    >
                      {isGoing ? 'Going ✓' : "I'm going!"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event lightbox overlay — scrollable portrait stack */}
      {overlayEvent && (
        <div
          className="cal-overlay-backdrop"
          onClick={() => setOverlayEvent(null)}
        >
          <div
            className="cal-overlay-portrait"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="cal-overlay-close"
              onClick={() => setOverlayEvent(null)}
              aria-label="Close"
            >✕</button>

            {overlayHasMore && (
              <div className="cal-overlay-more-arrow" aria-hidden="true">&#8964;</div>
            )}
            <div className="cal-portrait-scroll" ref={overlayScrollRef} onScroll={handleOverlayScroll}>
              {sorted.map((ev) => {
                const evStart = parseISO(ev.start_time);
                const evEnd = parseISO(ev.end_time);
                const evIsGoing = myRsvpSet.has(ev.id);
                const evFriends = friendRsvpMap.get(ev.id);
                return (
                  <div
                    key={ev.id}
                    className="cal-portrait-event"
                    ref={(el) => { overlayItemRefs.current[ev.id] = el; }}
                  >
                    {ev.event_image_url ? (
                      <div className="cal-portrait-img-wrap">
                        <img className="cal-portrait-img" src={ev.event_image_url} alt="" />
                      </div>
                    ) : null}
                    <div className="cal-portrait-info">
                      <p className="cal-overlay-date-line">
                        {format(evStart, 'EEEE, MMMM d')}
                      </p>
                      <p className="cal-overlay-time">
                        {format(evStart, 'h:mm a')} – {format(evEnd, 'h:mm a')}
                      </p>
                      <p className="cal-overlay-desc">{ev.event_description}</p>
                      {ev.is_members_only && (
                        <span className="cal-members-badge">Members only</span>
                      )}
                      {evFriends && evFriends.length > 0 && (
                        <p className="friend-rsvp-callout">
                          {evFriends.length === 1
                            ? `${evFriends[0].username} is going`
                            : `${evFriends[0].username} and ${evFriends.length - 1} ${evFriends.length - 1 === 1 ? 'other' : 'others'} you know are going`}
                        </p>
                      )}
                      {userId && (
                        <button
                          className={`rsvp-button${evIsGoing ? ' rsvp-going' : ''}`}
                          onClick={() => onRsvp?.(ev.id, evIsGoing)}
                        >
                          {evIsGoing ? 'Going ✓' : "I'm going!"}
                        </button>
                      )}
                    </div>
                    <CalendarExportRow event={ev} preference={calendarPreference} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ MONTHLY VIEW ══════════════════════════════════════════════════ */}
      {viewMode === 'month' && (
        <div className="cal-monthly-card">
          {/* Seasonal tree placeholder */}
          <div className="cal-monthly-tree">
            <img src="/raccoon_pfp.png" alt="seasonal tree" className="cal-tree-img" />
          </div>

          {/* Month name + navigation */}
          <div className="cal-monthly-header">
            <span className="cal-month-name">{format(monthDisplayDate, 'MMM').toUpperCase()}</span>
            <div className="cal-month-nav">
              <button className="cal-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
              <button className="cal-nav-btn" onClick={() => navigateMonth(1)}>›</button>
            </div>
          </div>

          {monthlyLoading ? (
            <p className="cal-loading">Loading…</p>
          ) : (
            <div className="cal-grid">
              {/* Day-of-week headers */}
              {WEEK_DAYS.map((d, i) => (
                <div key={i} className="cal-weekday-label">{d}</div>
              ))}
              {/* Day cells */}
              {cells.map((dayNum, i) => (
                <div
                  key={i}
                  className={`cal-day-cell${dayNum ? ` ${getDayClass(dayNum)}` : ' cal-day-empty'}`}
                  onClick={
                    dayNum && monthlyEventsByDay.has(dayNum)
                      ? () => openDayOverlay(dayNum)
                      : undefined
                  }
                >
                  {dayNum || ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ DAY DETAIL OVERLAY ════════════════════════════════════════════ */}
      {selectedDay !== null && (
        <div className="cal-overlay-backdrop" onClick={closeOverlay}>
          <div className="cal-overlay-portrait" onClick={(e) => e.stopPropagation()}>
            <button className="cal-overlay-close" onClick={closeOverlay}>✕</button>
            <h2 className="cal-overlay-date">
              {format(new Date(displayYear, displayMonth - 1, selectedDay), 'EEEE, MMMM d')}
            </h2>

            {/* Scrollable stack of event cards */}
            <div className="cal-portrait-scroll">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="cal-portrait-event">
                  <div className="cal-portrait-img-wrap">
                    {event.event_image_url ? (
                      <img src={event.event_image_url} alt="Event" className="cal-portrait-img" />
                    ) : (
                      <img src={club?.logo_url} className="cal-portrait-img" alt="No image" />
                    )}
                  </div>
                  <div className="cal-portrait-info">
                    <p className="cal-overlay-desc">{event.event_description}</p>
                    <p className="cal-overlay-time">
                      {format(parseISO(event.start_time), 'h:mm a')} –{' '}
                      {format(parseISO(event.end_time), 'h:mm a')}
                    </p>
                    {userId && (
                      <button
                        className="rsvp-button"
                        onClick={() => handleMonthlyRsvp(event.id, monthlyMyRsvpSet.has(event.id))}
                      >
                        {monthlyMyRsvpSet.has(event.id) ? 'Going ✓' : "I'm going!"}
                      </button>
                    )}
                    <CalendarExportRow event={event} preference={calendarPreference} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(CalendarModule);
