import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { sanitizeBioHtml } from '../lib/sanitizeHtml';

/**
 * Member roster viewer: category tabs + an avatar track for the active category.
 * Tapping a member opens a swipeable detail carousel.
 *
 * @param {string[]} categories - ordered category names (drives the tabs)
 * @param {Array} members - [{ name, category, photo, bio, user_id }]
 */
function ClubMemberScroll({ categories = [], members = [] }) {
  const [activeCat, setActiveCat] = useState(categories[0] ?? null);
  const [openIndex, setOpenIndex] = useState(null);

  // Only surface category tabs that actually have members assigned.
  const usedCategories = categories.filter((c) => members.some((m) => m.category === c));

  if (usedCategories.length === 0) return null;

  const cat = usedCategories.includes(activeCat) ? activeCat : usedCategories[0];
  const activeList = members.filter((m) => m.category === cat);

  return (
    <div className="mr-scroll">
      <div className="mr-cats">
        {usedCategories.map((c) => (
          <button
            key={c}
            className={`mr-cat-tab ${c === cat ? 'active' : ''}`}
            onClick={() => { setActiveCat(c); setOpenIndex(null); }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mr-track">
        {activeList.map((m, i) => (
          <button key={i} className="mr-member" onClick={() => setOpenIndex(i)}>
            <div
              className="mr-avatar"
              style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined}
            />
            <div className="mr-m-name">{m.name}</div>
          </button>
        ))}
      </div>

      {openIndex != null && activeList[openIndex] && (
        <DetailOverlay members={activeList} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  );
}

function DetailOverlay({ members, startIndex, onClose }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(startIndex);

  // Jump to the clicked member's slide on open.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
  }, [startIndex]);

  useEffect(() => {
    const onKey = (e) => {
      const el = trackRef.current;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
      else if (e.key === 'ArrowRight' && el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="mr-overlay" onClick={onClose}>
      <div className="mr-carousel" ref={trackRef} onScroll={onScroll}>
        {members.map((m, i) => (
          <div className="mr-slide" key={i}>
            <div className="mr-detail" onClick={(e) => e.stopPropagation()}>
              <button className="mr-close" onClick={onClose} aria-label="Close">×</button>
              <div
                className="mr-d-avatar"
                style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined}
              />
              <div className="mr-d-name">{m.name}</div>
              <div className="mr-d-role">{m.category}</div>
              <div className="mr-d-bio" dangerouslySetInnerHTML={{ __html: sanitizeBioHtml(m.bio) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mr-dots">
        {members.map((_, i) => (
          <button
            key={i}
            className={`mr-dot ${i === active ? 'active' : ''}`}
            aria-label={`Go to member ${i + 1}`}
            onClick={() => {
              const el = trackRef.current;
              if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default ClubMemberScroll;
