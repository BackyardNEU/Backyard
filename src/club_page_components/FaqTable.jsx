import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import borderBlackImg from '/src/assets/border.svg';
import borderHorizontalBlackImg from '/src/assets/border-horizontal.svg';

/* palette pulled from the mockup */
const BLUE = "#da0000ff";

const ROW_A = "#3b4b6c";
const ROW_B = "#51658dff";
const INK = "#CFD2E5";
const MUTED = "#ffffffff";
const VLINE = "#ffffffff";
const SECTION_LINE = "#CFD2E5";
const GRID_LINE = "#Ece7e5";

const ROW_H = 50;
const USER_VISIBLE = 3;
const OWNER_VISIBLE = 5;
const COLS = "64px 1fr 1fr";

/**
 * Editor-facing FAQ table (only rendered in edit mode).
 *
 * Top section: user-submitted questions (read-only question text; the editor types an answer
 * and clicks Accept). Bottom section: the club's own FAQs (fully editable + an add row).
 *
 * All effects are optimistic and committed by the page-level Save:
 *  - onAccept(id, answer): parent appends {q,a} to the faqs module draft + marks the row to delete.
 *  - onDelete(id):         parent marks the row to delete.
 *  - onChange(nextFaqs):   parent updates the faqs module draft (owner FAQs).
 *
 * @param {Array}  faqs          - the club's FAQs: [{ q, a }]
 * @param {Function} onChange    - (nextFaqs) => void
 * @param {Array}  userQuestions - pending submissions: [{ id, question }]
 * @param {Function} onAccept    - (id, answer) => void
 * @param {Function} onDelete    - (id) => void
 */
