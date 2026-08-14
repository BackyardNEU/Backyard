import { describe, it, expect } from 'vitest';
import { renderChangesRequestedEmail } from '../server/lib/emails/changesRequestedEmail.js';

const note = 'Could you add a bit more detail about when you meet?';

describe('renderChangesRequestedEmail', () => {
    it('names the club in the subject', () => {
        expect(renderChangesRequestedEmail({ clubName: 'Chess Club', note }).subject)
            .toContain('Chess Club');
    });

    // The note is the entire point of the message.
    it('includes the note in both the HTML and the text part', () => {
        const { html, text } = renderChangesRequestedEmail({ clubName: 'Chess Club', note });
        expect(html).toContain(note);
        expect(text).toContain(note);
    });

    // A club should be able to tell what to fix from the inbox preview line.
    it('puts the note in the preheader', () => {
        const { html } = renderChangesRequestedEmail({ clubName: 'Chess', note });
        const preheader = html.split('</div>')[0];
        expect(preheader).toContain(note.slice(0, 40));
    });

    it('greets by first name when there is one', () => {
        expect(renderChangesRequestedEmail({ clubName: 'Chess', firstName: 'Alex', note }).html)
            .toContain('Hi Alex');
    });

    // The note is typed by a reviewer, but it still lands in rendered HTML.
    it('escapes HTML in the note', () => {
        const { html } = renderChangesRequestedEmail({
            clubName: 'Chess', note: '<script>alert(1)</script>',
        });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in the club name', () => {
        const { html } = renderChangesRequestedEmail({ clubName: '<b>Chess</b>', note });
        expect(html).not.toContain('<b>Chess</b>');
    });

    it('tells them their answers are still there', () => {
        const { html, text } = renderChangesRequestedEmail({ clubName: 'Chess', note });
        expect(html).toMatch(/still be there/i);
        expect(text).toMatch(/still be there/i);
    });

    it('reads without images and without a style block', () => {
        const { html, text } = renderChangesRequestedEmail({ clubName: 'Chess', note });
        expect(html).not.toContain('<style');
        expect(text).not.toContain('<');
    });
});
