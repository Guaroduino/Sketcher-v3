import React, { useState, useRef, useEffect } from 'react';
import { QuickAccessSettings, QuickAccessTool, Tool, StrokeMode } from '../types';
import { ChevronUpIcon, ChevronDownIcon, PlusIcon, SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, FreeTransformIcon, SparklesIcon, CropIcon, MarqueeRectIcon, LassoIcon, MagicWandIcon, TextIcon, AdvancedMarkerIcon, WatercolorIcon, CubeIcon } from './icons';

interface FloatingQuickAccessBarProps {
    quickAccessSettings: QuickAccessSettings;
    activeColor: string;
    activeSize: number;
    tool: Tool;
    strokeMode: StrokeMode;
    onUpdateColor: (index: number, newColor: string) => void;
    onAddColor: (color: string) => void;
    onRemoveColor: (index: number) => void;
    onUpdateSize: (index: number, newSize: number) => void;
    onSelectColor: (color: string) => void;
    onSelectSize: (size: number) => void;
    onSelectTool: (tool: QuickAccessTool) => void;
    onOpenToolSelector: (index: number) => void;
    onAddToolSlot: () => void;
    onToggleHeader: () => void;
    isHeaderVisible: boolean;
    activeFillColor?: string;
    onUpdateFillColor?: (index: number, newColor: string) => void;
    onSelectFillColor?: (color: string) => void;
    onOpenToolOptions?: () => void;
}

// Icon Map for Tool Slots (Reused)
const toolIconMap: Record<Tool, React.FC<{ className?: string }>> = {
    'select': SelectIcon,
    'brush': BrushIcon,
    'eraser': EraserIcon,
    'simple-marker': SolidMarkerIcon,
    'natural-marker': NaturalMarkerIcon,
    'airbrush': AirbrushIcon,
    'fx-brush': FXBrushIcon,
    'transform': TransformIcon,
    'free-transform': FreeTransformIcon,
    'crop': CropIcon,
    'pan': () => null,
    'marquee-rect': MarqueeRectIcon,
    'lasso': LassoIcon,
    'magic-wand': MagicWandIcon,
    'debug-brush': BrushIcon,
    'text': TextIcon,
    'advanced-marker': AdvancedMarkerIcon,
    'watercolor': WatercolorIcon,
};