export default function FaqTable({ faqs = [], onChange, userQuestions = [], onAccept, onDelete }) {
  // Transient answer drafts the editor types before accepting (keyed by question id).
  const [answers, setAnswers] = useState({});

  // ----- active cell (spreadsheet selection) -----
  const [activeKey, setActiveKey] = useState(null);
  const [rect, setRect] = useState(null);
  const activeElRef = useRef(null);

  const updateRect = useCallback(() => {
    const el = activeElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, []);

  const select = (key, el) => {
    activeElRef.current = el;
    setActiveKey(key);
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  };
  const clearSel = () => { setActiveKey(null); activeElRef.current = null; setRect(null); };

  useEffect(() => {
    if (!activeKey) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateRect); };
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    const onDown = (e) => {
      if (e.target.closest("[data-cellkey]") || e.target.closest(".cell-overlay")) return;
      clearSel();
    };
    const onKey = (e) => { if (e.key === "Escape") clearSel(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [activeKey, updateRect]);

  // ----- mutations -----
  const setUserAnswer = (id, val) => setAnswers((a) => ({ ...a, [id]: val }));

  const acceptUser = (id) => {
    const row = userQuestions.find((r) => r.id === id);
    const ans = (answers[id] || "").trim();
    if (row && ans) onAccept?.(id, ans);
    setAnswers((prev) => { const n = { ...prev }; delete n[id]; return n; });
    clearSel();
  };

  const deleteUser = (id) => { onDelete?.(id); clearSel(); };

  const deleteFaq = (index) => { onChange?.(faqs.filter((_, i) => i !== index)); clearSel(); };

  // edit a faq cell; typing into the trailing "add" index appends a new faq
  const setFaqCell = (index, field, val) => {
    const next = faqs.slice();
    while (next.length <= index) next.push({ q: "", a: "" });
    next[index] = { ...next[index], [field]: val };
    onChange?.(next);
  };

  const unanswered = userQuestions.length;

  // ----- derive the active cell's meta for the overlay -----
  let overlay = null;
  if (activeKey && rect) {
    const [sec, idxS, col] = activeKey.split(":");
    const index = Number(idxS);
    if (sec === "u") {
      const row = userQuestions[index];
      if (row) overlay = col === "q"
        ? { value: row.question, editable: false }
        : { value: answers[row.id] || "", editable: true, placeholder: "enter answer here", onChange: (v) => setUserAnswer(row.id, v), maxLength: 500 };
    } else {
      const row = faqs[index];
      const isQ = col === "q";
      overlay = {
        value: row ? (isQ ? row.q : row.a) : "",
        editable: true,
        placeholder: isQ ? "enter a common question here" : "enter answer here",
        onChange: (v) => setFaqCell(index, isQ ? "q" : "a", v),
        maxLength: isQ ? 100 : 500,
      };
    }
  }

  return (
    <div className="faq-table-wrap">
      <style>{cssText}</style>

      {/* count pill */}
      <div className="faq-count-pill" style={{ background: BLUE }}>
        {unanswered} unanswered question{unanswered === 1 ? "" : "s"}
      </div>

      <div style={{ overflowX: "auto" }}>
        <div className="faq-table-box" style={{ position: "relative", minWidth: 760, border: `2px solid ${VLINE}`,  overflow: "hidden", background: "#fff" }}>
          <img src={borderBlackImg} alt="" className="faq-border faq-border-left" />
          <img src={borderBlackImg} alt="" className="faq-border faq-border-right" />
          <div
            className="faq-border-h-wrap faq-border-top-wrap"
            style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
            aria-hidden="true"
          />
          <div
            className="faq-border-h-wrap faq-border-bottom-wrap"
            style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
            aria-hidden="true"
          />

          {/* ===== user questions (submitted) ===== */}
          {/* Height tracks the actual question count (1 question = 1 row tall) instead of
              always padding to USER_VISIBLE with filler rows — caps at USER_VISIBLE, then scrolls. */}
          <Section visible={Math.min(userQuestions.length, USER_VISIBLE)}>
            {userQuestions.map((row, i) => (
              <Row key={row.id} i={i}>
                <XCell variant="circle" onClick={() => deleteUser(row.id)} />
                <Cell ck={`u:${i}:q`} value={row.question} activeKey={activeKey} onSelect={select} />
                <AnswerCell
                  ck={`u:${i}:a`} value={answers[row.id] || ""} placeholder="enter answer here"
                  activeKey={activeKey} onSelect={select}
                  accept={(answers[row.id] || "").trim() ? () => acceptUser(row.id) : null}
                />
              </Row>
            ))}
          </Section>

          {/* divider between the two sets */}
          <div style={{ height: 2, background: SECTION_LINE }} />

          {/* ===== owner FAQs (editable) ===== */}
          {/* Height tracks real faqs + the trailing "add" row (3 questions = 4 rows tall)
              instead of always padding to OWNER_VISIBLE with filler rows — caps at
              OWNER_VISIBLE, then scrolls. */}
          <Section visible={Math.min(faqs.length + 1, OWNER_VISIBLE)}>
            {ownerRows(faqs).map((row, i) => (
              <Row key={`o${i}`} i={i}>
                {row.kind === "data"
                  ? <XCell variant="plain" onClick={() => deleteFaq(i)} />
                  : <div />}
                <Cell ck={`f:${i}:q`} value={row.q}
                  placeholder={row.kind === "add" ? "enter a common question here" : ""}
                  activeKey={activeKey} onSelect={select} />
                <AnswerCell ck={`f:${i}:a`} value={row.a}
                  placeholder={row.kind === "add" ? "enter answer here" : ""}
                  activeKey={activeKey} onSelect={select} accept={null} />
              </Row>
            ))}
          </Section>
        </div>
      </div>

 

      {overlay && rect && <Overlay rect={rect} meta={overlay} onClose={clearSel} />}
    </div>
  );
}

/* ---------- layout helpers ---------- */

function Section({ visible, children }) {
  return (
    <div className="tbl-scroll" style={{ height: visible * ROW_H, overflowY: "auto", overflowX: "hidden" }}>
      {children}
    </div>
  );
}

function Row({ i, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, height: ROW_H,
      background: i % 2 === 0 ? ROW_A : ROW_B, borderBottom: `1px solid ${GRID_LINE}` }}>
      {children}
    </div>
  );
}

function XCell({ variant, onClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${GRID_LINE}` }}>
      {variant === "circle" ? (
        <button onClick={onClick} aria-label="Delete question" style={{ all: "unset", cursor: "pointer",
          width: 25, height: 30, borderRadius: 8, background: BLUE, color: "#ffffffff",
          display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600,
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}
          onMouseDown={(e) => e.stopPropagation()}>x</button>
      ) : (
        <button onClick={onClick} aria-label="Delete row" style={{ all: "unset", cursor: "pointer",
          color: "#ffffffff", fontSize: 18, lineHeight: 1, padding: 6 }}
          onMouseDown={(e) => e.stopPropagation()}>×</button>
      )}
    </div>
  );
}

function Cell({ ck, value, placeholder, activeKey, onSelect }) {
  const active = activeKey === ck;
  return (
    <div data-cellkey={ck} onMouseDown={(e) => onSelect(ck, e.currentTarget)}
      style={{ ...cellBase,
        boxShadow: active ? `inset 0 0 0 2px #000` : "none", cursor: "text" }}>
      {value
        ? <span style={cellText}>{value}</span>
        : <span style={{ ...cellText, color: MUTED }}>{placeholder || ""}</span>}
    </div>
  );
}

