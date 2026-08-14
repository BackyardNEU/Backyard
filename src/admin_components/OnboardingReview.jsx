import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import DraftPreview from './DraftPreview';
import ClubLinkTable from './ClubLinkTable';

/**
 * Review queue for club pages submitted through the onboarding wizard.
 *
 * Approving used to mean running curl with a hand-extracted JWT, which is fine for
 * whoever wrote the endpoints and a wall for everyone else. Outreach is not their job,
 * and the thing they will do dozens of times cannot require a terminal.
 *
 * Reviewing opens the page full screen, the way a student sees it. A preview in a side
 * panel answers "did the fields save"; this has to answer "is this good enough to
 * publish", and that is a judgement about the whole page at the size it will be read.
 */
const s = {
    row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    key: { color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' },
    pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '2px 0 12px', fontSize: 13 },
    btn: { padding: '6px 14px', fontFamily: 'monospace', cursor: 'pointer' },
    input: { padding: '4px 6px', fontFamily: 'monospace', width: 300 },
    err: { color: 'red', marginTop: 8 },
    ok: { color: 'green', marginTop: 8 },
    muted: { color: '#555', fontSize: 13 },

    // Above the nav bar, which sits high on the main app. A reviewer should be looking at
    // the club page and nothing else.
    overlay: {
        position: 'fixed', inset: 0, zIndex: 4000,
        background: '#fff', display: 'flex', flexDirection: 'column',
    },
    bar: {
        flex: 'none', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid #ddd', background: '#fafafa',
        fontFamily: 'monospace',
    },
    // Only this scrolls, so the actions stay reachable however long the page runs.
    body: { flex: 1, overflowY: 'auto', background: '#fff' },
    fields: { padding: 20, maxWidth: 760, fontFamily: 'monospace' },
    spacer: { flex: 1 },
};

