import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { isUuid, slugifyUniversity, slugMatches } from '../../shared/slug.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('uni_names')
        .select('id, uni_name')
        .order('uni_name');

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    // Hand the slug back so callers building links do not each have to derive it.
    res.json((data || []).map((u) => ({ ...u, slug: slugifyUniversity(u.uni_name) })));
});

// GET /api/universities/:idOrSlug
//
// Accepts either a UUID or a readable slug ("Northeastern"). UUIDs stay supported
// indefinitely: they are what every link in the app used before slugs existed, so
// bookmarks, the stored lastPath and any already-shared URL would otherwise 404.
router.get('/:idOrSlug', async (req, res) => {
    const { idOrSlug } = req.params;

    if (isUuid(idOrSlug)) {
        const { data, error } = await supabaseAdmin
            .from('uni_names')
            .select('id, uni_name')
            .eq('id', idOrSlug)
            .single();

        if (error) {
            const err = new Error(error.message);
            err.status = error.code === 'PGRST116' ? 404 : 502;
            throw err;
        }

        return res.json({ ...data, slug: slugifyUniversity(data.uni_name) });
    }

    // Slugs are derived from uni_name rather than stored, so there is no column to filter
    // on — read the list and compare. uni_names is a small reference table, and this
    // avoids an ilike that would mishandle punctuation ("St. John's" vs "St-Johns").
    const { data, error } = await supabaseAdmin
        .from('uni_names')
        .select('id, uni_name');

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    const match = (data || []).find((u) => slugMatches(idOrSlug, u.uni_name));
    if (!match) return res.status(404).json({ error: 'University not found' });

    res.json({ ...match, slug: slugifyUniversity(match.uni_name) });
});

export default router;
