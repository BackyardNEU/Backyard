import React from 'react';
import "./ReviewList.css"

export default function StatsCard({ stats_array }) {
     if (!stats_array) {
        return <div className="stats-card"><p>No stats available.</p></div>;
    }
    console.log(stats_array);

    const stat_categories = [
        { label: "Time commitment", value: parseFloat(stats_array.hours?.toFixed(1)) || 0, color: 'rgba(82, 50, 6, 1)', end: 12 },
        { label: "Skill Growth Index", value: parseFloat(stats_array.skill?.toFixed(1)) || 0, color: 'rgb(47, 115, 164)', end: 10 },
        { label: "Community", value: parseFloat(stats_array.community?.toFixed(1)) || 0, color: 'rgba(255, 128, 0, 1)', end: 10 },
        { label: "Leadership", value: parseFloat(stats_array.leadership?.toFixed(1)) || 0, color: 'rgba(198, 165, 1, 0.85)', end: 10 },
        { label: "Fun Index", value: parseFloat(stats_array.fun_index?.toFixed(1)) || 0, color: 'rgba(124, 124, 124, 0.85)', end: 10 },
    ];

    return (
    <div className="stats-card">
        {stat_categories.map((cat) => {
            const bar_percentage = ((cat.value) / (cat.end)) * 100;
            return (
                <div className="range-row" key={cat.label}>
                    <div className="vert-flex">
                        <p className="number" style={{ color: `${cat.color}` }}>
                            {cat.value} <span className="number-small">/{cat.end}</span>
                        </p>
                        <span className="range-label">{cat.label}</span>
                    </div>
                    <div className="range-bar-container">
                        <div
                            className="range-bar-fill"
                            style={{ width: `${bar_percentage}%`, backgroundColor: `${cat.color}` }}
                        />
                    </div>
                </div>
            );
        })}
    </div>
);
}