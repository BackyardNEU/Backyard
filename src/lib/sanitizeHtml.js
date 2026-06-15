// Whitelist sanitizer for member-bio rich text. Editor bios are produced by a
// contentEditable + execCommand toolbar (bold/italic/underline/bullets/numbered).
// We rebuild a clean tree keeping only formatting tags and dropping ALL attributes,
// comments, and other elements (so injected scripts/handlers/styles can't survive).

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'P', 'BR']);

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clean(node) {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += escapeText(child.nodeValue);
    } else if (child.nodeType === 1) {
      const tag = child.tagName;
      if (ALLOWED.has(tag)) {
        const t = tag.toLowerCase();
        out += t === 'br' ? '<br>' : `<${t}>${clean(child)}</${t}>`;
      } else {
        out += clean(child); // unwrap unknown elements, keep their sanitized contents
      }
    }
    // comments / other node types are dropped
  });
  return out;
}

/**
 * @param {string} html
 * @returns {string} sanitized HTML containing only b/strong/i/em/u/ul/ol/li/p/br
 */
export function sanitizeBioHtml(html) {
  if (!html) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return clean(tpl.content);
}
