import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  startOfDay, addDays, format, isSameDay, parseISO,
  getDay, getDaysInMonth, isToday, isBefore,
} from 'date-fns';
import ColorThief from 'colorthief';
import { apiFetch } from '../lib/api';
import { useClubData } from '../context/useClubData';
import { prefetchCalendar, readCalendar } from '../lib/calendarCache';
import { Skeleton, SkeletonRegion } from '../components/Skeleton';
import '../club_page_components/CalendarModule.css';
import './CalendarPage.css';
import './EventInfoRow.css';
import PortraitTitle from './PortraitTitle';
import treeImg from '/src/assets/tree.png';
import borderImg from '../assets/border.svg';
import borderHorizontalImg from '../assets/border-horizontal.svg';
import minimizedPosterActiveIcon from '../assets/Minimized_poster_icon_active.png';
import minimizedPosterInactiveIcon from '../assets/Minimized_poster_icon_inactive.png';
import maximizedPosterActiveIcon from '../assets/Maximized_poster_icon_active.png';
import maximizedPosterInactiveIcon from '../assets/Maximized_poster_icon_inactive.png';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarPage({ onClose }) {
  const { allData, friendsArray, profile: viewerProfile } = useClubData();
  const clubImageById = useMemo(
    () => new Map(allData.map(club => [club.id, club.image_url])),
    [allData]
  );
  const clubNameById = useMemo(
    () => new Map(allData.map(club => [club.id, club.club_name])),
    [allData]
  );

  // Minimized event rows use the club's own image's dominant color as their
  // background (same pastel-toning technique BasicInfoModule uses for its hero
  // rectangle), keyed by club_id and computed once per club, not per event.
  const [dominantColorByClubId, setDominantColorByClubId] = useState({});

  const todayDate = startOfDay(new Date());

  // Warmed by prefetchCalendar when the calendar button was hovered. Read synchronously
  // during render rather than in an effect — an effect runs after the first paint, so the
  // panel would still flash "Loading events…" before swapping to content, which is the
  // exact seam this removes.
  const warmed = readCalendar();

  const [status, setStatus] = useState(() => {
    if (!warmed) return 'loading';
    return warmed.userId ? 'ready' : 'unauthed';
  });
  const [userId, setUserId] = useState(() => warmed?.userId ?? null);

  const [weeklyEvents, setWeeklyEvents] = useState(() => warmed?.events ?? []);
  const [myRsvpSet, setMyRsvpSet] = useState(() => new Set(
    (warmed?.rsvps ?? [])
      .filter((r) => r.user_id === warmed?.userId)
      .map((r) => r.event_id)
  ));
  const [weeklyRsvps, setWeeklyRsvps] = useState(() => warmed?.rsvps ?? []); // raw { user_id, event_id } rows, so friend RSVPs can be derived alongside myRsvpSet

  useEffect(() => {
    const clubIds = [...new Set(weeklyEvents.map(e => e.club_id).filter(Boolean))];
    const missing = clubIds.filter(id => !(id in dominantColorByClubId) && clubImageById.get(id));
    if (missing.length === 0) return;

    missing.forEach((clubId) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const [r, g, b] = new ColorThief().getColor(img);
          const factor = (r + (255 - r) * 0.85 >= 240 &&
                          g + (255 - g) * 0.85 >= 240 &&
                          b + (255 - b) * 0.85 >= 240) ? 0.5 : 0.85;
          const pastel = `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
          setDominantColorByClubId(prev => ({ ...prev, [clubId]: pastel }));
        } catch {
          setDominantColorByClubId(prev => ({ ...prev, [clubId]: 'rgb(211, 211, 211)' }));
        }
      };
      img.onerror = () => {
        setDominantColorByClubId(prev => ({ ...prev, [clubId]: 'rgb(211, 211, 211)' }));
      };
      img.src = clubImageById.get(clubId);
    });
  }, [weeklyEvents, clubImageById, dominantColorByClubId]);

  // Same derivation ExpandedTile uses for a club page's "X is going" callouts —
  // cross-reference the raw rsvp rows against the current user's friends list.
  const weeklyFriendRsvpMap = useMemo(() => {
    const friendIdSet = new Set(friendsArray.map(f => f.id));
    const friendProfileMap = new Map(friendsArray.map(f => [f.id, f]));
    const map = new Map();
    for (const rsvp of weeklyRsvps) {
      if (friendIdSet.has(rsvp.user_id)) {
        if (!map.has(rsvp.event_id)) map.set(rsvp.event_id, []);
        map.get(rsvp.event_id).push(friendProfileMap.get(rsvp.user_id));
      }
    }
    return map;
  }, [weeklyRsvps, friendsArray]);

  const [viewMode, setViewMode] = useState('week');
  // Week-view-only: whether each event renders as a tall poster card or a
  // shrunken single-line row. Toggled via the two icon buttons above the
  // Week/Month button.
  const [posterSize, setPosterSize] = useState('maximized'); // 'maximized' | 'minimized'

  const [displayYear, setDisplayYear] = useState(todayDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(todayDate.getMonth() + 1);
  const [monthlyEvents, setMonthlyEvents] = useState([]);
  const [monthlyMyRsvpSet, setMonthlyMyRsvpSet] = useState(new Set());
  const [nextMonthlyEvents, setNextMonthlyEvents] = useState([]);
  const [nextMonthlyMyRsvpSet, setNextMonthlyMyRsvpSet] = useState(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  // { type: 'month', year, month, day } | { type: 'week', date: Date } | null
  const [selectedOverlay, setSelectedOverlay] = useState(null);

  const containerRef = useRef(null);
  const handleWheel = useCallback((e) => {
    if (!containerRef.current) return;
    // Only intercept horizontal gestures (trackpad swipe). Let vertical scroll
    // (deltaY dominant, e.g. mouse wheel) pass through to the page.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaX;
    }
  }, []);
  const handleMouseEnter = () => containerRef.current?.addEventListener('wheel', handleWheel, { passive: false });
  const handleMouseLeave = () => containerRef.current?.removeEventListener('wheel', handleWheel);

  // Tracks which day column sits closest to the row's horizontal center as the
  // user scrolls, so its label can highlight the same way the day dots do.
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Populates state when the calendar was opened without a prior hover (keyboard, touch,
  // a very fast click). On a warm cache prefetchCalendar resolves from memory, so this
  // re-sets the same values and nothing flashes.
  //
  // Freshness is handled at the edges rather than by refetching on every open: the TTL is
  // 30s, RSVPs made inside this component update local state directly, and AuthListener
  // drops the cache on sign-in and sign-out — which is the only case where the payload
  // would otherwise belong to a different user.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const data = await prefetchCalendar();
      if (cancelled) return;

      if (!data || !data.userId) {
        setStatus('unauthed');
        return;
      }

      setUserId(data.userId);
      setWeeklyEvents(data.events);
      setWeeklyRsvps(data.rsvps);
      setMyRsvpSet(new Set(
        data.rsvps.filter((r) => r.user_id === data.userId).map((r) => r.event_id)
      ));
      setStatus('ready');
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(todayDate, i);
      const dayEvents = weeklyEvents
        .filter(e => isSameDay(parseISO(e.start_time), date))
        .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
      return { date, label: format(date, 'EEE'), fullLabel: format(date, 'EEEE'), sublabel: format(date, 'd'), isToday: i === 0, events: dayEvents };
    });
  }, [weeklyEvents, todayDate]);

  useEffect(() => {
    const row = containerRef.current;
    if (!row || viewMode !== 'week') return;
    let ticking = false;
    const updateActiveDay = () => {
      const dayEls = row.querySelectorAll('.calpg-week-day');
      // Below 700px .calpg-week-row has scroll padding sized so the first/last
      // day can actually reach true center — nearest-to-center math alone is
      // enough. Above that breakpoint there's no such padding, so the
      // first/last day's center can never reach the row's center; clamp it
      // at either scroll extreme instead.
      if (window.innerWidth > 700) {
        const maxScroll = row.scrollWidth - row.clientWidth;
        if (row.scrollLeft <= 1) {
          setActiveDayIndex(0);
          ticking = false;
          return;
        }
        if (row.scrollLeft >= maxScroll - 1) {
          setActiveDayIndex(dayEls.length - 1);
          ticking = false;
          return;
        }
      }
      const rowRect = row.getBoundingClientRect();
      const center = rowRect.left + rowRect.width / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;
      dayEls.forEach((dayEl, i) => {
        const rect = dayEl.getBoundingClientRect();
        const distance = Math.abs(center - (rect.left + rect.width / 2));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      });
      setActiveDayIndex(closestIndex);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateActiveDay);
        ticking = true;
      }
    };
    updateActiveDay();
    row.addEventListener('scroll', onScroll);
    return () => row.removeEventListener('scroll', onScroll);
  }, [viewMode, weekDays]);

  useEffect(() => {
    if (viewMode !== 'month' || !userId) return;
    let cancelled = false;
    const nextDate = new Date(displayYear, displayMonth, 1); // displayMonth is 1-based, so this rolls to next month
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = nextDate.getMonth() + 1;

    // One batched request instead of one per club. Fanning out client-side meant a user
    // in N clubs fired 2N requests every time this view opened, which was a large part of
    // what tripped the rate limiter.
    async function fetchClubEventsForMonth(memberList, year, month) {
      const events = await apiFetch(
        `/clubs/events/monthly-batch?clubIds=${memberList.join(',')}&year=${year}&month=${month}`
      );
      return events || [];
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
        // member_list comes from the shared profile; this used to be yet another
        // /me/profile request, fired every time the month view opened.
        const memberList = viewerProfile?.member_list || [];
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
  }, [viewMode, displayYear, displayMonth, userId, viewerProfile]);

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
    setSelectedOverlay(null);
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

  const isWeekOverlay = selectedOverlay?.type === 'week';
  const isSelectedInNextMonth = selectedOverlay?.type === 'month' && selectedOverlay.year === nextYear && selectedOverlay.month === nextMonthNum;
  const selectedDayEvents = !selectedOverlay
    ? []
    : isWeekOverlay
      ? (weekDays.find(d => isSameDay(d.date, selectedOverlay.date))?.events || [])
      : (isSelectedInNextMonth
          ? (nextMonthlyEventsByDay.get(selectedOverlay.day) || [])
          : (monthlyEventsByDay.get(selectedOverlay.day) || []));
  const selectedDayFriendRsvpMap = isWeekOverlay ? weeklyFriendRsvpMap : new Map();
  const selectedDayRsvpSet = isWeekOverlay ? myRsvpSet : (isSelectedInNextMonth ? nextMonthlyMyRsvpSet : monthlyMyRsvpSet);
  const selectedDayRsvpHandler = isWeekOverlay ? handleWeeklyRsvp : (isSelectedInNextMonth ? handleNextMonthlyRsvp : handleMonthlyRsvp);
  const selectedOverlayDate = !selectedOverlay
    ? null
    : isWeekOverlay
      ? selectedOverlay.date
      : new Date(selectedOverlay.year, selectedOverlay.month - 1, selectedOverlay.day);

  if (status === 'loading') {
    return (
      <SkeletonRegion className="calpg-card" label="Loading events">
        <div className="calendar-container">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="cal-day-col">
              <Skeleton width="60%" height="1rem" style={{ margin: '0 auto 12px' }} />
              <Skeleton height="9rem" radius={4} />
            </div>
          ))}
        </div>
      </SkeletonRegion>
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
        <div className="calpg-header">
          <button className="calpg-close" onClick={onClose}>✕</button>
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
            {weekDays.map((day, i) => (
              <div key={day.date.toISOString()} className={`calendar-day calpg-week-day${day.isToday ? ' today' : ''}`}>
                <div className="day-title-number calpg-day-title">
                  <span className={`calpg-day-label${i === activeDayIndex ? ' calpg-day-label--active' : ''}`}>
                    <span className="calpg-day-full">{day.fullLabel}</span>
                    <span className="calpg-day-abbr">{day.label}</span>
                  </span>
                  <span className={`calpg-day-num${i === activeDayIndex ? ' calpg-day-num--active' : ''}`}>{day.sublabel}</span>
                </div>
                <div className={`calpg-week-day-events${i === activeDayIndex ? ' calpg-week-day-events--active' : ''}`}>
                {day.events.length === 0 ? (
                  <p>No events</p>
                ) : (
                  day.events.map(event => {
                    const clubName = event.club_name || clubNameById.get(event.club_id) || '';
                    const eventName = event.event_name || '';
                    const titleText = clubName && eventName
                      ? `${clubName} • ${eventName}`
                      : (clubName || eventName);
                    const friends = weeklyFriendRsvpMap.get(event.id);
                    const posterUrl = event.event_image_url || event.image_url || clubImageById.get(event.club_id);
                    const isMinimized = posterSize === 'minimized';
                    return (
                      <button
                        type="button"
                        key={event.id}
                        className={`calendar-event${isMinimized ? ' calendar-event--minimized' : ''}`}
                        style={isMinimized ? { '--dominant-color': dominantColorByClubId[event.club_id] || 'rgb(211, 211, 211)' } : undefined}
                        onClick={() => setSelectedOverlay({ type: 'week', date: day.date })}
                      >
                        {isMinimized ? (
                          <div className="calendar-event-min-row">
                            <img
                              src={posterUrl || '/raccoon_pfp.png'}
                              alt=""
                              className={`calendar-event-min-thumb${posterUrl ? '' : ' calendar-event-min-thumb--default'}`}
                            />
                            <PortraitTitle text={titleText} />
                          </div>
                        ) : (
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
                            <img
                              src={posterUrl || '/raccoon_pfp.png'}
                              alt=""
                              className={`cal-portrait-img${posterUrl ? '' : ' cal-portrait-img--default'}`}
                            />
                            <PortraitTitle text={titleText} />
                            {friends && friends.length > 0 && (
                              <p className="friend-rsvp-callout">
                                {friends.length === 1
                                  ? `${friends[0].username} is going`
                                  : `${friends[0].username} and ${friends.length - 1} ${friends.length - 1 === 1 ? 'other' : 'others'} you know are going`}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
                </div>
              </div>
            ))}
          </div>
        )}
        {viewMode === 'month' && (
          monthlyLoading ? (
            <SkeletonRegion label="Loading month">
              <Skeleton height="14rem" radius={4} />
            </SkeletonRegion>
          ) : (
            <div className="calpg-align-row calpg-dual-grid-row">
              <div className="cal-grid calpg-grid-panel">
                {WEEK_DAYS.map((d, i) => <div key={i} className="cal-weekday-label calpg-weekday-label">{d}</div>)}
                {cells.map((dayNum, i) => (
                  <div
                    key={i}
                    className={`cal-day-cell${dayNum ? ` ${getDayClass(displayYear, displayMonth, dayNum, monthlyEventsByDay)}` : ' cal-day-empty'}`}
                    onClick={dayNum && monthlyEventsByDay.has(dayNum) ? () => setSelectedOverlay({ type: 'month', year: displayYear, month: displayMonth, day: dayNum }) : undefined}
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
                    onClick={dayNum && nextMonthlyEventsByDay.has(dayNum) ? () => setSelectedOverlay({ type: 'month', year: nextYear, month: nextMonthNum, day: dayNum }) : undefined}
                  >
                    {dayNum || ''}
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {selectedOverlay !== null && (
          <div className="cal-overlay-backdrop" onClick={() => setSelectedOverlay(null)}>
            <div className="cal-overlay-portrait" onClick={e => e.stopPropagation()}>
              <button className="cal-overlay-close" onClick={() => setSelectedOverlay(null)}>✕</button>
              <h2 className="cal-overlay-date">
                {format(selectedOverlayDate, 'EEE d').toUpperCase()}
              </h2>
              <div className="cal-portrait-scroll">
                {selectedDayEvents.map(event => {
                  const clubName = event.club_name || clubNameById.get(event.club_id) || '';
                  const eventName = event.event_name || '';
                  const titleText = clubName && eventName
                    ? `${clubName} • ${eventName}`
                    : (clubName || eventName);
                  const friends = selectedDayFriendRsvpMap.get(event.id);
                  const posterUrl = event.event_image_url || event.image_url || clubImageById.get(event.club_id);
                  return (
                  <div key={event.id} className="cal-portrait-event">
                    <div className="cal-portrait-img-wrap">
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-left" />
                      <img src={borderImg} alt="" className="cal-portrait-card-border cal-portrait-card-border-right" />
                      <div
                        className="cal-portrait-card-border-h cal-portrait-card-border-h-top"
                        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                      />
                      <img
                        src={posterUrl || '/raccoon_pfp.png'}
                        alt="Event"
                        className={`cal-portrait-img${posterUrl ? '' : ' cal-portrait-img--default'}`}
                      />
                    </div>
                    <div className="cal-portrait-info">
                      <img src={borderImg} alt="" className="cal-portrait-info-border cal-portrait-info-border-left" />
                      <img src={borderImg} alt="" className="cal-portrait-info-border cal-portrait-info-border-right" />
                      <div
                        className="cal-portrait-card-border-h cal-portrait-card-border-h-bottom"
                        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                      />
                      <PortraitTitle text={titleText} />
                      {event.where && (
                        <p className="cal-info-row">
                          <span className="cal-info-label">where</span>
                          <span className="cal-info-value">{event.where}</span>
                        </p>
                      )}
                      <p className="cal-info-row">
                        <span className="cal-info-label">when</span>
                        <span className="cal-info-value">
                          {format(parseISO(event.start_time), 'EEE MMM d')} {format(parseISO(event.start_time), 'h:mm a')}–{format(parseISO(event.end_time), 'h:mm a')}
                        </span>
                      </p>
                      {event.event_description && (
                        <p className="cal-info-row">
                          <span className="cal-info-label">about</span>
                          <span className="cal-info-value">{event.event_description}</span>
                        </p>
                      )}
                      {friends && friends.length > 0 && (
                        <p className="friend-rsvp-callout">
                          {friends.length === 1
                            ? `${friends[0].username} is going`
                            : `${friends[0].username} and ${friends.length - 1} ${friends.length - 1 === 1 ? 'other' : 'others'} you know are going`}
                        </p>
                      )}
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
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'week' && (
        <div className="calpg-poster-size-toggle">
          <button
            type="button"
            className="calpg-poster-size-btn"
            aria-label="Minimized poster view"
            aria-pressed={posterSize === 'minimized'}
            onClick={() => setPosterSize('minimized')}
          >
            <img src={posterSize === 'minimized' ? minimizedPosterActiveIcon : minimizedPosterInactiveIcon} alt="" />
          </button>
          <button
            type="button"
            className="calpg-poster-size-btn"
            aria-label="Maximized poster view"
            aria-pressed={posterSize === 'maximized'}
            onClick={() => setPosterSize('maximized')}
          >
            <img src={posterSize === 'maximized' ? maximizedPosterActiveIcon : maximizedPosterInactiveIcon} alt="" />
          </button>
        </div>
      )}

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
