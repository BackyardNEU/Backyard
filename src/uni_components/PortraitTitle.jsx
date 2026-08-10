import { useState, useRef, useLayoutEffect } from 'react';
import './PortraitTitle.css';

// Title above the info card. Capped to 75% of the card's width; if the text
// is wider than that, it becomes an infinite right-to-left ticker — same
// measure-and-duplicate technique as ClubMediaModule's .cm-poster-text marquee.
// Shared between the calendar lightbox card and the add-event-card.
export default function PortraitTitle({ text }) {
  const wrapRef = useRef(null);
  const copyRef = useRef(null);
  const [marquee, setMarquee] = useState(false);
  const [dur, setDur] = useState(20);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const copy = copyRef.current;
    if (!wrap || !copy) return;
    const textW = copy.scrollWidth;
    const over = textW > wrap.clientWidth + 1;
    setMarquee(over);
    if (over) setDur(Math.max(6, textW / 20));
  }, [text]);

  if (!text) return null;

  return (
    <div className="cal-portrait-title-wrap" ref={wrapRef}>
      <div
        className={`cal-portrait-title-track ${marquee ? 'cal-portrait-title-marquee-on' : ''}`}
        style={{ '--cal-title-dur': `${dur}s` }}
      >
        <span ref={copyRef} className="cal-portrait-title-copy">{text}</span>
        {marquee && <span className="cal-portrait-title-copy" aria-hidden="true">{text}</span>}
      </div>
    </div>
  );
}
