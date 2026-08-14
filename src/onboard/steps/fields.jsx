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

/**
 * Same look as Field, but a <div> rather than a <label>.
 *
 * A file input nested inside its own <label> receives the click twice — once directly,
 * once forwarded by the label — and browsers respond by never showing the picker at all.
 * The logo field looked completely dead because of it. Anything containing a file input,
 * or more than one control, belongs here instead.
 */
export function FieldGroup({ label, hint, children }) {
    return (
        <div className="ob-field">
            <span className="ob-label">{label}</span>
            {hint && <span className="ob-hint">{hint}</span>}
            {children}
        </div>
    );
}

// autoComplete="off" on every wizard field. These ask about a club, not a person, but
// the browser only sees a text box near a label saying "Name" or "Email" and fills in
// whatever it has saved for the person typing. That silently overwrites the club name we
// prefilled from the invite, and the club has no reason to suspect the value is wrong.
//
// The signup form is deliberately untouched: autofilling an email and password there is
// the browser doing its job.
export function Text({ value, onChange, ...rest }) {
    return (
        <input
            className="ob-input"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
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
            autoComplete="off"
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
