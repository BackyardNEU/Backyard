import { Field, Text, Area, Repeater, LIMITS } from './fields.jsx';

const MAX_ON_WIZARD = 12;

// Capped well below the server's 200 on purpose. This step is for the e-board, and a
// president typing in a 200-person roster during onboarding is a sign the form is
// being misread. The full roster fills in later from real memberships.
export default function People({ wizard }) {
    const data = wizard.getModule('member_roster') ?? {};
    const members = data.members ?? [];

    const setMembers = (next) => wizard.setModule('member_roster', {
        ...data,
        categories: data.categories ?? ['Leadership'],
        members: next,
    });

    return (
        <>
            <p className="ob-eyebrow">Step 4 of 6</p>
            <h2 className="ob-h1">Who runs the club</h2>
            <p className="ob-lede">
                Your e-board, or however many you want to name. Students join clubs
                because of people — this is the step that makes a page feel real.
                You can skip it and add people later.
            </p>

            <Repeater
                items={members}
                label="Person"
                addLabel={members.length === 0 ? '+ Add someone' : '+ Add another'}
                max={MAX_ON_WIZARD}
                onAdd={() => setMembers([...members, { name: '', category: 'Leadership', bio: '' }])}
                onRemove={(i) => setMembers(members.filter((_, j) => j !== i))}
            >
                {(member, i) => (
                    <>
                        <Field label="Name" value={member.name} max={LIMITS.MEMBER_NAME_MAX}>
                            <Text
                                value={member.name}
                                onChange={(v) => setMembers(members.map((m, j) => (j === i ? { ...m, name: v } : m)))}
                                placeholder="Alex Rivera"
                            />
                        </Field>
                        <Field label="Role">
                            <Text
                                value={member.category}
                                onChange={(v) => setMembers(members.map((m, j) => (j === i ? { ...m, category: v } : m)))}
                                placeholder="President"
                            />
                        </Field>
                        <Field label="A line about them" value={member.bio} max={LIMITS.MEMBER_BIO_MAX}>
                            <Area
                                value={member.bio}
                                onChange={(v) => setMembers(members.map((m, j) => (j === i ? { ...m, bio: v } : m)))}
                                rows={2}
                                placeholder="Fourth-year CS major, has run the spring tournament since 2024."
                            />
                        </Field>
                    </>
                )}
            </Repeater>
        </>
    );
}
