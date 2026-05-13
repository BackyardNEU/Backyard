import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('uni_names')
        .select('*')
        .order('uni_name');

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

router.get('/:id', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('uni_names')
        .select('*')
        .eq('id', req.params.id)
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = error.code === 'PGRST116' ? 404 : 502;
        throw err;
    }

    res.json(data);
});

export default router;
