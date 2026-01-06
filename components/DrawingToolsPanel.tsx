
import React, { useState, useRef, useEffect } from 'react';
import {
    BrushIcon, EraserIcon, GridIcon, RulerIcon,
    SettingsIcon, MoveIcon, UndoIcon, RedoIcon,
    TrashIcon, LayersIcon, SelectIcon, TextIcon,
    TransformIcon, FreeTransformIcon,
    FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon,
    SolidLineIcon, DashedLineIcon, DottedLineIcon, DashDotLineIcon,
    MirrorIcon, OrthogonalIcon, UploadIcon, DownloadIcon, CropIcon,
    LassoIcon, MarqueeRectIcon, MarqueeCircleIcon, PerspectiveIcon, SquareIcon, CircleIcon, CubeIcon, MoreVerticalIcon,
    ChevronDownIcon, ChevronRightIcon, SolidMarkerIcon, AdvancedMarkerIcon, NaturalMarkerIcon, AirbrushIcon,
    WatercolorIcon, FXBrushIcon, ExpandIcon, EyeOpenIcon, EyeClosedIcon, RefreshCwIcon,
} from './icons';

import type {
    BrushSettings, EraserSettings, SimpleMarkerSettings, AdvancedMarkerSettings,
    NaturalMarkerSettings, AirbrushSettings, WatercolorSettings, FXBrushSettings
} from '../types';

interface DrawingToolsPanelProps {
    // Tool State
    tool: string;
    setTool: (tool: any) => void;

    // Stroke State
    strokeMode: string;
    setStrokeMode: (mode: any) => void;
    strokeModifier: { style: string };
    setStrokeModifier: (modifier: any) => void;

    // Brush Settings
    brushColor: string;
    setBrushColor: (color: string) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushOpacity: number;
    setBrushOpacity: (opacity: number) => void;
    strokeSmoothing: number;
    setStrokeSmoothing: (smoothing: number) => void;
    isPressureSensitivityEnabled: boolean;
    setPressureSensitivityEnabled: (enabled: boolean) => void;

    // Specific Tool Settings (for popover configuration)
    brushSettings: BrushSettings;
    setBrushSettings: (settings: React.SetStateAction<BrushSettings>) => void;
    eraserSettings: EraserSettings;
    setEraserSettings: (settings: React.SetStateAction<EraserSettings>) => void;
    simpleMarkerSettings: SimpleMarkerSettings;
    setSimpleMarkerSettings: (settings: React.SetStateAction<SimpleMarkerSettings>) => void;
    advancedMarkerSettings: AdvancedMarkerSettings;
    setAdvancedMarkerSettings: (settings: React.SetStateAction<AdvancedMarkerSettings>) => void;
    naturalMarkerSettings: NaturalMarkerSettings;
    setNaturalMarkerSettings: (settings: React.SetStateAction<NaturalMarkerSettings>) => void;
    airbrushSettings: AirbrushSettings;
    setAirbrushSettings: (settings: React.SetStateAction<AirbrushSettings>) => void;
    watercolorSettings: WatercolorSettings;
    setWatercolorSettings: (settings: React.SetStateAction<WatercolorSettings>) => void;

    // Guide State
    isGridVisible: boolean;
    setGridVisible: (visible: boolean) => void;
    gridSize: number;
    setGridSize: (size: number) => void;

    isPerspectiveEnabled: boolean;
    setPerspectiveEnabled: (enabled: boolean) => void;
    isPerspectiveGridVisible?: boolean;
    togglePerspectiveGrid?: () => void;
    perspectiveGridColor?: string;
    setPerspectiveGridColor?: (color: string) => void;
    perspectiveGridDensity?: number;
    setPerspectiveGridDensity?: (density: number) => void;
    perspectiveGridVerticalScope?: 'both' | 'above' | 'below';
    setPerspectiveGridVerticalScope?: (scope: 'both' | 'above' | 'below') => void;
    perspectiveGridLength?: 'full' | 'short';
    setPerspectiveGridLength?: (length: 'full' | 'short') => void;
    onResetPerspective?: () => void;


    isSymmetryEnabled: boolean;
    setSymmetryEnabled: (enabled: boolean) => void;

    isOrthogonalEnabled: boolean;
    setOrthogonalEnabled: (enabled: boolean) => void;

    isRulerEnabled: boolean;
    setRulerEnabled: (enabled: boolean) => void;

    // File
    onImportBackground: () => void;
    onExportImage: () => void;
    onCropCanvas: () => void;

    // Actions
    onUndo: () => void;
    onRedo: () => void;
    onClearCanvas: () => void;
    onOpenCanvasSizeModal: () => void;
    onUpdateBackground: (updates: { color?: string, file?: File }) => void;
    backgroundColor?: string;
    isBackgroundVisible?: boolean;
    onToggleBackgroundVisibility?: () => void;
}



