import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  startOfDay, addDays, format, isSameDay, parseISO,
  getDay, getDaysInMonth, isToday, isBefore,
} from 'date-fns';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import '../club_page_components/CalendarModule.css';
import './CalendarPage.css';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  console.log('weeklyEvents:', weeklyEvents);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(todayDate, i);
      const dayEvents = weeklyEvents
        .filter(e => isSameDay(parseISO(e.start_time), date))
        .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
      return { date, label: format(date, 'EEE'), sublabel: format(date, 'd'), isToday: i === 0, events: dayEvents };
    });
  }, [weeklyEvents, todayDate]);

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
    if (isBefore(date, todayDate)) return 'cal-day-past';
    if (isToday(date)) return hasEvents ? 'cal-day-today-events' : 'cal-day-today';
    return hasEvents ? 'cal-day-has-events' : 'cal-day-normal';
  }

  const cells = getMonthGrid();
  const monthDisplayDate = new Date(displayYear, displayMonth - 1, 1);
  const selectedDayEvents = selectedDay ? (monthlyEventsByDay.get(selectedDay) || []) : [];

  if (status === 'loading') {
    return (
      <div className="cal-page-overlay">
        <div className="cal-page-card">
          <p className="cal-loading">Loading events…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <div className="cal-page-overlay" onClick={onClose}>
        <div className="cal-page-card" onClick={e => e.stopPropagation()}>
          <button className="cal-page-close" onClick={onClose}>✕</button>
          <p className="cal-unauthed-msg">Sign in to see your club events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cal-page-overlay" onClick={onClose}>
      <div className="cal-page-card" onClick={e => e.stopPropagation()}>
        <button className="cal-page-close" onClick={onClose}>✕</button>

        <p className="divider-header">Events</p>

        <div className="cal-view-toggle">
          <button
            className={`cal-toggle-btn${viewMode === 'week' ? ' cal-toggle-active' : ''}`}
            onClick={() => setViewMode('week')}
          >Week</button>
          <button
            className={`cal-toggle-btn${viewMode === 'month' ? ' cal-toggle-active' : ''}`}
            onClick={() => setViewMode('month')}
          >Month</button>
        </div>

        {viewMode === 'week' && (
          <>
            <h1 className="current-month">{format(todayDate, 'MMMM')}</h1>
            <div
              className="calendar-container"
              ref={containerRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {weekDays.map(day => (
                <div key={day.date.toISOString()} className={`calendar-day${day.isToday ? ' today' : ''}`}>
                  <div className="day-title-number">
                    <span>{day.label}</span>
                    <span>{day.sublabel}</span>
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
          </>
        )}

        {viewMode === 'month' && (
          <div className="cal-monthly-card">
            <div className="cal-monthly-tree">
              <img src="/raccoon_pfp.png" alt="seasonal tree" className="cal-tree-img" />
            </div>
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
            )}
          </div>
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
    </div>
  );
}

export default React.memo(CalendarPage);
