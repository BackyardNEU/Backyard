import { Field, Text, Area, Repeater, LIMITS } from './fields.jsx';

// Prompts rather than an empty box: "add a question" produces nothing, but "do I need
// experience?" produces an answer.
const PROMPTS = [
    'Do I need any experience?',
    'Is there a membership fee?',
    'How much time does it take each week?',
    'Can I join partway through the semester?',
];

export default function Faqs({ wizard }) {
    const data = wizard.getModule('faqs') ?? {};
    const faqs = data.faqs ?? [];

    const setFaqs = (next) => wizard.setModule('faqs', { ...data, faqs: next });

    return (
        <>
            <h2 className="ob-h1">Frequently Asked Questions</h2>
            <p className="ob-lede">
                Three or four is plenty. Answer what you get asked at every club fair.
            </p>

            {faqs.length === 0 && (
                <div style={{ marginBottom: 18 }}>
                    <p className="ob-hint" style={{ marginBottom: 8 }}>Start with a common one:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {PROMPTS.map((q) => (
                            <button
                                key={q}
                                type="button"
                                className="ob-ghost"
                                style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }}
                                onClick={() => setFaqs([{ q, a: '' }])}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <Repeater
                items={faqs}
                label="Question"
                addLabel="+ Add a question"
                max={LIMITS.MAX_FAQS}
                onAdd={() => setFaqs([...faqs, { q: '', a: '' }])}
                onRemove={(i) => setFaqs(faqs.filter((_, j) => j !== i))}
            >
                {(faq, i) => (
                    <>
                        <Field label="Question" value={faq.q} max={LIMITS.FAQ_Q_MAX}>
                            <Text
                                value={faq.q}
                                onChange={(v) => setFaqs(faqs.map((f, j) => (j === i ? { ...f, q: v } : f)))}
                                placeholder="Do I need any experience?"
                            />
                        </Field>
                        <Field label="Answer" value={faq.a} max={LIMITS.FAQ_A_MAX}>
                            <Area
                                value={faq.a}
                                onChange={(v) => setFaqs(faqs.map((f, j) => (j === i ? { ...f, a: v } : f)))}
                                rows={3}
                                placeholder="None at all. About half our members learned to play here."
                            />
                        </Field>
                    </>
                )}
            </Repeater>
        </>
    );
}
