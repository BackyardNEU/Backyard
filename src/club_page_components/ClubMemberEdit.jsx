import { useState, useRef, useEffect } from 'react';
import { uploadImage } from '../lib/uploadImage';
import { sanitizeBioHtml } from '../lib/sanitizeHtml';
import borderBlackImg from '/src/assets/border.svg';
import borderHorizontalBlackImg from '/src/assets/border-horizontal.svg';

const CATEGORY_LIST_ID = 'mr-category-options';

/**
 * Member roster editor (rendered in edit mode below the scroll).
 * All edits flow through onChange into the page draft and persist on the page Save.
 *
 * @param {Object} data - { categories: string[], members: [{name,category,photo,bio,user_id}] }
 * @param {Function} onChange - (nextData) => void
 */
function ClubMemberEdit({ data, onChange }) {
  const categories = data?.categories ?? [];
  const members = data?.members ?? [];

  const setMember = (i, patch) =>
    onChange?.({ ...data, members: members.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });

  const addMember = () =>
    onChange?.({ ...data, members: [...members, { name: '', category: '', photo: '', bio: '', user_id: null }] });

  const removeMember = (i) =>
    onChange?.({ ...data, members: members.filter((_, idx) => idx !== i) });

  const onCategoryChange = (i, value) => setMember(i, { category: value });

  // Remember a freshly-typed category for future autocomplete suggestions, once the user
  // is done typing it (on blur) — avoids polluting the suggestion list with half-typed text.
  const commitCategory = (i) => {
    const name = (members[i]?.category || '').trim();
    if (!name || categories.includes(name)) return;
    onChange?.({ ...data, categories: [...categories, name] });
  };

  const handlePhoto = async (i, file) => {
    if (!file) return;
    try {
      setMember(i, { photo: await uploadImage(file) });
    } catch (err) {
      console.error('Member photo upload failed:', err);
    }
  };

  return (
    <div className="mr-edit">
      <datalist id={CATEGORY_LIST_ID}>
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="mr-edit-row">
        {members.map((m, i) => (
          <MemberCard
            key={i}
            member={m}
            onRemove={() => removeMember(i)}
            onCategory={(v) => onCategoryChange(i, v)}
            onCategoryBlur={() => commitCategory(i)}
            onName={(v) => setMember(i, { name: v })}
            onPhoto={(f) => handlePhoto(i, f)}
            onBio={(html) => setMember(i, { bio: sanitizeBioHtml(html) })}
          />
        ))}

        <button className="mr-add-card" onClick={addMember} aria-label="Add a member">
          <img src={borderBlackImg} alt="" className="mr-add-card-border mr-add-card-border-left" />
          <img src={borderBlackImg} alt="" className="mr-add-card-border mr-add-card-border-right" />
          <div
            className="mr-add-card-border-h-wrap mr-add-card-border-top-wrap"
            style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
            aria-hidden="true"
          />
          <div
            className="mr-add-card-border-h-wrap mr-add-card-border-bottom-wrap"
            style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
            aria-hidden="true"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MemberCard({ member, onRemove, onCategory, onCategoryBlur, onName, onPhoto, onBio }) {
  const fileRef = useRef(null);

  return (
    <div className="mr-card">
      <img src={borderBlackImg} alt="" className="mr-border mr-border-left" />
      <img src={borderBlackImg} alt="" className="mr-border mr-border-right" />
      <div
        className="mr-border-h-wrap mr-border-top-wrap"
        style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
        aria-hidden="true"
      />
      <div
        className="mr-border-h-wrap mr-border-bottom-wrap"
        style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
        aria-hidden="true"
      />

      <button className="mr-remove" onClick={onRemove} aria-label="Remove member">✕</button>

      <div className="mr-category-wrap">
        <input
          className="mr-category"
          type="text"
          list={CATEGORY_LIST_ID}
          placeholder="Add to category  ex. Coaches"
          maxLength={40}
          value={member.category || ''}
          onChange={(e) => onCategory(e.target.value)}
          onBlur={onCategoryBlur}
        />
      </div>

      <div
        className={`mr-photo ${member.photo ? 'has-photo' : ''}`}
        style={member.photo ? { backgroundImage: `url(${member.photo})` } : undefined}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
      >
        <span className="mr-photo-hint">CHANGE PHOTO</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="mr-hidden-file"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>

      <div className="mr-fields">
        <input
          className="mr-name"
          type="text"
          placeholder="Enter Member Name"
          maxLength={25}
          value={member.name || ''}
          onChange={(e) => onName(e.target.value)}
        />
        <RichTextEditor value={member.bio} onChange={onBio} placeholder="add about  ex. bio" />
      </div>
    </div>
  );
}

const isEmptyHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent.trim() === '' && !tmp.querySelector('li, img, br');
};

/** Uncontrolled rich-text editor — innerHTML is seeded once on mount so re-renders don't move the caret. */
function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const [empty, setEmpty] = useState(() => isEmptyHtml(value));
  const [active, setActive] = useState({});
  const [charCount, setCharCount] = useState(() => (value || '').replace(/<[^>]*>/g, '').length);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    try { document.execCommand('styleWithCSS', false, false); } catch { /* not supported */ }
    // seed once
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
    e.preventDefault(); // keep the editor's selection
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

export default ClubMemberEdit;
