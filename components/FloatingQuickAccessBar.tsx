import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QuickAccessSettings, QuickAccessTool, Tool, StrokeMode } from '../types';
import { ChevronUpIcon, ChevronDownIcon, PlusIcon, MinusIcon, SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, FreeTransformIcon, SparklesIcon, CropIcon, MarqueeRectIcon, MarqueeCircleIcon, LassoIcon, MagicWandIcon, TextIcon, AdvancedMarkerIcon, WatercolorIcon, CubeIcon, EyedropperIcon } from './icons';
import { AdvancedColorPicker } from './AdvancedColorPicker';

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
    'marquee-circle': MarqueeCircleIcon,
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

    const handleColorPickerChange = (newColor: string) => {
        setColor(newColor);
        onColorChange(newColor);
    };

    const rect = anchorEl.getBoundingClientRect();
    const style: React.CSSProperties = { position: 'fixed', top: `${rect.bottom + 8}px`, left: `${rect.left}px`, zIndex: 60 }; // Top oriented

    const presets = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#78716c', '#ffffff', '#000000'];

    return createPortal(
        <div ref={popoverRef} style={style} className="bg-theme-bg-secondary p-3 rounded-lg shadow-2xl border border-theme-bg-tertiary space-y-3" onPointerDown={e => e.stopPropagation()}>
            {/* Advanced Picker */}
            <AdvancedColorPicker color={color} onChange={handleColorPickerChange} />

            {/* Hex Input */}
            <div className="flex items-center gap-2 justify-center">
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-text-secondary font-mono">#</span>
                    <input type="text" value={color.substring(1)} onChange={handleHexChange} className="w-24 bg-theme-bg-tertiary text-theme-text-primary rounded-md p-2 pl-5 font-mono text-sm uppercase" maxLength={6} />
                </div>
            </div>
            <div>
                <div className="grid grid-cols-7 gap-1">
                    {presets.map(preset => (
                        <button key={preset} onClick={() => { setColor(preset); onColorChange(preset); }} className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${preset === color ? 'border-theme-accent-primary' : 'border-transparent hover:border-gray-400'}`} style={{ backgroundColor: preset }} />
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

const SizeEditorPopover = ({ anchorEl, initialSize, onSizeChange, onClose }: { anchorEl: HTMLElement; initialSize: number; onSizeChange: (size: number) => void; onClose: () => void; }) => {
    const [size, setSize] = useState(initialSize);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setSize(initialSize); }, [initialSize]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && !anchorEl.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorEl]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSize = parseInt(e.target.value, 10);
        setSize(newSize);
        onSizeChange(newSize);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 1;
        if (val < 1) val = 1;
        if (val > 300) val = 300;
        setSize(val);
        onSizeChange(val);
    };

    const handleIncrement = () => {
        const newSize = Math.min(300, size + 1);
        setSize(newSize);
        onSizeChange(newSize);
    };

    const handleDecrement = () => {
        const newSize = Math.max(1, size - 1);
        setSize(newSize);
        onSizeChange(newSize);
    };

    const rect = anchorEl.getBoundingClientRect();
    const style: React.CSSProperties = { position: 'fixed', top: `${rect.bottom + 8}px`, left: `${rect.left}px`, zIndex: 60 };

    return createPortal(
        <div ref={popoverRef} style={style} className="bg-theme-bg-secondary p-3 rounded-lg shadow-2xl border border-theme-bg-tertiary flex flex-col items-center gap-3 w-64" onPointerDown={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 w-full">
                <span className="text-xs font-bold text-theme-text-secondary w-8">Px:</span>
                <input
                    type="number"
                    min="1"
                    max="300"
                    value={size}
                    onChange={handleInputChange}
                    className="w-full bg-theme-bg-tertiary text-theme-text-primary rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-theme-accent-primary"
                />
            </div>
            <div className="flex items-center gap-2 w-full">
                <button onClick={handleDecrement} className="p-1 rounded hover:bg-theme-bg-tertiary text-theme-text-secondary transition-colors">
                    <MinusIcon className="w-4 h-4" />
                </button>
                <input
                    type="range"
                    min="1"
                    max="300"
                    value={size}
                    onChange={handleSliderChange}
                    className="flex-1 min-w-0 h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer slider-thumb-horizontal"
                />
                <button onClick={handleIncrement} className="p-1 rounded hover:bg-theme-bg-tertiary text-theme-text-secondary transition-colors">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>
            <style>{`
                .slider-thumb-horizontal::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: var(--theme-accent-primary);
                    cursor: pointer;
                    margin-top: -4px; /* Fix for WebKit vertical alignment */
                }
                .slider-thumb-horizontal::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: var(--theme-accent-primary);
                    cursor: pointer;
                    border: none;
                }
            `}</style>
        </div>,
        document.body
    );
};

// UseLongPress Hook (Internal)
const useLongPress = (callback: () => void, ms = 500) => {
    const [startLongPress, setStartLongPress] = useState(false);
    const timerRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (startLongPress) {
            timerRef.current = setTimeout(callback, ms);
        } else {
            clearTimeout(timerRef.current);
        }
        return () => clearTimeout(timerRef.current);
    }, [callback, ms, startLongPress]);

    return {
        onMouseDown: () => setStartLongPress(true),
        onMouseUp: () => setStartLongPress(false),
        onMouseLeave: () => setStartLongPress(false),
        onTouchStart: () => setStartLongPress(true),
        onTouchEnd: () => setStartLongPress(false),
    };
};

const QuickAccessToolButton = ({ t, isActive, onClick, onLongPress, onContextMenu, title }: { t: QuickAccessTool | null, isActive: boolean, onClick: () => void, onLongPress?: () => void, onContextMenu: (e: React.MouseEvent) => void, title: string }) => {
    const longPressProps = useLongPress(onLongPress || (() => { }), 500);

    if (!t) return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            className="w-8 h-8 rounded-lg bg-theme-bg-tertiary border border-dashed border-theme-bg-tertiary flex items-center justify-center hover:border-theme-accent-primary transition-colors flex-shrink-0"
            title="Ranura Vacía"
        >
            <PlusIcon className="w-3 h-3 text-theme-text-tertiary" />
        </button>
    );

    const Icon = t.type === 'tool' ? toolIconMap[t.tool] : (t.type === 'fx-preset' ? FXBrushIcon : BrushIcon);

    return (
        <button
            {...(onLongPress ? longPressProps : {})}
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative flex-shrink-0 ${isActive ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary text-theme-text-secondary hover:bg-theme-bg-hover'}`}
            title={title}
        >
            <Icon className="w-5 h-5" />
            {t.type === 'mode-preset' && (
                <div className="absolute -bottom-1 -right-1 text-[8px] bg-theme-bg-primary px-0.5 rounded border border-theme-bg-tertiary font-mono">
                    {t.mode === 'freehand' ? 'F' : (t.mode === 'line' ? 'L' : t.mode.charAt(0).toUpperCase())}
                </div>
            )}
        </button>
    );
};

