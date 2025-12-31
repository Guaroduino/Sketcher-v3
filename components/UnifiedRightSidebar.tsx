
import React, { useState } from 'react';
import { LayersIcon, SparklesIcon, XIcon, EyeIcon } from './icons';

interface UnifiedRightSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: 'sketch' | 'render' | 'simple_render' | 'visual_prompting';
    onTabChange: (tab: 'sketch' | 'render' | 'simple_render' | 'visual_prompting') => void;
    outlinerNode: React.ReactNode;
    libraryNode: React.ReactNode;
    renderNode: React.ReactNode;
    simpleRenderNode: React.ReactNode;
    visualPromptingNode: React.ReactNode;

    // Resize Props for Outliner/Library split
    rightSidebarTopHeight: number;
    onResizeStart: (e: React.PointerEvent) => void;
    sidebarRef: React.RefObject<HTMLElement>;
    overrideContent?: React.ReactNode;
}

export const UnifiedRightSidebar: React.FC<UnifiedRightSidebarProps> = React.memo(({
    isOpen,
    onClose,
    activeTab,
    onTabChange,
    outlinerNode,
    libraryNode,
    renderNode,
    simpleRenderNode,
    visualPromptingNode,
    rightSidebarTopHeight,
    onResizeStart,
    sidebarRef,
    overrideContent
}) => {
    if (!isOpen) return null;

    if (overrideContent) {
        return (
            <div ref={sidebarRef} className="flex flex-col h-full w-full bg-theme-bg-secondary relative z-30 shadow-xl">
                {/* Override Content (No Tabs) */}
                <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary overflow-hidden">
                    {overrideContent}
                </div>
            </div>
        );
    }

    return (
        <div ref={sidebarRef} className="flex flex-col h-full w-full bg-theme-bg-secondary relative z-40">
            {/* Header Tabs */}
            <div className="flex items-center border-b border-theme-bg-tertiary bg-theme-bg-primary overflow-x-auto scrollbar-hide shrink-0 h-11">
                <button
                    onClick={() => onTabChange('sketch')}
                    className={`flex-1 min-w-[60px] py-3 px-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors relative ${activeTab === 'sketch'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <LayersIcon className="w-3 h-3 ml-1" />
                    Boceto
                    {activeTab === 'sketch' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent-primary" />
                    )}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
                <button
                    onClick={() => onTabChange('render')}
                    className={`flex-1 min-w-[60px] py-3 px-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors relative ${activeTab === 'render'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <SparklesIcon className="w-3 h-3 ml-1" />
                    Render
                    {activeTab === 'render' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent-primary" />
                    )}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
                <button
                    onClick={() => onTabChange('simple_render')}
                    className={`flex-1 min-w-[60px] py-3 px-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors relative ${activeTab === 'simple_render'
                        ? 'text-blue-500 bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <SparklesIcon className="w-3 h-3" />
                    Simp.
                    {activeTab === 'simple_render' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
                <button
                    onClick={() => onTabChange('visual_prompting')}
                    className={`flex-1 min-w-[60px] py-3 px-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors relative ${activeTab === 'visual_prompting'
                        ? 'text-purple-500 bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <EyeIcon className="w-3 h-3" />
                    Visual
                    {activeTab === 'visual_prompting' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary">
                {activeTab === 'sketch' ? (
                    <>
                        <div style={{ height: rightSidebarTopHeight }} className="flex-shrink-0 relative overflow-hidden flex flex-col">
                            {outlinerNode}
                        </div>
                        <div
                            onPointerDown={onResizeStart}
                            className="flex-shrink-0 h-1.5 bg-theme-bg-tertiary hover:bg-theme-accent-primary transition-colors cursor-ns-resize flex items-center justify-center group"
                        >
                            <div className="w-8 h-0.5 bg-theme-text-tertiary group-hover:bg-white rounded-full opacity-50" />
                        </div>
                        <div className="flex-grow min-h-0 relative overflow-hidden flex flex-col">
                            {libraryNode}
                        </div>
                    </>
                ) : activeTab === 'render' ? (
                    <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary">
                        {renderNode}
                    </div>
                ) : activeTab === 'simple_render' ? (
                    <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary">
                        {simpleRenderNode}
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary">
                        {visualPromptingNode}
                    </div>
                )}
            </div>
        </div>
    );
});
