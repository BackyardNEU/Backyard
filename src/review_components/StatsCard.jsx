import React from 'react';
import "./ReviewList.css"

export default function StatsCard({ stats_array }) {

const calculateAverages = (reviewsArray) => {
    if (!reviewsArray || reviewsArray.length === 0) return null;
    
    const totals = reviewsArray.reduce((acc, review) => ({
        club_hours: acc.club_hours + review.club_hours,
        club_growth_index: acc.club_growth_index + review.club_growth_index,
        club_community: acc.club_community + review.club_community,
        club_leadership: acc.club_leadership + review.club_leadership,
        club_fun: acc.club_fun + review.club_fun,
    }), {
        club_hours: 0,
        club_growth_index: 0,
        club_community: 0,
        club_leadership: 0,
        club_fun: 0,
    });

    const count = reviewsArray.length;
    return {
        club_hours: (totals.club_hours / count).toFixed(1),
        club_growth_index: (totals.club_growth_index / count).toFixed(1),
        club_community: (totals.club_community / count).toFixed(1),
        club_leadership: (totals.club_leadership / count).toFixed(1),
        club_fun: (totals.club_fun / count).toFixed(1),
    };
};

    const averages = calculateAverages(stats_array);

    const stat_categories = [
        { label: "Time commitment", value: averages?.club_hours || 0, color: 'rgba(82, 50, 6, 1)', end: 12 },
        { label: "Skill Growth Index", value: averages?.club_growth_index || 0, color: 'rgb(47, 115, 164)', end: 10 },
        { label: "Community", value: averages?.club_community || 0, color: 'rgba(255, 128, 0, 1)', end: 10 },
        { label: "Leadership", value: averages?.club_leadership || 0, color: 'rgba(198, 165, 1, 0.85)', end: 10 },
        { label: "Fun Index", value: averages?.club_fun || 0, color: 'rgba(124, 124, 124, 0.85)', end: 10 },
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