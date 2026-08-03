import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '../lib/api';
import newEventBtnImg from '../assets/New_Event_Btn.png';
import newEventBtnHoverImg from '../assets/New_Event_Btn:_On_Hover.png';
import newAddPosterImg from '../assets/New_add_poster.png';
import borderImg from '../assets/border.svg';
import borderHorizontalImg from '../assets/border-horizontal.svg';
import EventPosterCropModal from './EventPosterCropModal';
import './CalendarModule.css';

/**
 * Calendar / Events module — simplified "Coming Up" list.
 *
 * data shape: { filterByMembership: boolean }
 * @param {Object}   club          - club record (used for its image_url, as a
 *                                    poster placeholder for events with no image)
 * @param {Object}   data          - module data
 * @param {boolean}  editing       - page edit mode
 * @param {boolean}  isApproved    - true for approved club owners; shows add-event form
 * @param {Function} onChange      - (updatedData) => void
 * @param {string}   warning       - displays a warning for invalid fields not entered in by page editor
 * @param {Array}    events        - upcoming events fetched by ExpandedTile, sorted by start_time
 * @param {Set}      myRsvpSet     - event IDs the current user has RSVPd to
 * @param {Map}      friendRsvpMap - event ID → [{ username, ... }]
 * @param {Function} onRsvp        - (eventId, isCurrentlyGoing) => void
 * @param {Function} onAddEvent    - ({ eventName, description, where, startTime, endTime, imageUrl, isMembersOnly }) => Promise<void>
 * @param {string}   userId        - null if not logged in
 */
