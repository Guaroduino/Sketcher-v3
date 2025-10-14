import React, { useState, useRef, useEffect } from 'react';
// FIX: Add TransformIcon and re-enable transform tool.
import { SelectIcon, BrushIcon, EraserIcon, MarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, ChevronDownIcon, TrashIcon, ExportIcon, CropIcon, RulerIcon, PerspectiveIcon, OrthogonalIcon, MirrorIcon, FreeTransformIcon, MagicWandIcon, XIcon, FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon } from './icons';
import type { Tool, BrushSettings, EraserSettings, MarkerSettings, AirbrushSettings, FXBrushSettings, BrushPreset, Guide, CropRect, BlendMode, SketchObject, LibraryItem, StrokeMode } from '../types';

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  eraserSettings: EraserSettings;
  setEraserSettings: React.Dispatch<React.SetStateAction<EraserSettings>>;
  markerSettings: MarkerSettings;
  setMarkerSettings: React.Dispatch<React.SetStateAction<MarkerSettings>>;
  airbrushSettings: AirbrushSettings;
  setAirbrushSettings: React.Dispatch<React.SetStateAction<AirbrushSettings>>;
  fxBrushSettings: FXBrushSettings;
  setFxBrushSettings: React.Dispatch<React.SetStateAction<FXBrushSettings>>;
  brushPresets: BrushPreset[];
  onSavePreset: (name: string, settings: FXBrushSettings) => string;
  onUpdatePreset: (id: string, updates: Partial<Omit<BrushPreset, 'id'>>) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  activeGuide: Guide;
  setActiveGuide: (guide: 'ruler' | 'perspective' | 'mirror') => void;
  isOrthogonalVisible: boolean;
  onToggleOrthogonal: () => void;
  onExportClick: () => void;
  onEnhance: (payload: any) => void;
  isEnhancing: boolean;
  enhancementPreview: { fullDataUrl: string; croppedDataUrl: string | null; bbox: CropRect | null } | null;
  onGenerateEnhancementPreview: () => void;
  objects: SketchObject[];
  libraryItems: LibraryItem[];
  backgroundDataUrl: string | null;
  debugInfo: { prompt: string; images: { name: string; url: string }[] } | null;
  strokeMode: StrokeMode;
  setStrokeMode: (mode: StrokeMode) => void;
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


