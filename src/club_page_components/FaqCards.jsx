import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

/**
 * Viewer-facing FAQ cards: a horizontal row of flip cards (question → answer).
 * When `canAsk`, a leading "ask" card lets a logged-in non-editor submit one question.
 *
 * @param {string} clubId
 * @param {Array}  faqs   - [{ q, a }]
 * @param {boolean} canAsk
 */
function FaqCards({ clubId, faqs = [], canAsk = false }) {
  if (faqs.length === 0 && !canAsk) return null;

  return (
    <div className="faq-cards-row">
      {canAsk && <AskCard clubId={clubId} />}
      {faqs.map((f, i) => (
        <FlipCard key={i} q={f.q} a={f.a} />
      ))}
    </div>
  );
}

function AskCard({ clubId }) {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  const [takingOff, setTakingOff] = useState(false);

  // Reflect a previously-submitted question ("one per club") as the sent state.
  useEffect(() => {
    let alive = true;
    apiFetch(`/clubs/${clubId}/questions/mine`)
      .then((mine) => { if (alive && mine) setSent(true); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [clubId]);

  const submit = async () => {
    const q = value.trim();
    if (!q || sent || takingOff) return;
    setTakingOff(true); // start the send-icon takeoff animation immediately
    try {
      await apiFetch(`/clubs/${clubId}/questions`, { method: 'POST', body: { question: q } });
    } catch (err) {
      if (err.status !== 409) {
        console.error('Submit question failed:', err);
        setTakingOff(false);
        return;
      }
    }
    // let the 0.8s takeoff play out, then switch to the sent state
    setTimeout(() => { setValue(''); setSent(true); setTakingOff(false); }, 800);
  };

  return (
    <div className="faq-card faq-ask">
      <div className="faq-user-bubble">
        <div className={`faq-ask-card ${sent ? 'sent' : ''}`}>
          {sent ? (
            <div className="faq-sent">sent</div>
          ) : (
            <>
              <textarea
                className="faq-ask-input"
                placeholder="ask rac"
                rows={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!ready}
              />
              <div className="faq-spacer" />
              <button
                className={`faq-send ${value.trim() ? 'active' : ''} ${takingOff ? 'takeoff' : ''}`}
                onClick={submit}
                aria-label="Send question"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </>
          )}
        </div>

        {/* triangle tail */}
        <div className="faq-triangle">
          <div className="faq-triangle-stroke">
            <div className="faq-triangle-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlipCard({ q, a }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div
      className={`faq-card faq-flip ${showAnswer ? 'show-answer' : ''}`}
      onClick={() => setShowAnswer((s) => !s)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') setShowAnswer((s) => !s); }}
    >
      <div className="faq-flip-face faq-flip-front">
        <div className="faq-q">{q}</div>
        <div className="faq-flip-hint">tap to see answer</div>
      </div>
      <div className="faq-flip-face faq-flip-back">
        <div className="faq-q-small">{q}</div>
        <div className="faq-a">{a}</div>
      </div>
    </div>
  );
}

export default FaqCards;
