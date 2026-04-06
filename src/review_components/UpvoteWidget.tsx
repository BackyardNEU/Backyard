import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface UpvoteWidgetProps {
  score: number;
  userVote: number;
  onVote: (val: number) => void;
  variant?: 'pill' | 'stacked';
  theme?: 'light' | 'dark';
}

export function UpvoteWidget({ score, userVote, onVote, variant = 'stacked', theme = 'light' }: UpvoteWidgetProps) {
  const currentScore = score + userVote;
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-black border-white/40 text-white' : 'bg-white border-[#949494] text-black';
  const hoverBtn = isDark ? 'hover:bg-white/20' : 'hover:bg-gray-100';
  const activeBtn = isDark ? 'bg-white text-black' : 'bg-black text-white';

  if (variant === 'pill') {
    return (
      <div className={`flex flex-col items-center justify-between border rounded-full p-1.5 shadow-sm w-[34px] h-[96px] ${bgColor}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onVote(1); }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${userVote === 1 ? activeBtn : hoverBtn}`}
        >
          <ChevronUp size={18} strokeWidth={3} />
        </button>
        <span className="text-[11px] italic font-medium select-none">{currentScore}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onVote(-1); }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${userVote === -1 ? activeBtn : hoverBtn}`}
        >
          <ChevronDown size={18} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${isDark ? 'text-white' : 'text-black'}`}>
      <button 
        onClick={(e) => { e.stopPropagation(); onVote(1); }}
        className={`w-[30px] h-[30px] rounded-full border flex items-center justify-center transition-colors ${
          userVote === 1 
            ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
            : (isDark ? 'bg-black text-white border-white/40 hover:bg-white/20' : 'bg-white text-black border-[#949494] hover:bg-gray-100')
        }`}
      >
        <ChevronUp size={17} strokeWidth={2.5} />
      </button>
      <span className="text-[11px] italic font-medium font-sans select-none">{currentScore}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onVote(-1); }}
        className={`w-[30px] h-[30px] rounded-full border flex items-center justify-center transition-colors ${
          userVote === -1 
            ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
            : (isDark ? 'bg-black text-white border-white/40 hover:bg-white/20' : 'bg-white text-black border-[#949494] hover:bg-gray-100')
        }`}
      >
        <ChevronDown size={17} strokeWidth={2.5} />
      </button>
    </div>
  );
}