export default function OnboardingReview() {
    const [record, setRecord] = useState(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [view, setView] = useState('preview');

    const open = useCallback(async (id) => {
        setError(null); setMessage(null); setRecord(null); setView('preview');
        try {
            setRecord(await apiFetch(`/admin/onboarding/${id}`));
        } catch (e) {
            setError(e.message);
        }
    }, []);

    const close = useCallback(() => { setRecord(null); setNote(''); }, []);

    // Escape closes, and the page behind must not scroll while the overlay is up.
    useEffect(() => {
        if (!record) return;
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener('keydown', onKey);
        };
    }, [record, close]);

    const act = async (path, body, done) => {
        setBusy(true); setError(null); setMessage(null);
        const id = record.club_id;
        try {
            await apiFetch(`/admin/onboarding/${id}/${path}`, { method: 'POST', body });
            setMessage(done);
            close();
        } catch (e) {
            // The endpoints return the specific validation failures, which is what lets a
            // reviewer tell the club what to fix instead of guessing.
            setError(e.body?.errors ? `${e.message}: ${JSON.stringify(e.body.errors)}` : e.message);
        } finally {
            setBusy(false);
        }
    };

    const draft = record?.draft ?? {};
    const byType = (type) => (draft.modules ?? []).find((m) => m.type === type)?.data ?? {};
    const basic = byType('basic_info');
    const join = byType('join');
    const faqs = byType('faqs').faqs ?? [];
    const people = byType('member_roster').members ?? [];
    const events = draft.events ?? [];
    const reviewable = record?.status === 'pending_review';

    return (
        <div>
            <h2>Club onboarding</h2>

            <ClubLinkTable onReview={open} />

            {error && <p style={s.err}>{error}</p>}
            {message && <p style={s.ok}>{message}</p>}

            {record && (
                <div style={s.overlay} role="dialog" aria-modal="true" aria-label="Club page preview">
                    <div style={s.bar}>
                        <button style={s.btn} onClick={close}>← Back</button>
                        <strong>{basic.club_name || record.demo_club_data?.club_name || record.club_id}</strong>
                        <span style={s.muted}>{record.status}</span>

                        <button
                            style={{ ...s.btn, fontWeight: view === 'preview' ? 700 : 400 }}
                            onClick={() => setView('preview')}
                        >
                            Page
                        </button>
                        <button
                            style={{ ...s.btn, fontWeight: view === 'fields' ? 700 : 400 }}
                            onClick={() => setView('fields')}
                        >
                            Fields
                        </button>

                        <span style={s.spacer} />

                        <input
                            style={s.input}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What needs changing?"
                        />
                        <button
                            style={s.btn}
                            disabled={busy || !note.trim() || !reviewable}
                            onClick={() => act('request-changes', { note: note.trim() }, 'Sent back to the club.')}
                        >
                            Request changes
                        </button>
                        <button
                            style={s.btn}
                            disabled={busy || !reviewable}
                            onClick={() => act('approve', {}, 'Approved and published.')}
                        >
                            Approve
                        </button>
                        <button
                            style={s.btn}
                            disabled={busy}
                            onClick={() => act('unclaim', {}, 'Unclaimed. The link is revoked; issue a new one.')}
                        >
                            Unclaim
                        </button>
                    </div>

                    {!reviewable && (
                        <p style={{ ...s.muted, margin: 0, padding: '6px 16px', background: '#fff8e1' }}>
                            Approve and request changes only apply to a page awaiting review.
                            This one is {record.status}.
                        </p>
                    )}
                    {error && <p style={{ ...s.err, margin: 0, padding: '6px 16px' }}>{error}</p>}

                    <div style={s.body}>
                        {view === 'preview' ? (
                            <>
                                <DraftPreview record={record} />
                                {events.length > 0 && (
                                    <div style={s.fields}>
                                        <div style={s.key}>Events to be created ({events.length})</div>
                                        <p style={s.pre}>
                                            {events.map((e) => `${e.event_name} · ${e.start_time} · ${e.where || 'no location'}`).join('\n')}
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={s.fields}>
                                <div style={s.key}>Name</div>
                                <p style={s.pre}>{basic.club_name || '(empty)'}</p>

                                <div style={s.key}>Description</div>
                                <p style={s.pre}>{basic.description || '(empty)'}</p>

                                <div style={s.key}>Logo</div>
                                <p style={s.pre}>
                                    {basic.logo_url
                                        ? <img src={basic.logo_url} alt="" style={{ height: 64, borderRadius: 6 }} />
                                        : '(none)'}
                                </p>

                                <div style={s.key}>Category and subcategories</div>
                                <p style={s.pre}>
                                    {draft.interests?.category_id
                                        ? `${draft.interests.category_id} · ${(draft.interests.subcategories ?? []).map((x) => x.name).join(', ') || '(none)'}`
                                        : '(not set)'}
                                </p>

                                <div style={s.key}>Details</div>
                                <p style={s.pre}>{JSON.stringify(draft.details ?? {}, null, 1)}</p>

                                <div style={s.key}>Joining ({(join.tabs ?? []).length} section(s))</div>
                                <p style={s.pre}>
                                    {(join.tabs ?? []).map((t) => `${t.title}: ${t.body}`).join('\n') || '(none)'}
                                </p>

                                <div style={s.key}>FAQs ({faqs.length})</div>
                                <p style={s.pre}>{faqs.map((f) => `${f.q} / ${f.a}`).join('\n') || '(none)'}</p>

                                <div style={s.key}>People ({people.length})</div>
                                <p style={s.pre}>
                                    {people.map((m) => `${m.name}${m.category ? ` (${m.category})` : ''}`).join('\n') || '(none)'}
                                </p>

                                <div style={s.key}>Events ({events.length})</div>
                                <p style={s.pre}>
                                    {events.map((e) => `${e.event_name} · ${e.start_time} · ${e.where || 'no location'}`).join('\n') || '(none)'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
