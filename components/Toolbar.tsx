import React, { useState, useRef, useEffect } from 'react';
// FIX: Add TransformIcon and re-enable transform tool.
// FIX: Corrected import path for MagicWandIcon.
// FIX: Replaced MarkerIcon with SolidMarkerIcon and NaturalMarkerIcon
// FIX: Added WatercolorIcon to support the new watercolor tool.
import { SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, TransformIcon, ChevronDownIcon, TrashIcon, ExportIcon, CropIcon, RulerIcon, PerspectiveIcon, OrthogonalIcon, MirrorIcon, FreeTransformIcon, SparklesIcon, XIcon, FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon, SolidLineIcon, DashedLineIcon, DottedLineIcon, DashDotLineIcon, MarqueeRectIcon, LassoIcon, MagicWandIcon, UploadIcon, MoreVerticalIcon, TextIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, AdvancedMarkerIcon, WatercolorIcon } from './icons';
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
    onEnhance: (payload: any) => void;
    isEnhancing: boolean;
    enhancementPreview: { fullDataUrl: string; croppedDataUrl: string | null; bbox: CropRect | null } | null;
    onGenerateEnhancementPreview: () => void;
    objects: CanvasItem[];
    libraryItems: LibraryItem[];
    backgroundDataUrl: string | null;
    debugInfo: { prompt: string; images: { name: string; url: string }[] } | null;
    strokeMode: StrokeMode;
    setStrokeMode: (mode: StrokeMode) => void;
    strokeModifier: StrokeModifier;
    setStrokeModifier: React.Dispatch<React.SetStateAction<StrokeModifier>>;
    // FIX: Added missing preset-related props
    brushPresets: BrushPreset[];
    onSavePreset: (name: string) => void;
    onUpdatePreset: (id: string, updates: Partial<BrushPreset>) => void;
    onLoadPreset: (id: string) => void;
    onDeletePreset: (id: string) => void;
}

