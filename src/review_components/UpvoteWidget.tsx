import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './UpvoteWidget.css';

interface UpvoteWidgetProps {
  score: number;
  userVote: number;
  onVote: (val: number) => void;
  variant?: 'pill' | 'stacked';
  theme?: 'light' | 'dark';
}

export function UpvoteWidget({ score, userVote, onVote, variant = 'stacked', theme = 'light' }: UpvoteWidgetProps) {
  const isDark = theme === 'dark';
  const wrapperThemeClass = isDark ? 'uv--dark' : 'uv--light';

  if (variant === 'pill') {
    return (
      <div className={`uv uv--pill ${wrapperThemeClass}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onVote(1); }}
          className={`uv__btn ${userVote === 1 ? 'uv__btn--active' : ''}`}
        >
          <ChevronUp size={18} strokeWidth={3} />
        </button>
        <span className="uv__score">{score}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onVote(-1); }}
          className={`uv__btn ${userVote === -1 ? 'uv__btn--active' : ''}`}
        >
          <ChevronDown size={18} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <div className={`uv uv--stacked ${wrapperThemeClass}`}>
      <button 
        onClick={(e) => { e.stopPropagation(); onVote(1); }}
        className={`uv__btn uv__btn--outlined ${userVote === 1 ? 'uv__btn--active' : ''}`}
      >
        <ChevronUp size={17} strokeWidth={2.5} />
      </button>
      <span className="uv__score">{score}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onVote(-1); }}
        className={`uv__btn uv__btn--outlined ${userVote === -1 ? 'uv__btn--active' : ''}`}
      >
        <ChevronDown size={17} strokeWidth={2.5} />
      </button>
    </div>
  );
}