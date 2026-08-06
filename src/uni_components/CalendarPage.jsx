import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  startOfDay, addDays, format, isSameDay, parseISO,
  getDay, getDaysInMonth, isToday, isBefore,
} from 'date-fns';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import '../club_page_components/CalendarModule.css';
import './CalendarPage.css';
import treeImg from '/src/assets/tree.png';
import borderImg from '../assets/border.svg';
import borderHorizontalImg from '../assets/border-horizontal.svg';

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
  const [nextMonthlyEvents, setNextMonthlyEvents] = useState([]);
  const [nextMonthlyMyRsvpSet, setNextMonthlyMyRsvpSet] = useState(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null); // { year, month, day } | null

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
    const nextDate = new Date(displayYear, displayMonth, 1); // displayMonth is 1-based, so this rolls to next month
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = nextDate.getMonth() + 1;

    async function fetchClubEventsForMonth(memberList, year, month) {
      const settled = await Promise.allSettled(
        memberList.map(clubId =>
          apiFetch(`/clubs/${clubId}/events/monthly?year=${year}&month=${month}`)
            .then(evts => (evts || []).map(e => ({ ...e, club_id: clubId })))
        )
      );
      return settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
    }

    async function buildRsvpSet(events) {
      if (!events.length) return new Set();
      const ids = events.map(e => e.id);
      const rsvps = await apiFetch(`/events/rsvps?eventIds=${ids.join(',')}`);
      return new Set((rsvps || []).filter(r => r.user_id === userId).map(r => r.event_id));
    }

    async function fetchMonthly() {
      setMonthlyLoading(true);
      try {
        const profile = await apiFetch('/me/profile');
        const memberList = profile?.member_list || [];
        if (!memberList.length) {
          if (!cancelled) {
            setMonthlyEvents([]);
            setNextMonthlyEvents([]);
            setMonthlyLoading(false);
          }
          return;
        }
        const [currentEvents, nextEvents] = await Promise.all([
          fetchClubEventsForMonth(memberList, displayYear, displayMonth),
          fetchClubEventsForMonth(memberList, nextYear, nextMonthNum),
        ]);
        if (cancelled) return;
        setMonthlyEvents(currentEvents);
        setNextMonthlyEvents(nextEvents);
        const [currentRsvp, nextRsvp] = await Promise.all([
          buildRsvpSet(currentEvents),
          buildRsvpSet(nextEvents),
        ]);
        if (!cancelled) {
          setMonthlyMyRsvpSet(currentRsvp);
          setNextMonthlyMyRsvpSet(nextRsvp);
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

  const handleMonthlyRsvpFor = (eventsPool, setRsvpSet) => async (eventId, isGoing) => {
    const event = eventsPool.find(e => e.id === eventId);
    if (!event?.club_id) return;
    try {
      if (isGoing) {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'DELETE' });
        setRsvpSet(prev => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await apiFetch(`/clubs/${event.club_id}/events/${eventId}/rsvp`, { method: 'POST' });
        setRsvpSet(prev => new Set([...prev, eventId]));
      }
    } catch (err) { console.error('Monthly RSVP failed:', err); }
  };
  const handleMonthlyRsvp = handleMonthlyRsvpFor(monthlyEvents, setMonthlyMyRsvpSet);
  const handleNextMonthlyRsvp = handleMonthlyRsvpFor(nextMonthlyEvents, setNextMonthlyMyRsvpSet);

  function buildEventsByDay(events, year, month) {
    const map = new Map();
    for (const event of events) {
      const d = parseISO(event.start_time);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        const dayNum = d.getDate();
        if (!map.has(dayNum)) map.set(dayNum, []);
        map.get(dayNum).push(event);
      }
    }
    for (const [, evts] of map) evts.sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
    return map;
  }

  function navigateMonth(delta) {
    const d = new Date(displayYear, displayMonth - 1 + delta, 1);
    setDisplayYear(d.getFullYear());
    setDisplayMonth(d.getMonth() + 1);
    setSelectedDayInfo(null);
  }

  function getMonthGrid(year, month) {
    const firstDay = new Date(year, month - 1, 1);
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

  const monthDisplayDate = new Date(displayYear, displayMonth - 1, 1);
  const nextMonthDate = new Date(displayYear, displayMonth, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonthNum = nextMonthDate.getMonth() + 1;

  const monthlyEventsByDay = buildEventsByDay(monthlyEvents, displayYear, displayMonth);
  const nextMonthlyEventsByDay = buildEventsByDay(nextMonthlyEvents, nextYear, nextMonthNum);

  const cells = getMonthGrid(displayYear, displayMonth);
  const nextCells = getMonthGrid(nextYear, nextMonthNum);

  const isSelectedInNextMonth = selectedDayInfo && selectedDayInfo.year === nextYear && selectedDayInfo.month === nextMonthNum;
  const selectedDayEvents = selectedDayInfo
    ? (isSelectedInNextMonth
        ? (nextMonthlyEventsByDay.get(selectedDayInfo.day) || [])
        : (monthlyEventsByDay.get(selectedDayInfo.day) || []))
    : [];
  const selectedDayRsvpSet = isSelectedInNextMonth ? nextMonthlyMyRsvpSet : monthlyMyRsvpSet;
  const selectedDayRsvpHandler = isSelectedInNextMonth ? handleNextMonthlyRsvp : handleMonthlyRsvp;

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

  const headerDate = viewMode === 'month' ? monthDisplayDate : todayDate;

  return (
    <>
      <div className="calpg-card">
        <button className="calpg-close" onClick={onClose}>✕</button>
        <div className="calpg-header">
          <div className="calpg-tree-wrap">
            <img src={treeImg} alt="" className="calpg-tree-img" />
          </div>
          <div className={`calpg-month-row calpg-align-row${viewMode === 'month' ? ' calpg-month-row-monthly' : ''}`}>
            <h1 className={`calpg-month${viewMode === 'month' ? ' calpg-month-monthly' : ''}`}>
              <span className="calpg-month-full">{format(headerDate, 'MMMM')}</span>
              <span className="calpg-month-abbr">{format(headerDate, 'MMM').toUpperCase()}</span>
              {viewMode === 'month' && (
                <span className="calpg-month-range">
                  {format(monthDisplayDate, 'MMMM')} – {format(nextMonthDate, 'MMMM')}
                </span>
              )}
            </h1>
              <div className="cal-month-nav">
                <button className="cal-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
                <button className="cal-nav-btn" onClick={() => navigateMonth(1)}>›</button>
              </div>
          </div>
        </div>
        {viewMode === 'week' && (
          <div
            className="calendar-container calpg-week-row"
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {weekDays.map(day => (
              <div key={day.date.toISOString()} className={`calendar-day calpg-week-day${day.isToday ? ' today' : ''}`}>
                <div className="day-title-number calpg-day-title">
                  <span className="calpg-day-label">{day.label}</span>
                  <span className="calpg-day-num">{day.sublabel}</span>
                </div>
                {day.events.length === 0 ? (
                  <p>No events</p>
                ) : (
                  day.events.map(event => (
                    <div key={event.id} className="calendar-event">
                      {event.image_url && <img className="club-img" src={event.image_url} alt="" />}
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
            <div className="calpg-align-row calpg-dual-grid-row">
              <div className="cal-grid calpg-grid-panel">
                {WEEK_DAYS.map((d, i) => <div key={i} className="cal-weekday-label calpg-weekday-label">{d}</div>)}
                {cells.map((dayNum, i) => (
                  <div
                    key={i}
                    className={`cal-day-cell${dayNum ? ` ${getDayClass(displayYear, displayMonth, dayNum, monthlyEventsByDay)}` : ' cal-day-empty'}`}
                    onClick={dayNum && monthlyEventsByDay.has(dayNum) ? () => setSelectedDayInfo({ year: displayYear, month: displayMonth, day: dayNum }) : undefined}
                  >
                    {dayNum || ''}
                  </div>
                ))}
              </div>
              <div className="calpg-grid-divider" aria-hidden="true" />
              <div className="cal-grid calpg-grid-panel calpg-grid-panel-next">
                {WEEK_DAYS.map((d, i) => <div key={`next-${i}`} className="cal-weekday-label calpg-weekday-label">{d}</div>)}
                {nextCells.map((dayNum, i) => (
                  <div
                    key={i}
                    className={`cal-day-cell${dayNum ? ` ${getDayClass(nextYear, nextMonthNum, dayNum, nextMonthlyEventsByDay)}` : ' cal-day-empty'}`}
                    onClick={dayNum && nextMonthlyEventsByDay.has(dayNum) ? () => setSelectedDayInfo({ year: nextYear, month: nextMonthNum, day: dayNum }) : undefined}
                  >
                    {dayNum || ''}
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {selectedDayInfo !== null && (
          <div className="cal-overlay-backdrop" onClick={() => setSelectedDayInfo(null)}>
            <div className="cal-overlay-portrait" onClick={e => e.stopPropagation()}>
              <button className="cal-overlay-close" onClick={() => setSelectedDayInfo(null)}>✕</button>
              <h2 className="cal-overlay-date">
                {format(new Date(selectedDayInfo.year, selectedDayInfo.month - 1, selectedDayInfo.day), 'EEE d').toUpperCase()}
              </h2>
              <div className="cal-portrait-scroll">
                {selectedDayEvents.map(event => (
                  <div key={event.id} className="cal-portrait-event">
                    <div className="cal-portrait-img-wrap">
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-left" />
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-right" />
                      <div
                        className="cal-portrait-card-border-h cal-portrait-card-border-h-top"
                        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                      />
                      <div
                        className="cal-portrait-card-border-h cal-portrait-card-border-h-bottom"
                        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                      />
                      {event.event_image_url ? (
                        <img src={event.event_image_url} alt="Event" className="cal-portrait-img" />
                      ) : (
                        <img src="/raccoon_pfp.png" className="cal-portrait-img" alt="" />
                      )}
                    </div>
                    <div className="cal-portrait-info">
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-left" />
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-right" />
                      <div
                        className="cal-portrait-card-border-h cal-portrait-card-border-h-bottom"
                        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                      />
                      <p className="cal-overlay-desc">{event.event_description}</p>
                      <p className="cal-overlay-time">
                        {format(parseISO(event.start_time), 'h:mm a')} – {format(parseISO(event.end_time), 'h:mm a')}
                      </p>
                      {userId && event.club_id && (
                        <button
                          className="rsvp-button"
                          onClick={() => selectedDayRsvpHandler(event.id, selectedDayRsvpSet.has(event.id))}
                        >
                          {selectedDayRsvpSet.has(event.id) ? 'Going ✓' : "I'm going!"}
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
        {viewMode === 'week' ? 'Month' : 'Week'}
      </button>
    </>
  );
}

export default React.memo(CalendarPage);
