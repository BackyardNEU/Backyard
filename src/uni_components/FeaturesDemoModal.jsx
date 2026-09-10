import { useState, useEffect, useRef, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
// Plain chevrons, not the *Circle variants: those glyphs are a filled disc, so the disc
// IS the shape and a CSS background behind it would never show. The button carries the
// circle instead (border-radius + background), which is what makes the two-tone hover
// possible.
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import editBtnDemo from '../assets/editbtndemo.mp4';
import modulesExpandDemo from '../assets/modulesexpanddemo.mp4';
import dragAndHideDemo from '../assets/dragandhidedemo.mp4';
import categoriesDemo from '../assets/categoriesdemo.mp4';
import addEventsDemo from '../assets/addeventsdemo.mp4';
import './FeaturesDemoModal.css';

// How long "Welcome to Backyard!" holds before it cross-fades into the walkthrough.
const WELCOME_MS = 1500;

// Ordered as a lesson rather than by filename: find the button, open a module, rearrange
// what you opened, then the two things worth filling in first.
//
// One array so reordering or rewording is a single edit — the component reads length and
// index off it and nothing else knows how many slides there are.
const SLIDES = [
  { src: editBtnDemo, caption: 'Hit Edit Page to start making changes.' },
  { src: modulesExpandDemo, caption: 'Open any module to edit what’s inside it.' },
  { src: dragAndHideDemo, caption: 'Drag to reorder. Hide anything you don’t need yet.' },
  { src: categoriesDemo, caption: 'Pick the categories that describe your club.' },
  { src: addEventsDemo, caption: 'Add events so people know what’s coming up.' },
];

/**
 * First-run walkthrough for new club editors. Mounted by ExpandedTile as a sibling of
 * .expanded-card — see the note there about why it cannot be nested inside it.
 *
 * @param {Object}   props
 * @param {Function} props.onClose - called on backdrop click, the × button, or Escape.
 */
export default function FeaturesDemoModal({ onClose }) {
  const [phase, setPhase] = useState('welcome'); // 'welcome' | 'carousel'
  const [index, setIndex] = useState(0);
  const videoRefs = useRef([]);

  // Cleared on unmount so closing during the welcome hold cannot set state on an
  // unmounted component.
  useEffect(() => {
    const t = setTimeout(() => setPhase('carousel'), WELCOME_MS);
    return () => clearTimeout(t);
  }, []);

  // Only the visible slide plays. Five <video> elements playing at once is five decoders
  // for four things nobody is looking at; paired with preload="none" below, the offscreen
  // clips are never even fetched until they are paged to.
  useEffect(() => {
    if (phase !== 'carousel') return;
    videoRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === index) {
        el.play().catch(() => {
          // Autoplay can still be refused (low power mode, a strict policy). The frame
          // stays visible and the caption still explains it, so there is nothing to do.
        });
      } else {
        el.pause();
      }
    });
  }, [index, phase]);

  const go = useCallback((delta) => {
    setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (phase !== 'carousel') return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, phase]);

  const atStart = index === 0;
  const atEnd = index === SLIDES.length - 1;

  return (
    <div className="fd-backdrop" onClick={onClose}>
      <motion.div
        className="fd-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Backyard"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <button type="button" className="fd-close" onClick={onClose} aria-label="Close">×</button>

        <AnimatePresence mode="wait">
          {phase === 'welcome' ? (
            <motion.div
              key="welcome"
              className="fd-welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="fd-welcome-title">Welcome to Backyard!</h2>
              <p className="fd-welcome-sub">Here&apos;s how to build your club page.</p>
            </motion.div>
          ) : (
            <motion.div
              key="carousel"
              className="fd-carousel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="fd-stage">
                {SLIDES.map((slide, i) => (
                  <div
                    key={slide.src}
                    className={`fd-slide${i === index ? ' fd-slide--active' : ''}`}
                    aria-hidden={i !== index}
                  >
                    <video
                      // Kick the active clip off from the ref callback, not only from
                      // the effect above. AnimatePresence mode="wait" holds this subtree
                      // back until the welcome card has finished exiting, so by the time
                      // these mount the phase effect has already run against empty refs —
                      // slide 1 sat black until an index change happened to re-run it.
                      // The paused guard keeps this from re-calling play() every render.
                      ref={(el) => {
                        videoRefs.current[i] = el;
                        if (el && i === index && el.paused) el.play().catch(() => {});
                      }}
                      className="fd-video"
                      src={slide.src}
                      muted
                      loop
                      playsInline
                      // Only the visible clip is worth fetching, but it wants a real head
                      // start: with preload="none" nothing loads until play() lands, which
                      // shows a black frame first.
                      preload={i === index ? 'auto' : 'none'}
                    />
                    <p className="fd-caption">{slide.caption}</p>
                  </div>
                ))}
              </div>

              <div className="fd-nav">
                <button
                  type="button"
                  className="fd-chevron"
                  onClick={() => go(-1)}
                  disabled={atStart}
                  aria-label="Previous"
                >
                  <IoChevronBack />
                </button>

                <div className="fd-dots">
                  {SLIDES.map((slide, i) => (
                    <button
                      key={slide.src}
                      type="button"
                      className={`fd-dot${i === index ? ' fd-dot--active' : ''}`}
                      onClick={() => setIndex(i)}
                      aria-label={`Go to step ${i + 1}`}
                      aria-current={i === index}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="fd-chevron"
                  onClick={atEnd ? onClose : () => go(1)}
                  aria-label={atEnd ? 'Done' : 'Next'}
                >
                  <IoChevronForward />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
