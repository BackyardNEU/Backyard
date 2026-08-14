import { useEffect, useId, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Field, FieldGroup } from './fields.jsx';
import { INTEREST_LIMITS } from '../../../shared/clubInterestsValidation.js';

/**
 * Category plus two subcategories, matching what club_interests stores.
 *
 * The subcategory inputs are native comboboxes: an <input> bound to a <datalist>. Typing
 * filters our list, and anything not on it is simply kept as typed. That is exactly the
 * "pick one of ours or write your own" behaviour, with keyboard support and screen
 * reader semantics already handled, and none of the custom dropdown code the club page
 * editor needed.
 */
export default function CategoryPicker({ wizard }) {
    const interests = wizard.draft.interests ?? {};
    const [taxonomy, setTaxonomy] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const listId = useId();

    useEffect(() => {
        let cancelled = false;
        apiFetch('/interests', { auth: false })
            .then((data) => { if (!cancelled) setTaxonomy(data); })
            .catch((err) => { if (!cancelled) setLoadError(err.message); });
        return () => { cancelled = true; };
    }, []);

    const selected = taxonomy?.find((c) => c.id === interests.category_id);
    const options = selected?.subcategories ?? [];
    const subs = interests.subcategories ?? [];

    const setInterests = (patch) => wizard.setInterests({ ...interests, ...patch });

    const setSub = (index, name) => {
        const next = [...subs];
        // Keep the id when the typed text still matches the row it came from, so an
        // untouched pick stays a reference instead of becoming a duplicate by name.
        const match = options.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
        next[index] = match ? { id: match.id, name: match.name } : { name };
        setInterests({ subcategories: next });
    };

    return (
        <>
            <Field
                label="Category"
                hint="The closest fit. This is how students filter clubs."
            >
                <select
                    className="ob-select"
                    value={interests.category_id ?? ''}
                    onChange={(e) => {
                        // Subcategories belong to a category, so changing it invalidates
                        // whatever was picked underneath.
                        setInterests({ category_id: e.target.value || undefined, subcategories: [] });
                    }}
                    disabled={!taxonomy}
                >
                    <option value="">{taxonomy ? 'Choose a category' : 'Loading…'}</option>
                    {(taxonomy ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </Field>

            {loadError && (
                <div className="ob-error">
                    Could not load the category list. Refresh and try again.
                </div>
            )}

            <FieldGroup
                label="Two subcategories"
                hint="Pick from the list, or type your own if nothing fits."
            >
                <datalist id={listId}>
                    {options.map((o) => <option key={o.id} value={o.name} />)}
                </datalist>

                <div style={{ display: 'grid', gap: 10 }}>
                    {Array.from({ length: INTEREST_LIMITS.REQUIRED_SUBCATEGORIES }, (_, i) => (
                        <input
                            key={i}
                            className="ob-input"
                            list={listId}
                            value={subs[i]?.name ?? ''}
                            onChange={(e) => setSub(i, e.target.value)}
                            placeholder={i === 0 ? 'Start typing, or pick from the list' : 'And one more'}
                            disabled={!interests.category_id}
                            aria-label={`Subcategory ${i + 1}`}
                        />
                    ))}
                </div>

                {!interests.category_id && (
                    <span className="ob-hint">Choose a category first.</span>
                )}
            </FieldGroup>
        </>
    );
}