type SavedPrompts = {
    description: string[];
    style: string[];
    negative: string[];
}
type PromptType = keyof SavedPrompts;

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
    { tool: 'simple-marker', name: 'Marcador Sólido', icon: SolidMarkerIcon },
    { tool: 'advanced-marker', name: 'Marcador Avanzado', icon: AdvancedMarkerIcon },
    { tool: 'natural-marker', name: 'Marcador Natural', icon: NaturalMarkerIcon },
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
    'enhance': SparklesIcon,
    'crop': CropIcon,
    'pan': () => null,
    'debug-brush': BrushIcon,
    'text': TextIcon,
    'natural-marker': NaturalMarkerIcon,
    'airbrush': AirbrushIcon,
    'fx-brush': FXBrushIcon,
    'advanced-marker': AdvancedMarkerIcon,
    'watercolor': WatercolorIcon,
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
    onEnhance,
    isEnhancing,
    enhancementPreview,
    onGenerateEnhancementPreview,
    objects,
    libraryItems,
    backgroundDataUrl,
    debugInfo,
    strokeMode,
    setStrokeMode,
    strokeModifier,
    setStrokeModifier,
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
    const [isStrokeModifierMenuOpen, setIsStrokeModifierMenuOpen] = useState(false);
    const strokeModifierMenuRef = useRef<HTMLDivElement>(null);

    // Tool Group States
    const [isSelectionToolsMenuOpen, setIsSelectionToolsMenuOpen] = useState(false);
    const selectionToolsMenuRef = useRef<HTMLDivElement>(null);
    const [isDrawingToolsMenuOpen, setIsDrawingToolsMenuOpen] = useState(false);
    const drawingToolsMenuRef = useRef<HTMLDivElement>(null);
    const [lastActiveSelectionTool, setLastActiveSelectionTool] = useState<Tool>('marquee-rect');
    const [lastActiveDrawingTool, setLastActiveDrawingTool] = useState<Tool>('brush');

    // AI Panel State
    const [activeAiTab, setActiveAiTab] = useState<'object' | 'composition' | 'free'>('object');
    // Object
    const [enhancementPrompt, setEnhancementPrompt] = useState('');
    const [enhancementStylePrompt, setEnhancementStylePrompt] = useState('');
    const [enhancementNegativePrompt, setEnhancementNegativePrompt] = useState('');
    const [enhancementCreativity, setEnhancementCreativity] = useState(100);
    const [enhancementChromaKey, setEnhancementChromaKey] = useState<'none' | 'green' | 'blue'>('none');
    const [enhancementInputMode, setEnhancementInputMode] = useState<'full' | 'bbox'>('full');
    const [enhancementPreviewBgColor, setEnhancementPreviewBgColor] = useState('#FFFFFF');
    // Composition
    const [compositionPrompt, setCompositionPrompt] = useState('');
    const [styleRef, setStyleRef] = useState<{ url: string; name: string } | null>(null);
    const [isStyleRefHover, setIsStyleRefHover] = useState(false);
    // Free
    const [freeFormPrompt, setFreeFormPrompt] = useState('');
    const [addEnhancedImageToLibrary, setAddEnhancedImageToLibrary] = useState(true);
    const [freeFormSlots, setFreeFormSlots] = useState<{
        main: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        a: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        b: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        c: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null
    }>({ main: null, a: null, b: null, c: null });
    const slotFileInputRef = useRef<HTMLInputElement>(null);
    const currentlyEditingSlot = useRef<'main' | 'a' | 'b' | 'c' | null>(null);


    // Saved Prompts State
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompts>({ description: [], style: [], negative: [] });
    const [promptLoader, setPromptLoader] = useState<{ openFor: PromptType | null, anchorEl: HTMLElement | null }>({ openFor: null, anchorEl: null });
    const promptLoaderRef = useRef<HTMLDivElement>(null);

    // Load saved prompts from localStorage on mount
    useEffect(() => {
        try {
            const storedPrompts = localStorage.getItem('sketcher-ai-prompts');
            if (storedPrompts) {
                setSavedPrompts(JSON.parse(storedPrompts));
            }
        } catch (error) {
            console.error("Failed to load prompts from localStorage", error);
        }
    }, []);

    // Effect to close popovers when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (promptLoaderRef.current && !promptLoaderRef.current.contains(event.target as Node)) {
                setPromptLoader({ openFor: null, anchorEl: null });
            }
            if (strokeModeMenuRef.current && !strokeModeMenuRef.current.contains(event.target as Node)) {
                setIsStrokeModeMenuOpen(false);
            }
            if (strokeModifierMenuRef.current && !strokeModifierMenuRef.current.contains(event.target as Node)) {
                setIsStrokeModifierMenuOpen(false);
            }
            if (selectionToolsMenuRef.current && !selectionToolsMenuRef.current.contains(event.target as Node)) {
                setIsSelectionToolsMenuOpen(false);
            }
            if (drawingToolsMenuRef.current && !drawingToolsMenuRef.current.contains(event.target as Node)) {
                setIsDrawingToolsMenuOpen(false);
            }
            if (
                openSettings !== 'enhance' && // This effect is only for popovers now
                settingsPanelRef.current &&
                !settingsPanelRef.current.contains(event.target as Node) &&
                settingsPanelAnchor &&
                !settingsPanelAnchor.contains(event.target as Node)
            ) {
                setOpenSettings(null);
                setSettingsPanelAnchor(null);
                setSettingsPanelPosition(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [settingsPanelAnchor, openSettings]);

    // Link Chroma Key state to parent toggles and its own state
    useEffect(() => {
        if (isChromaKeyEnabled) {
            if (enhancementChromaKey === 'none') {
                setEnhancementChromaKey('green');
            }
        } else {
            setEnhancementChromaKey('none');
        }
    }, [isChromaKeyEnabled, setEnhancementChromaKey]);

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
        if (t === 'enhance' && openSettings !== 'enhance') {
            onGenerateEnhancementPreview();
        }
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

    const handleStyleRefDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsStyleRefHover(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setStyleRef({ url: event.target?.result as string, name: file.name });
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleFreeFormSlotDrop = (e: React.DragEvent<HTMLDivElement>, slot: 'main' | 'a' | 'b' | 'c') => {
        e.preventDefault();
        e.stopPropagation();

        // Case 1: Dropping a file from the user's desktop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const url = event.target?.result as string;
                    setFreeFormSlots(prev => ({ ...prev, [slot]: { id: `file-${Date.now()}`, type: 'file', url, name: file.name } }));
                };
                reader.readAsDataURL(file);
            }
            return;
        }

        // Case 2: Dropping from Outliner or Library
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (!jsonData) return;
            const data = JSON.parse(jsonData);

            if (data.type === 'outliner-item') {
                const item = objects.find(o => o.id === data.id);
                if (item && item.type === 'object' && item.canvas) {
                    const dataUrl = item.canvas.toDataURL();
                    setFreeFormSlots(prev => ({ ...prev, [slot]: { id: item.id, type: 'outliner', url: dataUrl, name: item.name } }));
                }
            } else if (data.type === 'library-item') {
                const item = libraryItems.find(i => i.id === data.id);
                if (item && item.type === 'image' && item.dataUrl) {
                    setFreeFormSlots(prev => ({ ...prev, [slot]: { id: item.id, type: 'library', url: item.dataUrl, name: item.name } }));
                }
            }
        } catch (error) {
            console.error("Error handling drop:", error);
        }
    };

    const handleSlotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && currentlyEditingSlot.current) {
            const file = e.target.files[0];
            const slot = currentlyEditingSlot.current;
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                setFreeFormSlots(prev => ({ ...prev, [slot]: { id: `file-${Date.now()}`, type: 'file', url, name: file.name } }));
            };
            reader.readAsDataURL(file);
        }
        // Reset file input to allow uploading the same file again
        if (e.target) e.target.value = '';
        currentlyEditingSlot.current = null;
    };

    // --- Prompt Save/Load Logic ---
    const savePrompt = (type: PromptType, value: string) => {
        if (!value.trim() || savedPrompts[type].includes(value.trim())) return;
        const newPrompts = { ...savedPrompts, [type]: [...savedPrompts[type], value.trim()] };
        setSavedPrompts(newPrompts);
        localStorage.setItem('sketcher-ai-prompts', JSON.stringify(newPrompts));
    };

    const deletePrompt = (type: PromptType, valueToDelete: string) => {
        const newPrompts = { ...savedPrompts, [type]: savedPrompts[type].filter(p => p !== valueToDelete) };
        setSavedPrompts(newPrompts);
        localStorage.setItem('sketcher-ai-prompts', JSON.stringify(newPrompts));
    };

    const loadPrompt = (type: PromptType, value: string) => {
        if (type === 'description') setEnhancementPrompt(value);
        if (type === 'style') setEnhancementStylePrompt(value);
        if (type === 'negative') setEnhancementNegativePrompt(value);
        setPromptLoader({ openFor: null, anchorEl: null });
    };

    const promptSetters: Record<PromptType, React.Dispatch<React.SetStateAction<string>>> = {
        description: setEnhancementPrompt,
        style: setEnhancementStylePrompt,
        negative: setEnhancementNegativePrompt,
    };

    const PromptManager: React.FC<{ type: PromptType; value: string; }> = ({ type, value }) => (
        <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => savePrompt(type, value)} className="text-xs px-2 py-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover]">Guardar</button>
            <button onClick={(e) => setPromptLoader({ openFor: type, anchorEl: e.currentTarget })} className="text-xs px-2 py-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cargar</button>
        </div>
    );

    const FreeFormSlot: React.FC<{
        slotData: { url: string, name: string } | null;
        onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
        onClear: () => void;
        onFileSelect: () => void;
        placeholder: string;
        className?: string;
    }> = ({ slotData, onDrop, onClear, onFileSelect, placeholder, className = '' }) => {
        const [isDragOver, setIsDragOver] = useState(false);

        const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
        };

        const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
        };

        const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
            handleDragLeave(e);
            onDrop(e);
        };

        return (
            <div
                onClick={!slotData ? onFileSelect : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragLeave}
                className={`relative bg-[--bg-tertiary] rounded-md flex items-center justify-center text-center text-xs text-[--text-secondary] p-2 transition-all ${isDragOver ? 'border-2 border-dashed border-[--accent-primary]' : 'border-2 border-dashed border-transparent'
                    } ${!slotData ? 'cursor-pointer' : ''} ${className}`}
            >
                {slotData ? (
                    <>
                        <img src={slotData.url} alt={slotData.name} className="max-w-full max-h-full object-contain rounded-md" />
                        <button onClick={onClear} className="absolute top-1 right-1 p-0.5 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-red-600 rounded-full text-white text-base">
                            <XIcon className="w-3 h-3" />
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-1 pointer-events-none">
                        <UploadIcon className="w-5 h-5" />
                        <span>{placeholder}</span>
                        <span className="text-[10px]">(Arrastra o haz clic para cargar)</span>
                    </div>
                )}
            </div>
        );
    };

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
            case 'enhance':
                return (
                    <div className="space-y-4">
                        {/* Tabs */}
                        <div className="flex border-b border-[--bg-tertiary]">
                            <button onClick={() => setActiveAiTab('object')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'object' ? 'text-[--accent-primary] border-b-2 border-[--accent-primary]' : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'}`}>
                                OBJETO
                            </button>
                            <button onClick={() => setActiveAiTab('composition')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'composition' ? 'text-[--accent-primary] border-b-2 border-[--accent-primary]' : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'}`}>
                                COMPOSICIÓN
                            </button>
                            <button onClick={() => setActiveAiTab('free')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'free' ? 'text-[--accent-primary] border-b-2 border-[--accent-primary]' : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'}`}>
                                LIBRE
                            </button>
                        </div>

                        {/* Object Tab */}
                        {activeAiTab === 'object' && (
                            <div className="space-y-4">
                                <div style={{ backgroundColor: enhancementPreviewBgColor }} className="rounded-md p-2 aspect-video flex items-center justify-center">
                                    {!enhancementPreview ? (
                                        <span className="text-xs text-[--text-secondary]">Generando vista previa...</span>
                                    ) : (
                                        <img
                                            src={
                                                enhancementInputMode === 'bbox' && enhancementPreview.croppedDataUrl
                                                    ? enhancementPreview.croppedDataUrl
                                                    : enhancementPreview.fullDataUrl
                                            }
                                            alt="AI Input Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="preview-bg-color" className="text-xs font-bold text-[--text-secondary] block mb-1">Fondo</label>
                                    <input
                                        type="color"
                                        id="preview-bg-color"
                                        value={enhancementPreviewBgColor}
                                        onChange={(e) => setEnhancementPreviewBgColor(e.target.value)}
                                        className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer"
                                        disabled={isEnhancing}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-2">Imagen de Entrada</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setEnhancementInputMode('full')}
                                            disabled={isEnhancing}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'full' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                                                }`}
                                        >
                                            Lienzo Completo
                                        </button>
                                        <button
                                            onClick={() => setEnhancementInputMode('bbox')}
                                            disabled={isEnhancing || !enhancementPreview?.bbox}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'bbox' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            Ajustar a Contenido
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Descripción del Objeto (Necesario)</label>
                                    <textarea
                                        value={enhancementPrompt}
                                        onChange={(e) => setEnhancementPrompt(e.target.value)}
                                        placeholder="Ej: 'añade un castillo de fantasía en el fondo'"
                                        className="w-full h-20 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={enhancementPrompt} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Estilo (Necesario)</label>
                                    <textarea
                                        value={enhancementStylePrompt}
                                        onChange={(e) => setEnhancementStylePrompt(e.target.value)}
                                        placeholder="Ej: 'fotorrealista, colores vivos, pintura al óleo'"
                                        className="w-full h-16 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="style" value={enhancementStylePrompt} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Negativo/Evitar (Opcional)</label>
                                    <textarea
                                        value={enhancementNegativePrompt}
                                        onChange={(e) => setEnhancementNegativePrompt(e.target.value)}
                                        placeholder="Ej: 'borroso, baja resolución, texto, marcas de agua'"
                                        className="w-full h-16 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="negative" value={enhancementNegativePrompt} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Creatividad: {enhancementCreativity}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="150"
                                        value={enhancementCreativity}
                                        onChange={(e) => setEnhancementCreativity(parseInt(e.target.value))}
                                        className="w-full"
                                        disabled={isEnhancing}
                                    />
                                    <div className="flex justify-between text-xs text-[--text-secondary] mt-1">
                                        <span>Fiel</span>
                                        <span>Equilibrado</span>
                                        <span>Imaginativo</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between py-1">
                                    <label htmlFor="chroma-key-toggle" className="text-xs font-bold text-[--text-secondary]">
                                        Forzar Fondo Chroma
                                    </label>
                                    <button
                                        id="chroma-key-toggle"
                                        role="switch"
                                        aria-checked={isChromaKeyEnabled}
                                        onClick={() => setIsChromaKeyEnabled(prev => !prev)}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${isChromaKeyEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                                            }`}
                                        disabled={isEnhancing}
                                    >
                                        <span
                                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                {isChromaKeyEnabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setEnhancementChromaKey('green')}
                                            disabled={isEnhancing}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'green' ? 'bg-green-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                                                }`}
                                        >
                                            Verde
                                        </button>
                                        <button
                                            onClick={() => setEnhancementChromaKey('blue')}
                                            disabled={isEnhancing}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'blue' ? 'bg-blue-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                                                }`}
                                        >
                                            Azul
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => onEnhance({
                                        activeAiTab,
                                        enhancementPrompt,
                                        enhancementStylePrompt,
                                        enhancementNegativePrompt,
                                        enhancementCreativity,
                                        enhancementInputMode,
                                        enhancementChromaKey: isChromaKeyEnabled ? enhancementChromaKey : 'none',
                                        enhancementPreviewBgColor,
                                    })}
                                    disabled={!enhancementPrompt.trim() || !enhancementStylePrompt.trim() || isEnhancing}
                                    className="w-full bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar'}
                                </button>
                                {isEnhancing && <div className="text-center text-xs text-[--text-secondary]">Esto puede tardar unos momentos...</div>}
                            </div>
                        )}

                        {/* Composition Tab */}
                        {activeAiTab === 'composition' && (
                            <div className="space-y-4">
                                <h5 className="font-bold text-md">Composición de Escena</h5>
                                <p className="text-xs text-[--text-secondary]">
                                    Describe cómo combinar, estilizar o modificar la escena actual. La IA usará todos los objetos visibles y el fondo como base. El resultado reemplazará el fondo actual.
                                </p>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Preview de Entrada</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-[--bg-tertiary] p-1 rounded-md text-center aspect-video flex items-center justify-center flex-col">
                                            {enhancementPreview?.fullDataUrl ? (
                                                <img src={enhancementPreview.fullDataUrl} alt="Composite Preview" className="max-w-full max-h-[80%] object-contain" />
                                            ) : <span className="text-xs text-[--text-secondary]">Cargando...</span>}
                                            <span className="text-xs text-[--text-secondary] mt-1">Objetos Visibles</span>
                                        </div>
                                        <div className="bg-[--bg-tertiary] p-1 rounded-md text-center aspect-video flex items-center justify-center flex-col">
                                            {backgroundDataUrl ? (
                                                <img src={backgroundDataUrl} alt="Background Preview" className="max-w-full max-h-[80%] object-contain" />
                                            ) : <span className="text-xs text-[--text-secondary]">Sin Fondo</span>}
                                            <span className="text-xs text-[--text-secondary] mt-1">Fondo</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Instrucciones de Composición (Necesario)</label>
                                    <textarea
                                        value={compositionPrompt}
                                        onChange={(e) => setCompositionPrompt(e.target.value)}
                                        placeholder="Ej: 'mezcla los objetos en un estilo de acuarela, con una iluminación suave desde la izquierda'"
                                        className="w-full h-24 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Referencia de Estilo (Opcional)</label>
                                    <div
                                        onDrop={handleStyleRefDrop}
                                        onDragOver={(e) => { e.preventDefault(); setIsStyleRefHover(true); }}
                                        onDragLeave={() => setIsStyleRefHover(false)}
                                        className={`w-full h-24 p-2 bg-[--bg-tertiary] rounded-md flex items-center justify-center text-center transition-colors ${isStyleRefHover ? 'border-2 border-dashed border-[--accent-primary]' : 'border-2 border-dashed border-transparent'}`}
                                    >
                                        {styleRef ? (
                                            <div className="relative">
                                                <img src={styleRef.url} alt="Style reference" className="max-h-20 object-contain" />
                                                <button onClick={() => setStyleRef(null)} className="absolute -top-1 -right-1 p-0.5 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-red-600 rounded-full text-white text-base">
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-[--text-secondary]">Arrastra una imagen de referencia aquí</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onEnhance({
                                        activeAiTab,
                                        compositionPrompt,
                                        styleRef,
                                    })}
                                    disabled={!compositionPrompt.trim() || isEnhancing}
                                    className="w-full bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar'}
                                </button>
                            </div>
                        )}

                        {/* Free Tab */}
                        {activeAiTab === 'free' && (
                            <div className="space-y-4">
                                <h5 className="font-bold text-md">Creación Libre</h5>
                                <p className="text-xs text-[--text-secondary]">
                                    Arrastra objetos desde el Outliner/Librería o haz clic para cargar imágenes en las ranuras. Luego, describe cómo combinarlos.
                                </p>
                                <input type="file" accept="image/*" className="hidden" ref={slotFileInputRef} onChange={handleSlotFileChange} />
                                <div className="space-y-2">
                                    <FreeFormSlot
                                        slotData={freeFormSlots.main}
                                        onDrop={(e) => handleFreeFormSlotDrop(e, 'main')}
                                        onClear={() => setFreeFormSlots(p => ({ ...p, main: null }))}
                                        onFileSelect={() => { currentlyEditingSlot.current = 'main'; slotFileInputRef.current?.click(); }}
                                        placeholder="[Objeto 1] Principal"
                                        className="h-28"
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                        <FreeFormSlot
                                            slotData={freeFormSlots.a}
                                            onDrop={(e) => handleFreeFormSlotDrop(e, 'a')}
                                            onClear={() => setFreeFormSlots(p => ({ ...p, a: null }))}
                                            onFileSelect={() => { currentlyEditingSlot.current = 'a'; slotFileInputRef.current?.click(); }}
                                            placeholder="[Añadido A]"
                                            className="h-20"
                                        />
                                        <FreeFormSlot
                                            slotData={freeFormSlots.b}
                                            onDrop={(e) => handleFreeFormSlotDrop(e, 'b')}
                                            onClear={() => setFreeFormSlots(p => ({ ...p, b: null }))}
                                            onFileSelect={() => { currentlyEditingSlot.current = 'b'; slotFileInputRef.current?.click(); }}
                                            placeholder="[Añadido B]"
                                            className="h-20"
                                        />
                                        <FreeFormSlot
                                            slotData={freeFormSlots.c}
                                            onDrop={(e) => handleFreeFormSlotDrop(e, 'c')}
                                            onClear={() => setFreeFormSlots(p => ({ ...p, c: null }))}
                                            onFileSelect={() => { currentlyEditingSlot.current = 'c'; slotFileInputRef.current?.click(); }}
                                            placeholder="[Añadido C]"
                                            className="h-20"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Instrucciones</label>
                                    <textarea
                                        value={freeFormPrompt}
                                        onChange={(e) => setFreeFormPrompt(e.target.value)}
                                        placeholder="Ej: Coloca [Objeto 1] en un paisaje similar a [Añadido A]"
                                        className="w-full h-24 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <label htmlFor="add-to-library-toggle-free" className="text-xs font-bold text-[--text-secondary]">
                                        Añadir a la Librería
                                    </label>
                                    <button
                                        id="add-to-library-toggle-free"
                                        role="switch"
                                        aria-checked={addEnhancedImageToLibrary}
                                        onClick={() => setAddEnhancedImageToLibrary(prev => !prev)}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${addEnhancedImageToLibrary ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                                            }`}
                                        disabled={isEnhancing}
                                    >
                                        <span
                                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${addEnhancedImageToLibrary ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <label htmlFor="chroma-key-toggle-free" className="text-xs font-bold text-[--text-secondary]">
                                        Forzar Fondo Chroma
                                    </label>
                                    <button
                                        id="chroma-key-toggle-free"
                                        role="switch"
                                        aria-checked={isChromaKeyEnabled}
                                        onClick={() => setIsChromaKeyEnabled(prev => !prev)}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${isChromaKeyEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                                            }`}
                                        disabled={isEnhancing}
                                    >
                                        <span
                                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onEnhance({
                                        activeAiTab,
                                        freeFormPrompt,
                                        freeFormSlots,
                                        addEnhancedImageToLibrary,
                                        enhancementChromaKey: isChromaKeyEnabled ? enhancementChromaKey : 'none'
                                    })}
                                    disabled={!freeFormPrompt.trim() || isEnhancing}
                                    className="w-full bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar'}
                                </button>
                            </div>
                        )}
                        {/* DEBUG PREVIEW PANEL */}
                        {debugInfo && (
                            <Accordion title="Debug Preview" defaultOpen>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Prompt Final Enviada</label>
                                    <pre className="text-xs p-2 bg-[--bg-tertiary] rounded-md whitespace-pre-wrap font-sans">
                                        {debugInfo.prompt}
                                    </pre>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Imágenes Enviadas</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {debugInfo.images.map((img, index) => (
                                            <div key={index} className="bg-[--bg-tertiary] p-1 rounded-md text-center">
                                                <img src={img.url} alt={img.name} className="max-w-full max-h-24 object-contain mx-auto" />
                                                <span className="text-xs text-[--text-secondary] mt-1 block">{img.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Accordion>
                        )}
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
                                <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                                <input type="color" value={brushSettings.color} onChange={(e) => setBrushSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                            </div>
                        </Accordion>
                        <Accordion title="Dinámica de Presión">
                            <div className="flex items-center justify-between py-1">
                                <label htmlFor="pressure-size-brush" className="text-xs text-[--text-secondary]">Controlar Tamaño</label>
                                <input id="pressure-size-brush" type="checkbox" checked={brushSettings.pressureControl.size} onChange={(e) => setBrushSettings(s => ({ ...s, pressureControl: { ...s.pressureControl, size: e.target.checked } }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                            </div>
                        </Accordion>
                    </div>
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
                            <BlendModeSelector
                                value={simpleMarkerSettings.blendMode}
                                onChange={(value) => setSimpleMarkerSettings(s => ({ ...s, blendMode: value }))}
                            />
                        </Accordion>
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
                    </div>
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
                            <BlendModeSelector
                                value={advancedMarkerSettings.blendMode}
                                onChange={(value) => setAdvancedMarkerSettings(s => ({ ...s, blendMode: value }))}
                            />
                        </Accordion>
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
                    </div>
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
    }[strokeMode];

    const strokeModesList: { mode: StrokeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
        { mode: 'freehand', label: 'A mano alzada', icon: FreehandIcon },
        { mode: 'line', label: 'Línea (2 Puntos)', icon: LineIcon },
        { mode: 'polyline', label: 'Polilínea', icon: PolylineIcon },
        { mode: 'curve', label: 'Curva (3 Puntos)', icon: BezierIcon },
        { mode: 'arc', label: 'Arco (Centro)', icon: ArcIcon },
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
                position: 'absolute',
                left: `${settingsPanelPosition.left}px`,
                top: `${settingsPanelPosition.top}px`,
                maxHeight: `calc(100vh - ${settingsPanelPosition.top + 16}px)`,
            };
        }

        if (!settingsPanelAnchor || !toolbarWrapperRef.current) {
            return { display: 'none' };
        }
        const anchorRect = settingsPanelAnchor.getBoundingClientRect();
        const wrapperRect = toolbarWrapperRef.current.getBoundingClientRect();

        return {
            position: 'absolute',
            left: `${anchorRect.right - wrapperRect.left + 8}px`,
            top: `${anchorRect.top - wrapperRect.top}px`,
            maxHeight: `calc(100vh - ${anchorRect.top - wrapperRect.top + 16}px)`,
        };
    };


    return (
        <div ref={toolbarWrapperRef} className="relative flex-shrink-0 h-full">
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
                        {isSelectionToolsMenuOpen && (
                            <div className="absolute left-full top-0 ml-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-60 z-20 p-2 space-y-1">
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
                        )}
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

                        {isStrokeModeMenuOpen && (
                            <div className="absolute left-full top-0 ml-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-60 z-20 p-2 space-y-1">
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
                        )}
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

                        {isStrokeModifierMenuOpen && (
                            <div className="absolute left-full top-0 ml-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-60 z-20 p-2 space-y-2">
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
                        )}
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
                        {isDrawingToolsMenuOpen && (
                            <div className="absolute left-full top-0 ml-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-60 z-20 p-2 space-y-1">
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
                        )}
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

                {/* AI Tools */}
                <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />
                <div className="flex flex-col items-center space-y-2">
                    <button onClick={() => handleToolClick('enhance')} onDoubleClick={(e) => handleToolDoubleClick('enhance', e)} className={toolButtonClasses('enhance')} title="Mejora con IA (doble clic para opciones)">
                        <SparklesIcon className="w-6 h-6" />
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
            </div>

            {/* Popovers for non-AI tools */}
            {openSettings && openSettings !== 'enhance' && (
                <div
                    ref={settingsPanelRef}
                    className="bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-80 z-20 overflow-y-auto"
                    style={getSettingsPanelStyle()}
                >
                    {renderSettings(openSettings)}
                </div>
            )}

            {/* Modal for AI tool */}
            {openSettings === 'enhance' && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => {
                            setOpenSettings(null);
                            setSettingsPanelAnchor(null);
                        }}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div
                            ref={settingsPanelRef}
                            className="bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-[500px] max-h-[90vh] flex flex-col pointer-events-auto"
                        >
                            <div className="flex-shrink-0 p-4 border-b border-[--bg-tertiary] flex justify-between items-center">
                                <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Mejora con IA</h4>
                                <button onClick={() => { setOpenSettings(null); setSettingsPanelAnchor(null); }} className="p-1 rounded-full hover:bg-[--bg-hover]">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4">
                                {renderSettings(openSettings)}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {promptLoader.openFor && promptLoader.anchorEl && (
                <div
                    ref={promptLoaderRef}
                    className="absolute z-30 bg-[--bg-secondary] border border-[--bg-tertiary] rounded-lg shadow-lg w-64 max-h-60 overflow-y-auto"
                    style={{
                        left: promptLoader.anchorEl.getBoundingClientRect().right + 8,
                        top: promptLoader.anchorEl.getBoundingClientRect().top
                    }}
                >
                    <ul className="p-1">
                        {savedPrompts[promptLoader.openFor].length > 0 ? (
                            savedPrompts[promptLoader.openFor].map((prompt, i) => (
                                <li key={i} className="group flex items-center justify-between text-sm text-[--text-primary] rounded-md hover:bg-[--bg-hover]">
                                    <button onClick={() => loadPrompt(promptLoader.openFor!, prompt)} className="flex-grow text-left p-2 truncate">
                                        {prompt}
                                    </button>
                                    <button onClick={() => deletePrompt(promptLoader.openFor!, prompt)} className="p-2 text-[--text-secondary] opacity-0 group-hover:opacity-100 hover:text-red-500">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li className="p-2 text-center text-xs text-[--text-secondary]">No hay prompts guardados.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};