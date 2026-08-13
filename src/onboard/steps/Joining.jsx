import { Field, Text, Area, Repeater, LIMITS } from './fields.jsx';

const MAX_TABS = 4;

// The highest-value screen on the page: "how do I actually join" is the question every
// student arrives with, and the one club directories usually answer worst.
export default function Joining({ wizard }) {
    const data = wizard.getModule('join') ?? {};
    const details = wizard.draft.details ?? {};
    const tabs = data.tabs ?? [{ title: 'How to join', body: '' }];

    const set = (patch) => wizard.setModule('join', { ...data, tabs, ...patch });
    const setTabs = (next) => wizard.setModule('join', { ...data, tabs: next });

    return (
        <>
            <p className="ob-eyebrow">Step 2 of 6</p>
            <h2 className="ob-h1">Joining</h2>
            <p className="ob-lede">
                When you meet, whether there&apos;s an application, and who to talk to. If a
                student reads one section, it&apos;s this one.
            </p>

            <Repeater
                items={tabs}
                label="Section"
                addLabel="+ Add another section"
                max={MAX_TABS}
                onAdd={() => setTabs([...tabs, { title: '', body: '' }])}
                onRemove={(i) => setTabs(tabs.filter((_, j) => j !== i))}
            >
                {(tab, i) => (
                    <>
                        <Field label="Heading" value={tab.title} max={LIMITS.TAB_TITLE_MAX}>
                            <Text
                                value={tab.title}
                                onChange={(v) => setTabs(tabs.map((t, j) => (j === i ? { ...t, title: v } : t)))}
                                placeholder="Meetings"
                            />
                        </Field>
                        <Field label="Details" value={tab.body} max={LIMITS.TAB_BODY_MAX}>
                            <Area
                                value={tab.body}
                                onChange={(v) => setTabs(tabs.map((t, j) => (j === i ? { ...t, body: v } : t)))}
                                placeholder="Thursdays at 7pm in Curry Student Center 333. Drop in whenever — no experience needed, and we have boards."
                            />
                        </Field>
                    </>
                )}
            </Repeater>

            <Field
                label="Application link"
                hint="Optional. A form, a sign-up sheet, or a tryout page."
                >
                <Text
                    type="url"
                    value={data.applicationLink}
                    onChange={(v) => set({ applicationLink: v })}
                    placeholder="https://forms.gle/…"
                />
            </Field>

            <Field
                label="Contact email"
                hint="Where students should write with questions. We never show this publicly without your say-so."
            >
                <Text
                    type="email"
                    value={details.email}
                    onChange={(v) => wizard.setDetails({ email: v })}
                    placeholder="chess@northeastern.edu"
                />
            </Field>

            <Field label="Instagram" hint="Just the handle — @yourclub or a full link both work.">
                <Text
                    value={details.instagram}
                    onChange={(v) => wizard.setDetails({ instagram: v })}
                    placeholder="@neuchess"
                />
            </Field>
        </>
    );
}
