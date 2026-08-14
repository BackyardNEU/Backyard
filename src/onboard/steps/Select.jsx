import { useEffect, useId, useRef, useState } from 'react';

/**
 * Dropdown that matches the rest of the page.
 *
 * A native <select> can be styled down to its closed state and no further: the open list
 * is drawn by the operating system, so it arrives in system fonts and system colours no
 * matter what the page looks like. On a surface built to feel like paper, that is the one
 * element that looks borrowed.
 *
 * This renders the list itself. That means keyboard behaviour has to be rebuilt rather
 * than inherited, so it is all here: arrows move, Enter and Space choose, Escape closes
 * and returns focus, Home and End jump, and typing a letter jumps to the next match the
 * way a real select does.
 */
export default function Select({ value, onChange, options, placeholder = 'Choose one', disabled }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const rootRef = useRef(null);
    const listRef = useRef(null);
    const buttonRef = useRef(null);
    const typeahead = useRef({ text: '', at: 0 });
    const listId = useId();

    const selectedIndex = options.findIndex((o) => o.value === value);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

    useEffect(() => {
        if (!open) return;
        const onDocDown = (e) => {
            if (!rootRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, [open]);

    // Keep the highlighted row in view when arrowing past the edge of a long list.
    useEffect(() => {
        if (!open || active < 0) return;
        listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }, [open, active]);

    const openWith = (index) => {
        if (disabled) return;
        setActive(index);
        setOpen(true);
    };

    const choose = (index) => {
        const option = options[index];
        if (!option) return;
        onChange(option.value);
        setOpen(false);
        buttonRef.current?.focus();
    };

    const onKeyDown = (e) => {
        if (disabled) return;

        if (!open) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
                e.preventDefault();
                openWith(selectedIndex >= 0 ? selectedIndex : 0);
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                setOpen(false);
                buttonRef.current?.focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                setActive((i) => Math.min(i + 1, options.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                setActive(0);
                break;
            case 'End':
                e.preventDefault();
                setActive(options.length - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                choose(active);
                break;
            default: {
                if (e.key.length !== 1) return;
                // Consecutive keystrokes build a search string, the way a native select
                // does; a pause starts a new one.
                const now = Date.now();
                const state = typeahead.current;
                state.text = now - state.at > 700 ? e.key : state.text + e.key;
                state.at = now;
                const match = options.findIndex((o) =>
                    o.label.toLowerCase().startsWith(state.text.toLowerCase()));
                if (match >= 0) setActive(match);
            }
        }
    };

    return (
        <div className="ob-dd" ref={rootRef}>
            <button
                type="button"
                ref={buttonRef}
                className={`ob-dd-button${open ? ' is-open' : ''}`}
                onClick={() => (open ? setOpen(false) : openWith(selectedIndex >= 0 ? selectedIndex : 0))}
                onKeyDown={onKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
            >
                <span className={selected ? '' : 'ob-dd-placeholder'}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className="ob-dd-caret" aria-hidden="true" />
            </button>

            {open && (
                <ul
                    className="ob-dd-list"
                    id={listId}
                    ref={listRef}
                    role="listbox"
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                >
                    {options.map((o, i) => (
                        <li
                            key={o.value}
                            role="option"
                            aria-selected={o.value === value}
                            className={`ob-dd-option${i === active ? ' is-active' : ''}`}
                            // mousedown, not click: the document listener that closes the
                            // list also fires on mousedown, and would beat a click here.
                            onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                            onMouseEnter={() => setActive(i)}
                        >
                            {o.label}
                            {o.value === value && <span className="ob-dd-tick" aria-hidden="true">✓</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
