import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import DraftPreview from './DraftPreview';

/**
 * Review queue for club pages submitted through the onboarding wizard.
 *
 * Approving used to mean running curl with a hand-extracted JWT, which is fine for the
 * person who wrote the endpoints and a wall for everyone else. Outreach is Connor and
 * Milo's job, so the thing they do dozens of times cannot require a terminal.
 *
 * Deliberately plain, matching the rest of this page. It is internal tooling, and the
 * scarce thing is being able to read a submission quickly, not styling.
 */
const s = {
    row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    list: { margin: '10px 0', padding: 0, listStyle: 'none' },
    item: {
        display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
        padding: '8px 10px', border: '1px solid #ddd', borderRadius: 4, marginBottom: 6,
    },
    panel: { marginTop: 14, padding: 12, border: '1px solid #ccc', borderRadius: 4, background: '#fafafa' },
    key: { color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' },
    pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '2px 0 12px', fontSize: 13 },
    btn: { padding: '6px 14px', fontFamily: 'monospace', cursor: 'pointer' },
    input: { padding: '4px 6px', fontFamily: 'monospace', width: 300 },
    err: { color: 'red', marginTop: 8 },
    ok: { color: 'green', marginTop: 8 },
    muted: { color: '#555', fontSize: 13 },
    // The club page components bring their own layout, so this is a plain container with
    // room around it rather than anything that could fight them.
    preview: {
        background: '#fff', border: '1px solid #ddd', borderRadius: 6,
        padding: 16, marginBottom: 16, overflowX: 'auto',
    },
};

