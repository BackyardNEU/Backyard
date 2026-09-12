import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { format, parseISO } from 'date-fns';
import borderImg from '../assets/border.svg';
import borderHorizontalImg from '../assets/border-horizontal.svg';
import FriendRsvpCallout from '../components/FriendRsvpCallout';
import { apiFetch } from '../lib/api';
import Avatar from '../components/Avatar';
import { useClubData } from '../context/useClubData';
import PortraitTitle from '../uni_components/PortraitTitle';
import './CalendarModule.css';

/**
 * Calendar / Events module — "Coming Up" list. Same card layout as AddEventPanel
 * (More/Less expand with Where/When/About rows); read-only except for RSVP.
 *
 * @param {Object}   club              - club record (used for its image_url)
 * @param {boolean}  editing           - page edit mode
 * @param {Function} onChange          - (updatedData) => void
 * @param {string}   warning           - displays a warning for invalid fields
 * @param {Array}    events            - upcoming events fetched by ExpandedTile
 * @param {Set}      myRsvpSet         - event IDs the current user has RSVPd to ('going')
 * @param {Set}      myMaybeSet        - event IDs the current user has marked 'maybe'
 * @param {Map}      friendRsvpMap     - event ID → [{ username, ... }] for going friends
 * @param {Map}      allAttendeesMap   - event ID → { going: [...], maybe: [...] }
 * @param {Function} onRsvp            - (eventId, isCurrentlyGoing) => void
 * @param {Function} onMaybe           - (eventId, isCurrentlyMaybe) => void
 * @param {string}   userId            - null if not logged in
 */
