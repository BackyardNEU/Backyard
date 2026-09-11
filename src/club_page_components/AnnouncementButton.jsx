import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../lib/api';
import './AnnouncementButton.css';

const MAX_LENGTH = 500;
const MAX_TITLE_LENGTH = 80;

export default function AnnouncementButton({ clubId, memberCount }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [queued, setQueued] = useState(false);
  const closeTimerRef = useRef(null);

  // memberCount includes the sender, who is excluded from the fan-out.
  // null  → still loading; show generic copy, allow send
  // 0     → genuinely empty (shouldn't happen); treat as unknown
  // 1     → only the moderator; no one to notify → disable send
  // 2+    → memberCount - 1 will be notified
  const recipientCount = memberCount > 0 ? memberCount - 1 : null;

  const remaining = MAX_LENGTH - message.length;
  const overLimit = remaining < 0;
  const titleOverLimit = title.length > MAX_TITLE_LENGTH;
  const canSend = message.trim().length > 0 && !overLimit && !titleOverLimit && !sending && recipientCount !== 0;

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  function openModal() {
    setTitle('');
    setMessage('');
    setError(null);
    setQueued(false);
    setOpen(true);
  }

  function closeModal() {
    if (sending) return;
    clearTimeout(closeTimerRef.current);
    setOpen(false);
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/clubs/${clubId}/announce`, {
        method: 'POST',
        body: { title: title.trim() || undefined, message: message.trim() },
      });
      setQueued(true);
      closeTimerRef.current = setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      setError(err.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  }

  function recipientLine() {
    if (recipientCount === null) return 'All club members will receive this as an in-app notification.';
    if (recipientCount === 0) return 'There are no other members to notify yet.';
    return `This will notify ${recipientCount} member${recipientCount === 1 ? '' : 's'}.`;
  }

  const modal = open
    ? createPortal(
        <div className="announce-backdrop" onClick={closeModal}>
          <div className="announce-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send Announcement</h3>
            <p>{recipientLine()}</p>

            {queued ? (
              <p style={{ color: '#27ae60', fontWeight: 600, textAlign: 'center', padding: '12px 0' }}>
                Announcement queued — members will be notified shortly.
              </p>
            ) : (
              <>
                <input
                  className={`announce-title-input${titleOverLimit ? ' announce-input--over' : ''}`}
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={sending}
                  maxLength={MAX_TITLE_LENGTH + 10}
                  autoFocus
                />
                <textarea
                  className="announce-textarea"
                  placeholder="Write your announcement..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                />
                <span className={`announce-char-count${overLimit ? ' announce-char-count--over' : ''}`}>
                  {remaining < 0 ? `-${Math.abs(remaining)}` : remaining} characters remaining
                </span>
                {error && <p className="announce-error">{error}</p>}
                <div className="announce-actions">
                  <button className="announce-cancel-btn" onClick={closeModal} disabled={sending} type="button">
                    Cancel
                  </button>
                  <button className="announce-send-btn" onClick={handleSend} disabled={!canSend} type="button">
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="duo-btn-wrap">
        <div className="duo-btn-pill" aria-hidden="true" />
        <button
          className="announce-trigger-btn duo-btn"
          style={{ '--duo-shadow': 'rgb(80, 50, 10)' }}
          onClick={openModal}
          type="button"
        >
          Announce
        </button>
      </div>
      {modal}
    </>
  );
}