const ColorEditorPopover = ({ anchorEl, initialColor, onColorChange, onClose }: { anchorEl: HTMLElement; initialColor: string; onColorChange: (color: string) => void; onClose: () => void; }) => {
    const [color, setColor] = useState(initialColor);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setColor(initialColor); }, [initialColor]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && !anchorEl.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorEl]);

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHex = `#${e.target.value.toLowerCase()}`;
        setColor(newHex);
        if (/^#[0-9a-f]{6}$/i.test(newHex)) onColorChange(newHex);
    };

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setColor(e.target.value);
        onColorChange(e.target.value);
    };

    const rect = anchorEl.getBoundingClientRect();
    const style: React.CSSProperties = { position: 'fixed', top: `${rect.bottom + 8}px`, left: `${rect.left}px`, zIndex: 60 }; // Top oriented

    const presets = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#78716c', '#ffffff', '#000000'];

    return (
        <div ref={popoverRef} style={style} className="bg-theme-bg-secondary p-3 rounded-lg shadow-2xl border border-theme-bg-tertiary space-y-3" onPointerDown={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
                <div className="relative w-10 h-10">
                    <input type="color" value={color} onChange={handlePickerChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="w-10 h-10 rounded-md border border-theme-bg-hover" style={{ backgroundColor: color }}></div>
                </div>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-text-secondary font-mono">#</span>
                    <input type="text" value={color.substring(1)} onChange={handleHexChange} className="w-24 bg-theme-bg-tertiary text-theme-text-primary rounded-md p-2 pl-5 font-mono text-sm" maxLength={6} />
                </div>
            </div>
            <div>
                <div className="grid grid-cols-7 gap-1">
                    {presets.map(preset => (
                        <button key={preset} onClick={() => { setColor(preset); onColorChange(preset); }} className={`w-6 h-6 rounded-full border-2 ${preset === color ? 'border-theme-accent-primary' : 'border-transparent hover:border-gray-400'}`} style={{ backgroundColor: preset }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

import { useLongPress } from '../hooks/useLongPress';

// ... (other components)

const QuickAccessToolButton = ({
    t,
    isActive,
    onClick,
    onLongPress,
    onContextMenu,
    title
}: {
    t: QuickAccessTool | null,
    isActive: boolean,
    onClick: () => void,
    onLongPress: () => void,
    onContextMenu: (e: React.MouseEvent) => void,
    title: string
}) => {
    const longPressProps = useLongPress(
        onLongPress,
        onClick,
        { shouldPreventDefault: true, delay: 500 }
    );

    return (
        <button
            {...longPressProps}
            onContextMenu={onContextMenu}
            className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary text-theme-text-secondary hover:bg-theme-bg-hover'}`}
            title={title}
        >
            {renderToolSlotIcon(t)}
        </button>
    );
};

const renderToolSlotIcon = (t: QuickAccessTool | null) => {
    if (!t) return <PlusIcon className="w-4 h-4 text-theme-text-secondary" />;
    if (t.type === 'tool') { const Icon = toolIconMap[t.tool]; return Icon ? <Icon className="w-5 h-5" /> : null; }
    if (t.type === 'fx-preset') return <FXBrushIcon className="w-5 h-5" />;
    if (t.type === 'mode-preset') return t.mode === 'parallelepiped' ? <CubeIcon className="w-5 h-5" /> : <BrushIcon className="w-5 h-5" />;
    return null;
};
const getToolTitle = (t: QuickAccessTool | null) => t ? (t.type === 'tool' ? t.tool : t.type === 'fx-preset' ? `Preset: ${t.name}` : t.mode) : "Seleccionar";

export const FloatingQuickAccessBar: React.FC<FloatingQuickAccessBarProps> = ({
    quickAccessSettings, activeColor, activeSize, tool, strokeMode,
    onUpdateColor, onAddColor, onRemoveColor, onUpdateSize,
    onSelectColor, onSelectSize, onSelectTool, onOpenToolSelector, onAddToolSlot,
    onToggleHeader, isHeaderVisible,
    activeFillColor, onSelectFillColor, onOpenToolOptions
}) => {
    const [editingColor, setEditingColor] = useState<{ index: number; initialColor: string; anchorEl: HTMLElement } | null>(null);
    const [colorContextMenu, setColorContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [activeColorType, setActiveColorType] = useState<'stroke' | 'fill'>('stroke');

    const [editingSize, setEditingSize] = useState<{ index: number; value: string } | null>(null);
    const sizeInputRef = useRef<HTMLInputElement>(null);

    // Size Handlers
    const handleSizeDoubleClick = (index: number, currentSize: number) => { setEditingSize({ index, value: String(currentSize) }); setTimeout(() => sizeInputRef.current?.select(), 0); };
    const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (editingSize) setEditingSize({ ...editingSize, value: e.target.value }); };
    const handleSizeBlur = () => {
        if (editingSize) {
            const newSize = parseInt(editingSize.value, 10);
            if (!isNaN(newSize)) onUpdateSize(editingSize.index, newSize);
            setEditingSize(null);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorContextMenu && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setColorContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [colorContextMenu]);

    return (
        <div className={`fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center max-w-[95vw] transition-all duration-300 ${isHeaderVisible ? 'top-20' : 'top-4'}`}>

            {/* Color Edit Popover and Context Menu */}
            {editingColor && (
                <ColorEditorPopover anchorEl={editingColor.anchorEl} initialColor={editingColor.initialColor} onClose={() => setEditingColor(null)} onColorChange={(newColor) => { if (editingColor.index !== null) { onUpdateColor(editingColor.index, newColor); setEditingColor(prev => prev ? { ...prev, initialColor: newColor } : null); } }} />
            )}
            {colorContextMenu && (
                <div ref={contextMenuRef} className="fixed z-60 bg-theme-bg-secondary rounded-md shadow-lg border border-theme-bg-tertiary py-1" style={{ top: colorContextMenu.y, left: colorContextMenu.x }}>
                    <button onClick={() => { if (quickAccessSettings.colors.length > 1) onRemoveColor(colorContextMenu.index); setColorContextMenu(null); }} className="block w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-theme-bg-hover">Eliminar</button>
                </div>
            )}


            <div className="bg-theme-bg-primary/95 backdrop-blur-md rounded-xl p-1.5 flex items-center gap-2 shadow-sm border border-theme-bg-tertiary overflow-x-auto scrollbar-hide max-w-full">
                {/* 1. Header Toggle */}
                <button onClick={onToggleHeader} className="p-2 rounded-lg text-theme-text-secondary hover:bg-theme-bg-tertiary transition-colors" title={isHeaderVisible ? "Ocultar Encabezado" : "Mostrar Encabezado"}>
                    {isHeaderVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                {/* 2. Active Colors Indicators */}
                <div className="flex items-center gap-2 mr-2">
                    <div className="flex flex-col items-center gap-0.5" title="Color de Trazo" onClick={() => setActiveColorType('stroke')}>
                        <div className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${activeColorType === 'stroke' ? 'ring-2 ring-theme-accent-primary scale-110' : ''}`} style={{ backgroundColor: activeColor, borderColor: 'rgba(0,0,0,0.2)' }}></div>
                    </div>
                    {activeFillColor !== undefined && onSelectFillColor && (
                        <div className="flex flex-col items-center gap-0.5" title="Color de Relleno" onClick={() => setActiveColorType('fill')}>
                            <div className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${activeColorType === 'fill' ? 'ring-2 ring-theme-accent-primary scale-110' : ''}`} style={{ backgroundColor: activeFillColor, borderColor: 'rgba(0,0,0,0.2)' }}>
                                {activeFillColor === 'transparent' && <div className="w-full h-0.5 bg-red-500 rotate-45 relative top-1/2 -translate-y-1/2 rounded-full"></div>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                {/* 3. Palette */}
                <div className="flex items-center gap-1.5">
                    {quickAccessSettings.colors.map((color, idx) => (
                        <button
                            key={idx}
                            onClick={() => activeColorType === 'stroke' ? onSelectColor(color) : onSelectFillColor?.(color)}
                            onDoubleClick={(e) => setEditingColor({ index: idx, initialColor: color, anchorEl: e.currentTarget })}
                            onContextMenu={(e) => { e.preventDefault(); setColorContextMenu({ x: e.clientX, y: e.clientY, index: idx }); }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${activeColor === color || activeFillColor === color ? 'border-theme-accent-primary' : 'border-theme-bg-tertiary'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                    <button
                        onClick={() => activeColorType === 'stroke' ? onSelectColor('transparent') : onSelectFillColor?.('transparent')}
                        className={`w-6 h-6 rounded-full border-2 border-theme-bg-tertiary flex items-center justify-center bg-white relative overflow-hidden transition-transform hover:scale-110 ${activeColor === 'transparent' || activeFillColor === 'transparent' ? 'border-theme-accent-primary' : ''}`}
                        title="Transparente"
                    >
                        <div className="w-full h-0.5 bg-red-500 rotate-45 absolute"></div>
                    </button>
                    <button onClick={() => onAddColor('#ffffff')} className="w-6 h-6 rounded-full border-2 border-dashed border-theme-text-tertiary flex items-center justify-center hover:border-theme-accent-primary text-theme-text-tertiary hover:text-theme-accent-primary transition-colors">
                        <PlusIcon className="w-3 h-3" />
                    </button>
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                {/* 4. Sizes */}
                <div className="flex items-center gap-1">
                    {quickAccessSettings.sizes.map((size, idx) => (
                        <div key={idx} className="relative">
                            {editingSize?.index === idx ? (
                                <input ref={sizeInputRef} type="number" value={editingSize.value} onChange={handleSizeChange} onBlur={handleSizeBlur} onKeyDown={(e) => e.key === 'Enter' && handleSizeBlur()} className="w-10 text-center text-xs bg-theme-bg-tertiary rounded p-0.5" />
                            ) : (
                                <button onClick={() => onSelectSize(size)} onDoubleClick={() => handleSizeDoubleClick(idx, size)} className={`w-8 py-1 rounded text-xs font-bold transition-colors ${activeSize === size ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary text-theme-text-secondary hover:bg-theme-bg-hover'}`} title={`${size}px`}>
                                    {size}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                {/* 5. Tool Slots */}
                <div className="flex items-center gap-1">
                    {quickAccessSettings.tools.map((t, idx) => {
                        const isActive = t && (
                            (t.type === 'tool' && t.tool === tool) ||
                            (t.type === 'fx-preset' && tool === 'fx-brush') ||
                            (t.type === 'mode-preset' && tool === t.tool && strokeMode === t.mode)
                        );
                        return (
                            <QuickAccessToolButton
                                key={idx}
                                t={t}
                                isActive={!!isActive}
                                onClick={() => t ? onSelectTool(t) : onOpenToolSelector(idx)}
                                onLongPress={() => onOpenToolOptions?.()}
                                onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onOpenToolSelector(idx); }}
                                title={getToolTitle(t)}
                            />
                        );
                    })}
                    <button onClick={onAddToolSlot} className="p-2 rounded-lg border border-dashed border-theme-bg-tertiary text-theme-text-tertiary hover:text-theme-accent-primary hover:border-theme-accent-primary transition-colors">
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