// Helper component for individual brush items to manage their own popover state
const BrushToolItem: React.FC<{
    tool: any;
    isActive: boolean;
    onSelect: () => void;
    settingsData: { values: any; setter: any } | null;
}> = ({ tool, isActive, onSelect, settingsData }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsPopoverOpen(false);
            }
        };

        if (isPopoverOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPopoverOpen]);


    const renderSettingSlider = (label: string, value: number, min: number, max: number, step: number, key: string) => {
        if (value === undefined) return null;
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-theme-text-secondary">
                    <span>{label}</span>
                    <span>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
                </div>
                <input
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={(e) => {
                        if (settingsData?.setter) {
                            settingsData.setter((prev: any) => ({ ...prev, [key]: parseFloat(e.target.value) }));
                        }
                    }}
                    className="w-full h-1.5 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent-primary block"
                />
            </div>
        );
    };

    return (
        <div className="relative flex items-center gap-1 group p-1 hover:bg-theme-bg-tertiary rounded-md">
            <button
                onClick={onSelect}
                className={`flex-1 flex items-center gap-2 p-2 rounded text-[10px] transition-colors ${isActive
                    ? 'bg-theme-accent-primary text-white font-bold shadow-sm'
                    : 'text-theme-text-secondary hover:text-theme-text-primary'
                    }`}
            >
                {tool.icon}
                <span>{tool.label}</span>
            </button>

            {/* Settings Button */}
            <div className="relative">
                <button
                    ref={triggerRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Close other popovers if needed (handled by click outside usually)
                        const rect = triggerRef.current?.getBoundingClientRect();
                        const sidebar = triggerRef.current?.closest('aside');
                        const sidebarRect = sidebar?.getBoundingClientRect() ?? { top: 0, left: 0 };
                        if (rect) {
                            setPopoverPos({
                                top: rect.top - sidebarRect.top,
                                left: rect.right - sidebarRect.left + 5
                            });
                        }
                        setIsPopoverOpen(!isPopoverOpen);
                    }}
                    className={`p-1.5 rounded transition-colors ${isActive
                        ? 'text-theme-accent-primary hover:bg-theme-bg-tertiary bg-white/10'
                        : 'text-theme-text-tertiary hover:text-theme-text-primary hover:bg-theme-bg-tertiary'
                        } ${isPopoverOpen ? 'bg-theme-bg-tertiary text-theme-text-primary' : ''}`}
                    title="Configuración"
                >
                    <MoreVerticalIcon className="w-4 h-4" />
                </button>

                {/* Settings Flyout - To the Right of the Item */}
                {isPopoverOpen && settingsData && (
                    <div
                        ref={popoverRef}
                        className="fixed w-48 bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-xl z-[60] p-3 space-y-3"
                        style={{
                            left: popoverPos.left,
                            top: popoverPos.top
                        }}
                    >
                        <h4 className="text-[11px] font-bold text-theme-text-primary border-b border-theme-bg-tertiary pb-1 mb-2">
                            Ajustes: {tool.label}
                        </h4>

                        {/* Generic rendering of available properties */}
                        {renderSettingSlider("Tamaño", settingsData.values.size, 1, 100, 1, 'size')}
                        {renderSettingSlider("Opacidad", settingsData.values.opacity, 0, 1, 0.05, 'opacity')}
                        {renderSettingSlider("Flujo", settingsData.values.flow, 0, 1, 0.05, 'flow')}
                        {renderSettingSlider("Humedad", settingsData.values.wetness, 0, 100, 1, 'wetness')}
                        {/* Add more as needed */}

                        <div className="pt-2 border-t border-theme-bg-tertiary">
                            <span className="text-[9px] text-theme-text-tertiary italic">Más ajustes próximamente...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};



export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
    tool, setTool,

    // Stroke
    strokeMode, setStrokeMode,
    strokeModifier, setStrokeModifier,

    // Brush
    brushColor, setBrushColor,
    brushSize, setBrushSize,
    brushOpacity, setBrushOpacity,
    strokeSmoothing, setStrokeSmoothing,
    isPressureSensitivityEnabled, setPressureSensitivityEnabled,

    // Specific Tool Settings
    brushSettings: _brushSettings, setBrushSettings, // Rename to avoid conflict with individual props if any, though we mostly use these objects now
    eraserSettings, setEraserSettings,
    simpleMarkerSettings, setSimpleMarkerSettings,
    advancedMarkerSettings, setAdvancedMarkerSettings,
    naturalMarkerSettings, setNaturalMarkerSettings,
    airbrushSettings, setAirbrushSettings,
    watercolorSettings, setWatercolorSettings,

    // Guides
    isGridVisible, setGridVisible,
    gridSize, setGridSize,
    isPerspectiveEnabled, setPerspectiveEnabled,
    isPerspectiveGridVisible, togglePerspectiveGrid,
    perspectiveGridColor, setPerspectiveGridColor,
    perspectiveGridDensity, setPerspectiveGridDensity,
    perspectiveGridVerticalScope, setPerspectiveGridVerticalScope,
    perspectiveGridLength, setPerspectiveGridLength, onResetPerspective,
    isSymmetryEnabled, setSymmetryEnabled,
    isOrthogonalEnabled, setOrthogonalEnabled,
    isRulerEnabled, setRulerEnabled,

    // File
    onImportBackground, onExportImage, onCropCanvas,

    // Actions
    onUndo, onRedo, onClearCanvas,
    onOpenCanvasSizeModal, onUpdateBackground, backgroundColor,
    isBackgroundVisible, onToggleBackgroundVisibility
}) => {

    // Helper Component for Optimized Sliders
    const ThrottledSlider = ({
        value,
        onChange,
        min,
        max,
        label,
        valueLabel,
        step = 1
    }: {
        value: number;
        onChange: (val: number) => void;
        min: number;
        max: number;
        label: string;
        valueLabel: string;
        step?: number;
    }) => {
        const [localValue, setLocalValue] = useState(value);
        const [isDragging, setIsDragging] = useState(false);

        useEffect(() => {
            if (!isDragging) {
                setLocalValue(value);
            }
        }, [value, isDragging]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = parseFloat(e.target.value);
            setLocalValue(val);
        };

        const handleCommit = () => {
            setIsDragging(false);
            if (localValue !== value) {
                onChange(localValue);
            }
        };

        return (
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-theme-text-secondary w-14">{label}</span>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={handleChange}
                    onPointerDown={() => setIsDragging(true)}
                    onPointerUp={handleCommit}
                    onBlur={handleCommit} // Ensure we commit if focus is lost
                    className="flex-grow h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent-primary"
                />
                <span className="text-[10px] text-theme-text-secondary w-8 text-right">
                    {valueLabel || localValue}
                </span>
            </div>
        );
    };

    const TOOLS = [
        { id: 'select', icon: <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI1IDkgMiAxMiA1IDE1Ii8+PHBvbHlsaW5lIHBvaW50cz0iOSA1IDEyIDIgMTUgNSIvPjxwb2x5bGluZSBwb2ludHM9IjE1IDE5IDEyIDIyIDkgMTkiLz48cG9seWxpbmUgcG9pbnRzPSIxOSA5IDIyIDEyIDE5IDE1Ii8+PGxpbmUgeDE9IjIiIHkxPSIxMiIgeDI9IjIyIiB5Mj0iMTIiLz48bGluZSB4MT0iMTIiIHkxPSIyIiB4Mj0iMTIiIHkyPSIyMiIvPjwvc3ZnPg==" className="w-5 h-5" />, label: 'Seleccionar' }, // MoveIcon placeholder
        { id: 'brush', icon: <BrushIcon className="w-5 h-5" />, label: 'Pincel' },
        { id: 'eraser', icon: <EraserIcon className="w-5 h-5" />, label: 'Borrador' },
        { id: 'text', icon: <TextIcon className="w-5 h-5" />, label: 'Texto' },
    ];

    const STROKE_MODES = [
        { id: 'freehand', icon: <FreehandIcon className="w-5 h-5" />, label: 'Mano Alzada' },
        { id: 'line', icon: <LineIcon className="w-5 h-5" />, label: 'Línea' },
        { id: 'polyline', icon: <PolylineIcon className="w-5 h-5" />, label: 'Polilínea' },
        { id: 'arc', icon: <ArcIcon className="w-5 h-5" />, label: 'Arco' },
        { id: 'bezier', icon: <BezierIcon className="w-5 h-5" />, label: 'Curva' },
        { id: 'rectangle', icon: <SquareIcon className="w-5 h-5" />, label: 'Rectángulo' },
        { id: 'circle', icon: <CircleIcon className="w-5 h-5" />, label: 'Círculo' },
        { id: 'parallelepiped', icon: <CubeIcon className="w-5 h-5" />, label: 'Caja 3D' },
    ];

    const STROKE_STYLES = [
        { id: 'solid', icon: <SolidLineIcon className="w-5 h-5" />, label: 'Sólido' },
        { id: 'dashed', icon: <DashedLineIcon className="w-5 h-5" />, label: 'Guiones' },
        { id: 'dotted', icon: <DottedLineIcon className="w-5 h-5" />, label: 'Punteado' },
        { id: 'dashdot', icon: <DashDotLineIcon className="w-5 h-5" />, label: 'Mixto' },
    ];

    const PRESET_COLORS = [
        '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
        '#FFFF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#808080',
        '#800000', '#800080', '#008080', '#ffa500', '#a52a2a', '#808000'
    ];

    const BRUSH_TOOLS = [
        { id: 'brush', icon: <BrushIcon className="w-5 h-5" />, label: 'Pincel Standard' },
        { id: 'simple-marker', icon: <SolidMarkerIcon className="w-5 h-5" />, label: 'Marcador' },
        { id: 'natural-marker', icon: <NaturalMarkerIcon className="w-5 h-5" />, label: 'Marcador Natural' },
        { id: 'advanced-marker', icon: <AdvancedMarkerIcon className="w-5 h-5" />, label: 'Lápiz de Color' },
        { id: 'airbrush', icon: <AirbrushIcon className="w-5 h-5" />, label: 'Aerógrafo' },
        { id: 'watercolor', icon: <WatercolorIcon className="w-5 h-5" />, label: 'Acuarela' },
    ];

    const [isBrushToolsOpen, setIsBrushToolsOpen] = useState(false);
    const [brushFlyoutPos, setBrushFlyoutPos] = useState({ top: 0, left: 0 });
    const brushToolsButtonRef = useRef<HTMLButtonElement>(null);
    const flyoutRef = useRef<HTMLDivElement>(null);

    // Stroke Mode State
    const [isStrokeModeOpen, setIsStrokeModeOpen] = useState(false);
    const [strokeModeFlyoutPos, setStrokeModeFlyoutPos] = useState({ top: 0, left: 0 });
    const strokeModeButtonRef = useRef<HTMLButtonElement>(null);
    const strokeModeFlyoutRef = useRef<HTMLDivElement>(null);

    // Stroke Style State
    const [isStrokeStyleOpen, setIsStrokeStyleOpen] = useState(false);
    const [strokeStyleFlyoutPos, setStrokeStyleFlyoutPos] = useState({ top: 0, left: 0 });
    const strokeStyleButtonRef = useRef<HTMLButtonElement>(null);
    const strokeStyleFlyoutRef = useRef<HTMLDivElement>(null);

    // Close flyout when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isBrushToolsOpen &&
                flyoutRef.current &&
                !flyoutRef.current.contains(event.target as Node) &&
                brushToolsButtonRef.current &&
                !brushToolsButtonRef.current.contains(event.target as Node)
            ) {
                setIsBrushToolsOpen(false);
            }
        };

        if (isBrushToolsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isBrushToolsOpen]);

    // Close stroke mode flyout when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isStrokeModeOpen &&
                strokeModeFlyoutRef.current &&
                !strokeModeFlyoutRef.current.contains(event.target as Node) &&
                strokeModeButtonRef.current &&
                !strokeModeButtonRef.current.contains(event.target as Node)
            ) {
                setIsStrokeModeOpen(false);
            }
        };
        if (isStrokeModeOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isStrokeModeOpen]);

    // Close stroke style flyout when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isStrokeStyleOpen &&
                strokeStyleFlyoutRef.current &&
                !strokeStyleFlyoutRef.current.contains(event.target as Node) &&
                strokeStyleButtonRef.current &&
                !strokeStyleButtonRef.current.contains(event.target as Node)
            ) {
                setIsStrokeStyleOpen(false);
            }
        };
        if (isStrokeStyleOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isStrokeStyleOpen]);

    // Helpers to access settings based on tool ID
    const getToolSettings = (id: string) => {
        switch (id) {
            case 'brush': return { values: _brushSettings, setter: setBrushSettings }; // Use _brushSettings
            case 'simple-marker': return { values: simpleMarkerSettings, setter: setSimpleMarkerSettings };
            case 'natural-marker': return { values: naturalMarkerSettings, setter: setNaturalMarkerSettings };
            case 'advanced-marker': return { values: advancedMarkerSettings, setter: setAdvancedMarkerSettings };
            case 'airbrush': return { values: airbrushSettings, setter: setAirbrushSettings };
            case 'watercolor': return { values: watercolorSettings, setter: setWatercolorSettings };
            default: return null;
        }
    };


    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-3 space-y-4 pb-16">

            {/* Sticky Tool Selection Logic */}
            {(() => {
                const handleToolClick = (newToolId: string) => {
                    // Sticky Color Logic:
                    // When switching to a drawing tool (that has color settings), 
                    // apply the *currently visible* brushColor to it.
                    const targetSettings = getToolSettings(newToolId);

                    // Only apply if the target tool HAS settings (is a drawing tool)
                    // AND we have a valid current color.
                    if (targetSettings && brushColor && brushColor !== 'transparent') {
                        targetSettings.setter((prev: any) => ({ ...prev, color: brushColor }));
                    }

                    setTool(newToolId);
                };

                return (
                    <>
                        {/* HERRAMIENTAS PRINCIPALES */}
                        <section>
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider mb-2 block">Selección y Dibujo</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                    onClick={() => setTool('select')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'select'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Seleccionar"
                                >
                                    <SelectIcon className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => handleToolClick('brush')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'brush'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Pincel"
                                >
                                    <BrushIcon className="w-4 h-4" />
                                </button>

                                <div className="w-px h-6 bg-theme-bg-tertiary mx-1 self-center"></div>

                                <button
                                    onClick={() => setTool('marquee-rect')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'marquee-rect'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Selección Rectangular"
                                >
                                    <MarqueeRectIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setTool('marquee-circle')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'marquee-circle'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Selección Circular"
                                >
                                    <MarqueeCircleIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setTool('lasso')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'lasso'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Lazo"
                                >
                                    <LassoIcon className="w-4 h-4" />
                                </button>

                                <div className="w-px h-6 bg-theme-bg-tertiary mx-1 self-center"></div>

                                <button
                                    onClick={() => setTool('eraser')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'eraser'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Borrador"
                                >
                                    <EraserIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setTool('text')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'text'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Texto"
                                >
                                    <TextIcon className="w-4 h-4" />
                                </button>

                                <div className="w-px h-6 bg-theme-bg-tertiary mx-1 self-center"></div>

                                <button
                                    onClick={() => setTool('transform')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'transform'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Transformar"
                                >
                                    <TransformIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setTool('free-transform')}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool === 'free-transform'
                                        ? 'bg-theme-accent-primary text-white shadow-md'
                                        : 'bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary border border-theme-bg-tertiary'
                                        }`}
                                    title="Transformación Libre"
                                >
                                    <FreeTransformIcon className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="h-px bg-theme-bg-tertiary opacity-50 mb-3"></div>

                            <div className="flex flex-col gap-1.5 w-full">
                                {/* HERRAMIENTAS DE DIBUJO (Flyout Trigger) */}
                                <div className="relative w-full">
                                    <button
                                        ref={brushToolsButtonRef}
                                        onClick={() => {
                                            const rect = brushToolsButtonRef.current?.getBoundingClientRect();
                                            const sidebar = brushToolsButtonRef.current?.closest('aside');
                                            const sidebarRect = sidebar?.getBoundingClientRect() ?? { top: 0, left: 0 };
                                            if (rect) {
                                                setBrushFlyoutPos({
                                                    top: rect.top - sidebarRect.top,
                                                    left: rect.right - sidebarRect.left + 10
                                                });
                                            }
                                            setIsBrushToolsOpen(!isBrushToolsOpen)
                                        }}
                                        className={`w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider py-2 px-2 rounded transition-colors ${isBrushToolsOpen ? 'bg-theme-bg-tertiary text-theme-text-primary' : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {BRUSH_TOOLS.find(b => b.id === tool)?.icon || <BrushIcon className="w-4 h-4" />}
                                            {BRUSH_TOOLS.find(b => b.id === tool)?.label || 'Herramientas de Dibujo'}
                                        </span>
                                        <ChevronRightIcon className={`w-3 h-3 transition-transform ${isBrushToolsOpen ? 'rotate-90' : ''}`} />
                                    </button>

                                    {/* Flyout List - Dynamically Positioned */}
                                    {isBrushToolsOpen && (
                                        <div
                                            ref={flyoutRef}
                                            className="fixed w-56 bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-xl z-50 flex flex-col p-1 max-h-[80vh] overflow-y-auto custom-scrollbar"
                                            style={{ top: brushFlyoutPos.top, left: brushFlyoutPos.left }}
                                        >
                                            {BRUSH_TOOLS.map(brushTool => {
                                                const isActive = tool === brushTool.id;
                                                const settingsData = getToolSettings(brushTool.id);

                                                return (
                                                    <BrushToolItem
                                                        key={brushTool.id}
                                                        tool={brushTool}
                                                        isActive={isActive}
                                                        onSelect={() => handleToolClick(brushTool.id)}
                                                        settingsData={settingsData}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* MODO DE TRAZO (Flyout Trigger) */}
                                <div className="relative w-full">
                                    <button
                                        ref={strokeModeButtonRef}
                                        onClick={() => {
                                            const rect = strokeModeButtonRef.current?.getBoundingClientRect();
                                            const sidebar = strokeModeButtonRef.current?.closest('aside');
                                            const sidebarRect = sidebar?.getBoundingClientRect() ?? { top: 0, left: 0 };
                                            if (rect) {
                                                setStrokeModeFlyoutPos({
                                                    top: rect.top - sidebarRect.top,
                                                    left: rect.right - sidebarRect.left + 10
                                                });
                                            }
                                            setIsStrokeModeOpen(!isStrokeModeOpen)
                                        }}
                                        className={`w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider py-2 px-2 rounded transition-colors ${isStrokeModeOpen ? 'bg-theme-bg-tertiary text-theme-text-primary' : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {STROKE_MODES.find(m => m.id === strokeMode)?.icon}
                                            {STROKE_MODES.find(m => m.id === strokeMode)?.label || 'Modo de Trazo'}
                                        </span>
                                        <ChevronRightIcon className={`w-3 h-3 transition-transform ${isStrokeModeOpen ? 'rotate-90' : ''}`} />
                                    </button>

                                    {/* Flyout List - Dynamically Positioned */}
                                    {isStrokeModeOpen && (
                                        <div
                                            ref={strokeModeFlyoutRef}
                                            className="fixed w-48 bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-xl z-50 flex flex-col p-1"
                                            style={{ top: strokeModeFlyoutPos.top, left: strokeModeFlyoutPos.left }}
                                        >
                                            <div className="text-[10px] font-bold text-theme-text-tertiary px-2 py-1 border-b border-theme-bg-tertiary mb-1">
                                                Modo de Trazo
                                            </div>
                                            {STROKE_MODES.map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => { setStrokeMode(mode.id); setIsStrokeModeOpen(false); }}
                                                    className={`flex items-center gap-2 p-2 rounded text-[10px] transition-colors ${strokeMode === mode.id
                                                        ? 'bg-theme-accent-primary text-white font-bold'
                                                        : 'text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary'
                                                        }`}
                                                >
                                                    {mode.icon}
                                                    <span>{mode.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* ESTILO DE TRAZO (Flyout Trigger) */}
                                <div className="relative w-full">
                                    <button
                                        ref={strokeStyleButtonRef}
                                        onClick={() => {
                                            const rect = strokeStyleButtonRef.current?.getBoundingClientRect();
                                            const sidebar = strokeStyleButtonRef.current?.closest('aside');
                                            const sidebarRect = sidebar?.getBoundingClientRect() ?? { top: 0, left: 0 };
                                            if (rect) {
                                                setStrokeStyleFlyoutPos({
                                                    top: rect.top - sidebarRect.top,
                                                    left: rect.right - sidebarRect.left + 10
                                                });
                                            }
                                            setIsStrokeStyleOpen(!isStrokeStyleOpen)
                                        }}
                                        className={`w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider py-2 px-2 rounded transition-colors ${isStrokeStyleOpen ? 'bg-theme-bg-tertiary text-theme-text-primary' : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {STROKE_STYLES.find(s => s.id === strokeModifier.style)?.icon}
                                            {STROKE_STYLES.find(s => s.id === strokeModifier.style)?.label || 'Estilo de Trazo'}
                                        </span>
                                        <ChevronRightIcon className={`w-3 h-3 transition-transform ${isStrokeStyleOpen ? 'rotate-90' : ''}`} />
                                    </button>

                                    {/* Flyout List - Dynamically Positioned */}
                                    {isStrokeStyleOpen && (
                                        <div
                                            ref={strokeStyleFlyoutRef}
                                            className="fixed w-48 bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-xl z-50 flex flex-col p-1"
                                            style={{ top: strokeStyleFlyoutPos.top, left: strokeStyleFlyoutPos.left }}
                                        >
                                            <div className="text-[10px] font-bold text-theme-text-tertiary px-2 py-1 border-b border-theme-bg-tertiary mb-1">
                                                Estilo de Trazo
                                            </div>
                                            {STROKE_STYLES.map(style => (
                                                <button
                                                    key={style.id}
                                                    onClick={() => { setStrokeModifier({ ...strokeModifier, style: style.id }); setIsStrokeStyleOpen(false); }}
                                                    className={`flex items-center gap-2 p-2 rounded text-[10px] transition-colors ${strokeModifier.style === style.id
                                                        ? 'bg-theme-accent-primary text-white font-bold'
                                                        : 'text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary'
                                                        }`}
                                                >
                                                    {style.icon}
                                                    <span>{style.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                        <div className="h-px bg-theme-bg-tertiary opacity-50 my-2"></div>

                        {/* Brush Sliders (Compact) */}
                        <section className="space-y-2 px-1">
                            <ThrottledSlider
                                label="Tamaño"
                                min={1}
                                max={100}
                                value={(() => {
                                    switch (tool) {
                                        case 'brush': return brushSize;
                                        case 'eraser': return eraserSettings.size;
                                        case 'simple-marker': return simpleMarkerSettings.size;
                                        case 'natural-marker': return naturalMarkerSettings.size;
                                        case 'advanced-marker': return advancedMarkerSettings.size;
                                        case 'airbrush': return airbrushSettings.size;
                                        case 'watercolor': return watercolorSettings.size;
                                        default: return brushSize;
                                    }
                                })()}
                                valueLabel={(() => {
                                    const val = (() => {
                                        switch (tool) {
                                            case 'brush': return brushSize;
                                            case 'eraser': return eraserSettings.size;
                                            case 'simple-marker': return simpleMarkerSettings.size;
                                            case 'natural-marker': return naturalMarkerSettings.size;
                                            case 'advanced-marker': return advancedMarkerSettings.size;
                                            case 'airbrush': return airbrushSettings.size;
                                            case 'watercolor': return watercolorSettings.size;
                                            default: return brushSize;
                                        }
                                    })();
                                    return `${val}px`;
                                })()}
                                onChange={(val) => {
                                    switch (tool) {
                                        case 'brush': setBrushSize(val); break;
                                        case 'eraser': setEraserSettings(s => ({ ...s, size: val })); break;
                                        case 'simple-marker': setSimpleMarkerSettings(s => ({ ...s, size: val })); break;
                                        case 'natural-marker': setNaturalMarkerSettings(s => ({ ...s, size: val })); break;
                                        case 'advanced-marker': setAdvancedMarkerSettings(s => ({ ...s, size: val })); break;
                                        case 'airbrush': setAirbrushSettings(s => ({ ...s, size: val })); break;
                                        case 'watercolor': setWatercolorSettings(s => ({ ...s, size: val })); break;
                                        default: setBrushSize(val); break;
                                    }
                                }}
                            />
                            <ThrottledSlider
                                label={(tool === 'airbrush' || tool === 'advanced-marker') ? 'Flujo' : 'Opacidad'}
                                min={0}
                                max={1}
                                step={0.01}
                                value={(() => {
                                    switch (tool) {
                                        case 'brush': return brushOpacity;
                                        case 'eraser': return eraserSettings.opacity;
                                        case 'simple-marker': return simpleMarkerSettings.opacity;
                                        case 'natural-marker': return naturalMarkerSettings.opacity;
                                        case 'advanced-marker': return (advancedMarkerSettings.flow ?? 100) / 100;
                                        case 'airbrush': return airbrushSettings.flow;
                                        case 'watercolor': return watercolorSettings.opacity;
                                        default: return brushOpacity;
                                    }
                                })()}
                                valueLabel={(() => {
                                    const val = (() => {
                                        switch (tool) {
                                            case 'brush': return brushOpacity;
                                            case 'eraser': return eraserSettings.opacity;
                                            case 'simple-marker': return simpleMarkerSettings.opacity;
                                            case 'natural-marker': return naturalMarkerSettings.opacity;
                                            case 'advanced-marker': return (advancedMarkerSettings.flow ?? 100) / 100;
                                            case 'airbrush': return airbrushSettings.flow;
                                            case 'watercolor': return watercolorSettings.opacity;
                                            default: return brushOpacity;
                                        }
                                    })();
                                    return `${Math.round(val * 100)}%`;
                                })()}
                                onChange={(val) => {
                                    switch (tool) {
                                        case 'brush': setBrushOpacity(val); break;
                                        case 'eraser': setEraserSettings(s => ({ ...s, opacity: val })); break;
                                        case 'simple-marker': setSimpleMarkerSettings(s => ({ ...s, opacity: val })); break;
                                        case 'natural-marker': setNaturalMarkerSettings(s => ({ ...s, opacity: val })); break;
                                        case 'advanced-marker': setAdvancedMarkerSettings(s => ({ ...s, flow: val * 100 })); break;
                                        case 'airbrush': setAirbrushSettings(s => ({ ...s, flow: val })); break;
                                        case 'watercolor': setWatercolorSettings(s => ({ ...s, opacity: val })); break;
                                        default: setBrushOpacity(val); break;
                                    }
                                }}
                            />
                            <ThrottledSlider
                                label="Suavizado"
                                min={0}
                                max={1}
                                step={0.05}
                                value={strokeSmoothing}
                                valueLabel={`${Math.round(strokeSmoothing * 100)}%`}
                                onChange={(val) => setStrokeSmoothing(val)}
                            />

                            {/* Softness Slider (Only for supported tools) */}
                            {(tool === 'brush' || tool === 'eraser' || tool === 'advanced-marker') && (
                                <div className="space-y-2">
                                    <ThrottledSlider
                                        label="Suavidad"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={
                                            tool === 'eraser' ? (100 - eraserSettings.hardness) :
                                                tool === 'advanced-marker' ? (100 - advancedMarkerSettings.hardness) :
                                                    (100 - _brushSettings.hardness)
                                        }
                                        valueLabel={(() => {
                                            const val = tool === 'eraser' ? (100 - eraserSettings.hardness) :
                                                tool === 'advanced-marker' ? (100 - advancedMarkerSettings.hardness) :
                                                    (100 - _brushSettings.hardness);
                                            return `${val}%`;
                                        })()}
                                        onChange={(softness) => {
                                            const hardness = 100 - softness;
                                            if (tool === 'eraser') setEraserSettings(prev => ({ ...prev, hardness }));
                                            else if (tool === 'advanced-marker') setAdvancedMarkerSettings(prev => ({ ...prev, hardness }));
                                            else if (tool === 'brush') setBrushSettings(prev => ({ ...prev, hardness }));
                                        }}
                                    />

                                    {/* Curve Selector Row */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-theme-text-secondary w-14">Perfil</span>
                                        <select
                                            className="flex-grow h-6 text-[10px] bg-theme-bg-tertiary text-theme-text-primary rounded border border-theme-border-primary outline-none cursor-pointer px-1"
                                            value={
                                                tool === 'eraser' ? (eraserSettings.softnessCurve || 'linear') :
                                                    tool === 'advanced-marker' ? (advancedMarkerSettings.softnessCurve || 'linear') :
                                                        (_brushSettings.softnessCurve || 'linear')
                                            }
                                            onChange={(e) => {
                                                const curve = e.target.value as 'linear' | 'smooth' | 'bell';
                                                if (tool === 'eraser') setEraserSettings(prev => ({ ...prev, softnessCurve: curve }));
                                                else if (tool === 'advanced-marker') setAdvancedMarkerSettings(prev => ({ ...prev, softnessCurve: curve }));
                                                else if (tool === 'brush') setBrushSettings(prev => ({ ...prev, softnessCurve: curve }));
                                            }}
                                        >
                                            <option value="linear">Lineal</option>
                                            <option value="smooth">Suave</option>
                                            <option value="bell">Campana</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pb-1">
                                <label className={`text-[10px] ${strokeMode === 'freehand' ? 'text-theme-text-secondary' : 'text-theme-text-tertiary'}`}>
                                    Sensibilidad a Presión
                                </label>
                                <div className="relative inline-flex items-center cursor-pointer" onClick={() => strokeMode === 'freehand' && setPressureSensitivityEnabled(!isPressureSensitivityEnabled)}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isPressureSensitivityEnabled && strokeMode === 'freehand'}
                                        disabled={strokeMode !== 'freehand'}
                                        onChange={() => { }}
                                    />
                                    <div className={`w-9 h-5 bg-theme-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${strokeMode === 'freehand'
                                        ? (isPressureSensitivityEnabled ? 'peer-checked:bg-theme-accent-primary' : '')
                                        : 'opacity-50 cursor-not-allowed'
                                        }`}></div>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-theme-bg-tertiary opacity-50 my-3"></div>



                        {/* Guides */}
                        <section className="space-y-2">
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-1">Guías</label>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Mirror */}
                                <button
                                    onClick={() => setSymmetryEnabled(!isSymmetryEnabled)}
                                    className={`p-2 rounded border flex items-center justify-center gap-2 ${isSymmetryEnabled ? 'bg-theme-accent-primary/10 border-theme-accent-primary text-theme-accent-primary' : 'bg-theme-bg-primary border-theme-bg-tertiary text-theme-text-secondary hover:text-theme-text-primary'}`}
                                >
                                    <MirrorIcon className="w-4 h-4" />
                                    <span className="text-[10px]">Simetría</span>
                                </button>

                                {/* Orthogonal */}
                                <button
                                    onClick={() => setOrthogonalEnabled(!isOrthogonalEnabled)}
                                    className={`p-2 rounded border flex items-center justify-center gap-2 ${isOrthogonalEnabled ? 'bg-theme-accent-primary/10 border-theme-accent-primary text-theme-accent-primary' : 'bg-theme-bg-primary border-theme-bg-tertiary text-theme-text-secondary hover:text-theme-text-primary'}`}
                                >
                                    <OrthogonalIcon className="w-4 h-4" />
                                    <span className="text-[10px]">Ortogonal</span>
                                </button>
                            </div>

                            {/* Grid */}
                            <div className="flex items-center justify-between p-2 bg-theme-bg-primary rounded border border-theme-bg-tertiary">
                                <div className="flex items-center gap-2 text-[10px] text-theme-text-primary">
                                    <GridIcon className="w-4 h-4 text-theme-text-secondary" />
                                    <span>Cuadrícula</span>
                                </div>
                                <input type="checkbox" checked={isGridVisible} onChange={(e) => setGridVisible(e.target.checked)} className="cursor-pointer" />
                            </div>



                            {/* Perspective */}
                            <div className={`flex flex-col p-2 bg-theme-bg-primary rounded border border-theme-bg-tertiary transition-all ${isPerspectiveEnabled ? 'border-theme-accent-primary/30 bg-theme-accent-primary/5' : ''}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 text-[10px] text-theme-text-primary">
                                        <PerspectiveIcon className={`w-4 h-4 ${isPerspectiveEnabled ? 'text-theme-accent-primary' : 'text-theme-text-secondary'}`} />
                                        <span className={isPerspectiveEnabled ? 'font-bold text-theme-accent-primary' : ''}>Perspectiva</span>
                                    </div>
                                    <div className="flex items-center">
                                        <input type="checkbox" checked={isPerspectiveEnabled} onChange={(e) => setPerspectiveEnabled(e.target.checked)} className="cursor-pointer mr-2" />
                                        {isPerspectiveEnabled && onResetPerspective && (
                                            <button
                                                onClick={onResetPerspective}
                                                className="p-1 rounded hover:bg-theme-bg-tertiary text-theme-text-secondary hover:text-theme-text-primary transition-colors"
                                                title="Resetear Perspectiva (Esquinas)"
                                            >
                                                <RefreshCwIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Grid Toggle Sub-option */}
                                {isPerspectiveEnabled && togglePerspectiveGrid && (
                                    <div className="flex flex-col pl-6 mt-1 pt-1 border-t border-theme-bg-tertiary/50 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[9px] text-theme-text-secondary">Ver Cuadrícula</div>
                                            <div className="relative inline-flex items-center cursor-pointer" onClick={togglePerspectiveGrid}>
                                                <input type="checkbox" className="sr-only peer" checked={!!isPerspectiveGridVisible} readOnly />
                                                <div className="w-6 h-3 bg-theme-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-theme-accent-primary"></div>
                                            </div>
                                        </div>

                                        {/* Grid Settings */}
                                        {isPerspectiveGridVisible && (
                                            <div className="flex flex-col gap-1 pb-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    {/* Color Picker */}
                                                    <div className="flex items-center gap-1.5 bg-theme-bg-tertiary/30 rounded px-1.5 py-0.5 border border-theme-bg-tertiary/50">
                                                        <label className="text-[9px] text-theme-text-secondary">Color</label>
                                                        <input
                                                            type="color"
                                                            value={perspectiveGridColor?.startsWith('#') ? (perspectiveGridColor.length === 4 ? `#${perspectiveGridColor[1]}${perspectiveGridColor[1]}${perspectiveGridColor[2]}${perspectiveGridColor[2]}${perspectiveGridColor[3]}${perspectiveGridColor[3]}` : perspectiveGridColor) : '#c8c8c8'}
                                                            onChange={(e) => setPerspectiveGridColor && setPerspectiveGridColor(e.target.value)}
                                                            className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer rounded-sm overflow-hidden"
                                                        />
                                                    </div>

                                                    {/* Density Input */}
                                                    <div className="flex items-center gap-1.5 bg-theme-bg-tertiary/30 rounded px-1.5 py-0.5 border border-theme-bg-tertiary/50">
                                                        <label className="text-[9px] text-theme-text-secondary">Líneas</label>
                                                        <input
                                                            type="number"
                                                            min="12"
                                                            max="360"
                                                            step="12"
                                                            value={perspectiveGridDensity || 72}
                                                            onChange={(e) => setPerspectiveGridDensity && setPerspectiveGridDensity(Number(e.target.value))}
                                                            className="w-8 h-4 text-[9px] bg-transparent text-center focus:outline-none text-theme-text-primary"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Vertical Scope (Side) */}
                                                <div className="flex items-center gap-1.5 mt-1 bg-theme-bg-tertiary/30 rounded px-1.5 py-1 border border-theme-bg-tertiary/50">
                                                    <label className="text-[9px] text-theme-text-secondary w-8">Lado:</label>
                                                    <div className="flex flex-1 gap-px bg-theme-bg-tertiary rounded overflow-hidden">
                                                        {[
                                                            { id: 'above', label: 'Arriba' },
                                                            { id: 'both', label: 'Ambos' },
                                                            { id: 'below', label: 'Abajo' }
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => setPerspectiveGridVerticalScope && setPerspectiveGridVerticalScope(opt.id as any)}
                                                                className={`flex-1 py-0.5 text-[8px] transition-colors ${perspectiveGridVerticalScope === opt.id ? 'bg-theme-accent-primary text-white font-medium' : 'text-theme-text-secondary hover:bg-theme-bg-primary hover:text-theme-text-primary'}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Grid Length */}
                                                <div className="flex items-center gap-1.5 mt-1 bg-theme-bg-tertiary/30 rounded px-1.5 py-1 border border-theme-bg-tertiary/50">
                                                    <label className="text-[9px] text-theme-text-secondary w-8">Largo:</label>
                                                    <div className="flex flex-1 gap-px bg-theme-bg-tertiary rounded overflow-hidden">
                                                        {[
                                                            { id: 'full', label: 'Completo' },
                                                            { id: 'short', label: 'Corto' },
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => setPerspectiveGridLength && setPerspectiveGridLength(opt.id as any)}
                                                                className={`flex-1 py-0.5 text-[8px] transition-colors ${perspectiveGridLength === opt.id ? 'bg-theme-accent-primary text-white font-medium' : 'text-theme-text-secondary hover:bg-theme-bg-primary hover:text-theme-text-primary'}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="h-px bg-theme-bg-tertiary opacity-50"></div>

                        {/* Gestión */}
                        <section className="space-y-2">
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-1">Gestión</label>

                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={onImportBackground} className="flex items-center justify-center gap-2 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded hover:bg-theme-bg-hover text-theme-text-secondary text-[10px]">
                                    <UploadIcon className="w-3 h-3" /> Importar
                                </button>
                                <button onClick={onExportImage} className="flex items-center justify-center gap-2 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded hover:bg-theme-bg-hover text-theme-text-secondary text-[10px]">
                                    <DownloadIcon className="w-3 h-3" /> Exportar
                                </button>
                            </div>
                            <button onClick={onCropCanvas} className="w-full flex items-center justify-center gap-2 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded hover:bg-theme-bg-hover text-theme-text-secondary text-[10px] mt-1">
                                <CropIcon className="w-3 h-3" /> Recortar Lienzo
                            </button>
                            <button onClick={onOpenCanvasSizeModal} className="w-full flex items-center justify-center gap-2 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded hover:bg-theme-bg-hover text-theme-text-secondary text-[10px] mt-1">
                                <ExpandIcon className="w-3 h-3" /> Cambiar tamaño de lienzo
                            </button>

                            {/* Canvas Controls Moved from Right Sidebar */}
                            <div className="pt-2 border-t border-theme-bg-tertiary mt-2">
                                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-2">Lienzo</label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative w-8 h-8 rounded border border-theme-bg-tertiary overflow-hidden cursor-pointer" title="Color de Fondo">
                                        <input
                                            type="color"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => onUpdateBackground({ color: e.target.value })}
                                            value={backgroundColor || '#ffffff'}
                                        />
                                        <div className="w-full h-full" style={{ backgroundColor: backgroundColor || '#ffffff' }} />
                                    </div>
                                    <button
                                        onClick={onToggleBackgroundVisibility}
                                        className={`p-2 rounded border flex items-center justify-center transition-colors ${isBackgroundVisible ? 'bg-theme-accent-primary/10 border-theme-accent-primary text-theme-accent-primary' : 'bg-theme-bg-primary border-theme-bg-tertiary text-theme-text-secondary hover:text-theme-text-primary'}`}
                                        title={isBackgroundVisible ? 'Ocultar Fondo' : 'Mostrar Fondo'}
                                    >
                                        {isBackgroundVisible ? <EyeOpenIcon className="w-4 h-4" /> : <EyeClosedIcon className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={onOpenCanvasSizeModal}
                                        className="flex-1 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded text-[10px] text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary transition-colors"
                                    >
                                        Personalizado
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                );
            })()}

        </div >
    );
};
