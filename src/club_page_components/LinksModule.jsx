import React from 'react';
import {
  FaGlobe,
  FaYoutube,
  FaFacebook,
  FaInstagram,
  FaDiscord,
  FaLink,
} from 'react-icons/fa';
import './LinksModule.css';

/**
 * Links module — lets a club surface external links on their page.
 *
 * data shape:
 *   {
 *     actions: [{ label: string, url: string }, ...],  // custom CTA pills
 *     socials: {                                        // fixed platform set
 *       website:   string,
 *       youtube:   string,
 *       facebook:  string,
 *       instagram: string,
 *       discord:   string,
 *       custom:    string,
 *     }
 *   }
 *
 * @param {Object}   data     - module data (see shape above).
 * @param {boolean}  editing  - whether page-level edit mode is on.
 * @param {Function} onChange - callback receiving the full updated data object.
 */

// Fixed platform definitions — order controls render order.
const SOCIAL_PLATFORMS = [
  { key: 'website',   label: 'Website',     Icon: FaGlobe,     color: '#444',  bg: '#ececec' },
  { key: 'youtube',   label: 'YouTube',     Icon: FaYoutube,   color: '#fff',  bg: '#FF0000' },
  { key: 'facebook',  label: 'Facebook',    Icon: FaFacebook,  color: '#fff',  bg: '#1877F2' },
  { key: 'instagram', label: 'Instagram',   Icon: FaInstagram, color: '#fff',  bg: '#E4405F' },
  { key: 'discord',   label: 'Discord',     Icon: FaDiscord,   color: '#fff',  bg: '#5865F2' },
  { key: 'custom',    label: 'Custom Link', Icon: FaLink,      color: '#444',  bg: '#ececec' },
];

function LinksModule({ data, editing, onChange }) {
  const actions = data?.actions ?? [];
  const socials = data?.socials ?? {};

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const updateAction = (idx, field, value) =>
    onChange({
      ...data,
      actions: actions.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    });

  const addAction = () =>
    onChange({ ...data, actions: [...actions, { label: '', url: '' }] });

  const removeAction = (idx) =>
    onChange({ ...data, actions: actions.filter((_, i) => i !== idx) });

  const updateSocial = (key, value) =>
    onChange({ ...data, socials: { ...socials, [key]: value } });

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="links-module links-module--editing">
        <h2 className="links-heading">Links</h2>

        <p className="links-section-label">Action buttons</p>
        <div className="links-card-row">
          {actions.map((a, idx) => (
            <div className="links-action-card" key={idx}>
              <button
                className="links-card-delete"
                onClick={() => removeAction(idx)}
                aria-label="Delete action"
              >
                ×
              </button>
              <input
                className="links-card-input links-card-input--label"
                value={a.label || ''}
                onChange={(e) => updateAction(idx, 'label', e.target.value)}
                placeholder="Button label"
              />
              <input
                className="links-card-input links-card-input--url"
                type="url"
                value={a.url || ''}
                onChange={(e) => updateAction(idx, 'url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          ))}

          <button className="links-add-card" onClick={addAction} aria-label="Add action button">
            +
          </button>
        </div>

        <p className="links-section-label">Social links</p>
        <div className="links-social-inputs">
          {SOCIAL_PLATFORMS.map(({ key, label, Icon, bg, color }) => (
            <div className="links-social-input-row" key={key}>
              <span className="links-social-swatch" style={{ background: bg, color }}>
                <Icon size={14} />
              </span>
              <span className="links-social-input-label">{label}</span>
              <input
                className="links-social-input"
                type="url"
                value={socials[key] || ''}
                onChange={(e) => updateSocial(key, e.target.value)}
                placeholder="https://..."
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  const visibleActions = actions.filter((a) => a.url && a.label);
  const visibleSocials = SOCIAL_PLATFORMS.filter(({ key }) => socials[key]);

  if (visibleActions.length === 0 && visibleSocials.length === 0) return null;

  return (
    <div className="links-module">
      <h2 className="links-heading">Links</h2>

      {visibleActions.length > 0 && (
        <div className="links-actions">
          {visibleActions.map((a, i) => (
            <a
              key={i}
              className="links-action-btn"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.label}
            </a>
          ))}
        </div>
      )}

      {visibleSocials.length > 0 && (
        <div className="links-socials">
          {visibleSocials.map(({ key, label, Icon, bg, color }) => (
            <a
              key={key}
              className="links-social-icon"
              href={socials[key]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              style={{ background: bg, color }}
            >
              <Icon size={20} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(LinksModule);
