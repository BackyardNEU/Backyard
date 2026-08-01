import React, { useState, useRef, useLayoutEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '../lib/api';
import './CalendarModule.css';

/**
 * Calendar / Events module — simplified "Coming Up" list.
 *
 * data shape: { filterByMembership: boolean }
 * @param {Object}   data          - module data
 * @param {boolean}  editing       - page edit mode
 * @param {boolean}  isApproved    - true for approved club owners; shows add-event form
 * @param {Function} onChange      - (updatedData) => void
 * @param {string}   warning       - displays a warning for invalid fields not entered in by page editor
 * @param {Array}    events        - upcoming events fetched by ExpandedTile, sorted by start_time
 * @param {Set}      myRsvpSet     - event IDs the current user has RSVPd to
 * @param {Map}      friendRsvpMap - event ID → [{ username, ... }]
 * @param {Function} onRsvp        - (eventId, isCurrentlyGoing) => void
 * @param {Function} onAddEvent    - ({ description, startTime, endTime, imageUrl }) => Promise<void>
 * @param {string}   userId        - null if not logged in
 */
export function CalendarModule({
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
  const imageInputRef = useRef(null);

  const [overlayEvent, setOverlayEvent] = useState(null);
  const [overlayHasMore, setOverlayHasMore] = useState(false);
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

  // form for entering data for a new event
  const [showForm, setShowForm] = useState(false);
  // set initial form data to empty
  const [formData, setFormData] = useState({ description: '', date: '', startTime: '', endTime: '', membersOnly: false });
  // image file for form
  const [imageFile, setImageFile] = useState(null);
  // image preview for previewing the event in before posting it
  const [imagePreview, setImagePreview] = useState(null);
  // warning for invalid fields in the form
  const [formWarning, setFormWarning] = useState('');
  // for loading/data saving purposes
  const [isSubmitting, setIsSubmitting] = useState(false);
  // sorting events passed in through events prop by closest to current date
  const sorted = [...events].sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  // ── add-event form helpers ─────────────────────────────────────────────
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

  // simple updater
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  //necessary for when the image in the form changes as we need to change multiple different things
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  //submission handler
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        // request a newly generated uploard url for storage bucket in supabase using signed url for secure uploads
        const { signedUrl, publicUrl } = await apiFetch('/storage/event-poster-upload-url', {
          method: 'POST',
          body: { ext },
        });
        // do the actual uploard with the image fil using the signed url
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          body: imageFile,
          headers: { 'Content-Type': imageFile.type || 'application/octet-stream' },
        });
        if (!uploadRes.ok) throw new Error('Image upload failed.');
        imageUrl = publicUrl;
      }
      // adds the rest of the data after the image upload succeeds
      await onAddEvent?.({
        description: formData.description,
        startTime: `${formData.date}T${formData.startTime}:00`,
        endTime: `${formData.date}T${formData.endTime}:00`,
        imageUrl,
        isMembersOnly: formData.membersOnly,
      });
      // reset form fields
      setShowForm(false);
      setFormData({ description: '', date: '', startTime: '', endTime: '', membersOnly: false });
      setImageFile(null);
      setImagePreview(null);
      setFormWarning('');
    } catch (err) {
      setFormWarning(err.message || 'Failed to add event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // in case of the user cancelling the upload or sudden page failure
  const handleCancelForm = () => {
    setShowForm(false);
    setFormData({ description: '', date: '', startTime: '', endTime: '', membersOnly: false });
    setImageFile(null);
    setImagePreview(null);
    setFormWarning('');
  };

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="cal-module">
      <p className="divider-header">Coming Up</p>
      {editing && warning && <p className="module-warning">{warning}</p>}

      {/* Event list */}
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
                {event.event_image_url && (
                  <img className="cal-event-img" src={event.event_image_url} alt="" />
                )}
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add event (approved accounts only) */}
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

              <label className="cal-label cal-members-only-label">
                Members only
                <input
                  type="checkbox"
                  name="membersOnly"
                  checked={formData.membersOnly}
                  onChange={(e) => setFormData(prev => ({ ...prev, membersOnly: e.target.checked }))}
                />
              </label>

              {/* Live card preview */}
              {(imagePreview || formData.description || formData.date) && (
                <div className="cal-form-preview-wrap">
                  <p className="cal-form-preview-label">Preview</p>
                  <div className="cal-event-item cal-form-preview-card">
                    {imagePreview && (
                      <img className="cal-event-img" src={imagePreview} alt="" />
                    )}
                    <div className="cal-event-body">
                      {formData.date && (
                        <p className="cal-event-date">
                          {format(new Date(`${formData.date}T00:00:00`), 'EEE, MMM d').toUpperCase()}
                        </p>
                      )}
                      {(formData.startTime || formData.endTime) && (
                        <p className="cal-event-time">
                          {formData.startTime ? format(new Date(`${formData.date || '2000-01-01'}T${formData.startTime}:00`), 'h:mm a') : '?'}
                          {' – '}
                          {formData.endTime ? format(new Date(`${formData.date || '2000-01-01'}T${formData.endTime}:00`), 'h:mm a') : '?'}
                        </p>
                      )}
                      {formData.description && (
                        <p className="cal-event-desc">{formData.description}</p>
                      )}
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

export default React.memo(CalendarModule);
