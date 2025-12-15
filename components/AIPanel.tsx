import React, { useRef, useEffect } from 'react';
import { XIcon, SparklesIcon, TrashIcon, UploadIcon } from './icons';
import type { CropRect } from '../types';
import { useAIPanel, PromptType } from '../hooks/useAIPanel';

interface AIPanelProps {
    isOpen: boolean;
    onClose: () => void;
    // We pass the hook return value as props or just the necessary parts
    aiPanelState: ReturnType<typeof useAIPanel>;
    onEnhance: (payload: any) => void;
    isEnhancing: boolean;
    enhancementPreview: { fullDataUrl: string; croppedDataUrl: string | null; bbox: CropRect | null } | null;
    onGenerateEnhancementPreview: (includeBackground: boolean) => void;
}

const PromptManager: React.FC<{
    type: PromptType;
    value: string;
    savePrompt: (type: PromptType, value: string) => void;
    setPromptLoader: (state: { openFor: PromptType | null; anchorEl: HTMLElement | null }) => void;
}> = ({ type, value, savePrompt, setPromptLoader }) => (
    <div className="flex justify-end gap-2 mt-1">
        <button onClick={() => savePrompt(type, value)} className="text-xs px-2 py-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover]">Guardar</button>
        <button onClick={(e) => setPromptLoader({ openFor: type, anchorEl: e.currentTarget })} className="text-xs px-2 py-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cargar</button>
    </div>
);

