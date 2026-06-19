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
 *       order,           // per-poster display order (distinct from the module-level order)
 *       blob_image_url, blob_aspect, poster_color, poster_text, poster_text_color,
 *       content: [ { type:'title', value } | { type:'text', value }
 *                | { type:'media', items:[{ kind:'image'|'video', url }] } ]
 *     }]
 *   }
 *
 * Edit mode (`editing` true, approved accounts only) lets editors manage posters and their
 * content via an edit card that sits BELOW each poster; changes flow up through `onChange`
 * into the page draft and are saved by ExpandedTile. Images upload immediately via
 * /storage/review-upload-url; videos are pasted links. Blob feathering is fixed.
 *
 * @param {Object} data - module data (see shape above).
 * @param {boolean} editing - page-level edit mode.
 * @param {Function} onChange - receives the full updated data object.
 */
function ClubMediaModule({ data, editing, onChange, warning }) {
  const [openIndex, setOpenIndex] = useState(null);
  const posters = data?.posters ?? [];

  const orderOf = (p, i) => (typeof p.order === 'number' ? p.order : i);

  // Display order without ever reordering the underlying array (keeps keys/inputs stable);
  // each entry keeps its original array index for update/open/delete handlers.
  const ordered = posters
    .map((p, i) => ({ p, i, order: orderOf(p, i) }))
    .sort((a, b) => a.order - b.order);

  const updatePoster = (i, patch) =>
    onChange?.({ ...data, posters: posters.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  // Move a poster to display position newPos0, renumbering everyone contiguously.
  const setPosterOrder = (origIndex, newPos0) => {
    const seq = posters
      .map((p, i) => ({ i, order: orderOf(p, i) }))
      .sort((a, b) => a.order - b.order)
      .map((e) => e.i);
    const from = seq.indexOf(origIndex);
    if (from === -1) return;
    seq.splice(from, 1);
    seq.splice(newPos0, 0, origIndex);
    const orderByIndex = {};
    seq.forEach((idx, pos) => { orderByIndex[idx] = pos; });
    onChange?.({ ...data, posters: posters.map((p, i) => ({ ...p, order: orderByIndex[i] })) });
  };

  const addPoster = () => onChange?.({ ...data, posters: [...posters, newPoster(posters.length)] });

  const removePoster = (origIndex) => {
    const remaining = posters.filter((_, i) => i !== origIndex);
    const seq = remaining
      .map((p, i) => ({ i, order: orderOf(p, i) }))
      .sort((a, b) => a.order - b.order)
      .map((e) => e.i);
    const orderByIndex = {};
    seq.forEach((idx, pos) => { orderByIndex[idx] = pos; });
    onChange?.({ ...data, posters: remaining.map((p, i) => ({ ...p, order: orderByIndex[i] })) });
    setOpenIndex(null);
  };

  // Nothing to show publicly when empty; in edit mode we still render so the add card appears.
  if (posters.length === 0 && !editing) return null;

  const open = openIndex != null ? posters[openIndex] : null;

  return (
    <div className="club-media-module">
      <p className="divider-header">Media</p>
      {editing && warning && <p className="module-warning">{warning}</p>}
      {editing && (
          <p className="about-edit-help">
            Think of these like your highlights. When user's click on your highlights, they will see a scrap book where you will take them into the world of your club.
          </p>
        )}
      <div className="club-media-row">
        {ordered.map(({ p, i }, rank) => (
          <PosterCard
            key={i}
            poster={p}
            editing={editing}
            rank={rank}
            count={posters.length}
            onOpen={() => setOpenIndex(i)}
            onUpdate={(patch) => updatePoster(i, patch)}
            onSetOrder={(newPos0) => setPosterOrder(i, newPos0)}
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

/* ─────────────────────────── Poster card (+ edit card below) ─────────────────────────── */

function PosterCard({ poster, editing, rank, count, onOpen, onUpdate, onSetOrder, onDelete }) {
  const wrapRef = useRef(null);
  const copyRef = useRef(null);
  const [marquee, setMarquee] = useState(false);
  const [dur, setDur] = useState(20);

  // Only scroll when the text is wider than the poster. When it does, it's an infinite
  // right-to-left ticker (the text is duplicated and the track translates -50%). Duration
  // scales with the text width so the speed stays constant at 20px/s.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const copy = copyRef.current;
    if (!wrap || !copy) return;
    const textW = copy.scrollWidth;
    const over = textW > wrap.clientWidth + 1;
    setMarquee(over);
    if (over) setDur(Math.max(6, textW / 20));
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
    <div className="cm-poster-unit">
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

        {poster.poster_text && (
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
      </div>

      {editing && (
        <div className="cm-poster-edit">
          <div className="cm-edit-hint">click poster to edit content</div>

          <div className="cm-row">
            <div className="cm-row-left">
              <div className="cm-stack">
                <label className="cm-color" style={{ background: poster.poster_color || '#1e2630' }}>
                  <input
                    type="color"
                    value={poster.poster_color || '#1e2630'}
                    onChange={(e) => onUpdate({ poster_color: e.target.value })}
                    hidden
                  />
                </label>
                <div className="cm-label">Poster</div>
              </div>

              <div className="cm-stack">
                <label className="cm-color title" style={{ background: poster.poster_text_color || '#ffffff' }}>
                  <input
                    type="color"
                    value={poster.poster_text_color || '#ffffff'}
                    onChange={(e) => onUpdate({ poster_text_color: e.target.value })}
                    hidden
                  />
                </label>
                <div className="cm-label">Title</div>
              </div>
            </div>

            <div className="cm-stack">
              <select
                className="cm-order"
                value={rank + 1}
                onChange={(e) => onSetOrder(Number(e.target.value) - 1)}
              >
                {Array.from({ length: count }, (_, n) => (
                  <option key={n} value={n + 1}>{n + 1}</option>
                ))}
              </select>
              <div className="cm-muted">order</div>
            </div>
          </div>

          <div>
            <input
              className="cm-edit-text"
              value={poster.poster_text || ''}
              onChange={(e) => onUpdate({ poster_text: e.target.value })}
              placeholder="Enter Poster Title"
              maxLength={100}
            />
            <div className="char-counter-wrap">
              <span className="char-counter">{(poster.poster_text || '').length}/100</span>
            </div>
          </div>

          <div className="cm-bottom">
            <label className="cm-edit-upload">
              EDIT BLOB IMAGE
              <input type="file" accept="image/*" hidden onChange={handleBlobUpload} />
            </label>

            <div className="cm-stack">
              <select
                className="cm-aspect"
                value={poster.blob_aspect || '1 / 1'}
                onChange={(e) => onUpdate({ blob_aspect: e.target.value })}
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>{a.replace(/ /g, '')}</option>
                ))}
              </select>
              <div className="cm-muted">aspect ratio</div>
            </div>
          </div>
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
        <div>
          <input
            className="cm-block-title-input"
            value={block.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Title"
            maxLength={100}
          />
          <div className="char-counter-wrap">
            <span className="char-counter">{(block.value || '').length}/100</span>
          </div>
        </div>
      )}
      {block.type === 'text' && (
        <div>
          <textarea
            className="cm-block-text-input"
            value={block.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Text"
            maxLength={500}
          />
          <div className="char-counter-wrap">
            <span className="char-counter">{(block.value || '').length}/500</span>
          </div>
        </div>
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

// Card inner area reserved for the blob (the .cm-poster-card is 300x450 with ~14px insets).
const CARD_BLOB_W = 272;
const CARD_BLOB_H = 422;

const newPoster = (order = 0) => ({
  blob_image_url: '',
  blob_aspect: '1 / 1',
  poster_color: '#1e2630',
  poster_text: 'New Poster',
  poster_text_color: '#ffffff',
  content: [],
  order,
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
