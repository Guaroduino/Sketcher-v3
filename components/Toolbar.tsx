import React, { useState, useRef, useEffect } from 'react';
// FIX: Add TransformIcon and re-enable transform tool.
// FIX: Corrected import path for MagicWandIcon.
// FIX: Replaced MarkerIcon with SolidMarkerIcon and NaturalMarkerIcon
// FIX: Added WatercolorIcon to support the new watercolor tool.
import { SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, TransformIcon, ChevronDownIcon, TrashIcon, ExportIcon, CropIcon, RulerIcon, PerspectiveIcon, OrthogonalIcon, MirrorIcon, FreeTransformIcon, SparklesIcon, XIcon, FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon, SolidLineIcon, DashedLineIcon, DottedLineIcon, DashDotLineIcon, MarqueeRectIcon, LassoIcon, MagicWandIcon, UploadIcon, MoreVerticalIcon, TextIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, AdvancedMarkerIcon, WatercolorIcon, CubeIcon, SquareIcon, CircleIcon } from './icons';
// FIX: Replaced SolidMarkerSettings with SimpleMarkerSettings
// FIX: Added missing tool setting and BrushPreset types.
// FIX: Added WatercolorSettings to support the new watercolor tool.
import type { Tool, BrushSettings, EraserSettings, SimpleMarkerSettings, Guide, CropRect, BlendMode, CanvasItem, LibraryItem, StrokeMode, StrokeModifier, StrokeStyle, MagicWandSettings, TextSettings, NaturalMarkerSettings, AirbrushSettings, FXBrushSettings, BrushPreset, AdvancedMarkerSettings, WatercolorSettings } from '../types';

interface ToolbarProps {
    tool: Tool;
    setTool: (tool: Tool) => void;
    brushSettings: BrushSettings;
    setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
    eraserSettings: EraserSettings;
    setEraserSettings: React.Dispatch<React.SetStateAction<EraserSettings>>;
    // FIX: Replaced solidMarkerSettings with simpleMarkerSettings
    simpleMarkerSettings: SimpleMarkerSettings;
    setSimpleMarkerSettings: React.Dispatch<React.SetStateAction<SimpleMarkerSettings>>;
    // FIX: Added missing props for new tool settings
    naturalMarkerSettings: NaturalMarkerSettings;
    setNaturalMarkerSettings: React.Dispatch<React.SetStateAction<NaturalMarkerSettings>>;
    airbrushSettings: AirbrushSettings;
    setAirbrushSettings: React.Dispatch<React.SetStateAction<AirbrushSettings>>;
    fxBrushSettings: FXBrushSettings;
    setFxBrushSettings: React.Dispatch<React.SetStateAction<FXBrushSettings>>;
    advancedMarkerSettings: AdvancedMarkerSettings;
    setAdvancedMarkerSettings: React.Dispatch<React.SetStateAction<AdvancedMarkerSettings>>;
    // FIX: Added missing props for new tool settings for watercolor
    watercolorSettings: WatercolorSettings;
    setWatercolorSettings: React.Dispatch<React.SetStateAction<WatercolorSettings>>;
    magicWandSettings: MagicWandSettings;
    setMagicWandSettings: React.Dispatch<React.SetStateAction<MagicWandSettings>>;
    textSettings: TextSettings;
    setTextSettings: React.Dispatch<React.SetStateAction<TextSettings>>;
    activeGuide: Guide;
    setActiveGuide: (guide: 'ruler' | 'perspective' | 'mirror') => void;
    isOrthogonalVisible: boolean;
    onToggleOrthogonal: () => void;
    onExportClick: () => void;

    strokeMode: StrokeMode;
    setStrokeMode: (mode: StrokeMode) => void;
    strokeModifier: StrokeModifier;
    setStrokeModifier: React.Dispatch<React.SetStateAction<StrokeModifier>>;
    isSolidBox: boolean;
    setIsSolidBox: (value: boolean) => void;
    // FIX: Added missing preset-related props
    brushPresets: BrushPreset[];
    onSavePreset: (name: string) => void;
    onUpdatePreset: (id: string, updates: Partial<BrushPreset>) => void;
    onLoadPreset: (id: string) => void;
    onDeletePreset: (id: string) => void;
}



const Accordion: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-[--bg-tertiary]">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-2 text-xs font-bold uppercase text-[--text-secondary] hover:bg-[--bg-tertiary]">
                <span>{title}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};

const BlendModes: { name: string; value: BlendMode }[] = [
    { name: 'Normal', value: 'source-over' },
    { name: 'Multiply', value: 'multiply' },
    { name: 'Screen', value: 'screen' },
    { name: 'Overlay', value: 'overlay' },
    { name: 'Darken', value: 'darken' },
    { name: 'Lighten', value: 'lighten' },
    { name: 'Color Dodge', value: 'color-dodge' },
    { name: 'Color Burn', value: 'color-burn' },
    { name: 'Hard Light', value: 'hard-light' },
    { name: 'Soft Light', value: 'soft-light' },
    { name: 'Difference', value: 'difference' },
    { name: 'Exclusion', value: 'exclusion' },
    { name: 'Hue', value: 'hue' },
    { name: 'Saturation', value: 'saturation' },
    { name: 'Color', value: 'color' },
    { name: 'Luminosity', value: 'luminosity' },
];

const FontFamilies = ['Arial', 'Verdana', 'Georgia', 'Courier New', 'Lucida Console', 'Impact', 'Comic Sans MS'];

