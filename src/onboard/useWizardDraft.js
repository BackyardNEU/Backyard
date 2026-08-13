import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

const AUTOSAVE_MS = 1200;

/**
 * Draft state for the wizard, autosaved to club_onboarding.draft.
 *
 * Clubs abandon halfway — someone opens the link between classes and comes back that
 * evening — so every keystroke has to be recoverable. Saving is debounced rather than
 * per-step so a half-finished step survives a closed tab too.
 */
export function useWizardDraft(clubId) {
    const [draft, setDraft] = useState({ modules: [], details: {} });
    const [status, setStatus] = useState('unclaimed');
    const [reviewNote, setReviewNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
    const [error, setError] = useState(null);

    const timer = useRef(null);
    const pending = useRef(null);
    // Guards against a slow save landing after the component unmounts.
    const alive = useRef(true);

    useEffect(() => () => {
        alive.current = false;
        if (timer.current) clearTimeout(timer.current);
    }, []);

    useEffect(() => {
        if (!clubId) return;
        let cancelled = false;

        apiFetch(`/clubs/${clubId}/onboarding`)
            .then((row) => {
                if (cancelled) return;
                setDraft({
                    modules: row?.draft?.modules ?? [],
                    details: row?.draft?.details ?? {},
                });
                setStatus(row?.status ?? 'unclaimed');
                setReviewNote(row?.review_note ?? null);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message);
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [clubId]);

    const flush = useCallback(async () => {
        if (!pending.current || !clubId) return;
        const payload = pending.current;
        pending.current = null;
        setSaveState('saving');
        try {
            await apiFetch(`/clubs/${clubId}/onboarding/draft`, { method: 'PUT', body: payload });
            if (alive.current) { setSaveState('saved'); setError(null); }
        } catch (err) {
            if (alive.current) { setSaveState('error'); setError(err.message); }
        }
    }, [clubId]);

    const queueSave = useCallback((payload) => {
        pending.current = { ...(pending.current ?? {}), ...payload };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, AUTOSAVE_MS);
    }, [flush]);

    /** Replace one module's data, creating the module if the draft has never held it. */
    const setModule = useCallback((type, data) => {
        setDraft((prev) => {
            const modules = [...(prev.modules ?? [])];
            const i = modules.findIndex((m) => m.type === type);
            const next = i === -1
                ? { type, order: modules.length, isDisplayed: true, data }
                : { ...modules[i], data };
            if (i === -1) modules.push(next); else modules[i] = next;

            queueSave({ modules });
            return { ...prev, modules };
        });
    }, [queueSave]);

    const setDetails = useCallback((patch) => {
        setDraft((prev) => {
            const details = { ...(prev.details ?? {}), ...patch };
            queueSave({ details });
            return { ...prev, details };
        });
    }, [queueSave]);

    const getModule = useCallback(
        (type) => draft.modules?.find((m) => m.type === type)?.data ?? null,
        [draft.modules]
    );

    // Called before navigating between steps so a save is never left in the debounce
    // window when someone closes the tab.
    const saveNow = useCallback(async () => {
        if (timer.current) clearTimeout(timer.current);
        await flush();
    }, [flush]);

    return {
        draft, getModule, setModule, setDetails,
        status, reviewNote, loading, saveState, error, saveNow, setStatus,
    };
}
