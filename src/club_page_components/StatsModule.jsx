import React, { useState, useEffect, useRef } from 'react';
import './StatsModule.css';

const STAT_COLORS = [
    'rgba(82, 50, 6, 1)',
    'rgb(47, 115, 164)',
    'rgba(255, 128, 0, 1)',
    'rgba(198, 165, 1, 0.85)',
    'rgba(124, 124, 124, 0.85)',
    'rgba(180, 60, 100, 0.85)',
    'rgba(60, 160, 100, 0.85)',
    'rgba(100, 80, 200, 0.85)',
];

function CountUp({ target, animate, delay }) {
    const [display, setDisplay] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        if (!animate) {
            setDisplay(0);
            return;
        }

        const timeout = setTimeout(() => {
            const duration = 800;
            const start = performance.now();

            const tick = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplay(parseFloat((eased * target).toFixed(1)));
                if (progress < 1) rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        }, delay);

        return () => {
            clearTimeout(timeout);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [animate, target, delay]);

    return <>{display}</>;
}

function StatsModule({ data, editing, onChange }) {
    const [animated, setAnimated] = useState(false);
    const cardRef = useRef(null);
    const stats = data?.stats || [];

    useEffect(() => {
        if (!cardRef.current || editing || stats.length === 0) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setAnimated(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );

        observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [stats.length, editing]);

    const updateStat = (index, field, value) => {
        const updated = stats.map((s, i) =>
            i === index ? { ...s, [field]: value } : s
        );
        onChange({ ...data, stats: updated });
    };

    const addStat = () => {
        if (stats.length >= 8) return;
        onChange({ ...data, stats: [...stats, { label: '', unit: '/10', value: 0, max: 10 }] });
    };

    const removeStat = (index) => {
        onChange({ ...data, stats: stats.filter((_, i) => i !== index) });
    };

    if (stats.length === 0 && !editing) return null;

    return (
        <div className="stats-module" ref={!editing ? cardRef : null}>
            <p className="divider-header">Stats</p>
            <div className={editing ? 'stats-edit-list' : 'stats-card'}>
                {stats.map((stat, index) => {
                    const max = stat.max ?? 10;
                    const value = parseFloat(Number(stat.value).toFixed(1)) || 0;
                    const barPct = Math.min((value / max) * 100, 100);
                    const color = STAT_COLORS[index % STAT_COLORS.length];

                    return editing ? (
                        <div key={index} className="stats-edit-row">
                            <label className="stats-edit-label stats-edit-label--name">
                                Stat name
                                <input
                                    className="stats-input stats-input--label"
                                    type="text"
                                    placeholder="Stat name"
                                    value={stat.label}
                                    onChange={(e) => updateStat(index, 'label', e.target.value)}
                                />
                            </label>
                            <label className="stats-edit-label">
                                Unit
                                <input
                                    className="stats-input stats-input--unit"
                                    type="text"
                                    placeholder="Unit"
                                    value={stat.unit}
                                    onChange={(e) => updateStat(index, 'unit', e.target.value)}
                                />
                            </label>
                            <div className="stats-edit-row__numbers">
                                <label className="stats-edit-label">
                                    Value
                                    <input
                                        className="stats-input stats-input--number"
                                        type="number"
                                        min={0}
                                        max={stat.max ?? 10}
                                        step={0.1}
                                        value={stat.value}
                                        onChange={(e) => updateStat(index, 'value', parseFloat(e.target.value) || 0)}
                                    />
                                </label>
                                <label className="stats-edit-label">
                                    Max
                                    <input
                                        className="stats-input stats-input--number"
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={stat.max ?? 10}
                                        onChange={(e) => updateStat(index, 'max', parseFloat(e.target.value) || 10)}
                                    />
                                </label>
                            </div>
                            <button
                                className="stats-remove-btn"
                                onClick={() => removeStat(index)}
                                aria-label="Remove stat"
                            >
                                ✕
                            </button>
                            
                        </div>
                    ) : (
                        <div className="range-row" key={index}>
                            <div className="vert-flex">
                                <p className="number" style={{ color }}>
                                    <CountUp target={value} animate={animated} delay={index * 120} />
                                    <span className="number-small"> {stat.unit}</span>
                                </p>
                                <span className="range-label">{stat.label}</span>
                            </div>
                            <div className="range-bar-container">
                                <div
                                    className="range-bar-fill"
                                    style={{
                                        width: animated ? `${barPct}%` : '0%',
                                        backgroundColor: color,
                                        transition: `width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 120}ms`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            {editing && (
                <button
                    className="stats-add-btn"
                    onClick={addStat}
                    disabled={stats.length >= 8}
                >
                    + Add stat {stats.length >= 8 ? '(limit reached)' : `(${stats.length}/8)`}
                </button>
            )}
        </div>
    );
}

export default React.memo(StatsModule);