export function CalendarModule({
  club,
  editing,
  isApproved = false,
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
  const [formData, setFormData] = useState({ eventName: '', start: '', end: '', where: '', description: '', membersOnly: false });
  // image file for form
  const [imageFile, setImageFile] = useState(null);
  // image preview for previewing the event in before posting it
  const [imagePreview, setImagePreview] = useState(null);
  // warning for invalid fields in the form
  const [formWarning, setFormWarning] = useState('');
  // for loading/data saving purposes
  const [isSubmitting, setIsSubmitting] = useState(false);
  // scale/crop modal for the poster, open only while editing an already-selected image
  const [showCropModal, setShowCropModal] = useState(false);
  // the add-btn/cal-form share one row slot; its height is animated between
  // the button's compact size and the form's real (measured) height — same
  // technique as the comment card's More/Less, itself derived from the
  // module accordion's grid-template-rows 0fr/1fr trick.
  const addSlotRef = useRef(null);
  const [addSlotHeight, setAddSlotHeight] = useState(null);
  // sorting events passed in through events prop by closest to current date
  const sorted = [...events].sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  // Re-measure whenever the form's own content changes shape (image
  // added/removed, warning appears, etc.) so the slot always grows/shrinks to
  // fit — not just once when it first opens.
  useEffect(() => {
    if (showForm && addSlotRef.current) {
      setAddSlotHeight(addSlotRef.current.scrollHeight);
    }
  }, [showForm, imagePreview, formWarning]);

  // ── add-event form helpers ─────────────────────────────────────────────
  function validateForm() {
    const { start: startVal, end: endVal, description } = formData;
    if (description.length > 200) { setFormWarning('Description must be 200 characters or fewer.'); return false; }
    if (!startVal || !endVal) { setFormWarning('Please fill in the start and end times.'); return false; }
    const start = new Date(startVal);
    const end = new Date(endVal);
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

  // clears the selected poster and resets the file input so re-picking the same file still fires onChange
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleCropConfirm = (newFile) => {
    setImageFile(newFile);
    setImagePreview(URL.createObjectURL(newFile));
    setShowCropModal(false);
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
        eventName: formData.eventName,
        description: formData.description,
        where: formData.where,
        startTime: `${formData.start}:00`,
        endTime: `${formData.end}:00`,
        imageUrl,
        isMembersOnly: formData.membersOnly,
      });
      // reset form fields
      setShowForm(false);
      setFormData({ eventName: '', start: '', end: '', where: '', description: '', membersOnly: false });
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
    setFormData({ eventName: '', start: '', end: '', where: '', description: '', membersOnly: false });
    setImageFile(null);
    setImagePreview(null);
    setFormWarning('');
  };

  // The add-btn and cal-form occupy the same row slot — clicking the button
  // morphs it into the form in place (see .cal-add-slot below).
  const addEventButton = (
    <button
      className="cal-add-btn"
      onClick={() => setShowForm(true)}
      style={{ '--cal-add-btn-bg': `url(${newEventBtnImg})`, '--cal-add-btn-bg-hover': `url(${newEventBtnHoverImg})` }}
    >
      <img src={borderImg} alt="" className="cal-add-btn-border cal-add-btn-border-left" />
      <img src={borderImg} alt="" className="cal-add-btn-border cal-add-btn-border-right" />
      <div
        className="cal-add-btn-border-h cal-add-btn-border-h-top"
        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
      />
      <div
        className="cal-add-btn-border-h cal-add-btn-border-h-bottom"
        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
      />
    </button>
  );

  const addEventForm = (
    <div className="cal-form">
      <img src={borderImg} alt="" className="cal-form-border cal-form-border-left" />
      <img src={borderImg} alt="" className="cal-form-border cal-form-border-right" />
      <div
        className="cal-form-border-h cal-form-border-h-top"
        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
      />
      <div
        className="cal-form-border-h cal-form-border-h-bottom"
        style={{ backgroundImage: `url(${borderHorizontalImg})` }}
      />

      <div className="cal-form-header">
        <button
          type="button"
          className="cal-form-close-btn"
          onClick={handleCancelForm}
          disabled={isSubmitting}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Sits above the upload tile, not overlaid on it — same reasoning as the
          comment carousel's toolbar (avoids swallowing the tile's own click) */}
      {imageFile && (
        <div className="cal-image-toolbar">
          <button
            type="button"
            className="cal-image-scale-btn"
            onClick={() => setShowCropModal(true)}
            aria-label="Scale poster"
          >
            SCALE
          </button>
          <button
            type="button"
            className="cal-image-remove-btn"
            onClick={handleRemoveImage}
            aria-label="Remove poster"
          >
            REMOVE
          </button>
        </div>
      )}

      <button
        type="button"
        className="cal-image-trigger"
        onClick={() => imageInputRef.current?.click()}
      >
        {imagePreview ? (
          <img className="cal-poster-preview" src={imagePreview} alt="" />
        ) : (
          <div className="cal-poster-placeholder-wrap">
            <img className="cal-poster-placeholder" src={newAddPosterImg} alt="Upload event poster" />
            <span className="cal-poster-plus">+</span>
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
      </button>

      <div className="cal-divider" />

      <input
        className="cal-input"
        type="text"
        name="eventName"
        value={formData.eventName}
        onChange={handleFormChange}
        placeholder="Event Name (Optional)"
      />
      <div className="cal-datetime-field">
        <span className="cal-datetime-label">Start</span>
        <input
          className="cal-input"
          type="datetime-local"
          name="start"
          value={formData.start}
          onChange={handleFormChange}
        />
      </div>
      <div className="cal-datetime-field">
        <span className="cal-datetime-label">End</span>
        <input
          className="cal-input"
          type="datetime-local"
          name="end"
          value={formData.end}
          onChange={handleFormChange}
        />
      </div>
      <input
        className="cal-input"
        type="text"
        name="where"
        value={formData.where}
        onChange={handleFormChange}
        placeholder="Where (Optional)"
      />
      <input
        className="cal-input"
        type="text"
        name="description"
        value={formData.description}
        onChange={handleFormChange}
        placeholder="About (Optional)"
        maxLength={200}
      />

      {formWarning && <p className="cal-form-warning">{formWarning}</p>}

      <div className="cal-form-footer">
        <label className="cal-members-only-label">
          <input
            type="checkbox"
            name="membersOnly"
            checked={formData.membersOnly}
            onChange={(e) => setFormData(prev => ({ ...prev, membersOnly: e.target.checked }))}
          />
          <span>Members Only</span>
        </label>

        <div className="duo-btn-wrap cal-submit-wrap">
          <div className="duo-btn-pill" aria-hidden="true" />
          <button
            className="cal-submit-btn duo-btn"
            style={{ '--duo-shadow': 'rgb(150, 150, 150)' }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="cal-module">
      <p className="divider-header">Coming Up</p>
      {editing && warning && <p className="module-warning">{warning}</p>}

      {/* Event list — the add-event button (approved owners only) sits first in
          the row, sized to match the event cards, so it's exclusive to club pages */}
      {sorted.length === 0 && !isApproved ? (
        <p className="cal-empty">No upcoming events.</p>
      ) : (
        <div className="cal-event-list">
          {isApproved && (
            <div
              className="cal-add-slot"
              ref={addSlotRef}
              style={showForm && addSlotHeight ? { maxHeight: `${addSlotHeight}px` } : undefined}
            >
              {showForm ? addEventForm : addEventButton}
            </div>
          )}
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showCropModal && imageFile && (
        <EventPosterCropModal
          file={imageFile}
          onCancel={() => setShowCropModal(false)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

export default React.memo(CalendarModule);
