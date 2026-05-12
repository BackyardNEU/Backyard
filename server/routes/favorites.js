import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { data, error } = await supabaseAdmin
    .from('user_favorites')
    .select('*');

    if (error) {
        const err = new Error(error.message);
        err.status = 502; // we got a response from Supabase, but it was an error
        throw err;
    }

    res.json(data);
});

export default router;
