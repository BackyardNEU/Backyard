import React, { useState, useRef, useLayoutEffect } from 'react';
import FeatheredBlob from './FeatheredBlob';
import { apiFetch } from '../lib/api';
import './ClubMediaModule.css';

/**
 * Club Media module — a horizontal row of poster cards that expand into a
 * full-height portrait modal of media/text/title blocks.
 *
 * data shape:
 *   {
 *     posters: [{
 *       blob_image_url, blob_aspect, poster_color, poster_text, poster_text_color,
 *       content: [ { type:'title', value } | { type:'text', value }
 *                | { type:'media', items:[{ kind:'image'|'video', url }] } ]
 *     }]
 *   }
 *
 * Edit mode (`editing` true, approved accounts only) lets editors manage posters and
 * their content; changes flow up through `onChange` into the page draft and are saved
 * by ExpandedTile. Images upload immediately via /storage/review-upload-url; videos are
 * pasted links. Blob feathering is fixed (not user-editable).
 *
 * @param {Object} data - module data (see shape above).
 * @param {boolean} editing - page-level edit mode.
 * @param {Function} onChange - receives the full updated data object.
 */
function ClubMediaModule({ data, editing, onChange }) {
  const [openIndex, setOpenIndex] = useState(null);
  const posters = data?.posters ?? [];

  const updatePoster = (i, patch) =>
    onChange?.({ ...data, posters: posters.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  const addPoster = () => onChange?.({ ...data, posters: [...posters, newPoster()] });

  const removePoster = (i) => {
    onChange?.({ ...data, posters: posters.filter((_, idx) => idx !== i) });
    setOpenIndex(null);
  };

  // Nothing to show publicly when empty; in edit mode we still render so the add card appears.
  if (posters.length === 0 && !editing) return null;

  const open = openIndex != null ? posters[openIndex] : null;

  return (
    <div className="club-media-module">
      <p className="divider-header">Media</p>

      <div className="club-media-row">
        {posters.map((poster, i) => (
          <PosterCard
            key={i}
            poster={poster}
            editing={editing}
            onOpen={() => setOpenIndex(i)}
            onUpdate={(patch) => updatePoster(i, patch)}
            onDelete={() => removePoster(i)}
          />
        ))}

        {editing && (
          <button className="cm-add-poster" onClick={addPoster} aria-label="Add poster">+</button>
        )}
      </div>

      {open && (
        <PosterModal
          poster={open}
          editing={editing}
          onClose={() => setOpenIndex(null)}
          onUpdate={(patch) => updatePoster(openIndex, patch)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Poster card ─────────────────────────── */

function PosterCard({ poster, editing, onOpen, onUpdate, onDelete }) {
  const wrapRef = useRef(null);
  const copyRef = useRef(null);
  const [marquee, setMarquee] = useState(false);
  const [dur, setDur] = useState(20);

  // Only scroll when the text is wider than the poster. When it does, it's an infinite
  // right-to-left ticker: the text is duplicated and the track translates -50%, so the
  // second copy seamlessly takes the first's place. Duration scales with the text width
  // so the speed stays constant at 20px/s.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const copy = copyRef.current;
    if (!wrap || !copy) return;
    const textW = copy.scrollWidth;
    const over = textW > wrap.clientWidth + 1;
    setMarquee(over);
    if (over) setDur(Math.max(6, textW / 20)); // 20 px/s
  }, [poster.poster_text, editing]);

  const fit = fitBlob(poster.blob_aspect || '1 / 1', CARD_BLOB_W, CARD_BLOB_H);

  const handleBlobUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onUpdate({ blob_image_url: await uploadImage(file) });
    } catch (err) {
      console.error('Blob image upload failed:', err);
    }
  };

  return (
    <div
      className={`cm-poster-card ${editing ? 'cm-poster-card--editing' : ''}`}
      style={{ background: poster.poster_color || '#1e2630' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
    >
      {editing && (
        <button
          className="cm-poster-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete poster"
        >
          ×
        </button>
      )}

      <div className="cm-poster-stage" style={fit}>
        {poster.blob_image_url ? (
          <FeatheredBlob
            image={poster.blob_image_url}
            aspectRatio={poster.blob_aspect || '1 / 1'}
            color={poster.poster_color || '#1e2630'}
            feather={BLOB_FEATHER}
            className="cm-float"
          />
        ) : (
          <div className="cm-poster-empty">No image</div>
        )}
      </div>

      {!editing && poster.poster_text && (
        <div className="cm-poster-text" ref={wrapRef}>
          <div
            className={`cm-marquee-track ${marquee ? 'cm-marquee-on' : ''}`}
            style={{ color: poster.poster_text_color || '#fff', '--cm-dur': `${dur}s` }}
          >
            <span ref={copyRef} className="cm-marquee-copy">{poster.poster_text}</span>
            {marquee && <span className="cm-marquee-copy" aria-hidden="true">{poster.poster_text}</span>}
          </div>
        </div>
      )}

      {editing && (
        <div className="cm-poster-edit" onClick={(e) => e.stopPropagation()}>
          <div className="cm-edit-row">
            <label className="cm-edit-color">
              Card
              <input
                type="color"
                value={poster.poster_color || '#1e2630'}
                onChange={(e) => onUpdate({ poster_color: e.target.value })}
              />
            </label>
            <label className="cm-edit-color">
              Text
              <input
                type="color"
                value={poster.poster_text_color || '#ffffff'}
                onChange={(e) => onUpdate({ poster_text_color: e.target.value })}
              />
            </label>
            <select
              className="cm-edit-aspect"
              value={poster.blob_aspect || '1 / 1'}
              onChange={(e) => onUpdate({ blob_aspect: e.target.value })}
            >
              {ASPECTS.map((a) => (
                <option key={a} value={a}>{a.replace(/ /g, '')}</option>
              ))}
            </select>
          </div>
          <input
            className="cm-edit-text"
            value={poster.poster_text || ''}
            onChange={(e) => onUpdate({ poster_text: e.target.value })}
            placeholder="poster text"
          />
          <label className="cm-edit-upload">
            {poster.blob_image_url ? 'Change image' : 'Upload image'}
            <input type="file" accept="image/*" hidden onChange={handleBlobUpload} />
          </label>
          <span className="cm-edit-hint">Tap image → edit content</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Expanded modal ─────────────────────────── */

function PosterModal({ poster, editing, onClose, onUpdate }) {
  const content = poster.content ?? [];
  const setContent = (next) => onUpdate({ content: next });
  const addBlock = (block) => setContent([block, ...content]); // newest on top
  const updateBlock = (bi, patch) => setContent(content.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  const removeBlock = (bi) => setContent(content.filter((_, i) => i !== bi));

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cm-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="cm-modal-header">
          <span className="cm-modal-title" style={{ color: poster.poster_color || '#2c1b2b' }}>
            {poster.poster_text || 'Untitled'}
          </span>
        </div>

        <div className="cm-modal-body">
          {editing && <BlockAdder onAdd={addBlock} />}

          {content.map((block, bi) =>
            editing ? (
              <BlockEditor
                key={bi}
                block={block}
                onChange={(patch) => updateBlock(bi, patch)}
                onRemove={() => removeBlock(bi)}
              />
            ) : (
              <ContentBlock key={bi} block={block} />
            )
          )}

          {content.length === 0 && !editing && <p className="cm-modal-empty">No media yet.</p>}
        </div>
      </div>
    </div>
  );
}

function BlockAdder({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const addImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const items = [];
      for (const f of files) items.push({ kind: 'image', url: await uploadImage(f) });
      onAdd({ type: 'media', items });
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    setOpen(false);
  };

  const addVideo = () => {
    const url = videoUrl.trim();
    if (!url) return;
    onAdd({ type: 'media', items: [{ kind: 'video', url }] });
    setVideoUrl('');
    setVideoMode(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="cm-block-adder">
        <button className="cm-add-btn" onClick={() => setOpen(true)}>+ Add</button>
      </div>
    );
  }

  return (
    <div className="cm-block-adder cm-add-menu">
      <button onClick={() => { onAdd({ type: 'title', value: '' }); setOpen(false); }}>Title</button>
      <button onClick={() => { onAdd({ type: 'text', value: '' }); setOpen(false); }}>Text</button>
      <label className="cm-add-upload">
        Image(s)
        <input type="file" accept="image/*" multiple hidden onChange={addImages} />
      </label>
      {!videoMode ? (
        <button onClick={() => setVideoMode(true)}>Video</button>
      ) : (
        <span className="cm-add-video">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="paste video link"
          />
          <button onClick={addVideo}>Add</button>
        </span>
      )}
      <button className="cm-add-cancel" onClick={() => { setOpen(false); setVideoMode(false); }} aria-label="Cancel">✕</button>
    </div>
  );
}

function BlockEditor({ block, onChange, onRemove }) {
  return (
    <div className="cm-block-edit">
      <button className="cm-block-remove" onClick={onRemove} aria-label="Remove block">×</button>
      {block.type === 'title' && (
        <input
          className="cm-block-title-input"
          value={block.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Title"
        />
      )}
      {block.type === 'text' && (
        <textarea
          className="cm-block-text-input"
          value={block.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Text"
        />
      )}
      {block.type === 'media' && <MediaCarousel items={block.items} />}
    </div>
  );
}

function ContentBlock({ block }) {
  if (block?.type === 'title') return <h3 className="cm-block-title">{block.value}</h3>;
  if (block?.type === 'text') return <p className="cm-block-text">{block.value}</p>;
  if (block?.type === 'media') return <MediaCarousel items={block.items} />;
  return null;
}

/* ─────────────────────────── Swipeable media carousel ─────────────────────────── */

function MediaCarousel({ items }) {
  const [active, setActive] = useState(0);
  const total = items?.length ?? 0;

  const onScroll = (e) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  if (!total) return null;

  return (
    <div className="cm-carousel">
      <div className="cm-carousel-track" onScroll={onScroll}>
        {items.map((it, i) => (
          <div className="cm-carousel-slide" key={i}>{renderMediaItem(it)}</div>
        ))}
      </div>
      {total > 1 && (
        <div className="cm-carousel-dots">
          {items.map((_, d) => (
            <span key={d} className={`cm-carousel-dot ${d === active ? 'is-active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

const BLOB_FEATHER = 4;
const ASPECTS = ['1 / 1', '4 / 3', '3 / 4', '16 / 9', '9 / 16', '3 / 2', '2 / 3'];

// Card inner area reserved for the blob (the .cm-poster-card is 280x420 with padding).
const CARD_BLOB_W = 252;
const CARD_BLOB_H = 392;

const newPoster = () => ({
  blob_image_url: '',
  blob_aspect: '1 / 1',
  poster_color: '#1e2630',
  poster_text: 'New Poster',
  poster_text_color: '#ffffff',
  content: [],
});

// Largest aspect-correct box that fits within boxW x boxH — fills the card maximally
// without overflowing, for any blob aspect.
function fitBlob(aspect, boxW, boxH) {
  const [aw, ah] = aspect.split('/').map((s) => parseFloat(s));
  if (!aw || !ah) return { width: `${boxW}px`, height: `${boxH}px` };
  const scale = Math.min(boxW / aw, boxH / ah);
  return { width: `${aw * scale}px`, height: `${ah * scale}px` };
}

// Two-step signed upload (same flow as ReviewPage): get a URL, PUT bytes, return the public URL.
async function uploadImage(file) {
  const ext = file.name.split('.').pop() || 'jpg';
  const { signedUrl, publicUrl } = await apiFetch('/storage/review-upload-url', {
    method: 'POST',
    body: { ext },
  });
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return publicUrl;
}

// Pull the 11-char id out of common YouTube URL shapes.
function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function renderMediaItem(item) {
  if (!item?.url) return null;
  if (item.kind === 'video') {
    const id = youtubeId(item.url);
    if (id) {
      return (
        <iframe
          className="cm-media-frame"
          src={`https://www.youtube.com/embed/${id}`}
          title="video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return <video className="cm-media-video" src={item.url} controls />;
  }
  return <img className="cm-media-img" src={item.url} alt="" />;
}

export default React.memo(ClubMediaModule);
