import React, { useState, useEffect, useRef } from 'react';
import "./ReviewList.css";

export default function StatsCard({ stats_array }) {
    const [animated, setAnimated] = useState(false);
    const cardRef = useRef(null);

   const stat_categories = [
    { label: "Time commitment", value: parseFloat(stats_array?.hours?.toFixed(1)) || 0, color: 'rgba(82, 50, 6, 1)', end: 12, unit: "hrs/wk" },
    { label: "Skill Growth Index", value: parseFloat(stats_array?.skill?.toFixed(1)) || 0, color: 'rgb(47, 115, 164)', end: 10, unit: "/10" },
    { label: "Community", value: parseFloat(stats_array?.community?.toFixed(1)) || 0, color: 'rgba(255, 128, 0, 1)', end: 10, unit: "/10" },
    { label: "Leadership", value: parseFloat(stats_array?.leadership?.toFixed(1)) || 0, color: 'rgba(198, 165, 1, 0.85)', end: 10, unit: "/10" },
    { label: "Fun Index", value: parseFloat(stats_array?.fun_index?.toFixed(1)) || 0, color: 'rgba(124, 124, 124, 0.85)', end: 10, unit: "/10" },
];

    // Trigger animation when card scrolls into view
    useEffect(() => {
        if (!cardRef.current || !stats_array) return;

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
    }, [stats_array]);

    if (!stats_array) {
        return <div className="stats-card"><p>No stats available.</p></div>;
    }

    return (
        <div className="stats-card" ref={cardRef}>
            {stat_categories.map((cat, index) => {
                const bar_percentage = (cat.value / cat.end) * 100;
                return (
                    <div className="range-row" key={cat.label}>
                        <div className="vert-flex">
                            <p className="number" style={{ color: cat.color }}>
                                <CountUp target={cat.value} animate={animated} delay={index * 120} />
                                <span className="number-small">{cat.unit}</span>
                            </p>
                            <span className="range-label">{cat.label}</span>
                        </div>
                        <div className="range-bar-container">
                            <div
                                className="range-bar-fill"
                                style={{
                                    width: animated ? `${bar_percentage}%` : '0%',
                                    backgroundColor: cat.color,
                                    transition: `width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 120}ms`,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

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
                // ease-out curve
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplay(parseFloat((eased * target).toFixed(1)));

                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                }
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