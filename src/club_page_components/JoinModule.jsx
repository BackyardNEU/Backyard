import React, { useState } from 'react';
import './JoinModule.css';

/**
 * Join module — lets a club advertise recruiting info.
 *
 * data shape:
 *   {
 *     tabs: [{ title: string, body: string }, ...],
 *     applicationLink: string,   // empty => "Apply" button hidden
 *     contactLink: string        // empty => "Contact recruiter" button hidden
 *   }
 *
 * @param {Object} data - module data (see shape above).
 * @param {boolean} editing - whether the page-level edit mode is on (only ever true for approved accounts).
 * @param {Function} onChange - callback receiving the full updated data object (preserved by parent useCallback).
 */
function JoinModule({ data, editing, onChange }) {
  const [active, setActive] = useState(0);

  const tabs = data?.tabs ?? [];
  const applicationLink = data?.applicationLink || '';
  const contactLink = data?.contactLink || '';

  // Clamp the active index so a deletion can't leave us pointing past the end.
  const activeIndex = tabs.length ? Math.min(active, tabs.length - 1) : 0;

  const updateTab = (idx, field, value) =>
    onChange({ ...data, tabs: tabs.map((t, i) => (i === idx ? { ...t, [field]: value } : t)) });

  const addTab = () =>
    onChange({ ...data, tabs: [...tabs, { title: '', body: '' }] });

  const removeTab = (idx) =>
    onChange({ ...data, tabs: tabs.filter((_, i) => i !== idx) });

  const updateLink = (field, value) =>
    onChange({ ...data, [field]: value });

  if (editing) {
    return (
      <div className="join-module join-module--editing">
        <h2 className="join-heading">Join</h2>

        <div className="join-card-row">
          {tabs.map((t, idx) => (
            <div className="join-tab-card" key={idx}>
              <button
                className="join-tab-delete"
                onClick={() => removeTab(idx)}
                aria-label="Delete tab"
              >
                ×
              </button>
              <input
                className="join-card-title"
                value={t.title || ''}
                onChange={(e) => updateTab(idx, 'title', e.target.value)}
                placeholder="edit tab title ex: we're looking for"
              />
              <textarea
                className="join-card-body"
                value={t.body || ''}
                onChange={(e) => updateTab(idx, 'body', e.target.value)}
                placeholder="ex: edit available positions"
              />
            </div>
          ))}

          <button className="join-add-card" onClick={addTab} aria-label="Add a tab">
            +
          </button>
        </div>

        <div className="join-link-inputs">
          <input
            className="join-link-input"
            value={applicationLink}
            onChange={(e) => updateLink('applicationLink', e.target.value)}
            placeholder="enter application link"
          />
          <input
            className="join-link-input"
            value={contactLink}
            onChange={(e) => updateLink('contactLink', e.target.value)}
            placeholder="enter contact link"
          />
        </div>
      </div>
    );
  }

  // View mode — nothing to show if the module is empty.
  if (tabs.length === 0 && !applicationLink && !contactLink) return null;

  return (
    <div className="join-module">
      <h2 className="join-heading">Join</h2>

      {tabs.length > 0 && (
        <>
          <div className="join-tabs" role="tablist">
            {tabs.map((t, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIndex}
                className={`join-tab ${i === activeIndex ? 'active' : ''}`}
                onClick={() => setActive(i)}
              >
                {t.title || 'Untitled'}
              </button>
            ))}
          </div>
          <div className="join-tab-content">{tabs[activeIndex]?.body}</div>
        </>
      )}

      {(applicationLink || contactLink) && (
        <div className="join-actions">
          {applicationLink && (
            <a
              className="join-link-btn"
              href={applicationLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply
            </a>
          )}
          {contactLink && (
            <a
              className="join-link-btn"
              href={contactLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact recruiter
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(JoinModule);
