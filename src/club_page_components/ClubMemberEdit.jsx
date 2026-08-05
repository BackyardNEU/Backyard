import { useState, useRef, useEffect } from 'react';
import { uploadImage } from '../lib/uploadImage';
import { sanitizeBioHtml } from '../lib/sanitizeHtml';

const ADD_VALUE = '__add_category__';

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

  // Add a category and assign it to this member in a single update (avoids stale-data races).
  const addCategoryAndAssign = (i, name) => {
    const nextCats = categories.includes(name) ? categories : [...categories, name];
    const nextMembers = members.map((m, idx) => (idx === i ? { ...m, category: name } : m));
    onChange?.({ ...data, categories: nextCats, members: nextMembers });
  };

  const onCategoryChange = (i, value) => {
    if (value === ADD_VALUE) {
      const name = (window.prompt('New category name:') || '').trim();
      if (name) addCategoryAndAssign(i, name);
    } else {
      setMember(i, { category: value });
    }
  };

  // Rename a category everywhere (the list + every member assigned to it); merges if the new
  // name already exists.
  const renameCategory = (oldName) => {
    const name = (window.prompt('Rename category:', oldName) || '').trim();
    if (!name || name === oldName) return;
    const nextCats = categories
      .map((c) => (c === oldName ? name : c))
      .filter((c, idx, arr) => arr.indexOf(c) === idx); // dedupe on merge
    const nextMembers = members.map((m) => (m.category === oldName ? { ...m, category: name } : m));
    onChange?.({ ...data, categories: nextCats, members: nextMembers });
  };

  // Delete a category; its members become uncategorized (kept, but hidden from the viewer
  // until reassigned).
  const deleteCategory = (name) => {
    const count = members.filter((m) => m.category === name).length;
    if (count > 0 && !window.confirm(
      `"${name}" has ${count} member${count === 1 ? '' : 's'}. Delete the category? They'll become uncategorized.`
    )) return;
    const nextCats = categories.filter((c) => c !== name);
    const nextMembers = members.map((m) => (m.category === name ? { ...m, category: '' } : m));
    onChange?.({ ...data, categories: nextCats, members: nextMembers });
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
      <div className="mr-cat-manage">
        <span className="mr-cat-manage-label">Categories</span>
        {categories.length === 0 && (
          <span className="mr-cat-empty">none yet — add one from a member card</span>
        )}
        {categories.map((c) => (
          <span className="mr-cat-chip" key={c}>
            <span className="mr-cat-chip-name">{c}</span>
            <button className="mr-cat-chip-btn" onClick={() => renameCategory(c)} aria-label={`Rename ${c}`}>✎</button>
            <button className="mr-cat-chip-btn del" onClick={() => deleteCategory(c)} aria-label={`Delete ${c}`}>×</button>
          </span>
        ))}
      </div>

      <div className="mr-edit-row">
        {members.map((m, i) => (
          <MemberCard
            key={i}
            member={m}
            categories={categories}
            onRemove={() => removeMember(i)}
            onCategory={(v) => onCategoryChange(i, v)}
            onName={(v) => setMember(i, { name: v })}
            onPhoto={(f) => handlePhoto(i, f)}
            onBio={(html) => setMember(i, { bio: sanitizeBioHtml(html) })}
          />
        ))}

        <button className="mr-add-card" onClick={addMember} aria-label="Add a member">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MemberCard({ member, categories, onRemove, onCategory, onName, onPhoto, onBio }) {
  const fileRef = useRef(null);

  return (
    <div className="mr-card">
      <button className="mr-remove" onClick={onRemove} aria-label="Remove member">✕</button>

      <div className="mr-category-wrap">
        <select
          className="mr-category"
          value={categories.includes(member.category) ? member.category : ''}
          onChange={(e) => onCategory(e.target.value)}
        >
          <option value="" disabled>Add to category  ex. Coaches</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={ADD_VALUE}>＋  Add category</option>
        </select>
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
