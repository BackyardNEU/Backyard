import { useState } from 'react';
import { apiFetch } from '../lib/api';
import './InviteLinkButton.css';

export default function InviteLinkButton({ clubId }) {
  const [link, setLink] = useState(null);       // { url, expires_at, token }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokedNotice, setRevokedNotice] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/clubs/${clubId}/invite-link`, { method: 'POST' });
      setLink(data);
    } catch (err) {
      setError(err.message || 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const revoke = async () => {
    if (!link) return;
    setRevoking(true);
    try {
      await apiFetch(`/invite/${link.token}/revoke`, { method: 'PATCH' });
      setLink(null);
      setCopied(false);
      setRevokedNotice(true);
      setTimeout(() => setRevokedNotice(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  const expiresText = link?.expires_at
    ? `Expires ${new Date(link.expires_at).toLocaleDateString()}`
    : undefined;

  return (
    <>
      {!link && (
        <div className="duo-btn-wrap">
          <div className="duo-btn-pill" aria-hidden="true" />
          <button
            className="invite-generate-btn duo-btn"
            style={{ '--duo-shadow': '#1c2a44' }}
            onClick={generate}
            disabled={loading}
            type="button"
          >
            {loading ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </div>
      )}

      {link && (
        <>
          <div className="duo-btn-wrap">
            <div className="duo-btn-pill" aria-hidden="true" />
            <button
              className="invite-copy-btn duo-btn"
              style={{ '--duo-shadow': '#1c2a44' }}
              onClick={copy}
              type="button"
              title={expiresText}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="duo-btn-wrap">
            <div className="duo-btn-pill" aria-hidden="true" />
            <button
              className="invite-revoke-btn duo-btn"
              style={{ '--duo-shadow': 'rgb(120, 20, 20)' }}
              onClick={revoke}
              disabled={revoking}
              type="button"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </>
      )}

      {/* Independent of the buttons above — a standalone confirmation that shows
          "Link revoked" then fades itself out and unmounts, decoupled from
          whether Generate/Copy/Revoke are showing. */}
      {revokedNotice && (
        <div className="duo-btn-wrap invite-revoked-fade">
          <div className="duo-btn-pill" aria-hidden="true" />
          <button className="invite-revoke-btn duo-btn" style={{ '--duo-shadow': 'rgb(120, 20, 20)' }} disabled type="button">
            Link revoked
          </button>
        </div>
      )}

      {error && <p className="invite-error">{error}</p>}
    </>
  );
}
