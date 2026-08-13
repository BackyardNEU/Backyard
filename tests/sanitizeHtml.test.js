import { describe, it, expect } from 'vitest';
import { sanitizeBioHtml } from '../shared/sanitizeHtml.js';

// src/lib/sanitizeHtml.js does the same job with document.createElement('template'),
// which is browser-only, so it could never run on the server. That left PUT
// /clubs/:clubId/page doing no HTML sanitization at all, while JoinModule.jsx rendered
// join-tab bodies through dangerouslySetInnerHTML. Harmless only while every writer
// was a trusted moderator — the club onboarding wizard hands that write access to
// strangers, so this had to become DOM-free and run on writes.

describe('sanitizeBioHtml — allowed formatting', () => {
    it('keeps the formatting tags the editor toolbar produces', () => {
        expect(sanitizeBioHtml('<b>bold</b>')).toBe('<b>bold</b>');
        expect(sanitizeBioHtml('<strong>s</strong>')).toBe('<strong>s</strong>');
        expect(sanitizeBioHtml('<i>i</i><em>e</em><u>u</u>')).toBe('<i>i</i><em>e</em><u>u</u>');
    });

    it('keeps list structure', () => {
        expect(sanitizeBioHtml('<ul><li>one</li><li>two</li></ul>')).toBe(
            '<ul><li>one</li><li>two</li></ul>'
        );
    });

    it('keeps paragraphs and line breaks', () => {
        expect(sanitizeBioHtml('<p>a</p><br>')).toBe('<p>a</p><br>');
    });

    it('lowercases tag names', () => {
        expect(sanitizeBioHtml('<B>x</B>')).toBe('<b>x</b>');
    });

    it('returns an empty string for empty input', () => {
        expect(sanitizeBioHtml('')).toBe('');
        expect(sanitizeBioHtml(null)).toBe('');
        expect(sanitizeBioHtml(undefined)).toBe('');
    });
});

describe('sanitizeBioHtml — attribute stripping', () => {
    // Every attribute goes, not just the dangerous ones. An allowlist of tags plus a
    // blanket attribute drop is far easier to reason about than an attribute denylist.
    it('drops all attributes from allowed tags', () => {
        expect(sanitizeBioHtml('<b class="x" id="y">t</b>')).toBe('<b>t</b>');
    });

    it('drops event handlers on allowed tags', () => {
        expect(sanitizeBioHtml('<b onclick="alert(1)">t</b>')).toBe('<b>t</b>');
    });

    it('drops style attributes', () => {
        expect(sanitizeBioHtml('<p style="position:fixed;top:0">t</p>')).toBe('<p>t</p>');
    });
});

