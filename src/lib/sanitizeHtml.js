// Re-export of the shared implementation. This used to be a DOM-based sanitizer
// (document.createElement('template')), which meant it could only ever run in the
// browser — so the server stored whatever it was handed. The shared version is a
// DOM-free tokenizer with the same allowlist, so both sides run identical logic.
//
// Client-side sanitizing is UX only: it keeps the editor from producing junk. The
// server sanitizes on every write, and components sanitize again at render, so
// neither layer is solely load-bearing.
export { sanitizeBioHtml } from '../../shared/sanitizeHtml.js';
export { default } from '../../shared/sanitizeHtml.js';
