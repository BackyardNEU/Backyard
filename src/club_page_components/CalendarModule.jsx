import React, { useState, useRef, useCallback } from 'react';
import { startOfDay, addDays, format, isSameDay, parseISO } from 'date-fns';
import { apiFetch } from '../lib/api';
import './CalendarModule.css';

/**
 * Calendar / Events module.
 *
 * data shape: { filterByMembership: boolean }
 *   filterByMembership — when true, non-members won't see members-only events
 *   (server enforces this; the setting is stored here for display purposes).
 * @param {Object}   data        - the module data (a boolean for the setting of whether or not members or non members can view events)
 * @param {boolean}  editing     - page layout edit mode (shows filterByMembership toggle)
 * @param {boolean}  isApproved  - true for approved club owners; shows add-event form regardless of edit mode
 * @param {Function} onChange    - (updatedData) => void
 * @param {string}   warning     
 * @param {Array}    events      - fetched by ExpandedTile
 * @param {Set}      myRsvpSet   - event IDs the current user has RSVPd to
 * @param {Map}      friendRsvpMap - event ID → [{ username, ... }]
 * @param {Function} onRsvp      - (eventId, isCurrentlyGoing) => void
 * @param {Function} onAddEvent  - ({ description, startTime, endTime, imageUrl }) => Promise<void>
 * @param {string}   userId      - null if not logged in
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
  const containerRef = useRef(null);
  const imageInputRef = useRef(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', date: '', startTime: '', endTime: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formWarning, setFormWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (containerRef.current) containerRef.current.scrollLeft += e.deltaX;
  }, []);

  const handleMouseEnter = () => {
    containerRef.current?.addEventListener('wheel', handleWheel, { passive: false });
  };

  const handleMouseLeave = () => {
    containerRef.current?.removeEventListener('wheel', handleWheel);
  };

  const today = startOfDay(new Date());

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const dayEvents = events
      .filter((event) => isSameDay(parseISO(event.start_time), date))
      .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
    return { date, label: format(date, 'EEE'), sublabel: format(date, 'd'), isToday: i === 0, events: dayEvents };
  });

  // --- form helpers ---

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

  return (
    <div className="cal-module">
      <p className="divider-header">Events</p>
      {editing && warning && <p className="module-warning">{warning}</p>}

      <h1 className="current-month">{format(today, 'MMMM')}</h1>
      <div
        className="calendar-container"
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {days.map((day) => (
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
                <input className="cal-input" type="date" name="date" value={formData.date} onChange={handleFormChange} />
              </label>

              <div className="cal-time-row">
                <label className="cal-label">
                  Start time *
                  <input className="cal-input" type="time" name="startTime" value={formData.startTime} onChange={handleFormChange} />
                </label>
                <label className="cal-label">
                  End time *
                  <input className="cal-input" type="time" name="endTime" value={formData.endTime} onChange={handleFormChange} />
                </label>
              </div>

              <div className="cal-label">
                Event image (optional)
                <div
                  className={`cal-image-upload ${imagePreview ? 'has-image' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => imageInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imageInputRef.current?.click(); } }}
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="Event preview" className="cal-image-preview" />
                    : <span className="cal-image-placeholder">Click to upload image</span>}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              {formWarning && <p className="cal-form-warning">{formWarning}</p>}

              <div className="cal-form-actions">
                <button className="cal-cancel-btn" onClick={handleCancelForm} disabled={isSubmitting}>Cancel</button>
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
