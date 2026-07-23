import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  startOfDay, addDays, format, isSameDay, parseISO,
  getDay, getDaysInMonth, isToday, isBefore,
} from 'date-fns';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import '../club_page_components/CalendarModule.css';
import './CalendarPage.css';
import treeImg from '/src/assets/tree.png';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Calendar / Events module.
 *
 * data shape: { filterByMembership: boolean }
 * @param {Object}   club          - club object (id used for monthly fetch)
 * @param {Object}   data          - module data
 * @param {boolean}  editing       - page layout edit mode (shows filterByMembership toggle)
 * @param {boolean}  isApproved    - true for approved club owners; shows add-event form
 * @param {Function} onChange      - (updatedData) => void
 * @param {string}   warning
 * @param {Array}    events        - weekly events fetched by ExpandedTile
 * @param {Set}      myRsvpSet     - event IDs the current user has RSVPd to
 * @param {Map}      friendRsvpMap - event ID → [{ username, ... }]
 * @param {Function} onRsvp        - (eventId, isCurrentlyGoing) => void
 * @param {Function} onAddEvent    - ({ description, startTime, endTime, imageUrl }) => Promise<void>
 * @param {string}   userId        - null if not logged in
 */
export function CalendarModule({
  club,
  data,
  editing,
  isApproved = false,
  onChange,
  warning,
  events = [],
  myRsvpSet = new Set(),
  friendRsvpMap = new Map(),
  onRsvp,
  onAddEvent,
  userId,
}) {
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
    if (containerRef.current) {  
            containerRef.current.scrollLeft += e.deltaX || e.deltaY;  
      }
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

  const handleCancelForm = () => {
    setShowForm(false);
    setFormData({ description: '', date: '', startTime: '', endTime: '' });
    setImageFile(null);
    setImagePreview(null);
    setFormWarning('');
  };

  // ── derived values ───────────────────────────────────────────────────────
  const cells = getMonthGrid();
  const selectedDayEvents = selectedDay ? (monthlyEventsByDay.get(selectedDay) || []) : [];
  const monthDisplayDate = new Date(displayYear, displayMonth - 1, 1);

  // form preview times
  const previewStartTime = formData.date && formData.startTime
    ? `${formData.date}T${formData.startTime}:00` : null;
  const previewEndTime = formData.date && formData.endTime
    ? `${formData.date}T${formData.endTime}:00` : null;

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="cal-module">

      {editing && warning && <p className="module-warning">{warning}</p>}

      {/* View toggle */}
      <div className="cal-view-toggle">
        <button
          className={`cal-toggle-btn${viewMode === 'week' ? ' cal-toggle-active' : ''}`}
          onClick={() => setViewMode('week')}
        >
          Week
        </button>
        <button
          className={`cal-toggle-btn${viewMode === 'month' ? ' cal-toggle-active' : ''}`}
          onClick={() => setViewMode('month')}
        >
          Month
        </button>
      </div>

      {/* ══ WEEKLY VIEW ═══════════════════════════════════════════════════ */}
      {viewMode === 'week' && (
        <>
          <h1 className="current-month">{format(today, 'MMMM')}</h1>
          <div
            className="calendar-container"
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {weekDays.map((day) => (
              <div key={day.date.toISOString()} className={`calendar-day${day.isToday ? ' today' : ''}`}>
                <div className="day-title-number">
                  <span>{day.label}</span>
                  <span>{day.sublabel}</span>
                </div>
                {day.events.length === 0 ? (
                  <p>No events</p>
                ) : (
                  day.events.map((event) => (
                    <div key={event.id} className="calendar-event">
                      {event.event_image_url && (
                        <img className="club-img" src={event.event_image_url} alt="" />
                      )}
                      <div className="club-name">{event.club_name}</div>
                      <div className="event-description">
                        <p>about<span className="club-info">{event.event_description}</span></p>
                      </div>
                      <div>
                        <span>time </span>
                        <span className="club-info">
                          {format(parseISO(event.start_time), 'h:mm a')} – {format(parseISO(event.end_time), 'h:mm a')}
                        </span>
                      </div>
                      {userId && (
                        <button
                          className="rsvp-button"
                          onClick={() => onRsvp?.(event.id, myRsvpSet.has(event.id))}
                        >
                          {myRsvpSet.has(event.id) ? 'Going ✓' : "I'm going!"}
                        </button>
                      )}
                      {(() => {
                        const friends = friendRsvpMap.get(event.id);
                        if (!friends || friends.length === 0) return null;
                        const first = friends[0].username;
                        const rest = friends.length - 1;
                        return (
                          <p className="friend-rsvp-callout">
                            {rest === 0
                              ? `${first} is going`
                              : `${first} and ${rest} ${rest === 1 ? 'other' : 'others'} you know are going`}
                          </p>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT SETTINGS ═════════════════════════════════════════════════ */}
      {editing && (
        <div className="cal-edit-section">
          <label className="cal-toggle-label">
            <input
              type="checkbox"
              checked={data?.filterByMembership ?? false}
              onChange={(e) => onChange?.({ ...data, filterByMembership: e.target.checked })}
            />
            {' '}Restrict members-only events to club members
          </label>
        </div>
      )}

      {/* ══ ADD EVENT ═════════════════════════════════════════════════════ */}
      {isApproved && (
        <div className="cal-add-event-section">
          {!showForm && (
            <button className="cal-add-btn" onClick={() => setShowForm(true)}>＋ Add Event</button>
          )}
          {showForm && (
            <div className="cal-form">
              <p className="cal-form-title">New Event</p>

              <label className="cal-label">
                Description *
                <div>
                  <textarea
                    className="cal-input cal-textarea"
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="What's happening?"
                    maxLength={200}
                    rows={3}
                  />
                  <div className="char-counter-wrap">
                    <span className="char-counter">{formData.description.length}/200</span>
                  </div>
                </div>
              </label>

              <label className="cal-label">
                Date *
                <input
                  className="cal-input"
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                />
              </label>

              <div className="cal-time-row">
                <label className="cal-label">
                  Start time *
                  <input
                    className="cal-input"
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleFormChange}
                  />
                </label>
                <label className="cal-label">
                  End time *
                  <input
                    className="cal-input"
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleFormChange}
                  />
                </label>
              </div>

              <div className="cal-label">
                Event image (optional)
                <p className="cal-image-hint">For the best display, use a portrait-style image — 3:4 ratio or 750 × 1,000 px</p>
                <div
                  className="cal-image-trigger"
                  role="button"
                  tabIndex={0}
                  onClick={() => imageInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      imageInputRef.current?.click();
                    }
                  }}
                >
                  {imageFile ? `✓ ${imageFile.name}` : 'Click to upload image'}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              {/* ── Live previews ─────────────────────────────────────── */}
              {imagePreview && (
                <div className="cal-preview-section">
                  <p className="cal-preview-title">Previews</p>

                  {/* Week view card */}
                  <div className="cal-preview-element">
                    <p className="cal-preview-label">Week view</p>
                    <div className="calendar-event cal-preview-week-card">
                      <img className="club-img" src={imagePreview} alt="" />
                      <div className="club-name">{club?.name || 'Your Club'}</div>
                      <div className="event-description">
                        <p>about<span className="club-info">{formData.description || '…'}</span></p>
                      </div>
                      {previewStartTime && previewEndTime && (
                        <div>
                          <span>time </span>
                          <span className="club-info">
                            {format(new Date(previewStartTime), 'h:mm a')} – {format(new Date(previewEndTime), 'h:mm a')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Month overlay portrait card */}
                  <div className="cal-preview-element">
                    <p className="cal-preview-label">Month view</p>
                    <div className="cal-portrait-preview">
                      <div className="cal-portrait-img-wrap">
                        <img src={imagePreview} alt="Event" className="cal-portrait-img" />
                      </div>
                      <div className="cal-portrait-info">
                        <p className="cal-overlay-desc">{formData.description || '…'}</p>
                        {previewStartTime && previewEndTime && (
                          <p className="cal-overlay-time">
                            {format(new Date(previewStartTime), 'h:mm a')} –{' '}
                            {format(new Date(previewEndTime), 'h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formWarning && <p className="cal-form-warning">{formWarning}</p>}

              <div className="cal-form-actions">
                <button className="cal-cancel-btn" onClick={handleCancelForm} disabled={isSubmitting}>
                  Cancel
                </button>
                <button className="cal-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Event'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CalendarPage({ onClose }) {
  const todayDate = startOfDay(new Date());
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'unauthed'
  const [userId, setUserId] = useState(null);

  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [myRsvpSet, setMyRsvpSet] = useState(new Set());

  const [viewMode, setViewMode] = useState('week');

  const [displayYear, setDisplayYear] = useState(todayDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(todayDate.getMonth() + 1);
  const [monthlyEvents, setMonthlyEvents] = useState([]);
  const [monthlyMyRsvpSet, setMonthlyMyRsvpSet] = useState(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const containerRef = useRef(null);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (containerRef.current) containerRef.current.scrollLeft += e.deltaX || e.deltaY;
  }, []);
  const handleMouseEnter = () => containerRef.current?.addEventListener('wheel', handleWheel, { passive: false });
  const handleMouseLeave = () => containerRef.current?.removeEventListener('wheel', handleWheel);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { setStatus('unauthed'); return; }
      setUserId(user.id);
      try {
        const events = await apiFetch('/events/weekly');
        setWeeklyEvents(events || []);
        if (events?.length) {
          const ids = events.map(e => e.id);
          const rsvps = await apiFetch(`/events/rsvps?eventIds=${ids.join(',')}`);
          setMyRsvpSet(new Set(
            (rsvps || []).filter(r => r.user_id === user.id).map(r => r.event_id)
          ));
        }
      } catch (err) {
        console.error('Failed to load weekly events:', err);
      }
      setStatus('ready');
    }
    init();
  }, []);

  useEffect(() => {
    if (viewMode !== 'month' || !userId) return;
    let cancelled = false;
    async function fetchMonthly() {
      setMonthlyLoading(true);
      try {
        const profile = await apiFetch('/me/profile');
        const memberList = profile?.member_list || [];
        if (!memberList.length) {
          if (!cancelled) { setMonthlyEvents([]); setMonthlyLoading(false); }
          return;
        }
        const settled = await Promise.allSettled(
          memberList.map(clubId =>
            apiFetch(`/clubs/${clubId}/events/monthly?year=${displayYear}&month=${displayMonth}`)
              .then(evts => (evts || []).map(e => ({ ...e, club_id: clubId })))
          )
        );
        if (cancelled) return;
        const allEvents = settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
        setMonthlyEvents(allEvents);
        if (allEvents.length) {
          const ids = allEvents.map(e => e.id);
          const rsvps = await apiFetch(`/events/rsvps?eventIds=${ids.join(',')}`);
          if (!cancelled) {
            setMonthlyMyRsvpSet(new Set(
              (rsvps || []).filter(r => r.user_id === userId).map(r => r.event_id)
            ));
          }
        }
      } catch (err) {
        console.error('Monthly events fetch failed:', err);
      } finally {
        if (!cancelled) setMonthlyLoading(false);
      }
    }
    fetchMonthly();
    return () => { cancelled = true; };
  }, [viewMode, displayYear, displayMonth, userId]);

  const handleWeeklyRsvp = async (eventId, isGoing) => {
    const event = weeklyEvents.find(e => e.id === eventId);
    if (!event?.club_id) return;
    try {
      if (isGoing) {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'DELETE' });
        setMyRsvpSet(prev => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'POST' });
        setMyRsvpSet(prev => new Set([...prev, eventId]));
      }
    } catch (err) { console.error('Weekly RSVP failed:', err); }
  };

  const handleMonthlyRsvp = async (eventId, isGoing) => {
    const event = monthlyEvents.find(e => e.id === eventId);
    if (!event?.club_id) return;
    try {
      if (isGoing) {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'DELETE' });
        setMonthlyMyRsvpSet(prev => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'POST' });
        setMonthlyMyRsvpSet(prev => new Set([...prev, eventId]));
      }
    } catch (err) { console.error('Monthly RSVP failed:', err); }
  };

  const today = startOfDay(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const dayEvents = weeklyEvents
      .filter(e => isSameDay(parseISO(e.start_time), date))
      .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
    return { date, label: format(date, 'EEE'), sublabel: format(date, 'd'), isToday: i === 0, events: dayEvents };
  });

  const monthlyEventsByDay = new Map();
  for (const event of monthlyEvents) {
    const d = parseISO(event.start_time);
    if (d.getFullYear() === displayYear && d.getMonth() + 1 === displayMonth) {
      const dayNum = d.getDate();
      if (!monthlyEventsByDay.has(dayNum)) monthlyEventsByDay.set(dayNum, []);
      monthlyEventsByDay.get(dayNum).push(event);
    }
  }
  for (const [, evts] of monthlyEventsByDay) evts.sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  function navigateMonth(delta) {
    const d = new Date(displayYear, displayMonth - 1 + delta, 1);
    setDisplayYear(d.getFullYear());
    setDisplayMonth(d.getMonth() + 1);
    setSelectedDay(null);
  }

  function getMonthGrid() {
    const firstDay = new Date(displayYear, displayMonth - 1, 1);
    const offset = getDay(firstDay);
    const totalDays = getDaysInMonth(firstDay);
    return [...Array(offset).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  }

  function getDayClass(dayNum) {
    const date = new Date(displayYear, displayMonth - 1, dayNum);
    const hasEvents = monthlyEventsByDay.has(dayNum);
    if (isBefore(date, today)) return 'cal-day-past';
    if (isToday(date)) return hasEvents ? 'cal-day-today-events' : 'cal-day-today';
    return hasEvents ? 'cal-day-has-events' : 'cal-day-normal';
  }

  const cells = getMonthGrid();
  const monthDisplayDate = new Date(displayYear, displayMonth - 1, 1);
  const selectedDayEvents = selectedDay ? (monthlyEventsByDay.get(selectedDay) || []) : [];

  if (status === 'loading') {
    return (
      <div className="calpg-card">
        <p className="cal-loading">Loading events…</p>
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <div className="calpg-card">
        <button className="calpg-close" onClick={onClose}>✕</button>
        <p className="cal-unauthed-msg">Sign in to see your club events.</p>
      </div>
    );
  }

  const headerDate = viewMode === 'month' ? monthDisplayDate : today;

  return (
    <>
      <div className="calpg-card">
        <button className="calpg-close" onClick={onClose}>✕</button>


        <div className="calpg-header">
          <div className="calpg-tree-wrap">
            <img src={treeImg} alt="" className="calpg-tree-img" />
          </div>
          <div className="calpg-month-row">
            <h1 className="calpg-month">
              <span className="calpg-month-full">{format(headerDate, 'MMMM')}</span>
              <span className="calpg-month-abbr">{format(headerDate, 'MMM').toUpperCase()}</span>
            </h1>
            {viewMode === 'month' && (
              <div className="cal-month-nav">
                <button className="cal-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
                <button className="cal-nav-btn" onClick={() => navigateMonth(1)}>›</button>
              </div>
            )}
          </div>
        </div>

        {viewMode === 'week' && (
          <div
            className="calendar-container"
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {weekDays.map(day => (
              <div key={day.date.toISOString()} className={`calendar-day${day.isToday ? ' today' : ''}`}>
                <div className="day-title-number calpg-day-title">
                  <span className="calpg-day-label">{day.label}</span>
                  <span className="calpg-day-num">{day.sublabel}</span>
                </div>
                {day.events.length === 0 ? (
                  <p>No events</p>
                ) : (
                  day.events.map(event => (
                    <div key={event.id} className="calendar-event">
                      {event.event_image_url && <img className="club-img" src={event.event_image_url} alt="" />}
                      <div className="club-name">{event.club_name}</div>
                      <div className="event-description">
                        <p>about<span className="club-info">{event.event_description}</span></p>
                      </div>
                      <div>
                        <span>time </span>
                        <span className="club-info">
                          {format(parseISO(event.start_time), 'h:mm a')} – {format(parseISO(event.end_time), 'h:mm a')}
                        </span>
                      </div>
                      {userId && event.club_id && (
                        <button
                          className="rsvp-button"
                          onClick={() => handleWeeklyRsvp(event.id, myRsvpSet.has(event.id))}
                        >
                          {myRsvpSet.has(event.id) ? 'Going ✓' : "I'm going!"}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'month' && (
          monthlyLoading ? (
            <p className="cal-loading">Loading…</p>
          ) : (
            <div className="cal-grid">
              {WEEK_DAYS.map((d, i) => <div key={i} className="cal-weekday-label">{d}</div>)}
              {cells.map((dayNum, i) => (
                <div
                  key={i}
                  className={`cal-day-cell${dayNum ? ` ${getDayClass(dayNum)}` : ' cal-day-empty'}`}
                  onClick={dayNum && monthlyEventsByDay.has(dayNum) ? () => setSelectedDay(dayNum) : undefined}
                >
                  {dayNum || ''}
                </div>
              ))}
            </div>
          )
        )}

        {selectedDay !== null && (
          <div className="cal-overlay-backdrop" onClick={() => setSelectedDay(null)}>
            <div className="cal-overlay-portrait" onClick={e => e.stopPropagation()}>
              <button className="cal-overlay-close" onClick={() => setSelectedDay(null)}>✕</button>
              <h2 className="cal-overlay-date">
                {format(new Date(displayYear, displayMonth - 1, selectedDay), 'EEEE, MMMM d')}
              </h2>
              <div className="cal-portrait-scroll">
                {selectedDayEvents.map(event => (
                  <div key={event.id} className="cal-portrait-event">
                    <div className="cal-portrait-img-wrap">
                      {event.event_image_url ? (
                        <img src={event.event_image_url} alt="Event" className="cal-portrait-img" />
                      ) : (
                        <img src="/raccoon_pfp.png" className="cal-portrait-img" alt="" />
                      )}
                    </div>
                    <div className="cal-portrait-info">
                      <p className="cal-overlay-desc">{event.event_description}</p>
                      <p className="cal-overlay-time">
                        {format(parseISO(event.start_time), 'h:mm a')} – {format(parseISO(event.end_time), 'h:mm a')}
                      </p>
                      {userId && event.club_id && (
                        <button
                          className="rsvp-button"
                          onClick={() => handleMonthlyRsvp(event.id, monthlyMyRsvpSet.has(event.id))}
                        >
                          {monthlyMyRsvpSet.has(event.id) ? 'Going ✓' : "I'm going!"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="calpg-toggle-btn"
        type="button"
        onClick={() => setViewMode(v => (v === 'week' ? 'month' : 'week'))}
      >
        {viewMode === 'week' ? 'Week' : 'Month'}
      </button>
    </>
  );
}

export default React.memo(CalendarModule);