export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  brushSettings,
  setBrushSettings,
  eraserSettings,
  setEraserSettings,
  markerSettings,
  setMarkerSettings,
  airbrushSettings,
  setAirbrushSettings,
  fxBrushSettings,
  setFxBrushSettings,
  brushPresets,
  onSavePreset,
  onUpdatePreset,
  onLoadPreset,
  onDeletePreset,
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
}) => {
  const [openSettings, setOpenSettings] = useState<Tool | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [presetName, setPresetName] = useState('');
  const [isChromaKeyEnabled, setIsChromaKeyEnabled] = useState(false);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const [isStrokeModeMenuOpen, setIsStrokeModeMenuOpen] = useState(false);
  const strokeModeMenuRef = useRef<HTMLDivElement>(null);

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
      main: { id: string, type: 'outliner' | 'library', url: string, name: string } | null,
      a: { id: string, type: 'outliner' | 'library', url: string, name: string } | null,
      b: { id: string, type: 'outliner' | 'library', url: string, name: string } | null,
      c: { id: string, type: 'outliner' | 'library', url: string, name: string } | null
  }>({ main: null, a: null, b: null, c: null });

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect to detect when settings are modified from a loaded preset
  useEffect(() => {
    if (selectedPresetId !== 'custom') {
      const currentPreset = brushPresets.find(p => p.id === selectedPresetId);
      if (currentPreset && JSON.stringify(currentPreset.settings) !== JSON.stringify(fxBrushSettings)) {
        setSelectedPresetId('custom');
      }
    }
  }, [fxBrushSettings, brushPresets, selectedPresetId]);
  
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


  const handleToolClick = (t: Tool) => {
    if (tool !== t) {
      setOpenSettings(null);
    }
    setTool(t);
  };

  const handleToolDoubleClick = (t: Tool) => {
    if (t === 'enhance' && openSettings !== 'enhance') {
      onGenerateEnhancementPreview();
    }
    setOpenSettings(prev => (prev === t ? null : t));
  };

  const toolButtonClasses = (t: Tool) =>
    `p-3 rounded-lg transition-colors ${
      tool === t ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'
    }`;

  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPresetId(id);
    if (id !== 'custom') {
        onLoadPreset(id);
        const preset = brushPresets.find(p => p.id === id);
        setPresetName(preset ? preset.name : '');
    } else {
        setPresetName('');
    }
  }
  
  const handleDeletePreset = () => {
      if (selectedPresetId !== 'custom' && confirm("¿Estás seguro de que quieres eliminar este ajuste preestablecido?")) {
          onDeletePreset(selectedPresetId);
          setSelectedPresetId('custom');
          setPresetName('');
      }
  }
  
  const handleSave = () => {
      if (selectedPresetId !== 'custom' && presetName.trim()) {
          onUpdatePreset(selectedPresetId, { name: presetName.trim(), settings: fxBrushSettings });
      }
  };

  const handleSaveAs = () => {
      if (presetName.trim()) {
          const newId = onSavePreset(presetName.trim(), fxBrushSettings);
          setSelectedPresetId(newId);
      }
  };

  const handleTextureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              setFxBrushSettings(s => ({
                  ...s,
                  texture: { dataUrl: event.target?.result as string, name: file.name }
              }));
          };
          reader.readAsDataURL(file);
      }
  };

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
      
      try {
          const libData = JSON.parse(e.dataTransfer.getData('application/json'));
          if (libData.type === 'library-item') {
              const item = libraryItems.find(i => i.id === libData.id);
              if (item && item.dataUrl) {
                  setFreeFormSlots(prev => ({ ...prev, [slot]: { id: item.id, type: 'library', url: item.dataUrl, name: item.name } }));
                  return;
              }
          }
      } catch (error) { /* not a library item */ }

      try {
          const outlinerId = e.dataTransfer.getData('text/plain');
          if (outlinerId) {
              const item = objects.find(o => o.id === outlinerId);
              if (item && item.canvas && item.type === 'object') {
                  const dataUrl = item.canvas.toDataURL();
                  setFreeFormSlots(prev => ({ ...prev, [slot]: { id: item.id, type: 'outliner', url: dataUrl, name: item.name } }));
                  return;
              }
          }
      } catch (error) { /* not an outliner item */ }
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
      placeholder: string;
      className?: string;
  }> = ({ slotData, onDrop, onClear, placeholder, className = '' }) => (
      <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`relative bg-[--bg-tertiary] rounded-md flex items-center justify-center text-center text-xs text-[--text-secondary] p-2 ${className}`}
      >
          {slotData ? (
              <>
                  <img src={slotData.url} alt={slotData.name} className="max-w-full max-h-full object-contain rounded-md" />
                  <button onClick={onClear} className="absolute top-1 right-1 p-0.5 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-red-600 rounded-full text-white text-base">
                      <XIcon className="w-3 h-3"/>
                  </button>
              </>
          ) : (
              <span>{placeholder}</span>
          )}
      </div>
  );

  const renderSettings = (toolToShow: Tool) => {
    switch (toolToShow) {
      case 'select':
      case 'transform':
      case 'free-transform':
        return null;
      case 'enhance':
        return (
            <div className="p-4 space-y-4">
                <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Mejora con IA</h4>
                
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
                                className={`text-xs p-2 rounded transition-colors ${
                                    enhancementInputMode === 'full' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                                }`}
                            >
                                Lienzo Completo
                            </button>
                            <button
                                onClick={() => setEnhancementInputMode('bbox')}
                                disabled={isEnhancing || !enhancementPreview?.bbox}
                                className={`text-xs p-2 rounded transition-colors ${
                                    enhancementInputMode === 'bbox' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed'
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
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${
                                isChromaKeyEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                            }`}
                            disabled={isEnhancing}
                        >
                            <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                    isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    {isChromaKeyEnabled && (
                        <div className="grid grid-cols-2 gap-2">
                             <button
                                onClick={() => setEnhancementChromaKey('green')}
                                disabled={isEnhancing}
                                className={`text-xs p-2 rounded transition-colors ${
                                    enhancementChromaKey === 'green' ? 'bg-green-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                                }`}
                            >
                                Verde
                            </button>
                             <button
                                onClick={() => setEnhancementChromaKey('blue')}
                                disabled={isEnhancing}
                                className={`text-xs p-2 rounded transition-colors ${
                                    enhancementChromaKey === 'blue' ? 'bg-blue-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
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
                                    <img src={enhancementPreview.fullDataUrl} alt="Composite Preview" className="max-w-full max-h-[80%] object-contain"/>
                                ) : <span className="text-xs text-[--text-secondary]">Cargando...</span> }
                                <span className="text-xs text-[--text-secondary] mt-1">Objetos Visibles</span>
                            </div>
                            <div className="bg-[--bg-tertiary] p-1 rounded-md text-center aspect-video flex items-center justify-center flex-col">
                                {backgroundDataUrl ? (
                                    <img src={backgroundDataUrl} alt="Background Preview" className="max-w-full max-h-[80%] object-contain"/>
                                ) : <span className="text-xs text-[--text-secondary]">Sin Fondo</span> }
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
                                        <XIcon className="w-3 h-3"/>
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
                        Arrastra objetos desde el Outliner o la Librería a las ranuras. Luego, describe cómo combinarlos.
                    </p>
                    <div className="space-y-2">
                      <FreeFormSlot
                        slotData={freeFormSlots.main}
                        onDrop={(e) => handleFreeFormSlotDrop(e, 'main')}
                        onClear={() => setFreeFormSlots(p => ({...p, main: null}))}
                        placeholder="[Objeto 1] Principal"
                        className="h-28"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <FreeFormSlot
                          slotData={freeFormSlots.a}
                          onDrop={(e) => handleFreeFormSlotDrop(e, 'a')}
                          onClear={() => setFreeFormSlots(p => ({...p, a: null}))}
                          placeholder="[Añadido A]"
                          className="h-20"
                        />
                         <FreeFormSlot
                          slotData={freeFormSlots.b}
                          onDrop={(e) => handleFreeFormSlotDrop(e, 'b')}
                          onClear={() => setFreeFormSlots(p => ({...p, b: null}))}
                          placeholder="[Añadido B]"
                          className="h-20"
                        />
                         <FreeFormSlot
                          slotData={freeFormSlots.c}
                          onDrop={(e) => handleFreeFormSlotDrop(e, 'c')}
                          onClear={() => setFreeFormSlots(p => ({...p, c: null}))}
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
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${
                                addEnhancedImageToLibrary ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                            }`}
                            disabled={isEnhancing}
                        >
                            <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                    addEnhancedImageToLibrary ? 'translate-x-6' : 'translate-x-1'
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
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${
                                isChromaKeyEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'
                            }`}
                            disabled={isEnhancing}
                        >
                            <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                    isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'
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
                                        <img src={img.url} alt={img.name} className="max-w-full max-h-24 object-contain mx-auto"/>
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
                    <input id="pressure-size-brush" type="checkbox" checked={brushSettings.pressureControl.size} onChange={(e) => setBrushSettings(s => ({ ...s, pressureControl: {...s.pressureControl, size: e.target.checked} }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                </div>
            </Accordion>
          </div>
        );
      case 'marker':
         return (
          <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
             <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Marcador</h4>
             </div>
            <Accordion title="General" defaultOpen>
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {markerSettings.size}px</label>
                  <input type="range" min="1" max="200" value={markerSettings.size} onChange={(e) => setMarkerSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Flujo: {Math.round(markerSettings.opacity * 100)}%</label>
                  <input type="range" min="1" max="100" value={markerSettings.opacity * 100} onChange={(e) => setMarkerSettings(s => ({ ...s, opacity: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
                 <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                  <input type="color" value={markerSettings.color} onChange={(e) => setMarkerSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
                </div>
            </Accordion>
            <Accordion title="Punta">
                 <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Forma de la punta</label>
                    <div className="flex gap-2">
                        <button onClick={() => setMarkerSettings(s => ({ ...s, tipShape: 'square' }))} className={`flex-1 text-xs p-2 rounded ${markerSettings.tipShape === 'square' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Cuadrada</button>
                        <button onClick={() => setMarkerSettings(s => ({ ...s, tipShape: 'line' }))} className={`flex-1 text-xs p-2 rounded ${markerSettings.tipShape === 'line' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Línea</button>
                    </div>
                </div>
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Suavidad: {markerSettings.smoothness}%</label>
                  <input type="range" min="0" max="99" value={markerSettings.smoothness} onChange={(e) => setMarkerSettings(s => ({ ...s, smoothness: parseInt(e.target.value) }))} className="w-full" />
                </div>
            </Accordion>
            <Accordion title="Dinámica de Presión">
                <div className="flex items-center justify-between py-1">
                    <label htmlFor="pressure-opacity-marker" className="text-xs text-[--text-secondary]">Controlar Opacidad</label>
                    <input id="pressure-opacity-marker" type="checkbox" checked={markerSettings.pressureControl.opacity} onChange={(e) => setMarkerSettings(s => ({ ...s, pressureControl: {...s.pressureControl, opacity: e.target.checked} }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                </div>
            </Accordion>
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
       case 'airbrush':
        return (
          <div className="p-4 space-y-4">
            <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Aerógrafo</h4>
            <div>
              <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {airbrushSettings.size}px</label>
              <input type="range" min="1" max="300" value={airbrushSettings.size} onChange={(e) => setAirbrushSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-[--text-secondary] block mb-1">Flujo (Density): {Math.round(airbrushSettings.density * 100)}%</label>
              <input type="range" min="1" max="100" value={airbrushSettings.density * 100} onChange={(e) => setAirbrushSettings(s => ({ ...s, density: parseInt(e.target.value) / 100 }))} className="w-full" />
            </div>
             <div>
              <label className="text-xs text-[--text-secondary] block mb-1">Suavidad: {Math.round(airbrushSettings.softness * 100)}%</label>
              <input type="range" min="0" max="100" value={airbrushSettings.softness * 100} onChange={(e) => setAirbrushSettings(s => ({ ...s, softness: parseInt(e.target.value) / 100 }))} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
              <input type="color" value={airbrushSettings.color} onChange={(e) => setAirbrushSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
            </div>
          </div>
        );
      case 'fx-brush':
        return (
          <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
            <div className="p-4 space-y-3 bg-[--bg-secondary] sticky top-0 z-10 border-b border-[--bg-tertiary]">
                <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Pincel FX</h4>
                 <div className="flex items-center gap-2">
                    <select value={selectedPresetId} onChange={handleLoadPreset} className="bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2 flex-grow">
                        <option value="custom">Personalizado</option>
                        {brushPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {selectedPresetId !== 'custom' && (
                       <button onClick={handleDeletePreset} className="p-2 bg-[--bg-tertiary] hover:bg-red-600 rounded-md" title="Eliminar preset">
                           <TrashIcon className="w-4 h-4" />
                       </button>
                    )}
                 </div>
                 <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Nombre del Preset"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      className="bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2 w-full"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSave} 
                        disabled={selectedPresetId === 'custom' || !presetName.trim()}
                        className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-bold p-2 rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Guardar cambios en el preset actual">
                          Guardar
                      </button>
                      <button 
                        onClick={handleSaveAs}
                        disabled={!presetName.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold p-2 rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Guardar como un nuevo preset">
                          Guardar Como...
                      </button>
                    </div>
                  </div>
            </div>
            <Accordion title="General" defaultOpen>
              <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Tamaño: {fxBrushSettings.size}px</label>
                  <input type="range" min="1" max="500" value={fxBrushSettings.size} onChange={(e) => setFxBrushSettings(s => ({ ...s, size: parseInt(e.target.value) }))} className="w-full" />
              </div>
              <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Opacidad: {Math.round(fxBrushSettings.opacity * 100)}%</label>
                  <input type="range" min="0" max="100" value={fxBrushSettings.opacity * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, opacity: parseInt(e.target.value) / 100 }))} className="w-full" />
              </div>
               <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Acumulación (Flow): {Math.round(fxBrushSettings.flow * 100)}%</label>
                  <input type="range" min="1" max="100" value={fxBrushSettings.flow * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, flow: parseInt(e.target.value) / 100 }))} className="w-full" />
              </div>
              <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Color</label>
                  <input type="color" value={fxBrushSettings.color} onChange={(e) => setFxBrushSettings(s => ({ ...s, color: e.target.value }))} className="w-full h-8 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer" />
              </div>
               <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Modo de Fusión</label>
                  <select
                    value={fxBrushSettings.blendMode}
                    onChange={(e) => setFxBrushSettings(s => ({ ...s, blendMode: e.target.value as BlendMode }))}
                    className="w-full bg-[--bg-tertiary] text-[--text-primary] text-xs rounded-md p-2"
                  >
                      {BlendModes.map(mode => <option key={mode.value} value={mode.value}>{mode.name}</option>)}
                  </select>
              </div>
            </Accordion>
             <Accordion title="Forma de la Punta">
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Dureza: {fxBrushSettings.hardness}%</label>
                  <input type="range" min="0" max="100" value={fxBrushSettings.hardness} onChange={(e) => setFxBrushSettings(s => ({ ...s, hardness: parseInt(e.target.value) }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Espaciado: {fxBrushSettings.spacing}%</label>
                  <input type="range" min="1" max="500" value={fxBrushSettings.spacing} onChange={(e) => setFxBrushSettings(s => ({ ...s, spacing: parseInt(e.target.value) }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Suavidad: {fxBrushSettings.smoothness}%</label>
                  <input type="range" min="0" max="99" value={fxBrushSettings.smoothness} onChange={(e) => setFxBrushSettings(s => ({ ...s, smoothness: parseInt(e.target.value) }))} className="w-full" />
                </div>
                 <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Ángulo: {fxBrushSettings.angle}°</label>
                  <input 
                    type="range"
                    min="0"
                    max="360"
                    value={fxBrushSettings.angle}
                    onChange={(e) => setFxBrushSettings(s => ({ ...s, angle: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                    <label htmlFor="angle-follows-stroke" className="text-xs text-[--text-secondary]">Seguir dirección del trazo</label>
                    <input 
                      id="angle-follows-stroke" 
                      type="checkbox" 
                      checked={fxBrushSettings.angleFollowsStroke} 
                      onChange={(e) => setFxBrushSettings(s => ({ ...s, angleFollowsStroke: e.target.checked }))} 
                      className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" 
                    />
                </div>
                <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Forma</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setFxBrushSettings(s => ({ ...s, tipShape: 'round' }))} className={`text-xs p-2 rounded ${fxBrushSettings.tipShape === 'round' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Redonda</button>
                        <button onClick={() => setFxBrushSettings(s => ({ ...s, tipShape: 'square' }))} className={`text-xs p-2 rounded ${fxBrushSettings.tipShape === 'square' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Cuadrada</button>
                        <button onClick={() => setFxBrushSettings(s => ({ ...s, tipShape: 'line' }))} className={`text-xs p-2 rounded ${fxBrushSettings.tipShape === 'line' ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Línea</button>
                    </div>
                </div>
            </Accordion>
            <Accordion title="Dinámica de Forma">
                <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Var. Tamaño: {Math.round(fxBrushSettings.sizeJitter * 100)}%</label>
                  <input type="range" min="0" max="100" value={fxBrushSettings.sizeJitter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, sizeJitter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
                 <div>
                  <label className="text-xs text-[--text-secondary] block mb-1">Var. Ángulo: {Math.round(fxBrushSettings.angleJitter * 100)}%</label>
                  <input type="range" min="0" max="100" value={fxBrushSettings.angleJitter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, angleJitter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
            </Accordion>
            <Accordion title="Dispersión">
                <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Dispersión: {Math.round(fxBrushSettings.scatter * 100)}%</label>
                    <input type="range" min="0" max="100" value={fxBrushSettings.scatter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, scatter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
            </Accordion>
            <Accordion title="Textura">
                <div className="space-y-2">
                    <input type="file" accept="image/*" className="hidden" ref={textureInputRef} onChange={handleTextureFileChange} />
                    <button onClick={() => textureInputRef.current?.click()} className="w-full bg-[--bg-tertiary] hover:bg-[--bg-hover] text-[--text-primary] text-xs p-2 rounded-md">Seleccionar Textura</button>
                </div>
                {fxBrushSettings.texture.dataUrl && (
                    <div className="mt-4 text-center">
                        <img src={fxBrushSettings.texture.dataUrl} className="w-16 h-16 object-contain inline-block bg-white rounded-sm" alt="Textura seleccionada"/>
                        <p className="text-xs text-gray-500 truncate">{fxBrushSettings.texture.name}</p>
                        <button onClick={() => setFxBrushSettings(s => ({ ...s, texture: { dataUrl: null, name: null } }))} className="text-red-500 hover:text-red-400 text-xs mt-1">Eliminar</button>
                    </div>
                )}
            </Accordion>
            <Accordion title="Dinámica de Color">
                 <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Var. Tono: {Math.round(fxBrushSettings.hueJitter * 100)}%</label>
                    <input type="range" min="0" max="100" value={fxBrushSettings.hueJitter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, hueJitter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
                <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Var. Saturación: {Math.round(fxBrushSettings.saturationJitter * 100)}%</label>
                    <input type="range" min="0" max="100" value={fxBrushSettings.saturationJitter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, saturationJitter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
                <div>
                    <label className="text-xs text-[--text-secondary] block mb-1">Var. Brillo: {Math.round(fxBrushSettings.brightnessJitter * 100)}%</label>
                    <input type="range" min="0" max="100" value={fxBrushSettings.brightnessJitter * 100} onChange={(e) => setFxBrushSettings(s => ({ ...s, brightnessJitter: parseInt(e.target.value) / 100 }))} className="w-full" />
                </div>
            </Accordion>
            <Accordion title="Dinámica de Presión">
                <div className="flex items-center justify-between py-1">
                    <label htmlFor="pressure-size" className="text-xs text-[--text-secondary]">Controlar Tamaño</label>
                    <input id="pressure-size" type="checkbox" checked={fxBrushSettings.pressureControl.size} onChange={(e) => setFxBrushSettings(s => ({ ...s, pressureControl: {...s.pressureControl, size: e.target.checked} }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
                </div>
                 <div className="flex items-center justify-between py-1">
                    <label htmlFor="pressure-opacity" className="text-xs text-[--text-secondary]">Controlar Opacidad</label>
                    <input id="pressure-opacity" type="checkbox" checked={fxBrushSettings.pressureControl.opacity} onChange={(e) => setFxBrushSettings(s => ({ ...s, pressureControl: {...s.pressureControl, opacity: e.target.checked} }))} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary]" />
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

  const strokeModesList: { mode: StrokeMode; label: string; icon: React.FC<{className?: string}> }[] = [
      { mode: 'freehand', label: 'A mano alzada', icon: FreehandIcon },
      { mode: 'line', label: 'Línea (2 Puntos)', icon: LineIcon },
      { mode: 'polyline', label: 'Polilínea', icon: PolylineIcon },
      { mode: 'curve', label: 'Curva (3 Puntos)', icon: BezierIcon },
      { mode: 'arc', label: 'Arco (Centro)', icon: ArcIcon },
  ];
  
  const isPaintTool = ['brush', 'marker', 'airbrush', 'fx-brush', 'eraser'].includes(tool);
  const strokeModeButtonClasses = `p-3 rounded-lg transition-colors ${isPaintTool ? 'bg-[--accent-primary] text-white hover:bg-[--accent-hover]' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`;

  return (
    <div className="relative flex-shrink-0">
      <div className="bg-[--bg-primary] text-[--text-primary] h-full flex flex-col p-2">
          {/* Main Tools */}
          <div className="flex flex-col items-center space-y-2">
              <button onClick={() => handleToolClick('select')} className={toolButtonClasses('select')} title="Seleccionar">
                  <SelectIcon className="w-6 h-6" />
              </button>

              <div className="relative" ref={strokeModeMenuRef}>
                <button
                    onClick={() => setIsStrokeModeMenuOpen(prev => !prev)}
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
              
              <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />

              <button onClick={() => handleToolClick('brush')} onDoubleClick={() => handleToolDoubleClick('brush')} className={toolButtonClasses('brush')} title="Rapidograph Solido (doble clic para opciones)">
                  <BrushIcon className="w-6 h-6" />
              </button>
              <button onClick={() => handleToolClick('marker')} onDoubleClick={() => handleToolDoubleClick('marker')} className={toolButtonClasses('marker')} title="Marcador (doble clic para opciones)">
                  <MarkerIcon className="w-6 h-6" />
              </button>
              <button onClick={() => handleToolClick('airbrush')} onDoubleClick={() => handleToolDoubleClick('airbrush')} className={toolButtonClasses('airbrush')} title="Aerógrafo (doble clic para opciones)">
                  <AirbrushIcon className="w-6 h-6" />
              </button>
              <button onClick={() => handleToolClick('fx-brush')} onDoubleClick={() => handleToolDoubleClick('fx-brush')} className={toolButtonClasses('fx-brush')} title="Pincel FX (doble clic para opciones)">
                  <FXBrushIcon className="w-6 h-6" />
              </button>
              <button onClick={() => handleToolClick('eraser')} onDoubleClick={() => handleToolDoubleClick('eraser')} className={toolButtonClasses('eraser')} title="Goma de Borrar (doble clic para opciones)">
                  <EraserIcon className="w-6 h-6" />
              </button>
          </div>
          
          {/* Guide Tools */}
          <div className="w-10/12 h-px bg-[--bg-tertiary] my-2 self-center" />
          <div className="flex flex-col items-center space-y-2">
            <button onClick={() => setActiveGuide('ruler')} className={`p-3 rounded-lg transition-colors ${ activeGuide === 'ruler' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Regla">
                <RulerIcon className="w-6 h-6" />
            </button>
             <button onClick={() => setActiveGuide('perspective')} className={`p-3 rounded-lg transition-colors ${ activeGuide === 'perspective' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Perspectiva">
                <PerspectiveIcon className="w-6 h-6" />
            </button>
            <button onClick={onToggleOrthogonal} className={`p-3 rounded-lg transition-colors ${ isOrthogonalVisible ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía Ortogonal">
                <OrthogonalIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setActiveGuide('mirror')} className={`p-3 rounded-lg transition-colors ${ activeGuide === 'mirror' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary]'}`} title="Guía de Espejo">
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
              <button onClick={() => handleToolClick('enhance')} onDoubleClick={() => handleToolDoubleClick('enhance')} className={toolButtonClasses('enhance')} title="Mejora con IA (doble clic para opciones)">
                  <MagicWandIcon className="w-6 h-6" />
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
      {openSettings && (
        <div className="absolute left-full top-2 ml-2 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-80 z-20 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {renderSettings(openSettings)}
        </div>
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