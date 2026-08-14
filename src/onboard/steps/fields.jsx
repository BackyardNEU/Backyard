import { LIMITS } from '../../../shared/clubPageValidation.js';

// Small shared pieces so each step file is about its own content rather than markup.
// Character counters use the same LIMITS the server enforces — a club should never be
// told a value is fine and then have the save rejected.

export function Field({ label, hint, children, value, max }) {
    const len = typeof value === 'string' ? value.length : 0;
    return (
        <label className="ob-field">
            <span className="ob-label">{label}</span>
            {hint && <span className="ob-hint">{hint}</span>}
            {children}
            {max != null && (
                <span className={`ob-count${len > max ? ' is-over' : ''}`}>
                    {len} / {max}
                </span>
            )}
        </label>
    );
}

export function Text({ value, onChange, ...rest }) {
    return (
        <input
            className="ob-input"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            {...rest}
        />
    );
}

export function Area({ value, onChange, rows = 4, ...rest }) {
    return (
        <textarea
            className="ob-textarea"
            rows={rows}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            {...rest}
        />
    );
}

export function Repeater({ items, label, addLabel, max, onAdd, onRemove, children }) {
    return (
        <>
            {items.map((item, i) => (
                <div className="ob-row" key={i}>
                    <div className="ob-row-head">
                        <span className="ob-row-label">{label} {i + 1}</span>
                        <button type="button" className="ob-link" onClick={() => onRemove(i)}>
                            Remove
                        </button>
                    </div>
                    {children(item, i)}
                </div>
            ))}
            {items.length < max && (
                <button type="button" className="ob-add" onClick={onAdd}>
                    {addLabel}
                </button>
            )}
        </>
    );
}

export { LIMITS };
