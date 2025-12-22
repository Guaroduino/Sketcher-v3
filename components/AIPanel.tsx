import React, { useRef, useEffect } from 'react';
import { XIcon, SparklesIcon, TrashIcon, UploadIcon } from './icons';
import type { CropRect } from '../types';
import { useAIPanel, PromptType } from '../hooks/useAIPanel';

import { AIPreviewPanel } from './AIPreviewPanel';

interface AIPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onEnhance: (payload: any) => void;
    isEnhancing: boolean;
    enhancementPreview: { fullDataUrl: string; croppedDataUrl: string | null; bbox: CropRect | null } | null;
    onGenerateEnhancementPreview: (includeBackground: boolean) => void;
    debugInfo: { prompt: string; images: { name: string; url: string }[] } | null;
    onUpdateDebugInfo: (payload: any) => void;
}

const PromptManager: React.FC<{
    type: PromptType;
    value: string;
    savePrompt: (type: PromptType, value: string) => void;
    setPromptLoader: (state: { openFor: PromptType | null; anchorEl: HTMLElement | null }) => void;
}> = ({ type, value, savePrompt, setPromptLoader }) => (
    <div className="flex justify-end gap-2 mt-1">
        <button onClick={() => savePrompt(type, value)} className="text-xs px-2 py-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover">Guardar</button>
        <button onClick={(e) => setPromptLoader({ openFor: type, anchorEl: e.currentTarget })} className="text-xs px-2 py-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover">Cargar</button>
    </div>
);

