
import React, { useState } from 'react';

interface CollapsiblePillGroupProps {
    label: string;
    options: { label: string, value: string }[];
    value: string;
    onChange: (val: string) => void;
}

export const CollapsiblePillGroup: React.FC<CollapsiblePillGroupProps> = ({ label, options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div className="border border-theme-bg-tertiary rounded-lg overflow-hidden transition-all bg-theme-bg-primary">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-theme-bg-tertiary/30 hover:bg-theme-bg-tertiary/50 transition-colors"
                title={selectedLabel}
            >
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-wider whitespace-nowrap">{label}</span>
                    {!isOpen && <span className="text-[10px] font-medium text-theme-accent-primary truncate max-w-[200px]">{selectedLabel}</span>}
                </div>
                {/* Chevron */}
                <svg className={`w-3 h-3 text-theme-text-secondary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="p-2 bg-theme-bg-primary border-t border-theme-bg-tertiary">
                    <div className="flex flex-wrap gap-1.5">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all flex-grow text-center ${value === opt.value
                                    ? 'bg-theme-text-primary text-theme-bg-primary border-theme-text-primary'
                                    : 'bg-transparent text-theme-text-secondary border-theme-bg-tertiary hover:border-theme-text-secondary'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