export function CalendarModule({
  club,
  editing,
  warning,
  events = [],
  myRsvpSet = new Set(),
  myMaybeSet = new Set(),
  friendRsvpMap = new Map(),
  onRsvp,
  onMaybe,
  onEditEvent,
  onDeleteEvent,
  isApproved = false,
  userId,
}) {
  const [overlayEvent, setOverlayEvent] = useState(null);
  const [overlayHasMore, setOverlayHasMore] = useState(false);
  const [attendeesMap, setAttendeesMap] = useState({});

  const [expandedEventIds, setExpandedEventIds] = useState(() => new Set());
  const [cardHeights, setCardHeights] = useState({});
  const cardSlotRefs = useRef({});

  const toggleCardExpanded = (eventId) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  useEffect(() => {
    if (expandedEventIds.size === 0) return;
    const next = {};
    expandedEventIds.forEach((id) => {
      const el = cardSlotRefs.current[id];
      if (el) next[id] = el.scrollHeight;
    });
    setCardHeights((prev) => ({ ...prev, ...next }));
  }, [expandedEventIds]);

  const overlayScrollRef = useRef(null);
  const overlayItemRefs = useRef({});

  useLayoutEffect(() => {
    if (!overlayEvent || !overlayScrollRef.current) return;
    const el = overlayItemRefs.current[overlayEvent.id];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
    const el2 = overlayScrollRef.current;
    setTimeout(() => {
      setOverlayHasMore(el2.scrollHeight - el2.scrollTop - el2.clientHeight > 10);
    }, 50);
  }, [overlayEvent]);

  /*
  const handleOverlayScroll = () => {
    const el = overlayScrollRef.current;
    if (!el) return;
    setOverlayHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 10);
  };

  const fetchAttendees = async (eventId) => {
    if (attendeesMap[eventId] !== undefined) {
      setAttendeesOpenId(prev => prev === eventId ? null : eventId);
      return;
    }
    try {
      const data = await apiFetch(`/clubs/${club.id}/events/${eventId}/attendees`);
      setAttendeesMap(prev => ({ ...prev, [eventId]: data }));
      setAttendeesOpenId(eventId);
    } catch (e) {
      setAttendeesMap(prev => ({ ...prev, [eventId]: [] }));
      setAttendeesOpenId(eventId);
    }
  };
  const openAttendeesOverlay = (event, tab = 'going') => {
    setAttendeesEvent(event);
    setAttendeesTab(tab);
  };
  */

  const sorted = [...events].sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  // ── action buttons ─────────────────────────────────────────────────────────

  function RsvpButtons({ event }) {
    const isGoing = myRsvpSet.has(event.id);
    const isMaybe = myMaybeSet.has(event.id);
    if (!userId) return null;
    return (
      <div className="cal-action-row">
        <button
          className={`rsvp-button${isGoing ? ' rsvp-going' : ''}`}
          onClick={() => onRsvp?.(event.id, isGoing)}
        >
          {isGoing ? 'Interested ✓' : 'Interested'}
        </button>
        <button
          className={`rsvp-button rsvp-maybe${isMaybe ? ' rsvp-maybe--active' : ''}`}
          onClick={() => onMaybe?.(event.id, isMaybe)}
        >
          {isMaybe ? 'Maybe ✓' : 'Maybe'}
        </button>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
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
            const isExpanded = expandedEventIds.has(event.id);

            return (
              <div
                key={event.id}
                className="cal-add-slot"
                ref={(el) => { cardSlotRefs.current[event.id] = el; }}
                style={isExpanded && cardHeights[event.id] ? { maxHeight: `${cardHeights[event.id]}px` } : undefined}
              >
                <div className="add-event-card">
                  <img src={borderImg} alt="" className="add-event-card-border add-event-card-border-left" />
                  <img src={borderImg} alt="" className="add-event-card-border add-event-card-border-right" />
                  <div
                    className="add-event-card-border-h add-event-card-border-h-top"
                    style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                  />
                  <div
                    className="add-event-card-border-h add-event-card-border-h-bottom"
                    style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                  />

                  {isApproved && (
                    <div className="add-event-card-actions">
                      <button
                        type="button"
                        className="cal-image-scale-btn"
                        onClick={(e) => { e.stopPropagation(); onEditEvent?.(event); }}
                        aria-label="Edit event"
                      >EDIT</button>
                      <button
                        type="button"
                        className="cal-image-remove-btn"
                        onClick={(e) => { e.stopPropagation(); onDeleteEvent?.(event.id); }}
                        aria-label="Delete event"
                      >DELETE</button>
                    </div>
                  )}

                  <img
                    className={`add-event-card-img${!event.event_image_url ? ' add-event-card-img--default' : ''}`}
                    src={event.event_image_url || club?.image_url || '/rac7.0.png'}
                    alt=""
                    onClick={() => toggleCardExpanded(event.id)}
                    style={{ cursor: 'pointer' }}
                  />

                  {isExpanded ? (
                    <div className="add-event-card-body">
                      <PortraitTitle text={event.event_name} />
                      {event.where && (
                        <p className="cal-info-row">
                          <span className="cal-info-label">Where: </span>
                          <span className="cal-info-value">{event.where}</span>
                        </p>
                      )}
                      <p className="cal-info-row">
                        <span className="cal-info-label">When: </span>
                        <span className="cal-info-value">
                          {format(start, 'EEE MMM d')} {format(start, 'h:mm a')}–{format(end, 'h:mm a')}
                        </span>
                      </p>
                      {event.event_description && (
                        <p className="cal-info-row">
                          <span className="cal-info-label">About: </span>
                          <span className="cal-info-value">{event.event_description}</span>
                        </p>
                      )}
                      {event.is_members_only && (
                        <span className="cal-members-badge">Members only</span>
                      )}
                      <FriendRsvpCallout friends={friends} />
                      <RsvpButtons event={event} />
                      <div className="add-event-card-toggle-row">
                        <button
                          type="button"
                          className="add-event-expand-btn"
                          onClick={() => toggleCardExpanded(event.id)}
                        >
                          Less
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="add-event-card-body"
                      onClick={() => toggleCardExpanded(event.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <p className="add-event-card-date">{format(start, 'EEE, MMM d').toUpperCase()}</p>
                      <PortraitTitle text={event.event_name} />
                      <div className="add-event-card-toggle-row">
                        <button
                          type="button"
                          className="add-event-expand-btn"
                          onClick={(e) => { e.stopPropagation(); toggleCardExpanded(event.id); }}
                        >
                          More
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default React.memo(CalendarModule);