function AnswerCell({ ck, value, placeholder, activeKey, onSelect, accept }) {
  const active = activeKey === ck;
  return (
    <div data-cellkey={ck} onMouseDown={(e) => onSelect(ck, e.currentTarget)}
      style={{ ...cellBase, position: "relative", paddingRight: accept ? 104 : 18, borderRight: "none",
        boxShadow: active ? `inset 0 0 0 2px #000` : "none", cursor: "text" }}>
      {value
        ? <span style={cellText}>{value}</span>
        : <span style={{ ...cellText, color: MUTED }}>{placeholder || ""}</span>}
      {accept && (
        <button onClick={accept} onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
            background: BLUE, color: "#fff", border: "none", borderRadius: 999, cursor: "pointer",
            padding: "6px 16px", fontSize: 14, fontWeight: 500, boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>
          Add to Faqs
        </button>
      )}
    </div>
  );
}

const cellBase = { display: "flex", alignItems: "center", padding: "0 18px", overflow: "hidden", minWidth: 0, borderRight: `1px solid ${GRID_LINE}` };
const cellText = { fontSize: 19, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/* trailing "add" row + filler padding for the owner section */
function ownerRows(faqs) {
  const rows = faqs.map((f) => ({ kind: "data", ...f }));
  rows.push({ kind: "add", q: "", a: "" });           // editable add row
  return rows;
}

/* ---------- Google-Sheets style overflow overlay ---------- */

function Overlay({ rect, meta, onClose }) {
  const taRef = useRef(null);
  const resize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(rect.height - 16, ta.scrollHeight) + "px";
  };
  useLayoutEffect(() => { if (meta.editable) { const ta = taRef.current; if (ta) { ta.focus(); resize(); } } });

  const maxW = Math.min(560, Math.max(rect.width, rect.width * 2.2));
  return (
    <div className="cell-overlay" style={{ position: "fixed", left: rect.left, top: rect.top,
      minWidth: rect.width, maxWidth: maxW, minHeight: rect.height, zIndex: 9600,
      background: "#CFD2E5", border: `1px solid #000`, borderRadius: 3,
      boxShadow: "0 6px 22px rgba(0,0,0,0.22)", display: "flex", alignItems: "center",
      padding: "0 16px" }}>
      {meta.editable ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
          <textarea ref={taRef} value={meta.value} placeholder={meta.placeholder}
            maxLength={meta.maxLength}
            onChange={(e) => { meta.onChange(e.target.value); resize(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onClose(); } }}
            rows={1} style={{ width: "100%", resize: "none", border: "none", outline: "none",
              background: "transparent", fontSize: 19, color: "#000000ff", lineHeight: 1.3,
              fontFamily: "inherit", padding: "9px 0", overflow: "hidden" }} />
          {meta.maxLength && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "0.72rem", color: "#000" }}>{meta.value.length}/{meta.maxLength}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 19, color: "000000ff", lineHeight: 1.35, padding: "10px 0",
          whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{meta.value}</div>
      )}
    </div>
  );
}

const cssText = `
  .faq-table-wrap { width: 100%; margin-top: 16px; font-family: 'Barlow Condensed', sans-serif; }
  .faq-count-pill { display: inline-flex; align-items: center; margin-bottom: 14px; padding: 8px 18px;
    border-radius: 10px; color: #fff; font-weight: 400; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
  .tbl-scroll::-webkit-scrollbar { width: 12px; }
  .tbl-scroll::-webkit-scrollbar-thumb { background: #cfcfcf; border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
  .tbl-scroll::-webkit-scrollbar-track { background: transparent; }
  .cell-overlay textarea::placeholder { color: ${MUTED}; }

  /* Subtle noise/grain overlay on top of the table's background */
  .faq-table-box::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.19'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  /* Decorative vine border (black, matches the calendar's) */
  .faq-border {
    position: absolute;
    top: 0;
    height: 100%;
    width: auto;
    pointer-events: none;
    z-index: 5;
  }
  .faq-border-left { left: 0; transform: scaleX(0.8); transform-origin: left center; }
  .faq-border-right { right: 0; transform: scaleX(-0.8); transform-origin: center; }

  .faq-border-h-wrap {
    position: absolute;
    left: 0;
    width: 100%;
    height: 5px;
    background-repeat: repeat-x;
    background-position: left center;
    background-size: auto 100%;
    pointer-events: none;
    z-index: 5;
  }
  .faq-border-top-wrap { top: 0; }
  .faq-border-bottom-wrap { bottom: 0; }
`;
