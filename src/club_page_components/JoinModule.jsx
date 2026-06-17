import React, { useState } from 'react';
import { sanitizeBioHtml } from '../lib/sanitizeHtml';
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
function JoinModule({ data, editing, onChange, warning }) {
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
        <p className="divider-header">How to Join</p>

        {warning && <p className="module-warning">{warning}</p>}
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
              <div className="mr-category-wrap">
                <input
                  className="mr-category"
                  value={t.title || ''}
                  onChange={(e) => updateTab(idx, 'title', e.target.value)}
                  placeholder="edit tab title ex: we're looking for"
                />
              </div>

              <JoinTabEditor
                value={t.body}
                onChange={(html) => updateTab(idx, 'body', sanitizeBioHtml(html))}
                placeholder="add about positions ex: we're looking for defenders"
              />
            </div>
          ))}

          <button className="join-add-card" onClick={addTab} aria-label="Add a tab">
            +
          </button>
        </div>

        <div className="join-link-inputs">
          <input
            className="join-link-application-input"
            value={applicationLink}
            onChange={(e) => updateLink('applicationLink', e.target.value)}
            placeholder="enter application link"
          />
          <input
            className="join-link-contact-input"
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
      <p className="divider-header">How to Join</p>

      {tabs.length > 0 && (
        <>
          <div className="join-tabs" role="tablist">
            {tabs.map((t, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIndex}
                className={`mr-cat-tab ${i === activeIndex ? 'active' : ''}`}
                onClick={() => setActive(i)}
              >
                {t.title || 'Untitled'}
              </button>
            ))}
          </div>
          <div className="join-tab-content" dangerouslySetInnerHTML={{ __html: tabs[activeIndex]?.body || '' }} />
        </>
      )}

      {(applicationLink || contactLink) && (
        <div className="join-actions">
          {applicationLink && (
            <a
              className="apply-link-btn"
              href={applicationLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply
            </a>
          )}
          {contactLink && (
            <a
              className="contact-link-btn"
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

const isEmptyHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent.trim() === '' && !tmp.querySelector('li, img, br');
};

/** Uncontrolled rich-text editor for join tabs — innerHTML is seeded once on mount. */
function JoinTabEditor({ value, onChange, placeholder }) {
  const ref = React.useRef(null);
  const [empty, setEmpty] = React.useState(() => isEmptyHtml(value));
  const [active, setActive] = React.useState({});
  const [charCount, setCharCount] = React.useState(() => (value || '').replace(/<[^>]*>/g, '').length);

  React.useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    try { document.execCommand('styleWithCSS', false, false); } catch { /* not supported */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshActive = () => {
    const next = {};
    ['bold', 'italic', 'underline'].forEach((c) => {
      try { next[c] = document.queryCommandState(c); } catch { /* ignore */ }
    });
    setActive(next);
  };

  const handleInput = () => {
    setEmpty(isEmptyHtml(ref.current?.innerHTML));
    setCharCount(ref.current?.textContent?.length ?? 0);
    onChange(ref.current?.innerHTML || '');
  };

  const exec = (cmd) => (e) => {
    e.preventDefault();
    ref.current?.focus();
    try { document.execCommand(cmd, false, null); } catch { /* ignore */ }
    handleInput();
    refreshActive();
  };

  return (
    <div className="mr-bio">
      <div
        ref={ref}
        className={`mr-editor ${empty ? 'is-empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-ph={placeholder}
        onInput={handleInput}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
      />
      <div className="char-counter-wrap">
        <span className="char-counter">{charCount}/500</span>
      </div>
      <div className="mr-toolbar">
        <button type="button" className={`b ${active.bold ? 'active' : ''}`} onMouseDown={exec('bold')} title="Bold">B</button>
        <button type="button" className={`i ${active.italic ? 'active' : ''}`} onMouseDown={exec('italic')} title="Italic">I</button>
        <button type="button" className={`u ${active.underline ? 'active' : ''}`} onMouseDown={exec('underline')} title="Underline">U</button>
        <span className="sep" />
        <button type="button" onMouseDown={exec('insertUnorderedList')} title="Bulleted list">•</button>
        <button type="button" onMouseDown={exec('insertOrderedList')} title="Numbered list">1.</button>
      </div>
    </div>
  );
}

export default React.memo(JoinModule);