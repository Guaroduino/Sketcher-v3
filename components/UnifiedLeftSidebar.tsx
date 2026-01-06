
import React from 'react';
import { BrushIcon } from './icons';

interface UnifiedLeftSidebarProps {
    isOpen: boolean;
    // Removed activeTab and onTabChange as unnecessary for single content
    drawingToolsNode: React.ReactNode;
}

export const UnifiedLeftSidebar: React.FC<UnifiedLeftSidebarProps> = React.memo(({
    isOpen,
    drawingToolsNode
}) => {
    // Left sidebar now only contains tools.
    return (
        <div className="flex flex-col h-full bg-theme-bg-secondary w-full">
            {/* Header - Static Label 'Tools' */}
            <div className="flex items-center border-b border-theme-bg-tertiary bg-theme-bg-primary h-11 shrink-0">
                <div className="flex-1 min-w-[60px] py-3 px-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 text-theme-accent-primary bg-theme-bg-secondary">
                    <BrushIcon className="w-3 h-3" />
                    Herramientas
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent-primary" />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 w-full h-full bg-theme-bg-secondary z-10">
                    {drawingToolsNode}
                </div>
            </div>
        </div>
    );
});
