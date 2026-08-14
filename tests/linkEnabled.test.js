import { describe, it, expect } from 'vitest';
import { sanitizeModules } from '../shared/sanitizeModules.js';

// BasicInfoModule renders `links.filter(l => l.enabled && l.url)`. The wizard created
// links without that flag, so every link a club added was dropped from their own page,
// on the preview and on the published version, with nothing on screen explaining why.

const withLinks = (links) => [{ type: 'basic_info', data: { links } }];
const linksOf = (modules) => sanitizeModules(modules)[0].data.links;

describe('link enabled flag', () => {
    it('treats a link with no flag as enabled', () => {
        expect(linksOf(withLinks([{ name: 'Instagram', url: 'https://instagram.com/x' }]))[0].enabled)
            .toBe(true);
    });

    // The club page editor can hide a link, and that has to survive a save from anywhere.
    it('preserves a deliberate false', () => {
        expect(linksOf(withLinks([{ name: 'Old', url: 'https://x.com', enabled: false }]))[0].enabled)
            .toBe(false);
    });

    it('leaves an explicit true alone', () => {
        expect(linksOf(withLinks([{ name: 'x', url: 'https://x.com', enabled: true }]))[0].enabled)
            .toBe(true);
    });

    it('fills the flag in while also normalizing the address', () => {
        const [link] = linksOf(withLinks([{ name: 'Instagram', url: 'instagram.com/x' }]));
        expect(link).toMatchObject({ enabled: true, url: 'https://instagram.com/x' });
    });

    // Both have to be true for the link to render, so a repaired flag on an unusable
    // address must not make it look fixed.
    it('still leaves an unusable address for the validator', () => {
        const [link] = linksOf(withLinks([{ name: 'x', url: 'javascript:alert(1)' }]));
        expect(link.enabled).toBe(true);
        expect(link.url).toBe('javascript:alert(1)');
    });

    it('keeps the label', () => {
        expect(linksOf(withLinks([{ name: 'Discord', url: 'discord.gg/x' }]))[0].name)
            .toBe('Discord');
    });
});