describe('sanitizeBioHtml — XSS payloads', () => {
    it('neutralises the img onerror payload', () => {
        const out = sanitizeBioHtml('<img src=x onerror=alert(1)>');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('onerror');
    });

    it('neutralises script tags, keeping only inert escaped text', () => {
        const out = sanitizeBioHtml('<script>alert(1)</script>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('<');
    });

    it('neutralises svg onload', () => {
        const out = sanitizeBioHtml('<svg/onload=alert(1)>');
        expect(out).not.toContain('<svg');
        expect(out).not.toContain('onload');
    });

    it('neutralises iframes', () => {
        expect(sanitizeBioHtml('<iframe src="//evil.com"></iframe>')).not.toContain('<iframe');
    });

    it('strips anchors, since links are not in the allowlist', () => {
        const out = sanitizeBioHtml('<a href="javascript:alert(1)">click</a>');
        expect(out).not.toContain('<a');
        expect(out).not.toContain('javascript:');
        expect(out).toBe('click');
    });

    // The property that makes this safe by construction: every < in the output was
    // emitted by us, never passed through from input.
    it('escapes stray angle brackets in text', () => {
        expect(sanitizeBioHtml('1 < 2 && 3 > 2')).toBe('1 &lt; 2 &amp;&amp; 3 &gt; 2');
    });

    // A '<' followed by a space is literal text, not a tag. Treating it as one consumed
    // to the next '>' (or to the end of the string) and deleted everything after it.
    it('does not swallow text after a "<" followed by a space', () => {
        expect(sanitizeBioHtml('a < b always')).toBe('a &lt; b always');
        expect(sanitizeBioHtml('under < 20 people show up')).toBe('under &lt; 20 people show up');
    });

    it('drops comments, including conditional-comment tricks', () => {
        expect(sanitizeBioHtml('a<!-- <script>alert(1)</script> -->b')).toBe('ab');
    });

    it('does not emit a raw angle bracket for a malformed tag', () => {
        const out = sanitizeBioHtml('<b<script>alert(1)</script>');
        expect(out).not.toContain('<script');
    });
});

describe('sanitizeBioHtml — unwrapping', () => {
    it('unwraps unknown elements but keeps their sanitized contents', () => {
        expect(sanitizeBioHtml('<div><b>kept</b></div>')).toBe('<b>kept</b>');
    });

    it('unwraps nested unknown elements', () => {
        expect(sanitizeBioHtml('<div><span><b>deep</b></span></div>')).toBe('<b>deep</b>');
    });
});

describe('sanitizeBioHtml — balance', () => {
    // Unbalanced output would break the surrounding page layout when injected via
    // dangerouslySetInnerHTML, so unclosed tags get closed rather than passed through.
    it('closes an unclosed allowed tag', () => {
        expect(sanitizeBioHtml('<b>unclosed')).toBe('<b>unclosed</b>');
    });

    it('ignores a stray closing tag that was never opened', () => {
        expect(sanitizeBioHtml('text</b>')).toBe('text');
    });

    // The branch sanitizes on write, again on approve, and again at render, so a
    // non-idempotent pass corrupts text a little more every save. The original fixture
    // here had no &, < or > in any TEXT position, so it passed while "Arts &amp; Crafts"
    // was quietly degrading to "&amp;amp;amp;" in production.
    it('is idempotent over text containing ampersands and brackets', () => {
        const inputs = [
            '<p>Arts &amp; Crafts</p>',
            'Tryouts Tue &amp; Thu',
            '1 &lt; 2 &amp;&amp; 3 &gt; 2',
            '<b>Q&amp;A</b> with the e-board',
            '&lt;script&gt;alert(1)&lt;/script&gt;',
        ];
        for (const input of inputs) {
            const once = sanitizeBioHtml(input);
            expect(sanitizeBioHtml(once), `not idempotent for: ${input}`).toBe(once);
            expect(sanitizeBioHtml(sanitizeBioHtml(once))).toBe(once);
        }
    });

    it('does not double-escape an existing entity', () => {
        expect(sanitizeBioHtml('Arts &amp; Crafts')).toBe('Arts &amp; Crafts');
        expect(sanitizeBioHtml('<p>Q&amp;A</p>')).toBe('<p>Q&amp;A</p>');
    });

    // Decoding happens before escaping, so a decoded angle bracket still cannot become
    // markup — it comes back out escaped like any other stray bracket.
    it('keeps decoded brackets inert', () => {
        const out = sanitizeBioHtml('&lt;img src=x onerror=alert(1)&gt;');
        expect(out).not.toContain('<img');
        expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('decodes numeric references without letting them through as markup', () => {
        expect(sanitizeBioHtml('&#38;')).toBe('&amp;');
        expect(sanitizeBioHtml('&#x3C;b&#x3E;')).toBe('&lt;b&gt;');
    });

    // An unrecognised entity is not decoded, so its '&' is a literal ampersand and gets
    // escaped like any other. Still stable on a second pass, which is what matters.
    it('escapes the ampersand of an unrecognised entity, and stays stable', () => {
        const once = sanitizeBioHtml('AT&amp;T &notreal; x');
        expect(once).toBe('AT&amp;T &amp;notreal; x');
        expect(sanitizeBioHtml(once)).toBe(once);
    });
});