export const AIPanel: React.FC<AIPanelProps> = ({
    isOpen,
    onClose,
    onEnhance,
    isEnhancing,
    enhancementPreview,
    onGenerateEnhancementPreview,
    debugInfo,
    onUpdateDebugInfo,
}) => {
    // Internal State Management to prevent App re-renders
    const aiPanelState = useAIPanel();
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
        upscaleFormat, setUpscaleFormat,
        upscaleCreativity, setUpscaleCreativity,
        sketchWaterLevel, setSketchWaterLevel,
        sketchDetailLevel, setSketchDetailLevel,
        sketchUserInstruction, setSketchUserInstruction
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
            const includeBg = activeAiTab === 'composition' || activeAiTab === 'sketch' || activeAiTab === 'upscale';
            onGenerateEnhancementPreview(includeBg);
        }
    }, [isOpen, activeAiTab]);

    // Real-time Debug Info Update
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            onUpdateDebugInfo({
                activeAiTab,
                enhancementPrompt, enhancementStylePrompt, enhancementNegativePrompt, enhancementCreativity, enhancementInputMode, enhancementChromaKey, enhancementPreviewBgColor,
                compositionPrompt, styleRef,
                freeFormPrompt, freeFormSlots,
                shouldUpdateBackground, shouldAddToCanvas, shouldAddToLibrary, shouldRemoveContent, sourceScope,
                upscaleCreativity,
                sketchWaterLevel, sketchDetailLevel, sketchUserInstruction
            });
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [
        isOpen, activeAiTab,
        enhancementPrompt, enhancementStylePrompt, enhancementNegativePrompt, enhancementCreativity, enhancementInputMode, enhancementChromaKey, enhancementPreviewBgColor,
        compositionPrompt, styleRef,
        freeFormPrompt, freeFormSlots,
        shouldUpdateBackground, shouldAddToCanvas, shouldAddToLibrary, shouldRemoveContent, sourceScope,
        upscaleCreativity,
        sketchWaterLevel, sketchDetailLevel, sketchUserInstruction
    ]);

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
                <div ref={panelRef} className="bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-lg w-[500px] max-h-[90vh] flex flex-col pointer-events-auto">
                    <div className="flex-shrink-0 p-4 border-b border-theme-bg-tertiary flex justify-between items-center">
                        <h4 className="text-sm font-bold uppercase text-theme-text-secondary">Mejora con IA</h4>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-hover">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {/* Tabs */}
                        <div className="flex border-b border-theme-bg-tertiary">
                            <button onClick={() => setActiveAiTab('object')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'object' ? 'text-theme-accent-primary border-b-2 border-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-tertiary'}`}>
                                OBJETO
                            </button>
                            <button onClick={() => setActiveAiTab('composition')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'composition' ? 'text-theme-accent-primary border-b-2 border-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-tertiary'}`}>
                                COMPOSICIÓN
                            </button>
                            <button onClick={() => setActiveAiTab('free')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'free' ? 'text-theme-accent-primary border-b-2 border-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-tertiary'}`}>
                                LIBRE
                            </button>
                            <button onClick={() => setActiveAiTab('sketch')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'sketch' ? 'text-theme-accent-primary border-b-2 border-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-tertiary'}`}>
                                ACUARELA
                            </button>
                            <button onClick={() => setActiveAiTab('upscale')} className={`flex-1 p-2 text-sm font-semibold transition-colors ${activeAiTab === 'upscale' ? 'text-theme-accent-primary border-b-2 border-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-tertiary'}`}>
                                ESCALAR
                            </button>
                        </div>

                        {/* Object Tab Implementation */}
                        {activeAiTab === 'object' && (
                            <div className="space-y-4">
                                <div style={{ backgroundColor: enhancementPreviewBgColor }} className="rounded-md p-2 aspect-video flex items-center justify-center">
                                    {!enhancementPreview ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-theme-text-secondary">Generando vista previa...</span>
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
                                    <label htmlFor="preview-bg-color" className="text-xs font-bold text-theme-text-secondary block mb-1">Fondo</label>
                                    <input
                                        type="color"
                                        id="preview-bg-color"
                                        value={enhancementPreviewBgColor}
                                        onChange={(e) => setEnhancementPreviewBgColor(e.target.value)}
                                        className="w-full h-8 p-0.5 bg-theme-bg-tertiary border border-theme-bg-hover rounded-md cursor-pointer"
                                        disabled={isEnhancing}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-2">Imagen de Entrada</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setEnhancementInputMode('full')}
                                            disabled={isEnhancing}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'full' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}
                                        >
                                            Lienzo Completo
                                        </button>
                                        <button
                                            onClick={() => setEnhancementInputMode('bbox')}
                                            disabled={isEnhancing || !enhancementPreview?.bbox}
                                            className={`text-xs p-2 rounded transition-colors ${enhancementInputMode === 'bbox' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                        >
                                            Ajustar a Contenido
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Descripción del Objeto (Necesario)</label>
                                    <textarea
                                        value={enhancementPrompt}
                                        onChange={(e) => setEnhancementPrompt(e.target.value)}
                                        placeholder="Ej: 'añade un castillo de fantasía en el fondo'"
                                        className="w-full h-20 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={enhancementPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Estilo (Necesario)</label>
                                    <textarea
                                        value={enhancementStylePrompt}
                                        onChange={(e) => setEnhancementStylePrompt(e.target.value)}
                                        placeholder="Ej: 'fotorrealista, colores vivos, pintura al óleo'"
                                        className="w-full h-16 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="style" value={enhancementStylePrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Negativo/Evitar (Opcional)</label>
                                    <textarea
                                        value={enhancementNegativePrompt}
                                        onChange={(e) => setEnhancementNegativePrompt(e.target.value)}
                                        placeholder="Ej: 'borroso, baja resolución, texto, marcas de agua'"
                                        className="w-full h-16 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="negative" value={enhancementNegativePrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Creatividad: {enhancementCreativity}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="150"
                                        value={enhancementCreativity}
                                        onChange={(e) => setEnhancementCreativity(parseInt(e.target.value))}
                                        className="w-full"
                                        disabled={isEnhancing}
                                    />
                                    <div className="flex justify-between text-xs text-theme-text-secondary mt-1">
                                        <span>Fiel</span>
                                        <span>Equilibrado</span>
                                        <span>Imaginativo</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between py-1">
                                    <label htmlFor="chroma-key-toggle" className="text-xs font-bold text-theme-text-secondary">
                                        Forzar Fondo Chroma
                                    </label>
                                    <button
                                        id="chroma-key-toggle"
                                        role="switch"
                                        aria-checked={isChromaKeyEnabled}
                                        onClick={() => setIsChromaKeyEnabled(prev => !prev)}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent-primary focus:ring-offset-theme-bg-primary ${isChromaKeyEnabled ? 'bg-theme-accent-primary' : 'bg-theme-bg-tertiary'}`}
                                        disabled={isEnhancing}
                                    >
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isChromaKeyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {isChromaKeyEnabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setEnhancementChromaKey('green')} disabled={isEnhancing} className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'green' ? 'bg-green-600 text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}>Verde</button>
                                        <button onClick={() => setEnhancementChromaKey('blue')} disabled={isEnhancing} className={`text-xs p-2 rounded transition-colors ${enhancementChromaKey === 'blue' ? 'bg-blue-600 text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}>Azul</button>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="add-to-canvas" className="ml-2 text-xs text-theme-text-secondary">Añadir a Canvas</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="add-to-library"
                                            checked={shouldAddToLibrary}
                                            onChange={(e) => setShouldAddToLibrary(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="add-to-library" className="ml-2 text-xs text-theme-text-secondary">Añadir a Librería</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="remove-content"
                                            checked={shouldRemoveContent}
                                            onChange={(e) => setShouldRemoveContent(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="remove-content" className="ml-2 text-xs text-theme-text-secondary">Quitar Contenido</label>
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
                                            <span className="text-xs text-theme-text-secondary">Generando vista previa...</span>
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
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Descripción de la Composición</label>
                                    <textarea
                                        value={compositionPrompt}
                                        onChange={(e) => setCompositionPrompt(e.target.value)}
                                        placeholder="Describe la escena completa..."
                                        className="w-full h-24 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={compositionPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Referencia de Estilo (Opcional)</label>
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
                                            className="text-xs text-theme-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-theme-bg-tertiary file:text-theme-text-primary hover:file:bg-theme-bg-hover"
                                            disabled={isEnhancing}
                                        />
                                        {styleRef && (
                                            <button onClick={() => setStyleRef(null)} className="text-red-500 hover:text-red-400">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {styleRef && <div className="mt-2 h-20 w-full bg-cover bg-center rounded-md border border-theme-bg-tertiary" style={{ backgroundImage: `url(${styleRef.url})` }}></div>}
                                </div>

                                <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-update-bg"
                                            checked={shouldUpdateBackground}
                                            onChange={(e) => setShouldUpdateBackground(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-update-bg" className="ml-2 text-xs text-theme-text-secondary">Reemplazar Fondo</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-add-to-canvas" className="ml-2 text-xs text-theme-text-secondary">Añadir como Capa</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="comp-remove-content"
                                            checked={shouldRemoveContent}
                                            onChange={(e) => setShouldRemoveContent(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="comp-remove-content" className="ml-2 text-xs text-theme-text-secondary">Quitar Contenido Usado</label>
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
                                    disabled={isEnhancing}
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
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Descripción Libre</label>
                                    <textarea
                                        value={freeFormPrompt}
                                        onChange={(e) => setFreeFormPrompt(e.target.value)}
                                        placeholder="Describe lo que quieres generar..."
                                        className="w-full h-24 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none"
                                        disabled={isEnhancing}
                                    />
                                    <PromptManager type="description" value={freeFormPrompt} savePrompt={savePrompt} setPromptLoader={setPromptLoader} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-2">Elementos (Opcional)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['main', 'a', 'b', 'c'] as const).map((slot) => (
                                            <div key={slot} className="border border-theme-bg-tertiary rounded p-2 bg-theme-bg-secondary">
                                                <span className="text-[10px] text-theme-text-secondary uppercase font-bold block mb-1">{slot === 'main' ? 'Principal' : `Ranura ${slot.toUpperCase()}`}</span>
                                                {freeFormSlots[slot] ? (
                                                    <div className="relative group aspect-square bg-theme-bg-tertiary rounded overflow-hidden">
                                                        <img src={freeFormSlots[slot]!.url} alt={slot} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => setFreeFormSlots({ ...freeFormSlots, [slot]: null })}
                                                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                        >
                                                            <XIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center aspect-square bg-theme-bg-tertiary rounded cursor-pointer hover:bg-theme-bg-hover transition-colors">
                                                        <UploadIcon className="w-5 h-5 text-theme-text-secondary mb-1" />
                                                        <span className="text-[10px] text-theme-text-secondary">Subir</span>
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
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="free-add-to-canvas" className="ml-2 text-xs text-theme-text-secondary">Añadir a Canvas</label>
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

                        {/* Sketch Tab Implementation */}
                        {activeAiTab === 'sketch' && (
                            <div className="space-y-4">
                                <div className="rounded-md p-2 aspect-video flex items-center justify-center bg-gray-800 border border-gray-700">
                                    {!enhancementPreview ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-theme-text-secondary">Generando vista previa...</span>
                                        </div>
                                    ) : (
                                        <img
                                            src={enhancementPreview.fullDataUrl}
                                            alt="Sketch Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                </div>

                                <div className="p-3 bg-theme-bg-secondary rounded-md text-xs text-theme-text-secondary border border-theme-bg-tertiary">
                                    Transforma tu lienzo actual en una pintura de acuarela o dibujo artístico basado en tus ajustes.
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Carga de Agua (Estilo): {sketchWaterLevel}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={sketchWaterLevel}
                                        onChange={(e) => setSketchWaterLevel(parseInt(e.target.value))}
                                        className="w-full accent-theme-accent-primary"
                                        disabled={isEnhancing}
                                    />
                                    <div className="flex justify-between text-xs text-theme-text-secondary mt-1">
                                        <span>Seco (Lápiz)</span>
                                        <span>Mojado (Acuarela)</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Nivel de Detalle: {sketchDetailLevel}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={sketchDetailLevel}
                                        onChange={(e) => setSketchDetailLevel(parseInt(e.target.value))}
                                        className="w-full accent-theme-accent-primary"
                                        disabled={isEnhancing}
                                    />
                                    <div className="flex justify-between text-xs text-theme-text-secondary mt-1">
                                        <span>Minimalista</span>
                                        <span>Hiperrealista</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-1">Instrucciones Adicionales (Opcional)</label>
                                    <textarea
                                        value={sketchUserInstruction}
                                        onChange={(e) => setSketchUserInstruction(e.target.value)}
                                        placeholder="Ej: 'Añade un tono más azulado al cielo', 'Usa colores cálidos del atardecer'."
                                        className="w-full h-16 p-2 bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md resize-none focus:ring-1 focus:ring-theme-accent-primary focus:outline-none"
                                        disabled={isEnhancing}
                                    />
                                </div>

                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="sketch-add-to-canvas"
                                            checked={shouldAddToCanvas}
                                            onChange={(e) => setShouldAddToCanvas(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded accent-theme-accent-primary"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="sketch-add-to-canvas" className="ml-2 text-xs text-theme-text-secondary">Añadir a Canvas</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="sketch-add-to-library"
                                            checked={shouldAddToLibrary}
                                            onChange={(e) => setShouldAddToLibrary(e.target.checked)}
                                            className="h-4 w-4 bg-theme-bg-tertiary border-theme-bg-hover rounded accent-theme-accent-primary"
                                            disabled={isEnhancing}
                                        />
                                        <label htmlFor="sketch-add-to-library" className="ml-2 text-xs text-theme-text-secondary">Añadir a Librería</label>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onEnhance({
                                        activeAiTab,
                                        sketchWaterLevel,
                                        sketchDetailLevel,
                                        sketchUserInstruction,
                                        shouldAddToLibrary,
                                        shouldAddToCanvas
                                    })}
                                    disabled={isEnhancing}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg transition-all transform active:scale-95"
                                >
                                    {isEnhancing ? 'Pintando...' : 'Generar Acuarela'}
                                </button>
                            </div>
                        )}

                        {/* Upscale Tab Implementation */}
                        {activeAiTab === 'upscale' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-theme-bg-secondary rounded-md border border-theme-bg-tertiary text-sm text-theme-text-secondary">
                                    <p className="mb-2"><strong>Modo Escalado 4K</strong></p>
                                    <p>Este modo generará una versión de súper alta resolución (aprox 4K) de tu composición actual.</p>
                                    <p className="mt-2 text-xs opacity-70">Nota: La IA realizará una "remasterización creativa", mejorando detalles y texturas manteniendo la estructura original.</p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-2">Formato de Descarga</label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setUpscaleFormat('png')}
                                            className={`flex-1 py-2 px-4 rounded border ${upscaleFormat === 'png' ? 'bg-theme-accent-primary text-white border-theme-accent-primary' : 'bg-theme-bg-tertiary border-theme-bg-tertiary hover:bg-theme-bg-hover'}`}
                                        >
                                            PNG
                                        </button>
                                        <button
                                            onClick={() => setUpscaleFormat('jpg')}
                                            className={`flex-1 py-2 px-4 rounded border ${upscaleFormat === 'jpg' ? 'bg-theme-accent-primary text-white border-theme-accent-primary' : 'bg-theme-bg-tertiary border-theme-bg-tertiary hover:bg-theme-bg-hover'}`}
                                        >
                                            JPG
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-xs font-bold text-theme-text-secondary block mb-2">Creatividad de Escalado: {upscaleCreativity}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="150"
                                        value={upscaleCreativity}
                                        onChange={(e) => setUpscaleCreativity(parseInt(e.target.value))}
                                        className="w-full"
                                        disabled={isEnhancing}
                                    />
                                    <div className="flex justify-between text-xs text-theme-text-secondary mt-1">
                                        <span>Fiel (0)</span>
                                        <span>Equilibrado (75)</span>
                                        <span>Imaginativo (150)</span>
                                    </div>
                                    <p className="text-xs text-theme-text-secondary opacity-70 mt-2 mb-4">
                                        <strong>0-30:</strong> Solo enfoca. <strong>30-100:</strong> Añade detalle. <strong>100+:</strong> Reinterpreta texturas.
                                    </p>
                                </div>

                                <button
                                    onClick={() => onEnhance({ activeAiTab, upscaleFormat, upscaleCreativity })}
                                    disabled={isEnhancing}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {isEnhancing ? 'Escalando...' : `Escalar a 4K y Descargar (${upscaleFormat.toUpperCase()})`}
                                </button>
                            </div>
                        )}
                        <AIPreviewPanel debugInfo={debugInfo} />
                    </div>
                </div>
            </div>

            {/* Prompt Loader Popover */}
            {promptLoader.openFor && promptLoader.anchorEl && (
                <div
                    ref={promptLoaderRef}
                    className="absolute z-[60] bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-lg w-64 max-h-60 overflow-y-auto"
                    style={{
                        left: promptLoader.anchorEl.getBoundingClientRect().right + 8,
                        top: promptLoader.anchorEl.getBoundingClientRect().top
                    }}
                >
                    <ul className="p-1">
                        {savedPrompts[promptLoader.openFor].length > 0 ? (
                            savedPrompts[promptLoader.openFor].map((prompt, i) => (
                                <li key={i} className="group flex items-center justify-between text-sm text-theme-text-primary rounded-md hover:bg-theme-bg-hover">
                                    <button onClick={() => loadPrompt(promptLoader.openFor!, prompt)} className="flex-grow text-left p-2 truncate">
                                        {prompt}
                                    </button>
                                    <button onClick={() => deletePrompt(promptLoader.openFor!, prompt)} className="p-2 text-theme-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li className="p-2 text-center text-xs text-theme-text-secondary">No hay prompts guardados.</li>
                        )}
                    </ul>
                </div>
            )}
        </>
    );
};
