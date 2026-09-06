import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import OnboardingReview from './OnboardingReview';

const s = {
  page:    { padding: 24, fontFamily: 'monospace', maxWidth: 760 },
  hr:      { margin: '32px 0', border: 0, borderTop: '1px solid #ddd' },
  section: { marginTop: 24 },
  field:   { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  input:   { padding: '4px 6px', fontFamily: 'monospace', width: 300 },
  select:  { padding: '4px 6px', fontFamily: 'monospace', width: 312 },
  btn:     { padding: '6px 14px', fontFamily: 'monospace', cursor: 'pointer' },
  result:  { marginTop: 16, padding: 12, background: '#f0f0f0', borderRadius: 4 },
  url:     { wordBreak: 'break-all', display: 'block', margin: '8px 0', fontSize: 13 },
  err:     { color: 'red', marginTop: 8 },
  muted:   { color: '#555', fontSize: 13, margin: '4px 0 0' },
};

export default function AdminPage() {
  const [access, setAccess]       = useState('checking'); // 'checking' | 'denied' | 'ok'
  const [clubs, setClubs]         = useState([]);
  const [clubId, setClubId]       = useState('');
  const [maxUses, setMaxUses]     = useState(1);
  const [daysValid, setDaysValid] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [result, setResult]       = useState(null);
  const [genError, setGenError]   = useState(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    apiFetch('/admin/is-admin')
      .then(() => apiFetch('/clubs', { auth: false }))
      .then(data => {
        setClubs([...data].sort((a, b) => a.club_name.localeCompare(b.club_name)));
        setAccess('ok');
      })
      .catch(() => setAccess('denied'));
  }, []);

  const generate = async () => {
    if (!clubId) return;
    setGenerating(true);
    setResult(null);
    setGenError(null);
    setCopied(false);
    try {
      const data = await apiFetch(`/admin/clubs/${clubId}/editor-invite-link`, {
        method: 'POST',
        body: { max_uses: maxUses, days_valid: daysValid },
      });
      setResult(data);
    } catch (err) {
      setGenError(err.message || 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (access === 'checking') return <p style={s.page}>Checking access...</p>;
  if (access === 'denied')   return <p style={s.page}>Access denied.</p>;

  return (
    <div style={s.page}>
      <h2 style={{ marginTop: 0 }}>Admin — Generate Editor Invite Link</h2>

      <div style={s.field}>
        <label>Club</label>
        <select style={s.select} value={clubId} onChange={e => { setClubId(e.target.value); setResult(null); setGenError(null); }}>
          <option value="">— select a club —</option>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.club_name}</option>)}
        </select>
      </div>

      <div style={s.field}>
        <label>Max uses</label>
        <input style={s.input} type="number" min={1} value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} />
        <span style={s.muted}>1 = single-use (recommended for editor links)</span>
      </div>

      <div style={s.field}>
        <label>Days valid</label>
        <input style={s.input} type="number" min={1} value={daysValid} onChange={e => setDaysValid(Number(e.target.value))} />
      </div>

      <button style={s.btn} onClick={generate} disabled={!clubId || generating}>
        {generating ? 'Generating...' : 'Generate Link'}
      </button>

      {genError && <p style={s.err}>Error: {genError}</p>}

      {result && (
        <div style={s.result}>
          <p style={{ margin: '0 0 4px' }}>
            <strong>Link generated</strong> — expires {new Date(result.expires_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>
          <code style={s.url}>{result.url}</code>
          <button style={s.btn} onClick={copy}>{copied ? 'Copied!' : 'Copy Link'}</button>
        </div>
      )}

      <hr style={s.hr} />

      <OnboardingReview />
    </div>
  );
}
