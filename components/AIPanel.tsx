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
        enhancementTextOnly, setEnhancementTextOnly,
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
            <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
                <div ref={panelRef} className="bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-lg w-[500px] max-h-[90vh] flex flex-col pointer-events-auto">
                    <div className="flex-shrink-0 p-4 border-b border-theme-bg-tertiary flex justify-between items-center">
                        <h4 className="text-sm font-bold uppercase text-theme-text-secondary">Crear Objeto</h4>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-hover">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {/* Object Creation Mode */}
                        <div className="space-y-4">
                            <div style={{ backgroundColor: enhancementPreviewBgColor }} className="rounded-md p-2 aspect-video flex items-center justify-center relative overflow-hidden">
                                {enhancementTextOnly ? (
                                    <div className="flex flex-col items-center justify-center h-full w-full text-center p-4">
                                        <SparklesIcon className="w-8 h-8 text-theme-accent-primary mb-2 opacity-50" />
                                        <span className="text-xs font-bold text-theme-text-primary">Modo Generación desde Cero</span>
                                        <span className="text-[10px] text-theme-text-secondary mt-1">La IA creará una imagen basada únicamente en tu descripción.</span>
                                    </div>
                                ) : !enhancementPreview ? (
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

                            <div className="flex items-center justify-between py-1 border-b border-theme-bg-tertiary pb-2 mb-2">
                                <label htmlFor="text-only-toggle" className="text-xs font-bold text-theme-text-secondary">
                                    Solo Texto (Sin Imagen Base)
                                </label>
                                <button
                                    id="text-only-toggle"
                                    role="switch"
                                    aria-checked={enhancementTextOnly}
                                    onClick={() => setEnhancementTextOnly(prev => !prev)}
                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent-primary focus:ring-offset-theme-bg-primary ${enhancementTextOnly ? 'bg-theme-accent-primary' : 'bg-theme-bg-tertiary'}`}
                                    disabled={isEnhancing}
                                >
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enhancementTextOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {!enhancementTextOnly && (
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
                            )}

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
                                    activeAiTab: 'object',
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
                                    enhancementTextOnly,
                                })}
                                disabled={!enhancementPrompt.trim() || !enhancementStylePrompt.trim() || isEnhancing}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 text-sm rounded-md disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {isEnhancing ? 'Generando...' : 'Generar'}
                            </button>
                        </div>
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
