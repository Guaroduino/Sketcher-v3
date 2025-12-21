
import React from 'react';
import {
    BrushIcon as PencilIcon,
    EraserIcon,
    SquareIcon,
    HandIcon as CursorClickIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '../../components/icons';

interface VisualPromptingToolbarProps {
    activeTool: 'pen' | 'eraser' | 'region' | 'polygon' | 'pan';
    onToolChange: (tool: 'pen' | 'eraser' | 'region' | 'polygon' | 'pan') => void;
    isPanelOpen: boolean;
    onTogglePanel: () => void;
    onProcessChanges?: () => void;
}

export const VisualPromptingToolbar: React.FC<VisualPromptingToolbarProps> = ({
    activeTool,
    onToolChange,
    isPanelOpen,
    onTogglePanel,
    onProcessChanges
}) => {
    return (
        <div className="w-12 bg-[#181818] border-r border-[#333] flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0">
            {/* Tools */}
            <div className="flex flex-col gap-2 w-full px-2">
                <ToolButton
                    active={activeTool === 'pan'}
                    onClick={() => onToolChange('pan')}
                    icon={<CursorClickIcon className="w-5 h-5" />}
                    title="Mover (Pan)"
                />
                <ToolButton
                    active={activeTool === 'pen'}
                    onClick={() => onToolChange('pen')}
                    icon={<PencilIcon className="w-5 h-5" />}
                    title="Lápiz"
                />
                <ToolButton
                    active={activeTool === 'eraser'}
                    onClick={() => onToolChange('eraser')}
                    icon={<EraserIcon className="w-5 h-5" />}
                    title="Borrador"
                />
                <div className="h-px bg-[#333] w-full my-1"></div>
                <ToolButton
                    active={activeTool === 'region'}
                    onClick={() => onToolChange('region')} // Keeps 'region' for Rectangle
                    icon={<SquareIcon className="w-5 h-5" />}
                    title="Región Rectangular"
                />
                <ToolButton
                    active={activeTool === 'polygon'}
                    onClick={() => onToolChange('polygon')} // New Polygon Tool
                    icon={
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a2 2 0 110 4h-1a1 1 0 00-1 1v3a2 2 0 11-4 0v-1a1 1 0 00-1-1H7a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3z" />
                        </svg>
                    }
                    title="Región Poligonal"
                />
            </div>

            <div className="flex-grow"></div>

            {/* Make Changes Button */}
            <div className="px-2 pb-4 w-full">
                <button
                    onClick={() => { if (onProcessChanges) onProcessChanges(); }}
                    className="w-full aspect-square rounded-lg bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 flex flex-col items-center justify-center gap-1 transition-all"
                    title="Hacer Cambios"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            </div>



        </div>
    );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, title: string }> = ({ active, onClick, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
            : 'text-gray-400 hover:bg-[#333] hover:text-gray-200'
            }`}
    >
        {icon}
    </button>
);