export default function OnboardingReview() {
    const [pending, setPending] = useState(null);
    const [clubId, setClubId] = useState('');
    const [record, setRecord] = useState(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    // Preview first: approving is a judgement about how the page looks, and the field
    // list is the fallback for when something needs reading exactly as typed.
    const [view, setView] = useState('preview');

    const loadPending = useCallback(() => {
        apiFetch('/admin/onboarding/pending')
            .then((d) => setPending(d.rows ?? []))
            .catch((e) => setError(e.message));
    }, []);

    useEffect(loadPending, [loadPending]);

    const open = async (id) => {
        setError(null); setMessage(null); setRecord(null); setClubId(id);
        try {
            setRecord(await apiFetch(`/admin/onboarding/${id}`));
        } catch (e) {
            setError(e.message);
        }
    };

    const act = async (path, body, done) => {
        setBusy(true); setError(null); setMessage(null);
        try {
            await apiFetch(`/admin/onboarding/${clubId}/${path}`, { method: 'POST', body });
            setMessage(done);
            loadPending();
            if (clubId) open(clubId);
        } catch (e) {
            // The endpoints return the specific validation failures, which is the whole
            // reason a reviewer can act on a rejection instead of guessing.
            setError(e.body?.errors ? `${e.message}: ${JSON.stringify(e.body.errors)}` : e.message);
        } finally {
            setBusy(false);
        }
    };

    const draft = record?.draft ?? {};
    const basic = (draft.modules ?? []).find((m) => m.type === 'basic_info')?.data ?? {};
    const join = (draft.modules ?? []).find((m) => m.type === 'join')?.data ?? {};
    const faqs = (draft.modules ?? []).find((m) => m.type === 'faqs')?.data?.faqs ?? [];
    const people = (draft.modules ?? []).find((m) => m.type === 'member_roster')?.data?.members ?? [];
    const events = draft.events ?? [];

    return (
        <div>
            <h2>Club onboarding</h2>

            <div style={s.row}>
                <strong>Awaiting review</strong>
                <button style={s.btn} onClick={loadPending}>Refresh</button>
            </div>

            {pending === null && <p style={s.muted}>Loading…</p>}
            {pending?.length === 0 && <p style={s.muted}>Nothing waiting.</p>}

            <ul style={s.list}>
                {(pending ?? []).map((r) => (
                    <li key={r.club_id} style={s.item}>
                        <span>
                            <strong>{r.club_name ?? r.club_id}</strong>{' '}
                            <span style={s.muted}>
                                submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'unknown'}
                            </span>
                        </span>
                        <button style={s.btn} onClick={() => open(r.club_id)}>Review</button>
                    </li>
                ))}
            </ul>

            <div style={{ ...s.row, marginTop: 16 }}>
                <label htmlFor="ob-club-id">Or open any club by id</label>
                <input
                    id="ob-club-id"
                    style={s.input}
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value.trim())}
                    placeholder="club uuid"
                />
                <button style={s.btn} onClick={() => open(clubId)} disabled={!clubId}>Open</button>
            </div>

            {error && <p style={s.err}>{error}</p>}
            {message && <p style={s.ok}>{message}</p>}

            {record && (
                <div style={s.panel}>
                    <div style={{ ...s.row, marginBottom: 12 }}>
                        <button
                            style={{ ...s.btn, fontWeight: view === 'preview' ? 700 : 400 }}
                            onClick={() => setView('preview')}
                        >
                            Preview
                        </button>
                        <button
                            style={{ ...s.btn, fontWeight: view === 'fields' ? 700 : 400 }}
                            onClick={() => setView('fields')}
                        >
                            Field list
                        </button>
                        <span style={s.muted}>
                            {record.status}
                            {record.submitted_at && ` · submitted ${new Date(record.submitted_at).toLocaleString()}`}
                        </span>
                    </div>

                    {view === 'preview' && (
                        <div style={s.preview}>
                            <DraftPreview record={record} />
                        </div>
                    )}

                    {view === 'fields' && (<>
                    <div style={s.key}>Status</div>
                    <p style={s.pre}>
                        {record.status}
                        {record.submitted_at && ` · submitted ${new Date(record.submitted_at).toLocaleString()}`}
                    </p>

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
                    <p style={s.pre}>{faqs.map((f) => `${f.q} — ${f.a}`).join('\n') || '(none)'}</p>

                    <div style={s.key}>People ({people.length})</div>
                    <p style={s.pre}>
                        {people.map((m) => `${m.name}${m.category ? ` (${m.category})` : ''}`).join('\n') || '(none)'}
                    </p>

                    <div style={s.key}>Events ({events.length})</div>
                    <p style={s.pre}>
                        {events.map((e) => `${e.event_name} · ${e.start_time} · ${e.where || 'no location'}`).join('\n') || '(none)'}
                    </p>
                    </>)}

                    {/* Events never appear in the preview, since the rows do not exist
                        until approval, so they are listed here in either view. */}
                    {view === 'preview' && events.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                            <div style={s.key}>Events to be created ({events.length})</div>
                            <p style={s.pre}>
                                {events.map((e) => `${e.event_name} · ${e.start_time} · ${e.where || 'no location'}`).join('\n')}
                            </p>
                        </div>
                    )}

                    <div style={s.row}>
                        <button
                            style={s.btn}
                            disabled={busy || record.status !== 'pending_review'}
                            onClick={() => act('approve', {}, 'Approved and published.')}
                        >
                            Approve
                        </button>
                        <input
                            style={s.input}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What needs changing?"
                        />
                        <button
                            style={s.btn}
                            disabled={busy || !note.trim() || record.status !== 'pending_review'}
                            onClick={() => act('request-changes', { note: note.trim() }, 'Sent back to the club.')}
                        >
                            Request changes
                        </button>
                        <button
                            style={s.btn}
                            disabled={busy}
                            onClick={() => act('unclaim', {}, 'Unclaimed. The link is revoked; issue a new one.')}
                        >
                            Unclaim
                        </button>
                    </div>

                    {record.status !== 'pending_review' && (
                        <p style={s.muted}>
                            Approve and request-changes only apply to a page awaiting review.
                            This one is {record.status}.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
