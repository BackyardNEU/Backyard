import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Field, FieldGroup } from './fields.jsx';
import { INTEREST_LIMITS } from '../../../shared/clubInterestsValidation.js';

/**
 * Category plus two subcategories, matching what club_interests stores.
 *
 * This used to be an <input> bound to a <datalist>. Technically that accepted free text,
 * but it renders as a dropdown, and a dropdown tells people the answer has to come from
 * the list. Nothing on screen said otherwise, so nobody would ever discover they could
 * type their own.
 *
 * Suggestions are now visible buttons and typing is its own labelled input. Both routes
 * are on screen at once, so neither has to be discovered.
 */
export default function CategoryPicker({ wizard }) {
    const interests = wizard.draft.interests ?? {};
    const [taxonomy, setTaxonomy] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [typed, setTyped] = useState('');

    useEffect(() => {
        let cancelled = false;
        apiFetch('/interests', { auth: false })
            .then((data) => { if (!cancelled) setTaxonomy(data); })
            .catch((err) => { if (!cancelled) setLoadError(err.message); });
        return () => { cancelled = true; };
    }, []);

    const selectedCategory = taxonomy?.find((c) => c.id === interests.category_id);
    const subs = (interests.subcategories ?? []).filter((s) => (s?.name ?? '').trim());
    const full = subs.length >= INTEREST_LIMITS.REQUIRED_SUBCATEGORIES;

    const chosen = new Set(subs.map((s) => s.name.trim().toLowerCase()));
    const suggestions = (selectedCategory?.subcategories ?? [])
        .filter((o) => !chosen.has(o.name.toLowerCase()));

    const setInterests = (patch) => wizard.setInterests({ ...interests, ...patch });

    const add = (sub) => {
        const name = (sub?.name ?? '').trim();
        if (!name || full || chosen.has(name.toLowerCase())) return;
        setInterests({ subcategories: [...subs, sub.id ? { id: sub.id, name } : { name }] });
        setTyped('');
    };

    const remove = (index) =>
        setInterests({ subcategories: subs.filter((_, i) => i !== index) });

    return (
        <>
            <Field label="Category" hint="The closest fit. This is how students filter clubs.">
                <div className="ob-select-wrap">
                    <select
                        className="ob-select"
                        value={interests.category_id ?? ''}
                        onChange={(e) => {
                            // Subcategories belong to a category, so changing it makes
                            // whatever was picked underneath invalid.
                            setInterests({ category_id: e.target.value || undefined, subcategories: [] });
                            setTyped('');
                        }}
                        disabled={!taxonomy}
                    >
                        <option value="">{taxonomy ? 'Choose a category' : 'Loading…'}</option>
                        {(taxonomy ?? []).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </Field>

            {loadError && (
                <div className="ob-error">Could not load the category list. Refresh and try again.</div>
            )}

            <FieldGroup
                label="Two subcategories"
                hint="Tap two of ours, or write your own. Both work the same."
            >
                {!interests.category_id ? (
                    <span className="ob-hint">Choose a category first.</span>
                ) : (
                    <>
                        {subs.length > 0 && (
                            <div className="ob-chips ob-chips--picked">
                                {subs.map((s, i) => (
                                    <span className="ob-chip ob-chip--picked" key={`${s.name}-${i}`}>
                                        {s.name}
                                        <button
                                            type="button"
                                            className="ob-chip-x"
                                            onClick={() => remove(i)}
                                            aria-label={`Remove ${s.name}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <p className="ob-hint" style={{ margin: '4px 0 0' }}>
                            {full
                                ? 'That is both. Remove one to swap it.'
                                : `Pick ${INTEREST_LIMITS.REQUIRED_SUBCATEGORIES - subs.length} more.`}
                        </p>

                        <div className="ob-sub-entry">
                            <input
                                className="ob-input"
                                autoComplete="off"
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        // Otherwise Enter submits the form and the club
                                        // loses what they were halfway through typing.
                                        e.preventDefault();
                                        add({ name: typed });
                                    }
                                }}
                                placeholder="Write your own, like Blitz nights"
                                disabled={full}
                                aria-label="Write your own subcategory"
                            />
                            <button
                                type="button"
                                className="ob-ghost ob-sub-add"
                                onClick={() => add({ name: typed })}
                                disabled={full || !typed.trim()}
                            >
                                Add
                            </button>
                        </div>

                        {suggestions.length > 0 && !full && (
                            <>
                                <p className="ob-hint" style={{ margin: '14px 0 6px' }}>
                                    Or tap one of ours:
                                </p>
                                <div className="ob-chips">
                                    {suggestions.map((o) => (
                                        <button
                                            key={o.id}
                                            type="button"
                                            className="ob-chip ob-chip--suggest"
                                            onClick={() => add(o)}
                                        >
                                            {o.name}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </FieldGroup>
        </>
    );
}