const selectionToolsGroup: { tool: Tool; name: string; icon: React.FC<{ className?: string }> }[] = [
    { tool: 'marquee-rect', name: 'Marco Rectangular', icon: MarqueeRectIcon },
    { tool: 'lasso', name: 'Lazo', icon: LassoIcon },
    { tool: 'magic-wand', name: 'Varita Mágica', icon: MagicWandIcon },
];

// FIX: Added 'watercolor' to the drawing tools group.
const drawingToolsGroup: { tool: Tool; name: string; icon: React.FC<{ className?: string }> }[] = [
    { tool: 'brush', name: 'Rapidograph Solido', icon: BrushIcon },
    // Renamed "Marcador Sólido" -> "Marcador"
    { tool: 'simple-marker', name: 'Marcador', icon: SolidMarkerIcon },
    { tool: 'advanced-marker', name: 'Lápiz de color', icon: AdvancedMarkerIcon },
    { tool: 'natural-marker', name: 'Marcador sólido', icon: NaturalMarkerIcon },
    { tool: 'airbrush', name: 'Aerógrafo', icon: AirbrushIcon },
    { tool: 'fx-brush', name: 'Pincel de Efectos', icon: FXBrushIcon },
    { tool: 'watercolor', name: 'Acuarela', icon: WatercolorIcon },
];

// FIX: Added 'watercolor' to the tool icon map to satisfy the Record type.
const toolIconMap: Record<Tool, React.FC<{ className?: string }>> = {
    'select': SelectIcon,
    'marquee-rect': MarqueeRectIcon,
    'lasso': LassoIcon,
    'magic-wand': MagicWandIcon,
    'brush': BrushIcon,
    'eraser': EraserIcon,
    'simple-marker': SolidMarkerIcon,
    'transform': TransformIcon,
    'free-transform': FreeTransformIcon,
    'advanced-marker': AdvancedMarkerIcon,
    'watercolor': WatercolorIcon,
    'natural-marker': NaturalMarkerIcon,
    'airbrush': AirbrushIcon,
    'fx-brush': FXBrushIcon,
    'text': TextIcon,
    'crop': CropIcon,
    'enhance': SparklesIcon,
    'pan': SelectIcon, // Using SelectIcon as placeholder for Pan
    'debug-brush': BrushIcon, // Using BrushIcon as placeholder for Debug Brush
};


