
import React, { useState } from 'react';
import { LayersIcon, SparklesIcon, XIcon } from './icons';

interface UnifiedRightSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: 'sketch' | 'render';
    onTabChange: (tab: 'sketch' | 'render') => void;
    outlinerNode: React.ReactNode;
    libraryNode: React.ReactNode;
    renderNode: React.ReactNode;

    // Resize Props for Outliner/Library split
    rightSidebarTopHeight: number;
    onResizeStart: (e: React.PointerEvent) => void;
    sidebarRef: React.RefObject<HTMLElement>;
    overrideContent?: React.ReactNode;
}

export const UnifiedRightSidebar: React.FC<UnifiedRightSidebarProps> = ({
    isOpen,
    onClose,
    activeTab,
    onTabChange,
    outlinerNode,
    libraryNode,
    renderNode,
    rightSidebarTopHeight,
    onResizeStart,
    sidebarRef,
    overrideContent
}) => {
    if (!isOpen) return null;

    if (overrideContent) {
        return (
            <aside ref={sidebarRef} className="flex-shrink-0 w-80 border-l border-theme-bg-tertiary flex flex-col h-full bg-theme-bg-secondary relative z-30 shadow-xl transition-all duration-300">
                {/* Override Content (No Tabs) */}
                <div className="flex-grow flex flex-col min-h-0 relative bg-theme-bg-secondary overflow-hidden">
                    {overrideContent}
                </div>
            </aside>
        );
    }

    return (
        <aside ref={sidebarRef} className="flex-shrink-0 w-80 border-l border-theme-bg-tertiary flex flex-col h-full bg-theme-bg-secondary relative z-30 shadow-xl transition-all duration-300">
            {/* Header Tabs */}
            <div className="flex items-center border-b border-theme-bg-tertiary bg-theme-bg-primary">
                <button
                    onClick={() => onTabChange('sketch')}
                    className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'sketch'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <LayersIcon className="w-4 h-4" />
                    Boceto
                    {activeTab === 'sketch' && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-theme-accent-primary" />
                    )}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
                <button
                    onClick={() => onTabChange('render')}
                    className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'render'
                        ? 'text-theme-accent-primary bg-theme-bg-secondary'
                        : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                        }`}
                >
                    <SparklesIcon className="w-4 h-4" />
                    Render
                    {activeTab === 'render' && (
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-theme-accent-primary" />
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
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        {renderNode}
                    </div>
                )}
            </div>
        </aside>
    );
};
