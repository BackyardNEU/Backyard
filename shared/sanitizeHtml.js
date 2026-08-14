// Allowlist sanitizer for rich text produced by the contentEditable toolbars
// (bold/italic/underline/bullets/numbered) used by member bios and club join tabs.
//
// src/lib/sanitizeHtml.js does the same job via document.createElement('template'),
// which is browser-only. That made it impossible to sanitize on the server, so
// PUT /clubs/:clubId/page stored whatever it was handed while JoinModule.jsx rendered
// it through dangerouslySetInnerHTML. Safe only while every writer was a trusted
// moderator; the club onboarding wizard hands write access to people outside the team.
//
// This implementation is a small tokenizer with no DOM dependency, so the same code
// runs on both sides. It is safe by construction: all text is escaped, and the only
// '<' characters in the output are ones this file emits for allowlisted tags.

const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br']);

// Void elements never get a closing tag and must not go on the open-tag stack.
const VOID = new Set(['br']);

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

// Decoding before escaping is what makes this idempotent, and idempotence is required:
// the same string is sanitized on write, again on approve, and again at render. Escaping
// unconditionally turned "Arts &amp; Crafts" into "&amp;amp;" and then "&amp;amp;amp;",
// visibly corrupting text a little more on every save.
//
// The DOM implementation this replaced got the behaviour for free — innerHTML parsed
// entities into text nodes, and re-escaping them round-tripped.
function decodeEntities(s) {
    return s.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
            try {
                return String.fromCodePoint(code);
            } catch {
                return match;
            }
        }
        const named = NAMED_ENTITIES[body.toLowerCase()];
        return named === undefined ? match : named;
    });
}

// Decode first, then escape. Escaping last means a decoded '<' can never reach the
// output as markup — it becomes &lt; like any other stray angle bracket.
function escapeText(s) {
    return decodeEntities(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * @param {string} html
 * @returns {string} HTML containing only b/strong/i/em/u/ul/ol/li/p/br, no attributes
 */
export function sanitizeBioHtml(html) {
    if (!html) return '';

    const input = String(html);
    let out = '';
    let i = 0;
    const openTags = [];

    while (i < input.length) {
        const lt = input.indexOf('<', i);

        // No more markup — escape the rest and stop.
        if (lt === -1) {
            out += escapeText(input.slice(i));
            break;
        }

        // Text before this '<'.
        if (lt > i) out += escapeText(input.slice(i, lt));

        const rest = input.slice(lt);

        // Comments: drop entirely, including anything inside them.
        if (rest.startsWith('<!--')) {
            const end = input.indexOf('-->', lt + 4);
            i = end === -1 ? input.length : end + 3;
            continue;
        }

        // Declarations and processing instructions: drop.
        if (rest.startsWith('<!') || rest.startsWith('<?')) {
            const end = input.indexOf('>', lt);
            i = end === -1 ? input.length : end + 1;
            continue;
        }

        // No whitespace anywhere before the tag name. Browsers treat "< div" as literal
        // text, and accepting it as a tag turned "a < b always" into "a <b></b>",
        // silently deleting the rest of the sentence on every write.
        //
        // Both \s* have to go: dropping only the one after '<' left the one after the
        // optional '/', which occupies the same position for an opening tag.
        const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(rest);

        // A '<' that does not begin a tag is literal text (e.g. "1 < 2").
        if (!match) {
            out += '&lt;';
            i = lt + 1;
            continue;
        }

        const isClosing = match[1] === '/';
        const tag = match[2].toLowerCase();

        // Skip to the end of the tag. Everything between the name and '>' — attributes,
        // event handlers, inline styles — is discarded without being parsed.
        const gt = input.indexOf('>', lt);
        i = gt === -1 ? input.length : gt + 1;

        if (!ALLOWED.has(tag)) continue; // unwrap: contents still get processed

        if (isClosing) {
            // Ignore a closing tag that was never opened, so it cannot leak out.
            const idx = openTags.lastIndexOf(tag);
            if (idx === -1) continue;
            // Close anything left open inside it, innermost first.
            while (openTags.length > idx) out += `</${openTags.pop()}>`;
            continue;
        }

        if (VOID.has(tag)) {
            out += `<${tag}>`;
            continue;
        }

        out += `<${tag}>`;
        openTags.push(tag);
    }

    // Unclosed tags would break the layout of whatever renders this.
    while (openTags.length) out += `</${openTags.pop()}>`;

    return out;
}

export default sanitizeBioHtml;
