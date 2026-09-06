import { Field, Text, Repeater } from './fields.jsx';

const MAX_STATS = 4;

// Only quantitative stats here. The qualitative kind (a 1-10 bar with a label and a max)
// needs explaining before it makes sense, and a step that needs explaining is a step
// people abandon. Clubs can add those later from the full page editor.
// Every suggestion carries a unit. A quantitative stat with an empty unit1 is rejected
// at submit, so a chip that created one handed the club a 400 naming a field the form
// never marked as required.
const SUGGESTIONS = [
    { label: 'Active members', unit1: 'members' },
    { label: 'Meetings a semester', unit1: 'meetings' },
    { label: 'Years running', unit1: 'years' },
];

export default function Stats({ wizard }) {
    const data = wizard.getModule('stats') ?? {};
    const stats = data.stats ?? [];

    const setStats = (next) => wizard.setModule('stats', { ...data, stats: next });

    return (
        <>
            <h2 className="ob-h1">Numbers worth showing</h2>
            <p className="ob-lede">
                A couple of numbers that show how big the club is. Skip this if nothing
                here fits.
            </p>

            {stats.length === 0 && (
                <div style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            className="ob-ghost"
                            style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }}
                            onClick={() => setStats([{ type: 'quantitative', value: 0, ...s }])}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            <Repeater
                items={stats}
                label="Number"
                addLabel="+ Add a number"
                max={MAX_STATS}
                onAdd={() => setStats([...stats, { type: 'quantitative', label: '', value: 0, unit1: 'members' }])}
                onRemove={(i) => setStats(stats.filter((_, j) => j !== i))}
            >
                {(stat, i) => (
                    <>
                        <Field label="What it counts">
                            <Text
                                value={stat.label}
                                onChange={(v) => setStats(stats.map((s, j) => (j === i ? { ...s, label: v } : s)))}
                                placeholder="Active members"
                            />
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Number">
                                <Text
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={stat.value}
                                    onChange={(v) => setStats(stats.map((s, j) => (
                                        // Whole numbers only — the server rejects fractions, and
                                        // an empty input must not become NaN.
                                        j === i ? { ...s, value: Math.max(0, Math.trunc(Number(v) || 0)) } : s
                                    )))}
                                />
                            </Field>
                            <Field label="Unit" hint="Plural, e.g. members. Required.">
                                <Text
                                    value={stat.unit1}
                                    onChange={(v) => setStats(stats.map((s, j) => (j === i ? { ...s, unit1: v } : s)))}
                                    placeholder="members"
                                />
                            </Field>
                        </div>
                    </>
                )}
            </Repeater>
        </>
    );
}
