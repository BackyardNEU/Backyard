import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../supabaseAdmin.js', () => ({ supabaseAdmin: { from: vi.fn(), storage: { from: vi.fn() } } }));

const { ImageModerator, LIKELIHOOD, DEFAULT_THRESHOLDS } = await import('./imageModerator.js');

// Build a fake Cloud Vision SafeSearch response.
function visionResponse(annotation) {
    return {
        ok: true,
        json: async () => ({ responses: [{ safeSearchAnnotation: annotation }] }),
    };
}

const BENIGN = {
    adult: 'VERY_UNLIKELY',
    violence: 'VERY_UNLIKELY',
    racy: 'VERY_UNLIKELY',
    medical: 'VERY_UNLIKELY',
    spoof: 'VERY_UNLIKELY',
};

describe('ImageModerator thresholds', () => {
    let mod;

    beforeEach(() => {
        mod = new ImageModerator('fake-key');
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const scanWith = async (annotation) => {
        globalThis.fetch.mockResolvedValueOnce(visionResponse({ ...BENIGN, ...annotation }));
        return mod.scan('https://example.com/img.jpg');
    };

    it('requires an API key', () => {
        expect(() => new ImageModerator()).toThrow(/CLOUD_VISION_API/);
    });

    it('passes a benign image', async () => {
        expect(await scanWith({})).toEqual({ safe: true });
    });

    // The core of the retune. Vision returns UNLIKELY/POSSIBLE for a great deal of
    // ordinary content — beach photos, gym selfies, costumes. The old adult:2 threshold
    // rejected all of it.
    it('allows adult:UNLIKELY — a beach or gym photo', async () => {
        expect((await scanWith({ adult: 'UNLIKELY' })).safe).toBe(true);
    });

    it('allows adult:POSSIBLE', async () => {
        expect((await scanWith({ adult: 'POSSIBLE' })).safe).toBe(true);
    });

    it('blocks adult:LIKELY', async () => {
        const r = await scanWith({ adult: 'LIKELY' });
        expect(r.safe).toBe(false);
        expect(r.violations[0].category).toBe('adult');
    });

    it('blocks adult:VERY_LIKELY', async () => {
        expect((await scanWith({ adult: 'VERY_LIKELY' })).safe).toBe(false);
    });

    it('allows violence:POSSIBLE — contact sport, fencing, stage combat', async () => {
        expect((await scanWith({ violence: 'POSSIBLE' })).safe).toBe(true);
    });

    it('blocks violence:LIKELY', async () => {
        expect((await scanWith({ violence: 'LIKELY' })).safe).toBe(false);
    });

    // racy is the noisiest signal, so only the most extreme rating trips it.
    it('allows racy:LIKELY — swimwear, dance, athletics', async () => {
        expect((await scanWith({ racy: 'LIKELY' })).safe).toBe(true);
    });

    it('blocks racy:VERY_LIKELY', async () => {
        expect((await scanWith({ racy: 'VERY_LIKELY' })).safe).toBe(false);
    });

    // Pre-med, nursing and EMS clubs post anatomy diagrams and first-aid demos.
    it('ignores medical entirely, even at VERY_LIKELY', async () => {
        expect((await scanWith({ medical: 'VERY_LIKELY' })).safe).toBe(true);
        expect(DEFAULT_THRESHOLDS.medical).toBeNull();
    });

    it('ignores spoof entirely', async () => {
        expect((await scanWith({ spoof: 'VERY_LIKELY' })).safe).toBe(true);
    });

    it('reports every category that tripped', async () => {
        const r = await scanWith({ adult: 'VERY_LIKELY', violence: 'LIKELY' });
        expect(r.safe).toBe(false);
        expect(r.violations.map((v) => v.category).sort()).toEqual(['adult', 'violence']);
    });

    it('treats an unknown likelihood string as 0 rather than throwing', async () => {
        expect((await scanWith({ adult: 'NOT_A_REAL_LEVEL' })).safe).toBe(true);
    });

    it('accepts a threshold override', async () => {
        const strict = new ImageModerator('fake-key', { adult: LIKELIHOOD.UNLIKELY });
        globalThis.fetch.mockResolvedValueOnce(visionResponse({ ...BENIGN, adult: 'UNLIKELY' }));
        expect((await strict.scan('https://example.com/i.jpg')).safe).toBe(false);
    });

    it('throws when Cloud Vision returns an error status', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'denied' });
        await expect(mod.scan('https://example.com/i.jpg')).rejects.toThrow(/403/);
    });

    it('throws when the response carries no annotation', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ responses: [{}] }) });
        await expect(mod.scan('https://example.com/i.jpg')).rejects.toThrow(/No SafeSearch/);
    });
});
