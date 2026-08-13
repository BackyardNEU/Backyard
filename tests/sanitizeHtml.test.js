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

    it('is idempotent — sanitizing twice equals sanitizing once', () => {
        const once = sanitizeBioHtml('<div><b>x</b><script>y</script></div>');
        expect(sanitizeBioHtml(once)).toBe(once);
    });
});
