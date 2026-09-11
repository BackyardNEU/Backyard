import { useState } from 'react';
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
  const [sent, setSent] = useState(false);

  const remaining = MAX_LENGTH - message.length;
  const overLimit = remaining < 0;
  const titleOverLimit = title.length > MAX_TITLE_LENGTH;
  const canSend = message.trim().length > 0 && !overLimit && !titleOverLimit && !sending;

  function openModal() {
    setTitle('');
    setMessage('');
    setError(null);
    setSent(false);
    setOpen(true);
  }

  function closeModal() {
    if (sending) return;
    setOpen(false);
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // apiFetch stringifies `body` itself (src/lib/api.js). Passing an already-encoded
      // string double-encoded it into a top-level JSON string, which express.json()
      // rejects in strict mode before the route is ever reached — so every send failed
      // with a body-parser 400 and the feature had never worked.
      await apiFetch(`/clubs/${clubId}/announce`, {
        method: 'POST',
        body: { title: title.trim() || undefined, message: message.trim() },
      });
      setSent(true);
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      setError(err.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  }

  const modal = open
    ? createPortal(
        <div className="announce-backdrop" onClick={closeModal}>
          <div className="announce-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send Announcement</h3>
            <p>
              {memberCount > 0
                ? `This will notify ${memberCount} member${memberCount === 1 ? '' : 's'}.`
                : 'All club members will receive this as an in-app notification.'}
            </p>

            {sent ? (
              <p style={{ color: '#27ae60', fontWeight: 600, textAlign: 'center', padding: '12px 0' }}>
                Announcement sent!
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