export const Toolbar: React.FC<ToolbarProps> = ({
    tool,
    setTool,
    brushSettings,
    setBrushSettings,
    eraserSettings,
    setEraserSettings,
    simpleMarkerSettings,
    setSimpleMarkerSettings,
    naturalMarkerSettings,
    setNaturalMarkerSettings,
    airbrushSettings,
    setAirbrushSettings,
    fxBrushSettings,
    setFxBrushSettings,
    advancedMarkerSettings,
    setAdvancedMarkerSettings,
    watercolorSettings,
    setWatercolorSettings,
    magicWandSettings,
    setMagicWandSettings,
    textSettings,
    setTextSettings,
    activeGuide,
    setActiveGuide,
    isOrthogonalVisible,
    onToggleOrthogonal,
    onExportClick,
    objects,
    libraryItems,
    backgroundDataUrl,
    debugInfo,
    strokeMode,
    setStrokeMode,
    strokeModifier,
    setStrokeModifier,
    isSolidBox,
    setIsSolidBox,
    brushPresets,
    ...props
}) => {

    const [openSettings, setOpenSettings] = useState<Tool | null>(null);
    const [settingsPanelAnchor, setSettingsPanelAnchor] = useState<HTMLElement | null>(null);
    const [settingsPanelPosition, setSettingsPanelPosition] = useState<{ top: number; left: number } | null>(null);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const toolbarWrapperRef = useRef<HTMLDivElement>(null);
    const [isChromaKeyEnabled, setIsChromaKeyEnabled] = useState(false);
    const [isStrokeModeMenuOpen, setIsStrokeModeMenuOpen] = useState(false);
    const strokeModeMenuRef = useRef<HTMLDivElement>(null);
    const strokeModeDropdownRef = useRef<HTMLDivElement>(null);
    const [isStrokeModifierMenuOpen, setIsStrokeModifierMenuOpen] = useState(false);
    const strokeModifierMenuRef = useRef<HTMLDivElement>(null);
    const strokeModifierDropdownRef = useRef<HTMLDivElement>(null);

    // Tool Group States
    const [isSelectionToolsMenuOpen, setIsSelectionToolsMenuOpen] = useState(false);
    const selectionToolsMenuRef = useRef<HTMLDivElement>(null);
    const selectionToolsDropdownRef = useRef<HTMLDivElement>(null);
    const [isDrawingToolsMenuOpen, setIsDrawingToolsMenuOpen] = useState(false);
    const drawingToolsMenuRef = useRef<HTMLDivElement>(null);
    const drawingToolsDropdownRef = useRef<HTMLDivElement>(null);
    const [lastActiveSelectionTool, setLastActiveSelectionTool] = useState<Tool>('marquee-rect');
    const [lastActiveDrawingTool, setLastActiveDrawingTool] = useState<Tool>('brush');



    // Effect to close popovers when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (strokeModeMenuRef.current && !strokeModeMenuRef.current.contains(target) &&
                strokeModeDropdownRef.current && !strokeModeDropdownRef.current.contains(target)) {
                setIsStrokeModeMenuOpen(false);
            }
            if (strokeModifierMenuRef.current && !strokeModifierMenuRef.current.contains(target) &&
                strokeModifierDropdownRef.current && !strokeModifierDropdownRef.current.contains(target)) {
                setIsStrokeModifierMenuOpen(false);
            }
            if (selectionToolsMenuRef.current && !selectionToolsMenuRef.current.contains(target) &&
                selectionToolsDropdownRef.current && !selectionToolsDropdownRef.current.contains(target)) {
                setIsSelectionToolsMenuOpen(false);
            }
            if (drawingToolsMenuRef.current && !drawingToolsMenuRef.current.contains(target) &&
                drawingToolsDropdownRef.current && !drawingToolsDropdownRef.current.contains(target)) {
                setIsDrawingToolsMenuOpen(false);
            }
            if (
                openSettings !== 'enhance' && // This effect is only for popovers now
                settingsPanelRef.current &&
                !settingsPanelRef.current.contains(target) &&
                settingsPanelAnchor &&
                !settingsPanelAnchor.contains(target)
            ) {
                setOpenSettings(null);
                setSettingsPanelAnchor(null);
                setSettingsPanelPosition(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [settingsPanelAnchor, openSettings]);



    // Track last active tool in each group
    useEffect(() => {
        if (selectionToolsGroup.some(t => t.tool === tool)) {
            setLastActiveSelectionTool(tool);
        } else if (drawingToolsGroup.some(t => t.tool === tool)) {
            setLastActiveDrawingTool(tool);
        }
    }, [tool]);


    const handleToolClick = (t: Tool) => {
        if (tool !== t) {
            setOpenSettings(null);
            setSettingsPanelAnchor(null);
            setSettingsPanelPosition(null);
        }
        setTool(t);
    };

    const handleToolDoubleClick = (t: Tool, e: React.MouseEvent) => {
        setOpenSettings(prev => {
            const currentTarget = e.currentTarget as HTMLElement;
            if (prev === t && settingsPanelAnchor === currentTarget) {
                setSettingsPanelAnchor(null);
                setSettingsPanelPosition(null);
                return null;
            } else {
                setSettingsPanelAnchor(currentTarget);
                setSettingsPanelPosition(null);
                setIsStrokeModeMenuOpen(false);
                setIsStrokeModifierMenuOpen(false);
                setIsSelectionToolsMenuOpen(false);
                setIsDrawingToolsMenuOpen(false);
                return t;
            }
        });
    };

    const handleSettingsClick = (e: React.MouseEvent, t: Tool) => {
        e.stopPropagation();

        const currentTarget = e.currentTarget as HTMLElement;
        const anchorRect = currentTarget.getBoundingClientRect();
        const wrapperRect = toolbarWrapperRef.current!.getBoundingClientRect();

        // Close all dropdowns
        setIsSelectionToolsMenuOpen(false);
        setIsDrawingToolsMenuOpen(false);
        setIsStrokeModeMenuOpen(false);
        setIsStrokeModifierMenuOpen(false);

        // Open settings panel, but first save its target position
        setSettingsPanelPosition({
            left: anchorRect.right - wrapperRect.left + 8,
            top: anchorRect.top - wrapperRect.top,
        });
        setSettingsPanelAnchor(currentTarget); // Still set anchor for identity/outside click
        setOpenSettings(t);
    };


    const toolButtonClasses = (t: Tool) =>
        `p-3 rounded-lg transition-colors ${tool === t ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'
        }`;





    const BlendModeSelector: React.FC<{
        value: BlendMode;
        onChange: (value: BlendMode) => void;
    }> = ({ value, onChange }) => (
        <div>
            <label className="text-xs text-[--text-secondary] block mb-1">Modo de Fusión</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as BlendMode)}
                className="w-full bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2"
            >
                {BlendModes.map(mode => <option key={mode.value} value={mode.value}>{mode.name}</option>)}
            </select>
        </div>
    );


    const renderSettings = (toolToShow: Tool) => {
        switch (toolToShow) {
            case 'select':
            case 'transform':
            case 'free-transform':
            case 'marquee-rect':
            case 'lasso':
                return null;
            case 'text':
                // ... (rest of text case)
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Herramienta de Texto</h4>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Fuente</label>
                            <select
                                value={textSettings.fontFamily}
                                onChange={(e) => setTextSettings(s => ({ ...s, fontFamily: e.target.value }))}
                                className="w-full bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2"
                            >
                                {FontFamilies.map(font => <option key={font} value={font}>{font}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {textSettings.fontSize}px</label>
                            <input type="range" min="8" max="256" value={textSettings.fontSize} onChange={(e) => setTextSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))} className="w-full" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                            <input type="color" value={textSettings.color} onChange={(e) => setTextSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Alineación</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setTextSettings(s => ({ ...s, textAlign: 'left' }))} className={`text-xs p-2 rounded ${textSettings.textAlign === 'left' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Izquierda</button>
                                <button onClick={() => setTextSettings(s => ({ ...s, textAlign: 'center' }))} className={`text-xs p-2 rounded ${textSettings.textAlign === 'center' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Centro</button>
                                <button onClick={() => setTextSettings(s => ({ ...s, textAlign: 'right' }))} className={`text-xs p-2 rounded ${textSettings.textAlign === 'right' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Derecha</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Estilo</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setTextSettings(s => ({ ...s, fontWeight: 'normal' }))} className={`text-xs p-2 rounded ${textSettings.fontWeight === 'normal' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Normal</button>
                                <button onClick={() => setTextSettings(s => ({ ...s, fontWeight: 'bold' }))} className={`text-xs p-2 rounded ${textSettings.fontWeight === 'bold' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Negrita</button>
                                <button onClick={() => setTextSettings(s => ({ ...s, fontWeight: 'italic' }))} className={`text-xs p-2 rounded ${textSettings.fontWeight === 'italic' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Cursiva</button>
                            </div>
                        </div>
                    </div>
                );
            case 'magic-wand':
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Varita Mágica</h4>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Tolerancia: {magicWandSettings.tolerance}</label>
                            <input type="range" min="0" max="100" value={magicWandSettings.tolerance} onChange={(e) => setMagicWandSettings(s => ({ ...s, tolerance: parseInt(e.target.value) }))} className="w-full" />
                        </div>
                        <div className="flex items-center justify-between py-1">
                            <label htmlFor="contiguous-toggle" className="text-xs text-[--text-secondary]">
                                Contiguo (solo píxeles adyacentes)
                            </label>
                            <button
                                id="contiguous-toggle"
                                role="switch"
                                aria-checked={magicWandSettings.contiguous}
                                onClick={() => setMagicWandSettings(s => ({ ...s, contiguous: !s.contiguous }))}
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${magicWandSettings.contiguous ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                                    }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${magicWandSettings.contiguous ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                );

            case 'brush':
                return (
                    <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Rapidograph Solido</h4>
                        </div>
                        <Accordion title="General" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {brushSettings.size}px</label>
                                <input type="range" min="1" max="200" value={brushSettings.size} onChange={(e) => setBrushSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div className="pt-2">
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 3, 5, 10, 20, 40].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setBrushSettings(s => ({ ...s, size }))}
                                            className={`text-xs p-2 rounded ${brushSettings.size === size ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}
                                        >
                                            {size}px
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Color de Trazo</label>
                                <input type="color" value={brushSettings.color} onChange={(e) => setBrushSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Relleno</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex rounded-md bg-[--bg-tertiary] p-1 gap-1">
                                        <button
                                            onClick={() => setBrushSettings(s => ({ ...s, fillColor: 'transparent' }))}
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${brushSettings.fillColor === 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Solo Trazo
                                        </button>
                                        <button
                                            onClick={() => setBrushSettings(s => ({ ...s, fillColor: s.color }))} // Set to current stroke color initially if enabling
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${brushSettings.fillColor !== 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Relleno
                                        </button>
                                    </div>
                                    {brushSettings.fillColor !== 'transparent' && (
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={brushSettings.fillColor} onChange={(e) => setBrushSettings(s => ({ ...s, fillColor: e.target.value }))} className="flex-grow h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Accordion >
                        <Accordion title="Dinámica de Presión">
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-size-brush" className="text-xs text-[--text-secondary]">Controlar Tamaño</label>
                                <input id="pressure-size-brush" type="checkbox" checked={brushSettings.pressureControl.size} onChange={(e) => setBrushSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, size: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                        </Accordion>
                    </div >
                );
            case 'simple-marker':
                return (
                    <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Marcador Sólido</h4>
                        </div>
                        <Accordion title="General" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {simpleMarkerSettings.size}px</label>
                                <input type="range" min="1" max="200" value={simpleMarkerSettings.size} onChange={(e) => setSimpleMarkerSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Opacidad: {Math.round(simpleMarkerSettings.opacity * 100)}%</label>
                                <input type="range" min="1" max="100" value={simpleMarkerSettings.opacity * 100} onChange={(e) => setSimpleMarkerSettings(s => ({ ...s, opacity: parseInt(e.target.value) / 100 }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                                <input type="color" value={simpleMarkerSettings.color} onChange={(e) => setSimpleMarkerSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Relleno</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex rounded-md bg-[--bg-tertiary] p-1 gap-1">
                                        <button
                                            onClick={() => setSimpleMarkerSettings(s => ({ ...s, fillColor: 'transparent' }))}
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${simpleMarkerSettings.fillColor === 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Solo Trazo
                                        </button>
                                        <button
                                            onClick={() => setSimpleMarkerSettings(s => ({ ...s, fillColor: s.color }))}
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${simpleMarkerSettings.fillColor !== 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Relleno
                                        </button>
                                    </div>
                                    {simpleMarkerSettings.fillColor !== 'transparent' && (
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={simpleMarkerSettings.fillColor} onChange={(e) => setSimpleMarkerSettings(s => ({ ...s, fillColor: e.target.value }))} className="flex-grow h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <BlendModeSelector
                                value={simpleMarkerSettings.blendMode}
                                onChange={(value) => setSimpleMarkerSettings(s => ({ ...s, blendMode: value }))}
                            />
                        </Accordion >
                        <Accordion title="Punta">
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Forma de la punta</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSimpleMarkerSettings(s => ({ ...s, tipShape: 'square' }))} className={`flex-1 text-xs p-2 rounded ${simpleMarkerSettings.tipShape === 'square' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Cuadrada</button>
                                    <button onClick={() => setSimpleMarkerSettings(s => ({ ...s, tipShape: 'line' }))} className={`flex-1 text-xs p-2 rounded ${simpleMarkerSettings.tipShape === 'line' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Línea</button>
                                </div>
                            </div>
                        </Accordion>
                        <Accordion title="Dinámica de Presión">
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-opacity-marker" className="text-xs text-[--text-secondary]">Controlar Opacidad</label>
                                <input id="pressure-opacity-marker" type="checkbox" checked={simpleMarkerSettings.pressureControl.opacity} onChange={(e) => setSimpleMarkerSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, opacity: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                        </Accordion>
                    </div >
                );
            case 'advanced-marker':
                return (
                    <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Marcador Avanzado</h4>
                        </div>
                        <Accordion title="General" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {advancedMarkerSettings.size}px</label>
                                <input type="range" min="1" max="300" value={advancedMarkerSettings.size} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Flujo: {advancedMarkerSettings.flow}%</label>
                                <input type="range" min="1" max="100" value={advancedMarkerSettings.flow} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, flow: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                                <input type="color" value={advancedMarkerSettings.color} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Relleno</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex rounded-md bg-[--bg-tertiary] p-1 gap-1">
                                        <button
                                            onClick={() => setAdvancedMarkerSettings(s => ({ ...s, fillColor: 'transparent' }))}
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${advancedMarkerSettings.fillColor === 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Solo Trazo
                                        </button>
                                        <button
                                            onClick={() => setAdvancedMarkerSettings(s => ({ ...s, fillColor: s.color }))}
                                            className={`flex-1 text-xs py-1 px-2 rounded-sm ${advancedMarkerSettings.fillColor !== 'transparent' ? 'bg-[--bg-primary] shadow text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                                        >
                                            Relleno
                                        </button>
                                    </div>
                                    {advancedMarkerSettings.fillColor !== 'transparent' && (
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={advancedMarkerSettings.fillColor} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, fillColor: e.target.value }))} className="flex-grow h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <BlendModeSelector
                                value={advancedMarkerSettings.blendMode}
                                onChange={(value) => setAdvancedMarkerSettings(s => ({ ...s, blendMode: value }))}
                            />
                        </Accordion >
                        <Accordion title="Punta">
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Dureza: {advancedMarkerSettings.hardness}%</label>
                                <input type="range" min="0" max="100" value={advancedMarkerSettings.hardness} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, hardness: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Espaciado: {advancedMarkerSettings.spacing}%</label>
                                <input type="range" min="1" max="100" value={advancedMarkerSettings.spacing} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, spacing: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                        </Accordion>
                        <Accordion title="Dinámica de Presión">
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-size-adv" className="text-xs text-[--text-secondary]">Controlar Tamaño</label>
                                <input id="pressure-size-adv" type="checkbox" checked={advancedMarkerSettings.pressureControl.size} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, size: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-flow-adv" className="text-xs text-[--text-secondary]">Controlar Flujo</label>
                                <input id="pressure-flow-adv" type="checkbox" checked={advancedMarkerSettings.pressureControl.flow} onChange={(e) => setAdvancedMarkerSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, flow: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                        </Accordion>
                    </div >
                );
            // FIX: Added settings panel for watercolor tool.
            case 'watercolor':
                return (
                    <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Acuarela</h4>
                        </div>
                        <Accordion title="General" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {watercolorSettings.size}px</label>
                                <input type="range" min="1" max="300" value={watercolorSettings.size} onChange={(e) => setWatercolorSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Flujo (Densidad): {watercolorSettings.flow}%</label>
                                <input type="range" min="1" max="100" value={watercolorSettings.flow} onChange={(e) => setWatercolorSettings(s => ({ ...s, flow: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Humedad (Opacidad): {watercolorSettings.wetness}%</label>
                                <input type="range" min="1" max="100" value={watercolorSettings.wetness} onChange={(e) => setWatercolorSettings(s => ({ ...s, wetness: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                                <input type="color" value={watercolorSettings.color} onChange={(e) => setWatercolorSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                            </div>
                        </Accordion>
                        <Accordion title="Dinámica de Presión">
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-size-wc" className="text-xs text-[--text-secondary]">Controlar Tamaño</label>
                                <input id="pressure-size-wc" type="checkbox" checked={watercolorSettings.pressureControl.size} onChange={(e) => setWatercolorSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, size: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-flow-wc" className="text-xs text-[--text-secondary]">Controlar Flujo</label>
                                <input id="pressure-flow-wc" type="checkbox" checked={watercolorSettings.pressureControl.flow} onChange={(e) => setWatercolorSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, flow: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                        </Accordion>
                    </div>
                );
            case 'natural-marker':
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Marcador Natural</h4>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {naturalMarkerSettings.size}px</label>
                            <input type="range" min="1" max="200" value={naturalMarkerSettings.size} onChange={(e) => setNaturalMarkerSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Opacidad: {Math.round(naturalMarkerSettings.opacity * 100)}%</label>
                            <input type="range" min="1" max="100" value={naturalMarkerSettings.opacity * 100} onChange={(e) => setNaturalMarkerSettings(s => ({ ...s, opacity: parseInt(e.target.value) / 100 }))} className="w-full" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                            <input type="color" value={naturalMarkerSettings.color} onChange={(e) => setNaturalMarkerSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                        </div>
                    </div>
                );
            case 'airbrush':
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Aerógrafo</h4>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {airbrushSettings.size}px</label>
                            <input type="range" min="1" max="500" value={airbrushSettings.size} onChange={(e) => setAirbrushSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Flujo: {Math.round(airbrushSettings.flow * 100)}%</label>
                            <input type="range" min="1" max="100" value={airbrushSettings.flow * 100} onChange={(e) => setAirbrushSettings(s => ({ ...s, flow: parseInt(e.target.value) / 100 }))} className="w-full" />
                        </div>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                            <input type="color" value={airbrushSettings.color} onChange={(e) => setAirbrushSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                        </div>
                    </div>
                );
            case 'fx-brush':
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Pincel de Efectos</h4>
                        <div>
                            <label className="text-xs text-[--text-secondary] block mb-1">Preset</label>
                            <select
                                value={fxBrushSettings.presetId || ''}
                                onChange={(e) => setFxBrushSettings(s => ({ ...s, presetId: e.target.value || null }))}
                                className="w-full bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2"
                            >
                                <option value="">Ninguno</option>
                                {brushPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                );
            case 'eraser':
                return (
                    <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Goma de Borrar</h4>
                        </div>
                        <Accordion title="General" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {eraserSettings.size}px</label>
                                <input type="range" min="1" max="500" value={eraserSettings.size} onChange={(e) => setEraserSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Opacidad: {Math.round(eraserSettings.opacity * 100)}%</label>
                                <input type="range" min="1" max="100" value={eraserSettings.opacity * 100} onChange={(e) => setEraserSettings(s => ({ ...s, opacity: parseInt(e.target.value) / 100 }))} className="w-full" />
                            </div>
                        </Accordion>
                        <Accordion title="Punta" defaultOpen>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Dureza: {eraserSettings.hardness}%</label>
                                <input type="range" min="0" max="100" value={eraserSettings.hardness} onChange={(e) => setEraserSettings(s => ({ ...s, hardness: parseInt(e.target.value) }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-xs text-[--text-secondary] block mb-1">Forma</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setEraserSettings(s => ({ ...s, tipShape: 'round' }))} className={`text-xs p-2 rounded ${eraserSettings.tipShape === 'round' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Redonda</button>
                                    <button onClick={() => setEraserSettings(s => ({ ...s, tipShape: 'square' }))} className={`text-xs p-2 rounded ${eraserSettings.tipShape === 'square' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Cuadrada</button>
                                </div>
                            </div>
                        </Accordion>
                    </div>
                );
            default:
                return null;
        }
    };

    const ActiveStrokeIcon = {
        freehand: FreehandIcon,
        line: LineIcon,
        polyline: PolylineIcon,
        curve: BezierIcon,
        arc: ArcIcon,
        parallelepiped: CubeIcon,
        rectangle: SquareIcon,
        circle: CircleIcon,
        'rotated-rectangle': TransformIcon,
    }[strokeMode];

    const strokeModesList: { mode: StrokeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
        { mode: 'freehand', label: 'A mano alzada', icon: FreehandIcon },
        { mode: 'line', label: 'Línea (2 Puntos)', icon: LineIcon },
        { mode: 'polyline', label: 'Polilínea', icon: PolylineIcon },
        { mode: 'curve', label: 'Curva (3 Puntos)', icon: BezierIcon },
        { mode: 'arc', label: 'Arco (Centro)', icon: ArcIcon },
        { mode: 'parallelepiped', label: 'Cubo 3D (Perspectiva)', icon: CubeIcon },
        { mode: 'rectangle', label: 'Rectángulo', icon: SquareIcon },
        { mode: 'circle', label: 'Círculo', icon: CircleIcon },
        { mode: 'rotated-rectangle', label: 'Rectángulo (3 Puntos)', icon: TransformIcon },
    ];

    const ActiveStrokeStyleIcon = {
        solid: SolidLineIcon,
        dashed: DashedLineIcon,
        dotted: DottedLineIcon,
        'dash-dot': DashDotLineIcon,
    }[strokeModifier.style];

    const strokeModifierList: { style: StrokeStyle; label: string; icon: React.FC<{ className?: string }> }[] = [
        { style: 'solid', label: 'Sólido', icon: SolidLineIcon },
        { style: 'dashed', label: 'Segmentado', icon: DashedLineIcon },
        { style: 'dotted', label: 'Punteado', icon: DottedLineIcon },
        { style: 'dash-dot', label: 'Línea y punto', icon: DashDotLineIcon },
    ];

    // FIX: Added 'watercolor' to the list of paint tools.
    const isPaintTool = ['brush', 'simple-marker', 'eraser', 'natural-marker', 'advanced-marker', 'airbrush', 'fx-brush', 'watercolor'].includes(tool);
    const strokeModeButtonClasses = `p-3 rounded-lg transition-colors ${isPaintTool ? 'bg-[--accent-primary] text-white hover:bg-[--accent-hover]' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`;
    const isStrokeModifierActive = strokeModifier.style !== 'solid';
    const strokeModifierButtonClasses = `p-3 rounded-lg transition-colors ${isStrokeModifierActive ? 'bg-[--accent-primary] text-white hover:bg-[--accent-hover]' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`;

    // Grouped Tools Logic
    const selectionToolTools: Tool[] = ['marquee-rect', 'lasso', 'magic-wand'];
    // FIX: Added 'watercolor' to the list of drawing tools.
    const drawingToolTools: Tool[] = ['brush', 'simple-marker', 'natural-marker', 'advanced-marker', 'airbrush', 'fx-brush', 'watercolor'];
    const isSelectionGroupActive = selectionToolTools.includes(tool);
    const isDrawingGroupActive = drawingToolTools.includes(tool);
    const ActiveSelectionIcon = toolIconMap[isSelectionGroupActive ? tool : lastActiveSelectionTool];
    const ActiveDrawingIcon = toolIconMap[isDrawingGroupActive ? tool : lastActiveDrawingTool];

    const getSettingsPanelStyle = (): React.CSSProperties => {
        if (!openSettings) {
            return { display: 'none' };
        }

        if (settingsPanelPosition) {
            return {
                position: 'fixed',
                left: `${settingsPanelPosition.left}px`,
                top: `${settingsPanelPosition.top}px`,
                maxHeight: `calc(100vh - ${settingsPanelPosition.top + 16}px)`,
            };
        }

        if (!settingsPanelAnchor) {
            return { display: 'none' };
        }
        const anchorRect = settingsPanelAnchor.getBoundingClientRect();

        return {
            position: 'fixed',
            left: `${anchorRect.right + 8}px`,
            top: `${anchorRect.top}px`,
            maxHeight: `calc(100vh - ${anchorRect.top}px - 16px)`,
        };
    };

    const getMenuPositionStyle = (anchorEl: HTMLElement | null): React.CSSProperties => {
        if (!anchorEl) return { display: 'none' };
        const rect = anchorEl.getBoundingClientRect();
        return {
            position: 'fixed',
            left: `${rect.right + 8}px`,
            top: `${rect.top}px`,
            maxHeight: `calc(100vh - ${rect.top}px - 16px)`,
            overflowY: 'auto',
            zIndex: 50
        };
    };


    return (
        <aside ref={toolbarWrapperRef} className="relative flex-shrink-0 h-full">
            <div className="bg-[--bg-primary] text-[--text-primary] h-full flex flex-col p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[--bg-tertiary] scrollbar-track-transparent">
                {/* Main Tools */}
                <div className="flex flex-col items-center space-y-2">
                    <button onClick={() => handleToolClick('select')} className={toolButtonClasses('select')} title="Seleccionar">
                        <SelectIcon className="w-6 h-6" />
                    </button>

                    <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />

                    {/* Selection Tools Group */}
                    <div className="relative" ref={selectionToolsMenuRef}>
                        <button
                            onClick={() => {
                                setIsDrawingToolsMenuOpen(false);
                                setIsStrokeModeMenuOpen(false);
                                setIsStrokeModifierMenuOpen(false);
                                setIsSelectionToolsMenuOpen(prev => !prev);
                            }}
                            onDoubleClick={(e) => handleToolDoubleClick(isSelectionGroupActive ? tool : lastActiveSelectionTool, e)}
                            className={`p-3 rounded-lg transition-colors ${isSelectionGroupActive ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`}
                            title="Herramientas de Selección (doble clic para opciones)"
                        >
                            <ActiveSelectionIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="relative" ref={strokeModeMenuRef}>
                        <button
                            onClick={() => {
                                setIsStrokeModifierMenuOpen(false);
                                setIsSelectionToolsMenuOpen(false);
                                setIsDrawingToolsMenuOpen(false);
                                setIsStrokeModeMenuOpen(prev => !prev);
                            }}
                            className={strokeModeButtonClasses}
                            title={`Modo de Trazo: ${strokeMode} (clic para cambiar)`}
                        >
                            <ActiveStrokeIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="relative" ref={strokeModifierMenuRef}>
                        <button
                            onClick={() => {
                                setIsStrokeModeMenuOpen(false);
                                setIsSelectionToolsMenuOpen(false);
                                setIsDrawingToolsMenuOpen(false);
                                setIsStrokeModifierMenuOpen(prev => !prev);
                            }}
                            className={strokeModifierButtonClasses}
                            title={`Estilo de Trazo: ${strokeModifier.style} (clic para cambiar)`}
                        >
                            <ActiveStrokeStyleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />

                    {/* Drawing Tools Group */}
                    <div className="relative" ref={drawingToolsMenuRef}>
                        <button
                            onClick={() => {
                                setIsSelectionToolsMenuOpen(false);
                                setIsStrokeModeMenuOpen(false);
                                setIsStrokeModifierMenuOpen(false);
                                setIsDrawingToolsMenuOpen(prev => !prev);
                            }}
                            onDoubleClick={(e) => handleToolDoubleClick(isDrawingGroupActive ? tool : lastActiveDrawingTool, e)}
                            className={`p-3 rounded-lg transition-colors ${isDrawingGroupActive ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`}
                            title="Herramientas de Dibujo (doble clic para opciones)"
                        >
                            <ActiveDrawingIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <button onClick={() => handleToolClick('eraser')} onDoubleClick={(e) => handleToolDoubleClick('eraser', e)} className={toolButtonClasses('eraser')} title="Goma de Borrar (doble clic para opciones)">
                        <EraserIcon className="w-6 h-6" />
                    </button>

                    <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />

                    <button onClick={() => handleToolClick('text')} onDoubleClick={(e) => handleToolDoubleClick('text', e)} className={toolButtonClasses('text')} title="Texto (doble clic para opciones)">
                        <TextIcon className="w-6 h-6" />
                    </button>

                </div>

                <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />

                {/* Guide Tools */}
                <div className="flex flex-col items-center space-y-2">
                    <button onClick={() => setActiveGuide('ruler')} className={`p-3 rounded-lg transition-colors ${activeGuide === 'ruler' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Regla">
                        <RulerIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => setActiveGuide('perspective')} className={`p-3 rounded-lg transition-colors ${activeGuide === 'perspective' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Perspectiva">
                        <PerspectiveIcon className="w-6 h-6" />
                    </button>
                    <button onClick={onToggleOrthogonal} className={`p-3 rounded-lg transition-colors ${isOrthogonalVisible ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía Ortogonal">
                        <OrthogonalIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => setActiveGuide('mirror')} className={`p-3 rounded-lg transition-colors ${activeGuide === 'mirror' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Espejo">
                        <MirrorIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Editing Tools */}
                <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />
                <div className="flex flex-col items-center space-y-2">
                    <button onClick={() => handleToolClick('transform')} className={toolButtonClasses('transform')} title="Transformar (Escalar/Rotar)">
                        <TransformIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => handleToolClick('free-transform')} className={toolButtonClasses('free-transform')} title="Transformación Libre (Distorsionar)">
                        <FreeTransformIcon className="w-6 h-6" />
                    </button>
                </div>


                {/* Other Tools */}
                <div className="mt-auto flex flex-col items-center space-y-2">
                    <button onClick={() => handleToolClick('crop')} className={toolButtonClasses('crop')} title="Recortar">
                        <CropIcon className="w-6 h-6" />
                    </button>
                    <button onClick={onExportClick} className="p-3 rounded-lg bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]" title="Exportar Imagen">
                        <ExportIcon className="w-6 h-6" />
                    </button>
                </div>
            </div >

            {/* Group Menus - Moved outside scrolling container for overflow-visible compliance */}
            {
                isSelectionToolsMenuOpen && (
                    <div
                        ref={selectionToolsDropdownRef}
                        className="fixed z-50 p-2 space-y-1 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-xl w-60"
                        style={getMenuPositionStyle(selectionToolsMenuRef.current)}
                    >
                        {selectionToolsGroup.map(({ tool: t, name, icon: Icon }) => (
                            <div key={t} className={`flex items-center justify-between rounded-md text-sm ${tool === t ? 'bg-[--accent-primary] text-white' : 'hover:bg-[--bg-tertiary]'}`}>
                                <button onClick={() => { handleToolClick(t); setIsSelectionToolsMenuOpen(false); }} className="flex items-center gap-3 p-2 flex-grow text-left">
                                    <Icon className="w-5 h-5" />
                                    <span>{name}</span>
                                </button>
                                <button onClick={(e) => { handleSettingsClick(e, t); }} className="p-2 mr-1 rounded-full hover:bg-black/10 flex-shrink-0" title="Configuración de la herramienta">
                                    <MoreVerticalIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )
            }

            {
                isStrokeModeMenuOpen && (
                    <div
                        ref={strokeModeDropdownRef}
                        className="fixed z-50 p-2 space-y-1 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-xl w-60"
                        style={getMenuPositionStyle(strokeModeMenuRef.current)}
                    >
                        <h4 className="px-2 pb-1 text-sm font-bold uppercase text-[--text-secondary]">Modos de Trazo</h4>
                        {strokeModesList.map(({ mode, label, icon: Icon }) => (
                            <button
                                key={mode}
                                onClick={() => {
                                    setStrokeMode(mode);
                                    setIsStrokeModeMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 p-2 rounded-md text-sm ${strokeMode === mode ? 'bg-[--accent-primary] text-white' : 'hover:bg-[--bg-tertiary]'}`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                )
            }

            {
                isStrokeModifierMenuOpen && (
                    <div
                        ref={strokeModifierDropdownRef}
                        className="fixed z-50 p-2 space-y-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-xl w-60"
                        style={getMenuPositionStyle(strokeModifierMenuRef.current)}
                    >
                        <h4 className="px-2 pb-1 text-sm font-bold uppercase text-[--text-secondary]">Estilo de Trazo</h4>
                        <div className="space-y-1">
                            {strokeModifierList.map(({ style, label, icon: Icon }) => (
                                <button
                                    key={style}
                                    onClick={() => {
                                        setStrokeModifier(s => ({ ...s, style }));
                                    }}
                                    className={`w-full flex items-center gap-3 p-2 rounded-md text-sm ${strokeModifier.style === style ? 'bg-[--accent-primary] text-white' : 'hover:bg-[--bg-tertiary]'}`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-[--bg-tertiary] pt-2 mt-2">
                            <label className="px-2 text-xs font-bold text-[--text-secondary]">Escala del Patrón: {strokeModifier.scale.toFixed(1)}</label>
                            <input
                                type="range"
                                min="0.5"
                                max="10"
                                step="0.5"
                                value={strokeModifier.scale}
                                onChange={(e) => setStrokeModifier(s => ({ ...s, scale: parseFloat(e.target.value) }))}
                                className="w-full mt-1"
                                disabled={strokeModifier.style === 'solid'}
                            />
                        </div>
                    </div>
                )
            }

            {
                isDrawingToolsMenuOpen && (
                    <div
                        ref={drawingToolsDropdownRef}
                        className="fixed z-50 p-2 space-y-1 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-xl w-60"
                        style={getMenuPositionStyle(drawingToolsMenuRef.current)}
                    >
                        {drawingToolsGroup.map(({ tool: t, name, icon: Icon }) => (
                            <div key={t} className={`flex items-center justify-between rounded-md text-sm ${tool === t ? 'bg-[--accent-primary] text-white' : 'hover:bg-[--bg-tertiary]'}`}>
                                <button onClick={() => { handleToolClick(t); setIsDrawingToolsMenuOpen(false); }} className="flex items-center gap-3 p-2 flex-grow text-left">
                                    <Icon className="w-5 h-5" />
                                    <span>{name}</span>
                                </button>
                                <button onClick={(e) => { handleSettingsClick(e, t); }} className="p-2 mr-1 rounded-full hover:bg-black/10 flex-shrink-0" title="Configuración de la herramienta">
                                    <MoreVerticalIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Popovers for tool settings */}
            {
                openSettings && settingsPanelPosition && (
                    <div
                        ref={settingsPanelRef}
                        className="fixed z-50 bg-[--bg-secondary] border border-[--bg-tertiary] rounded-lg shadow-xl w-64 overflow-hidden"
                        style={{
                            top: settingsPanelPosition.top,
                            left: settingsPanelPosition.left,
                            maxHeight: '80vh',
                        }}
                    >
                        {renderSettings(openSettings)}
                    </div>
                )
            }
        </aside >
    );
};