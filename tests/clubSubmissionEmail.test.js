import { describe, it, expect } from 'vitest';
import { renderClubSubmissionEmail } from '../server/lib/emails/clubSubmissionEmail.js';

describe('renderClubSubmissionEmail', () => {
    it('names the club in the subject', () => {
        const { subject } = renderClubSubmissionEmail({ clubName: 'Chess Club' });
        expect(subject).toContain('Chess Club');
    });

    it('greets by first name when there is one', () => {
        expect(renderClubSubmissionEmail({ clubName: 'Chess Club', firstName: 'Alex' }).html)
            .toContain('Thanks, Alex');
    });

    it('still reads properly without a name', () => {
        const { html } = renderClubSubmissionEmail({ clubName: 'Chess Club' });
        expect(html).toContain('Thanks');
        expect(html).not.toContain('Thanks, ');
    });

    it('falls back when the club name is missing', () => {
        const { subject, html } = renderClubSubmissionEmail({});
        expect(subject).toContain('your club');
        expect(html).toContain('your club');
    });

    // Club names come from people contacted over Instagram and land inside HTML that mail
    // clients render. A stray angle bracket would break the layout at best.
    it('escapes HTML in the club name', () => {
        const { html } = renderClubSubmissionEmail({ clubName: '<script>alert(1)</script>' });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in the first name', () => {
        const { html } = renderClubSubmissionEmail({ clubName: 'Chess', firstName: '<b>x</b>' });
        expect(html).not.toContain('<b>x</b>');
    });

    it('escapes quotes, which would otherwise break an inline attribute', () => {
        const { html } = renderClubSubmissionEmail({ clubName: 'The "Best" Club' });
        expect(html).toContain('&quot;');
    });

    // Outlook and others block images by default, so the message has to work without them.
    it('carries the whole message in text, not images', () => {
        const { text } = renderClubSubmissionEmail({ clubName: 'Chess Club' });
        expect(text).toContain('Chess Club');
        expect(text).toContain('couple of days');
        expect(text).not.toContain('<');
    });

    it('tells the club what happens next rather than just thanking them', () => {
        const { html } = renderClubSubmissionEmail({ clubName: 'Chess Club' });
        expect(html).toMatch(/read every page|couple of days/i);
    });

    // Mail clients strip <style> blocks, so anything not inline is lost.
    it('uses inline styles only', () => {
        const { html } = renderClubSubmissionEmail({ clubName: 'Chess Club' });
        expect(html).not.toContain('<style');
        expect(html).toContain('style="');
    });
});
