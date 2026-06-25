import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

/* palette pulled from the mockup */
const BLUE = "#000000ff";
const ROW_A = "#16193C";
const ROW_B = "#252951ff";
const INK = "#ffffffff";
const MUTED = "#b7b7b7ff";
const VLINE = "#ffffffff";
const SECTION_LINE = "#5b5964ff";

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
        <div style={{ minWidth: 760, border: `2px solid ${VLINE}`, borderRadius: 15, overflow: "hidden", background: "#fff" }}>
          {/* ===== user questions (submitted) ===== */}
          <Section visible={USER_VISIBLE}>
            {padTo(userQuestions, USER_VISIBLE).map((row, i) =>
              row ? (
                <Row key={row.id} i={i}>
                  <XCell variant="circle" onClick={() => deleteUser(row.id)} />
                  <Cell ck={`u:${i}:q`} value={row.question} activeKey={activeKey} onSelect={select} />
                  <AnswerCell
                    ck={`u:${i}:a`} value={answers[row.id] || ""} placeholder="enter answer here"
                    activeKey={activeKey} onSelect={select}
                    accept={(answers[row.id] || "").trim() ? () => acceptUser(row.id) : null}
                  />
                </Row>
              ) : <FillerRow key={`uf${i}`} i={i} />
            )}
          </Section>

          {/* divider between the two sets */}
          <div style={{ height: 2, background: SECTION_LINE }} />

          {/* ===== owner FAQs (editable) ===== */}
          <Section visible={OWNER_VISIBLE}>
            {ownerRows(faqs, OWNER_VISIBLE).map((row, i) =>
              row.kind === "filler" ? (
                <FillerRow key={`of${i}`} i={i} />
              ) : (
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
              )
            )}
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
      background: i % 2 === 0 ? ROW_A : ROW_B }}>
      {children}
    </div>
  );
}

function FillerRow({ i }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, height: ROW_H,
      background: i % 2 === 0 ? ROW_A : ROW_B }}>
      <div />
      <div />
      <div />
    </div>
  );
}

function XCell({ variant, onClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      {variant === "circle" ? (
        <button onClick={onClick} aria-label="Delete question" style={{ all: "unset", cursor: "pointer",
          width: 32, height: 32, borderRadius: 999, background: BLUE, color: "#fff",
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
      style={{ ...cellBase, position: "relative", paddingRight: accept ? 104 : 18,
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

const cellBase = { display: "flex", alignItems: "center", padding: "0 18px", overflow: "hidden", minWidth: 0 };
const cellText = { fontSize: 19, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/* trailing "add" row + filler padding for the owner section */
function ownerRows(faqs, visible) {
  const rows = faqs.map((f) => ({ kind: "data", ...f }));
  rows.push({ kind: "add", q: "", a: "" });           // editable add row
  while (rows.length < visible) rows.push({ kind: "filler" });
  return rows;
}
function padTo(arr, n) {
  const out = arr.slice();
  while (out.length < n) out.push(null);
  return out;
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
      background: "#fff", border: `1px solid #000`, borderRadius: 3,
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
    border-radius: 999px; color: #fff; font-weight: 600; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
  .tbl-scroll::-webkit-scrollbar { width: 12px; }
  .tbl-scroll::-webkit-scrollbar-thumb { background: #cfcfcf; border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
  .tbl-scroll::-webkit-scrollbar-track { background: transparent; }
  .cell-overlay textarea::placeholder { color: ${MUTED}; }
`;