export const AIPanel: React.FC<AIPanelProps> = ({
    isOpen,
    onClose,
    aiPanelState,
    onEnhance,
    isEnhancing,
    enhancementPreview,
    onGenerateEnhancementPreview,
}) => {
    const {
        activeAiTab, setActiveAiTab,
        enhancementPrompt, setEnhancementPrompt,
        enhancementStylePrompt, setEnhancementStylePrompt,
        enhancementNegativePrompt, setEnhancementNegativePrompt,
        enhancementCreativity, setEnhancementCreativity,
        enhancementChromaKey, setEnhancementChromaKey,
        isChromaKeyEnabled, setIsChromaKeyEnabled,
        enhancementInputMode, setEnhancementInputMode,
        enhancementPreviewBgColor, setEnhancementPreviewBgColor,
        shouldAddToCanvas, setShouldAddToCanvas,
        shouldAddToLibrary, setShouldAddToLibrary,
        shouldRemoveContent, setShouldRemoveContent,
        sourceScope, setSourceScope,
        shouldUpdateBackground, setShouldUpdateBackground,
        compositionPrompt, setCompositionPrompt,
        styleRef, setStyleRef,
        freeFormPrompt, setFreeFormPrompt,
        freeFormSlots, setFreeFormSlots,
        savedPrompts, savePrompt, deletePrompt,
        // ... other state
    } = aiPanelState;

    // Local state for prompt loader which is UI specific
    const [promptLoader, setPromptLoader] = React.useState<{ openFor: PromptType | null, anchorEl: HTMLElement | null }>({ openFor: null, anchorEl: null });
    const promptLoaderRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close prompt loader on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (promptLoaderRef.current && !promptLoaderRef.current.contains(event.target as Node)) {
                setPromptLoader({ openFor: null, anchorEl: null });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Generate preview when active tab changes
    useEffect(() => {
        if (isOpen) {
            const includeBg = activeAiTab === 'composition';
            onGenerateEnhancementPreview(includeBg);
        }
    }, [isOpen, activeAiTab]);

    // Load prompt handler
    const loadPrompt = (type: PromptType, value: string) => {
        if (type === 'description') setEnhancementPrompt(value);
        if (type === 'style') setEnhancementStylePrompt(value);
        if (type === 'negative') setEnhancementNegativePrompt(value);
        setPromptLoader({ openFor: null, anchorEl: null });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div ref={panelRef} className="bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg w-[500px] max-h-[90vh] flex flex-col pointer-events-auto">
                    <div className="flex-shrink-0 p-4 border-b border-[--bg-tertiary] flex justify-between items-center">
                        <h4 className="text-sm font-bold uppercase text-[--text-secondary]">Mejora con IA</h4>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-[--bg-hover]">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
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

                        {/* Object Tab Implementation */}
                        {activeAiTab === 'object' && (
                            <div className="space-y-4">
                                <div style={{ backgroundColor: enhancementPreviewBgColor }} className="rounded-md p-2 aspect-video flex items-center justify-center">
                                    {!enhancementPreview ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-[--text-secondary]">Generando vista previa...</span>
                                            {/* We trigger generation on mount/open if needed, usually passed prop controls this */}
                                        </div>
                                    ) : (
                                        <img
                                            src={enhancementInputMode === 'bbox' && enhancementPreview.croppedDataUrl ? enhancementPreview.croppedDataUrl : enhancementPreview.fullDataUrl}
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
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'full' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}
                                        >
                                            Lienzo Completo
                                        </button>
                                        <button
                                            onClick={() => setEnhancementInputMode('bbox')}
                                            disabled={isEnhancing || !enhancementPreview?.bbox}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'bbox' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed'}`}
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
                                    <PromptManager type="description" value={enhancementPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
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
                                    <PromptManager type="style" value={enhancementStylePrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
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
                                    <PromptManager type="negative" value={enhancementNegativePrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
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
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary] ${isChromaKeyEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'}`}
                                        disabled={isEnhancing}
                                    >
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {isChromaKeyEnabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setEnhancementChromaKey('green')} disabled={isEnhancing} className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'green' ? 'bg-green-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Verde</button>
                                        <button onClick={() => setEnhancementChromaKey('blue')} disabled={isEnhancing} className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'blue' ? 'bg-blue-600 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Azul</button>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="add-to-canvas" className="ml-2 text-xs text-[--text-secondary]">Añadir a Canvas</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="add-to-library"
                                            checked={shouldAddToLibrary}
                                            onChange={(e) => setShouldAddToLibrary(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="add-to-library" className="ml-2 text-xs text-[--text-secondary]">Añadir a Librería</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="remove-content"
                                            checked={shouldRemoveContent}
                                            onChange={(e) => setShouldRemoveContent(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="remove-content" className="ml-2 text-xs text-[--text-secondary]">Quitar Contenido</label>
                                    </div>
                                </div>

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
                                        shouldAddToCanvas,
                                        shouldAddToLibrary,
                                        shouldRemoveContent,
                                        sourceScope,
                                    })}
                                    disabled={!enhancementPrompt.trim() || !enhancementStylePrompt.trim() || isEnhancing}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar'}
                                </button>
                            </div>
                        )}
                        {/* Composition Tab Implementation */}
                        {activeAiTab === 'composition' && (
                            <div className="space-y-4">
                                <div className="rounded-md p-2 aspect-video flex items-center justify-center bg-gray-800 border border-gray-700">
                                    {!enhancementPreview ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-[--text-secondary]">Generando vista previa...</span>
                                        </div>
                                    ) : (
                                        <img
                                            src={enhancementPreview.fullDataUrl}
                                            alt="Composition Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Descripción de la Composición</label>
                                    <textarea
                                        value={compositionPrompt}
                                        onChange={(e) => setCompositionPrompt(e.target.value)}
                                        placeholder="Describe la escena completa..."
                                        className="w-full h-24 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={compositionPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Referencia de Estilo (Opcional)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        if (ev.target?.result) setStyleRef({ url: ev.target.result as string, name: file.name });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="text-xs text-[--text-secondary] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-[--bg-tertiary] file:text-[--text-primary] hover:file:bg-[--bg-hover]"
                                            disabled={isEnhancing}
                                        />
                                        {styleRef && (
                                            <button onClick={() => setStyleRef(null)} className="text-red-500 hover:text-red-400">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {styleRef && <div className="mt-2 h-20 w-full bg-cover bg-center rounded-md border border-[--bg-tertiary]" style={{ backgroundImage: `url(${styleRef.url})` }}></div>}
                                </div>

                                <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-update-bg"
                                            checked={shouldUpdateBackground}
                                            onChange={(e) => setShouldUpdateBackground(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-update-bg" className="ml-2 text-xs text-[--text-secondary]">Reemplazar Fondo</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-add-to-canvas" className="ml-2 text-xs text-[--text-secondary]">Añadir como Capa</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-remove-content"
                                            checked={shouldRemoveContent}
                                            onChange={(e) => setShouldRemoveContent(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-remove-content" className="ml-2 text-xs text-[--text-secondary]">Quitar Contenido Usado</label>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onEnhance({
                                        activeAiTab,
                                        compositionPrompt,
                                        styleRef,
                                        shouldUpdateBackground,
                                        shouldAddToCanvas,
                                        shouldRemoveContent
                                    })}
                                    disabled={!compositionPrompt.trim() || isEnhancing}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar Composición'}
                                </button>
                            </div>
                        )}

                        {/* Free Tab Implementation */}
                        {activeAiTab === 'free' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-1">Descripción Libre</label>
                                    <textarea
                                        value={freeFormPrompt}
                                        onChange={(e) => setFreeFormPrompt(e.target.value)}
                                        placeholder="Describe lo que quieres generar..."
                                        className="w-full h-24 p-2 bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={freeFormPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[--text-secondary] block mb-2">Elementos (Opcional)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['main', 'a', 'b', 'c'] as const).map((slot) => (
                                            <div key={slot} className="border border-[--bg-tertiary] rounded p-2 bg-[--bg-secondary]">
                                                <span className="text-[10px] text-[--text-secondary] uppercase font-bold block mb-1">{slot === 'main' ? 'Principal' : `Ranura ${slot.toUpperCase()}`}</span>
                                                {freeFormSlots[slot] ? (
                                                    <div className="relative group aspect-square bg-[--bg-tertiary] rounded overflow-hidden">
                                                        <img src={freeFormSlots[slot]!.url} alt={slot} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => setFreeFormSlots({ ...freeFormSlots, [slot]: null })}
                                                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                        >
                                                            <XIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center aspect-square bg-[--bg-tertiary] rounded cursor-pointer hover:bg-[--bg-hover] transition-colors">
                                                        <UploadIcon className="w-5 h-5 text-[--text-secondary] mb-1" />
                                                        <span className="text-[10px] text-[--text-secondary]">Subir</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onload = (ev) => {
                                                                        if (ev.target?.result) {
                                                                            setFreeFormSlots({
                                                                                ...freeFormSlots,
                                                                                [slot]: { id: `file-${Date.now()}`, type: 'file', url: ev.target.result as string, name: file.name }
                                                                            });
                                                                        }
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            disabled={isEnhancing}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="free-add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-[--bg-tertiary] border-[--bg-hover] rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="free-add-to-canvas" className="ml-2 text-xs text-[--text-secondary]">Añadir a Canvas</label>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onEnhance({ activeAiTab, freeFormPrompt, freeFormSlots, shouldAddToCanvas, shouldAddToLibrary })}
                                    disabled={!freeFormPrompt.trim() || isEnhancing}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {isEnhancing ? 'Generando...' : 'Generar Libre'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Prompt Loader Popover */}
            {promptLoader.openFor && promptLoader.anchorEl && (
                <div
                    ref={promptLoaderRef}
                    className="absolute z-[60] bg-[--bg-secondary] border border-[--bg-tertiary] rounded-lg shadow-lg w-64 max-h-60 overflow-y-auto"
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
        </>
    );
};
