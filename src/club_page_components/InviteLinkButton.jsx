import { useState } from 'react';
import { apiFetch } from '../lib/api';
import './InviteLinkButton.css';

export default function InviteLinkButton({ clubId }) {
  const [link, setLink] = useState(null);       // { url, expires_at, token }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setRevoked(false);
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
      setRevoked(true);
      setLink(null);
    } catch (err) {
      setError(err.message || 'Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  const expiresText = link?.expires_at
    ? `Expires ${new Date(link.expires_at).toLocaleDateString()}`
    : null;

  return (
    <div className="invite-link-btn-wrapper">
      {!link && !revoked && (
        <button
          className="invite-generate-btn"
          onClick={generate}
          disabled={loading}
          type="button"
        >
          {loading ? 'Generating...' : 'Generate Invite Link'}
        </button>
      )}

      {revoked && (
        <span className="invite-revoked-msg">Link revoked.</span>
      )}

      {link && !revoked && (
        <div className="invite-link-panel">
          <div className="invite-link-row">
            <input
              className="invite-link-input"
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
            />
            <button className="invite-copy-btn" onClick={copy} type="button">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="invite-link-meta">
            {expiresText && <span className="invite-expires">{expiresText}</span>}
            <button
              className="invite-revoke-btn"
              onClick={revoke}
              disabled={revoking}
              type="button"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="invite-error">{error}</p>}
    </div>
  );
}
