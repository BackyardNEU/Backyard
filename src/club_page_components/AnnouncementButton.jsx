import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../lib/api';
import './AnnouncementButton.css';

const MAX_LENGTH = 500;

export default function AnnouncementButton({ clubId, memberCount }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const remaining = MAX_LENGTH - message.length;
  const overLimit = remaining < 0;
  const canSend = message.trim().length > 0 && !overLimit && !sending;

  function openModal() {
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
      await apiFetch(`/clubs/${clubId}/announce`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
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
                <textarea
                  className="announce-textarea"
                  placeholder="Write your announcement..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                  autoFocus
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
