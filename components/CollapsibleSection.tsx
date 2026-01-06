
import React, { useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from './icons';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="space-y-2 border border-theme-bg-tertiary rounded-lg p-3 bg-theme-bg-primary/20">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-[10px] font-black text-theme-accent-primary uppercase tracking-[0.2em] hover:text-theme-text-primary transition-colors py-1 focus:outline-none group"
            >
                <span className="group-hover:translate-x-1 transition-transform">{title}</span>
                {isOpen ? <ChevronUpIcon className="w-3 h-3 text-theme-text-tertiary" /> : <ChevronDownIcon className="w-3 h-3 text-theme-text-tertiary" />}
            </button>
            {isOpen && <div className="space-y-4 pt-2 animate-in slide-in-from-top-1 fade-in duration-200 border-t border-theme-bg-tertiary/50">{children}</div>}
        </div>
    );
};
