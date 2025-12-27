
import React from 'react';
import { EyeIcon, BrushIcon } from './icons'; // Using Eye for Visual Prompting, Brush for Tools

interface UnifiedLeftSidebarProps {
    isOpen: boolean;
    activeTab: 'visual-prompting' | 'tools';
    onTabChange: (tab: 'visual-prompting' | 'tools') => void;
    visualPromptingNode: React.ReactNode;
    drawingToolsNode: React.ReactNode;
}

export const UnifiedLeftSidebar: React.FC<UnifiedLeftSidebarProps> = React.memo(({
    isOpen,
    activeTab,
    onTabChange,
    visualPromptingNode,
    drawingToolsNode
}) => {
    // If we want it to be collapsible like the right one, we check isOpen.
    // The previous implementation used a transform class.
    // Here we will use the same fixed position style as the previous sidebar, but with internal tabs.
    // The App.tsx controls the visibility via 'isLeftSidebarVisible'.

    // Note: The parent App.tsx handles the wider visibility logic (className with translate).
    // This component fills the <aside>.

    return (
        <div className="flex flex-col h-full bg-theme-bg-secondary w-full">
            {/* Header Tabs */}
            <div className="flex items-center border-b border-theme-bg-tertiary bg-theme-bg-primary">
                <button
                    onClick={() => onTabChange('visual-prompting')}
                    className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'visual-prompting'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <EyeIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Visual</span>
                    {activeTab === 'visual-prompting' && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-theme-accent-primary" />
                    )}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
                <button
                    onClick={() => onTabChange('tools')}
                    className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'tools'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <BrushIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Tools</span>
                    {activeTab === 'tools' && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-theme-accent-primary" />
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'visual-prompting' ? (
                    <div className="absolute inset-0 w-full h-full bg-theme-bg-secondary z-10 transition-opacity">
                        {visualPromptingNode}
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full bg-theme-bg-secondary z-10 transition-opacity">
                        {drawingToolsNode}
                    </div>
                )}
            </div>
        </div>
    );
});