const getToolTitle = (t: QuickAccessTool | null) => {
    if (!t) return "Ranura Vacía";
    if (t.type === 'tool') return `Herramienta: ${t.tool}`;
    if (t.type === 'fx-preset') return `FX: ${t.name}`;
    if (t.type === 'mode-preset') return `Modo: ${t.mode} (${t.tool})`;
    return "Desconocido";
};

// ...

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

    const [editingSize, setEditingSize] = useState<{ index: number; initialSize: number; anchorEl: HTMLElement } | null>(null);

    // Size Handlers
    const handleSizeDoubleClick = (index: number, currentSize: number, anchorEl: HTMLElement) => {
        setEditingSize({ index, initialSize: currentSize, anchorEl });
    };

    // ... (useEffect for context menu)

    // ..
    const handleEyeDropper = async () => {
        if (!(window as any).EyeDropper) {
            alert("EyeDropper API no compatible con este navegador.");
            return;
        }
        try {
            const eyeDropper = new (window as any).EyeDropper();
            const result = await eyeDropper.open();
            if (result.sRGBHex) {
                if (activeColorType === 'stroke') {
                    onSelectColor(result.sRGBHex);
                } else if (onSelectFillColor) {
                    onSelectFillColor(result.sRGBHex);
                }
            }
        } catch (e) {
            console.log("EyeDropper cancelado o fallido");
        }
    };

    return (
        <div className={`fixed left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[95vw] transition-all duration-300 ${isHeaderVisible ? 'top-[72px]' : 'top-4'}`}>

            {/* Size Edit Popover */}
            {editingSize && (
                <SizeEditorPopover
                    anchorEl={editingSize.anchorEl}
                    initialSize={editingSize.initialSize}
                    onClose={() => setEditingSize(null)}
                    onSizeChange={(newSize) => {
                        if (editingSize.index !== null) {
                            onUpdateSize(editingSize.index, newSize);
                            setEditingSize(prev => prev ? { ...prev, initialSize: newSize } : null);
                            onSelectSize(newSize); // Immediate update
                        }
                    }}
                />
            )}

            {/* Color Edit Popover and Context Menu */}
            {editingColor && (
                <ColorEditorPopover
                    anchorEl={editingColor.anchorEl}
                    initialColor={editingColor.initialColor}
                    onClose={() => setEditingColor(null)}
                    onColorChange={(newColor) => {
                        if (editingColor.index !== null) {
                            onUpdateColor(editingColor.index, newColor);
                            setEditingColor(prev => prev ? { ...prev, initialColor: newColor } : null);
                            if (activeColorType === 'stroke') {
                                onSelectColor(newColor);
                            } else if (activeColorType === 'fill' && onSelectFillColor) {
                                onSelectFillColor(newColor);
                            }
                        }
                    }}
                />
            )}
            {colorContextMenu && createPortal(
                <div ref={contextMenuRef} className="fixed z-[70] bg-theme-bg-secondary rounded-md shadow-lg border border-theme-bg-tertiary py-1" style={{ top: colorContextMenu.y, left: colorContextMenu.x }}>
                    <button onClick={() => { if (quickAccessSettings.colors.length > 1) onRemoveColor(colorContextMenu.index); setColorContextMenu(null); }} className="block w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-theme-bg-hover">Eliminar</button>
                </div>,
                document.body
            )}

            <div className="bg-theme-bg-primary/95 backdrop-blur-md rounded-xl p-1.5 flex items-center gap-2 shadow-sm border border-theme-bg-tertiary overflow-x-auto scrollbar-hide max-w-full">
                <button onClick={onToggleHeader} className="p-2 rounded-lg text-theme-text-secondary hover:bg-theme-bg-tertiary transition-colors flex-shrink-0" title={isHeaderVisible ? "Ocultar Encabezado" : "Mostrar Encabezado"}>
                    {isHeaderVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>

                <div className="w-px h-6 bg-theme-bg-tertiary" />

                <div className="flex items-center gap-2 mr-2">
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0" title="Color de Trazo" onClick={() => setActiveColorType('stroke')}>
                        <div className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${activeColorType === 'stroke' ? 'ring-2 ring-theme-accent-primary scale-110' : ''}`} style={{ backgroundColor: activeColor, borderColor: 'rgba(0,0,0,0.2)' }}></div>
                    </div>
                    <button onClick={handleEyeDropper} className="p-1 rounded-full text-theme-text-secondary hover:bg-theme-bg-tertiary transition-colors" title="Selector de Color en Pantalla">
                        <EyedropperIcon className="w-4 h-4" />
                    </button>
                    {activeFillColor !== undefined && onSelectFillColor && (
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0" title="Color de Relleno" onClick={() => setActiveColorType('fill')}>
                            <div className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${activeColorType === 'fill' ? 'ring-2 ring-theme-accent-primary scale-110' : ''}`} style={{ backgroundColor: activeFillColor, borderColor: 'rgba(0,0,0,0.2)' }}>
                                {activeFillColor === 'transparent' && <div className="w-full h-0.5 bg-red-500 rotate-45 relative top-1/2 -translate-y-1/2 rounded-full"></div>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                <div className="flex items-center gap-1.5">
                    {quickAccessSettings.colors.map((color, idx) => (
                        <button
                            key={idx}
                            onClick={() => activeColorType === 'stroke' ? onSelectColor(color) : onSelectFillColor?.(color)}
                            onDoubleClick={(e) => setEditingColor({ index: idx, initialColor: color, anchorEl: e.currentTarget })}
                            onContextMenu={(e) => { e.preventDefault(); setColorContextMenu({ x: e.clientX, y: e.clientY, index: idx }); }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${activeColor === color || activeFillColor === color ? 'border-theme-accent-primary' : 'border-theme-bg-tertiary'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                    <button
                        onClick={() => activeColorType === 'stroke' ? onSelectColor('transparent') : onSelectFillColor?.('transparent')}
                        className={`w-6 h-6 rounded-full border-2 border-theme-bg-tertiary flex items-center justify-center bg-white relative overflow-hidden transition-transform hover:scale-110 flex-shrink-0 ${activeColor === 'transparent' || activeFillColor === 'transparent' ? 'border-theme-accent-primary' : ''}`}
                        title="Transparente"
                    >
                        <div className="w-full h-0.5 bg-red-500 rotate-45 absolute"></div>
                    </button>
                    <button onClick={() => onAddColor('#ffffff')} className="w-6 h-6 rounded-full border-2 border-dashed border-theme-text-tertiary flex items-center justify-center hover:border-theme-accent-primary text-theme-text-tertiary hover:text-theme-accent-primary transition-colors flex-shrink-0">
                        <PlusIcon className="w-3 h-3" />
                    </button>
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

                <div className="flex items-center gap-1">
                    {quickAccessSettings.sizes.map((size, idx) => (
                        <div key={idx} className="relative">
                            <button
                                onClick={() => onSelectSize(size)}
                                onDoubleClick={(e) => handleSizeDoubleClick(idx, size, e.currentTarget)}
                                className={`w-8 py-1 rounded text-xs font-bold transition-colors flex-shrink-0 ${activeSize === size ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary text-theme-text-secondary hover:bg-theme-bg-hover'}`}
                                title={`${size}px (Doble clic para editar)`}
                            >
                                {size}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="w-px h-6 bg-theme-bg-tertiary" />

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
                    <button onClick={onAddToolSlot} className="p-2 rounded-lg border border-dashed border-theme-bg-tertiary text-theme-text-tertiary hover:text-theme-accent-primary hover:border-theme-accent-primary transition-colors flex-shrink-0">
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div >
    );
};
