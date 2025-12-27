import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PhotoIcon, SparklesIcon, UploadIcon, UndoIcon, RedoIcon, SaveIcon, XIcon as CloseIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon, FolderOpenIcon, GalleryIcon, ChevronDownIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { buildArchitecturalPrompt, ArchitecturalRenderOptions, SceneType, RenderStyleMode } from '../utils/architecturalPromptBuilder';
import { prepareVisualPromptingRequest, Region, buildVisualPrompt } from '../services/visualPromptingService';
import { LayeredCanvas, LayeredCanvasRef } from './visual-prompting/LayeredCanvas';
import { VisualPromptingControls } from './visual-prompting/VisualPromptingControls';
import { GEMINI_MODEL_ID } from '../utils/constants';


interface ArchitecturalRenderViewProps {
    onImportFromSketch: () => string | null; // Returns dataURL or null
    isSidebarOpen: boolean;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onRenderComplete?: (dataUrl: string) => void;
    onInspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>;
    credits: number | null;
    deductCredit?: () => Promise<boolean>;
    onSaveToLibrary?: (file: File) => void;
    // New: Model Selection
    selectedModel: string;
    onOpenLibrary: () => void;
}



const XIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);


const CollapsiblePillGroup: React.FC<{ label: string, options: { label: string, value: string }[], value: string, onChange: (val: string) => void }> = ({ label, options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div className="border border-theme-bg-tertiary rounded-lg overflow-hidden transition-all bg-theme-bg-primary">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-theme-bg-tertiary/30 hover:bg-theme-bg-tertiary/50 transition-colors"
            >
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-wider">{label}</span>
                    {!isOpen && <span className="text-[10px] font-medium text-theme-accent-primary truncate max-w-[180px]">{selectedLabel}</span>}
                </div>
                {/* Chevron */}
                <svg className={`w-3 h-3 text-theme-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="p-2 bg-theme-bg-primary border-t border-theme-bg-tertiary">
                    <div className="flex flex-wrap gap-1.5">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all flex-grow text-center ${value === opt.value
                                    ? 'bg-theme-text-primary text-theme-bg-primary border-theme-text-primary'
                                    : 'bg-transparent text-theme-text-secondary border-theme-bg-tertiary hover:border-theme-text-secondary'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export interface ArchitecturalRenderViewHandle {
    setInputImageFromFile: (file: File) => void;
    setInputImage: (url: string) => void;
    handleLocalUndo: () => void;
    handleLocalRedo: () => void;
    getFullState: () => any;
    setFullState: (state: any) => Promise<void>;
}

export const ArchitecturalRenderView = React.memo(React.forwardRef<ArchitecturalRenderViewHandle, ArchitecturalRenderViewProps>(({
    onImportFromSketch,
    isSidebarOpen,
    onRenderComplete,
    onInspectRequest,
    credits,
    deductCredit,
    onSaveToLibrary,
    selectedModel,
    onOpenLibrary
}, ref) => {
    const [sceneType, setSceneType] = useState<SceneType>('exterior');
    const [inputImage, setInputImageState] = useState<string | null>(null); // Renamed to avoid conflict

    const [creativeFreedom, setCreativeFreedom] = useState(50);
    const [additionalPrompt, setAdditionalPrompt] = useState('');
    const [manualPrompt, setManualPrompt] = useState('');
    const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
    const [vpGeneralInstructions, setVpGeneralInstructions] = useState('');
    const [vpReferenceImage, setVpReferenceImage] = useState<string | null>(null);
    const [aiStructuredPrompt, setAiStructuredPrompt] = useState('');
    const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
    const [regions, setRegions] = useState<Region[]>([]);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 1024, height: 1024 });

    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false);

    // -- local History State for Generations --
    interface HistoryEntry {
        input: string | null;
        result: string | null;
        regions: Region[];
        manualPrompt: string;
        additionalPrompt: string;
        vpGeneralInstructions: string;
        isPromptManuallyEdited: boolean;
    }

    const [generationHistory, setGenerationHistory] = useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showImportMenu, setShowImportMenu] = useState(false);

    const pushToHistory = useCallback((customState?: Partial<HistoryEntry>) => {
        const entry: HistoryEntry = {
            input: customState?.input !== undefined ? customState.input : inputImage,
            result: customState?.result !== undefined ? customState.result : resultImage,
            regions: customState?.regions !== undefined ? [...customState.regions] : [...regions],
            manualPrompt: customState?.manualPrompt !== undefined ? customState.manualPrompt : manualPrompt,
            additionalPrompt: customState?.additionalPrompt !== undefined ? customState.additionalPrompt : additionalPrompt,
            vpGeneralInstructions: customState?.vpGeneralInstructions !== undefined ? customState.vpGeneralInstructions : vpGeneralInstructions,
            isPromptManuallyEdited: customState?.isPromptManuallyEdited !== undefined ? customState.isPromptManuallyEdited : isPromptManuallyEdited
        };

        setGenerationHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, entry];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex, inputImage, resultImage, regions, manualPrompt, additionalPrompt, vpGeneralInstructions, isPromptManuallyEdited]);

    // Initialize history once there is an initial input or component mounts
    useEffect(() => {
        if (generationHistory.length === 0) {
            const initialEntry: HistoryEntry = {
                input: inputImage,
                result: resultImage,
                regions: [...regions],
                manualPrompt,
                additionalPrompt,
                vpGeneralInstructions,
                isPromptManuallyEdited
            };
            setGenerationHistory([initialEntry]);
            setHistoryIndex(0);
        }
    }, []);

    const handleLocalUndo = useCallback(() => {
        if (historyIndex > 0) {
            const prev = generationHistory[historyIndex - 1];
            setInputImageState(prev.input);
            setResultImage(prev.result);
            setRegions([...prev.regions]);
            setManualPrompt(prev.manualPrompt);
            setAdditionalPrompt(prev.additionalPrompt);
            setVpGeneralInstructions(prev.vpGeneralInstructions);
            setIsPromptManuallyEdited(prev.isPromptManuallyEdited);
            setHistoryIndex(prevIdx => prevIdx - 1);
        }
    }, [historyIndex, generationHistory]);

    const handleLocalRedo = useCallback(() => {
        if (historyIndex < generationHistory.length - 1) {
            const next = generationHistory[historyIndex + 1];
            setInputImageState(next.input);
            setResultImage(next.result);
            setRegions([...next.regions]);
            setManualPrompt(next.manualPrompt);
            setAdditionalPrompt(next.additionalPrompt);
            setVpGeneralInstructions(next.vpGeneralInstructions);
            setIsPromptManuallyEdited(next.isPromptManuallyEdited);
            setHistoryIndex(prev => prev + 1);
        }
    }, [historyIndex, generationHistory]);

    // Wrapper for setInputImageState to handle common side effects
    // Hard reset for new projects/imports
    const resetWithNewInput = useCallback((dataUrl: string | null, shouldPushToHistory: boolean = false) => {
        if (!shouldPushToHistory) {
            setGenerationHistory([]);
            setHistoryIndex(-1);
            // Re-initialization will be handled by useEffect or manually below
        }

        setInputImageState(dataUrl);
        setResultImage(null);
        setShowOriginal(false);
        // CRITICAL: Clear spatial context to avoid "ghost" references to old images
        setRegions([]);
        setManualPrompt('');
        setAdditionalPrompt('');
        setVpGeneralInstructions('');
        setVpReferenceImage(null);
        setStyleReferenceImage(null);
        setIsPromptManuallyEdited(false);
        canvasRef.current?.clearDrawing();

        if (shouldPushToHistory) {
            pushToHistory({
                input: dataUrl,
                result: null,
                regions: [],
                manualPrompt: '',
                additionalPrompt: '',
                vpGeneralInstructions: '',
                isPromptManuallyEdited: false
            });
        }
    }, [pushToHistory]);

    const processInputImage = useCallback((file: File, isPaste: boolean = false) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const result = e.target.result as string;
                const img = new Image();
                img.onload = () => {
                    // Max dimension 2048 for high-quality iterative cycles
                    let w = img.width;
                    let h = img.height;
                    const maxSize = 2048;
                    if (w > maxSize || h > maxSize) {
                        if (w > h) { h = (h / w) * maxSize; w = maxSize; }
                        else { w = (w / h) * maxSize; h = maxSize; }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, w, h);
                        const bakedUrl = canvas.toDataURL('image/png'); // Strip EXIF
                        setCanvasDimensions({ width: w, height: h });
                        resetWithNewInput(bakedUrl, isPaste); // Preserve history if it's a paste/import
                    }
                };
                img.src = result;
            }
        };
        reader.readAsDataURL(file);
    }, [resetWithNewInput]);

    const handleClearAllAnnotations = useCallback(() => {
        if (window.confirm('¿Estás seguro de que deseas borrar todas las anotaciones (dibujos y regiones)?')) {
            setRegions([]);
            canvasRef.current?.clearDrawing();
        }
    }, [setRegions]);

    useImperativeHandle(ref, () => ({
        setInputImageFromFile: (file: File) => {
            processInputImage(file, true); // Treat internal file setting as "undoable" action
        },
        setInputImage: (url: string) => {
            resetWithNewInput(url, true); // Treat programmatic setting as "undoable" action
        },
        handleLocalUndo,
        handleLocalRedo,
        getFullState: () => {
            return {
                inputImage,
                resultImage,
                styleReferenceImage,
                renderStyle,
                sceneType,
                timeOfDay,
                weather,
                archStyle,
                roomType,
                lighting,
                studioLighting,
                studioBackground,
                studioShot,
                carAngle,
                carEnvironment,
                carColor,
                objectMaterial,
                objectDoF,
                objectContext,
                creativeFreedom,
                additionalPrompt,
                manualPrompt,
                savedPrompts,
                regions,
                vpGeneralInstructions,
                vpReferenceImage,
                aiStructuredPrompt,
                isPromptManuallyEdited,
                drawingData: canvasRef.current?.getDrawingDataUrl(),
                generationHistory,
                historyIndex
            };
        },
        setFullState: async (state: any) => {
            if (!state) return;
            setInputImageState(state.inputImage);
            setResultImage(state.resultImage);
            setStyleReferenceImage(state.styleReferenceImage);
            if (state.renderStyle) setRenderStyle(state.renderStyle);
            if (state.sceneType) setSceneType(state.sceneType);
            if (state.timeOfDay) setTimeOfDay(state.timeOfDay);
            if (state.weather) setWeather(state.weather);
            if (state.archStyle) setArchStyle(state.archStyle);
            if (state.roomType) setRoomType(state.roomType);
            if (state.lighting) setLighting(state.lighting);
            if (state.studioLighting) setStudioLighting(state.studioLighting);
            if (state.studioBackground) setStudioBackground(state.studioBackground);
            if (state.studioShot) setStudioShot(state.studioShot);
            if (state.carAngle) setCarAngle(state.carAngle);
            if (state.carEnvironment) setCarEnvironment(state.carEnvironment);
            if (state.carColor) setCarColor(state.carColor);
            if (state.objectMaterial) setObjectMaterial(state.objectMaterial);
            if (state.objectDoF) setObjectDoF(state.objectDoF);
            if (state.objectContext) setObjectContext(state.objectContext);
            if (state.creativeFreedom !== undefined) setCreativeFreedom(state.creativeFreedom);
            if (state.additionalPrompt !== undefined) setAdditionalPrompt(state.additionalPrompt);
            if (state.manualPrompt !== undefined) setManualPrompt(state.manualPrompt);
            if (state.savedPrompts) setSavedPrompts(state.savedPrompts);
            if (state.regions) setRegions(state.regions);
            if (state.vpGeneralInstructions !== undefined) setVpGeneralInstructions(state.vpGeneralInstructions);
            if (state.vpReferenceImage !== undefined) setVpReferenceImage(state.vpReferenceImage);
            if (state.aiStructuredPrompt !== undefined) setAiStructuredPrompt(state.aiStructuredPrompt);
            if (state.isPromptManuallyEdited !== undefined) setIsPromptManuallyEdited(state.isPromptManuallyEdited);
            if (state.generationHistory) setGenerationHistory(state.generationHistory);
            if (state.historyIndex !== undefined) setHistoryIndex(state.historyIndex);

            if (state.drawingData) {
                // Wait for dimensions to settle or force them
                setTimeout(() => {
                    canvasRef.current?.loadDrawingDataUrl(state.drawingData);
                }, 100);
            }
        }
    }));

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processInputImage(file);
        }
    };
    const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);

    // -- Visual Prompting State --
    // Collapsed by default
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
    const [lastGuideImage, setLastGuideImage] = useState<string | null>(null); // To debug what we sent
    const [lastSentPrompt, setLastSentPrompt] = useState<string | null>(null); // To debug exact text sent
    const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'region' | 'polygon' | 'pan'>('pan');
    const [brushSize, setBrushSize] = useState(5);
    const [brushColor, setBrushColor] = useState('#FF0000');

    // Canvas Refs
    const canvasRef = useRef<LayeredCanvasRef>(null);

    // -- Mutually Exclusive Panels Logic --
    // If the main Sidebar (Architectural Config) is opened, we should close the Visual Prompting panel to avoid UI clutter
    // and signal that the user is focused on the Classic workflow.
    useEffect(() => {
        if (isSidebarOpen) {
            setIsLeftPanelOpen(false);
        }
    }, [isSidebarOpen]);

    // -- Form State --
    const [renderStyle, setRenderStyle] = useState<RenderStyleMode>('photorealistic'); // NEW: Global Render Style

    // Exterior/Interior States
    const [timeOfDay, setTimeOfDay] = useState('noon');
    const [weather, setWeather] = useState('sunny');
    const [archStyle, setArchStyle] = useState('modern'); // Now purely "Subject Style"
    const [roomType, setRoomType] = useState('living_room');
    const [lighting, setLighting] = useState('natural');

    // New Scene States
    const [studioLighting, setStudioLighting] = useState('softbox');
    const [studioBackground, setStudioBackground] = useState('infinity_white');
    const [studioShot, setStudioShot] = useState('full_shot'); // NEW

    const [carAngle, setCarAngle] = useState('front_three_quarter');
    const [carEnvironment, setCarEnvironment] = useState('studio');
    const [carColor, setCarColor] = useState('none'); // NEW

    const [objectMaterial, setObjectMaterial] = useState('matte_plastic');
    const [objectDoF, setObjectDoF] = useState('macro_focus');
    const [objectContext, setObjectContext] = useState('table_top'); // NEW

    // -- Refs for Handler Access (Closure Fix) --
    const resultImageRef = useRef<string | null>(null);
    const inputImageRef = useRef<string | null>(null);

    // ... (rest of state)

    useEffect(() => {
        // Sync Ref for Input Image
        inputImageRef.current = inputImage;

        // Update Canvas Dimensions when Input Image changes
        if (inputImage) {
            const img = new Image();
            img.onload = () => {
                setCanvasDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.src = inputImage;
        }
    }, [inputImage]);

    // Upscale State
    const [isUpscaling, setIsUpscaling] = useState(false);

    // -- Unified Result Handling --
    const updateResult = useCallback((newResult: string) => {
        const imgResult = new Image();
        imgResult.onload = () => {
            if (imgResult.naturalWidth && imgResult.naturalHeight) {
                setCanvasDimensions({ width: imgResult.naturalWidth, height: imgResult.naturalHeight });
            }
            setResultImage(newResult);
            if (onRenderComplete) onRenderComplete(newResult);
        };
        imgResult.src = newResult;
    }, [onRenderComplete]);

    // -- Failsafe: Sync dimensions with displayed image --
    const displayedImage = showOriginal ? inputImage : (resultImage || inputImage);
    useEffect(() => {
        if (displayedImage) {
            const img = new Image();
            img.onload = () => {
                if (img.naturalWidth !== canvasDimensions.width || img.naturalHeight !== canvasDimensions.height) {
                    setCanvasDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }
            };
            img.src = displayedImage;
        }
    }, [displayedImage, canvasDimensions.width, canvasDimensions.height]);

    // Keyboard Listeners removed here, handled globally in App.tsx

    // Navigation State
    const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    // Sync AI Structured Prompt
    useEffect(() => {
        if (!isPromptManuallyEdited) {
            const hasVisualEdits = regions.length > 0;
            // Determine mode for preview
            const mode = resultImage ? 'edit' : 'render';

            const payload = {
                baseImage: '', // Not needed for prompt text
                layersImage: '',
                regions,
                globalPrompt: manualPrompt,
                globalInstructions: vpGeneralInstructions,
                width: 1024,
                height: 1024,
                mode: mode as 'edit' | 'render'
            };

            const generated = buildVisualPrompt(payload);
            setAiStructuredPrompt(generated);
        }
    }, [regions, vpGeneralInstructions, manualPrompt, resultImage, isPromptManuallyEdited]);

    // Fit to Screen Logic
    const fitToScreen = useCallback(() => {
        if (!viewportRef.current || canvasDimensions.width === 0 || canvasDimensions.height === 0) return;

        const containerWidth = viewportRef.current.clientWidth;
        const containerHeight = viewportRef.current.clientHeight;
        const padding = 40;

        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        if (availableWidth <= 0 || availableHeight <= 0) return;

        const scaleX = availableWidth / canvasDimensions.width;
        const scaleY = availableHeight / canvasDimensions.height;

        // Use the smaller scale to fit entirely
        // Cap max initial zoom to 1.5 to avoid pixelation on small images, but allow shrink
        const newZoom = Math.min(scaleX, scaleY, 1.5);

        const centerX = (containerWidth - canvasDimensions.width * newZoom) / 2;
        const centerY = (containerHeight - canvasDimensions.height * newZoom) / 2;

        setTransform({ zoom: newZoom, x: centerX, y: centerY });
    }, [canvasDimensions]);

    // Trigger Fit on Load/Resize
    useEffect(() => {
        if (inputImage) {
            // Tiny delay to ensure layout is computed
            const timer = setTimeout(fitToScreen, 100);
            return () => clearTimeout(timer);
        }
    }, [inputImage, fitToScreen]);

    // Resize Observer for Panel Toggle
    useEffect(() => {
        if (!viewportRef.current) return;

        const observer = new ResizeObserver(() => {
            fitToScreen();
        });

        observer.observe(viewportRef.current);

        return () => observer.disconnect();
    }, [fitToScreen]);

    // Load saved prompts on mount
    useEffect(() => {
        const saved = localStorage.getItem('archrender_saved_prompts');
        if (saved) {
            try {
                setSavedPrompts(JSON.parse(saved));
            } catch (e) { console.error("Failed to load prompts", e); }
        }
    }, []);

    // Update Manual Prompt when options change
    // Update Manual Prompt when options change
    useEffect(() => {
        const renderOptions: ArchitecturalRenderOptions = {
            sceneType,
            renderStyle, // Pass new render style
            creativeFreedom,
            additionalPrompt,
            archStyle,
            hasStyleReference: !!styleReferenceImage,
            ...(sceneType === 'exterior' && { timeOfDay, weather }),
            ...(sceneType === 'interior' && { roomType, lighting }),
            ...(sceneType === 'studio' && { studioLighting, studioBackground, studioShot }),
            ...(sceneType === 'automotive' && { carAngle, carEnvironment, carColor }),
            ...((sceneType === 'object_interior' || sceneType === 'object_exterior') && { objectMaterial, objectDoF, objectContext }),
        };
        const generatedPrompt = buildArchitecturalPrompt(renderOptions);
        setManualPrompt(generatedPrompt);
    }, [sceneType, renderStyle, creativeFreedom, additionalPrompt, archStyle, timeOfDay, weather, roomType, lighting, styleReferenceImage, studioLighting, studioBackground, studioShot, carAngle, carEnvironment, carColor, objectMaterial, objectDoF, objectContext]);

    // Sync Refs
    useEffect(() => {
        resultImageRef.current = resultImage;
    }, [resultImage]);

    useEffect(() => {
        inputImageRef.current = inputImage;
    }, [inputImage]);

    // Live Preview of Visual Prompt
    useEffect(() => {
        // Construct a dummy payload to preview the text
        const payload = {
            baseImage: '', // Not needed for text prompt
            layersImage: '',
            regions,
            globalPrompt: manualPrompt,
            globalInstructions: vpGeneralInstructions,
            globalReferenceImage: vpReferenceImage || undefined,
            width: 0,
            height: 0
        };
        const previewText = buildVisualPrompt(payload);

        // Append implicit reference notes (logic duplicated from service for UI preview)
        let fullPreview = previewText;
        if (vpGeneralInstructions) {
            fullPreview += `\n\nGeneral Guidelines: ${vpGeneralInstructions}`;
        }
        if (vpReferenceImage) {
            fullPreview += `\n\n(Note: A Global Reference Image has been attached...)`;
        }
        const regionsWithRefs = regions.filter(r => r.referenceImage);
        if (regionsWithRefs.length > 0) {
            fullPreview += `\n\n(Note: Specific Reference Images attached for: ${regionsWithRefs.map(r => `R${r.regionNumber}`).join(', ')}...)`;
        }

        // Only update if we haven't sent a real one yet, OR if we want live preview to override
        // Let's make "lastSentPrompt" actually be "what is currently shown".
        // If isGenerating is true, maybe don't update? No, user might edit while generating (bad idea but possible).
        if (!isGenerating) {
            setLastSentPrompt(fullPreview);
        }
    }, [manualPrompt, regions, vpGeneralInstructions, vpReferenceImage, isGenerating]);


    const handleSavePrompt = () => {
        if (!manualPrompt.trim()) return;
        const newPrompts = [...savedPrompts, manualPrompt];
        setSavedPrompts(newPrompts);
        localStorage.setItem('archrender_saved_prompts', JSON.stringify(newPrompts));
        alert("Prompt guardado");
    };

    const handleLoadPrompt = (prompt: string) => {
        setManualPrompt(prompt);
    };

    const handleClearSavedPrompts = () => {
        if (confirm("¿Borrar todos los prompts guardados?")) {
            setSavedPrompts([]);
            localStorage.removeItem('archrender_saved_prompts');
        }
    };

    const resetView = () => setTransform({ zoom: 1, x: 0, y: 0 });

    const handleImport = () => {
        const dataUrl = onImportFromSketch();
        if (dataUrl) {
            const img = new Image();
            img.onload = () => {
                // Max dimension 2048 (consistent with upload)
                let w = img.width;
                let h = img.height;
                const maxDim = 2048;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = (h / w) * maxDim; w = maxDim; }
                    else { w = (w / h) * maxDim; h = maxDim; }
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    const bakedUrl = canvas.toDataURL('image/png');
                    setCanvasDimensions({ width: w, height: h });
                    resetWithNewInput(bakedUrl);
                }
            };
            img.src = dataUrl;
        } else {
            alert("No hay contenido visible en el sketch para importar.");
        }
    };



    const handleStyleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setStyleReferenceImage(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleReset = () => {
        if (confirm("¿Estás seguro de que quieres limpiar todo y restablecer la configuración?")) {
            resetWithNewInput(null);
            setStyleReferenceImage(null);
            setShowOriginal(false);
            setAdditionalPrompt('');
            setCreativeFreedom(50);
            setTimeOfDay('noon');
            setWeather('sunny');
            setArchStyle('modern');
            setRoomType('living_room');
            setLighting('natural');
            setRegions([]); // Clear Regions
            canvasRef.current?.clearDrawing(); // Clear drawings
            setGenerationHistory([]);
            setHistoryIndex(-1);
        }
    };

    // --- Visual Prompting Handlers ---
    const handleAddRegion = (data: { type: 'rectangle' | 'polygon', points?: { x: number, y: number }[], x: number, y: number, width: number, height: number }) => {
        const newRegion: Region = {
            id: Date.now().toString(),
            regionNumber: regions.length + 1,
            type: data.type,
            points: data.points,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            prompt: ''
        };
        setRegions([...regions, newRegion]);
        // Keep active to add more?
        if (!isLeftPanelOpen) setIsLeftPanelOpen(true);
    };

    const handleDeleteRegion = (id: string) => {
        const newRegions = regions.filter(r => r.id !== id).map((r, i) => ({
            ...r,
            regionNumber: i + 1 // Re-number regions
        }));
        setRegions(newRegions);
    };

    const handleUpdateRegionPrompt = (id: string, text: string) => {
        setRegions(regions.map(r => r.id === id ? { ...r, prompt: text } : r));
    };

    const handleUpdateRegionImage = (id: string, image: string | null) => {
        setRegions(regions.map(r => r.id === id ? { ...r, referenceImage: image || undefined } : r));
    };

    const handleProcessChanges = async () => {
        const currentInput = inputImageRef.current;
        const currentResult = resultImageRef.current;

        if (!currentInput && !currentResult) {
            alert("Por favor importa una imagen base primero.");
            return;
        }

        // --- Iterative Workflow: Determine Active Base Image ---
        // If "Show Original" is active, we use the original input. 
        // Otherwise, we use the previous result if it exists.
        const activeBaseImage = showOriginal ? currentInput : (currentResult || currentInput);

        if (!activeBaseImage) return;

        // Commit the active base image as the new input to avoid UI jumping/flickering
        // Use non-destructive state setter to preserve history
        if (!showOriginal && currentResult) {
            setInputImageState(currentResult);
        }

        setIsGenerating(true);
        setResultImage(null);
        setShowOriginal(false);

        try {
            // Use New Pipeline
            const layersImage = canvasRef.current?.getDrawingDataUrl() || ''; // Should get transparent png
            const visualGuideImage = await canvasRef.current?.getVisualGuideSnapshot() || '';

            const img = new Image();
            img.src = activeBaseImage;
            await img.decode();

            const payload = {
                baseImage: activeBaseImage,
                layersImage,
                visualGuideImage,
                regions,
                globalPrompt: '', // We ignore the architectural prompt for edits
                globalInstructions: vpGeneralInstructions,
                globalReferenceImage: styleReferenceImage || vpReferenceImage || undefined,
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                mode: 'edit' as const // Force Edit Mode (Preserve State)
            };

            const { contents, guideImageBase64, textPrompt } = await prepareVisualPromptingRequest(payload, import.meta.env.VITE_GEMINI_API_KEY, aiStructuredPrompt);
            setLastGuideImage(`data:image/png;base64,${guideImageBase64}`);
            setLastSentPrompt(textPrompt);

            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = selectedModel || GEMINI_MODEL_ID;
            const config = { responseModalities: ["IMAGE"] };

            if (onInspectRequest) {
                const confirmed = await onInspectRequest({ model, parts: contents.parts, config });
                if (!confirmed) {
                    setIsGenerating(false);
                    return;
                }
            }

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                const newResultDataUrl = `data:image/png;base64,${newImageBase64}`;

                // --- Regional Blending (Mitigate Quality Loss) ---
                if (regions.length > 0) {
                    const baseImg = new Image();
                    baseImg.src = activeBaseImage;
                    const aiImg = new Image();
                    aiImg.src = newResultDataUrl;

                    await Promise.all([
                        new Promise(r => baseImg.onload = r),
                        new Promise(r => aiImg.onload = r)
                    ]);

                    const blendCanvas = document.createElement('canvas');
                    blendCanvas.width = baseImg.width;
                    blendCanvas.height = baseImg.height;
                    const bCtx = blendCanvas.getContext('2d');

                    if (bCtx) {
                        // 1. Draw Original (High Quality)
                        bCtx.drawImage(baseImg, 0, 0);

                        // 2. Create Mask
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = baseImg.width;
                        maskCanvas.height = baseImg.height;
                        const mCtx = maskCanvas.getContext('2d');
                        if (mCtx) {
                            mCtx.fillStyle = 'white';
                            regions.forEach(r => {
                                // Draw rectangle with slight expansion (2px) to ensure coverage
                                mCtx.fillRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4);
                            });
                            // Apply Blur for Soft Edges (Feathering)
                            mCtx.filter = 'blur(8px)';
                            mCtx.drawImage(maskCanvas, 0, 0);
                        }

                        // 3. Draw AI Result over Original using Mask
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = baseImg.width;
                        tempCanvas.height = baseImg.height;
                        const tCtx = tempCanvas.getContext('2d');
                        if (tCtx) {
                            tCtx.drawImage(aiImg, 0, 0, blendCanvas.width, blendCanvas.height);
                            tCtx.globalCompositeOperation = 'destination-in';
                            tCtx.drawImage(maskCanvas, 0, 0);

                            bCtx.drawImage(tempCanvas, 0, 0);
                        }

                        const blendedDataUrl = blendCanvas.toDataURL('image/png');
                        pushToHistory(); // Save state BEFORE updating with new result
                        setIsGenerating(false);
                        pushToHistory({ result: blendedDataUrl });
                    } else {
                        // Fallback to simple update if canvas fails
                        updateResult(newResultDataUrl);
                        setIsGenerating(false);
                        pushToHistory({ result: newResultDataUrl });
                    }
                } else {
                    // Global Edit (No Regions): Just update as usual
                    updateResult(newResultDataUrl);
                    setIsGenerating(false);
                    pushToHistory({ result: newResultDataUrl });
                }
            } else {
                alert("La IA no generó una imagen.");
            }

        } catch (error) {
            console.error("Error processing changes:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    };


    // --- AI GENERATION LOGIC ---
    const handleConvertToPhotorealistic = async () => {
        if (!inputImage) {
            alert("Por favor importa una imagen o sketch primero.");
            return;
        }

        if (credits === null) {
            alert("Debes iniciar sesión para usar la IA (2 créditos gratis).");
            return;
        }

        if (credits <= 0) {
            alert("No tienes suficientes créditos para usar la función de IA.");
            return;
        }

        setIsGenerating(true);

        const currentInput = inputImageRef.current;
        const currentResult = resultImageRef.current;

        // --- Iterative Workflow: Determine Active Base Image ---
        const activeBaseImage = showOriginal ? currentInput : (currentResult || currentInput);

        // Commit logic for consistency (non-destructive)
        if (!showOriginal && currentResult) {
            setInputImageState(currentResult);
        }

        setResultImage(null);
        setShowOriginal(false);

        try {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = selectedModel || GEMINI_MODEL_ID;

            // ... (rest of logic uses activeBaseImage)

            const parts: any[] = [];
            const inputBase64 = activeBaseImage!.split(',')[1];
            parts.push({ inlineData: { mimeType: 'image/png', data: inputBase64 } });

            if (styleReferenceImage) {
                const styleBase64 = styleReferenceImage.split(',')[1];
                parts.push({ inlineData: { mimeType: 'image/png', data: styleBase64 } });
            }
            parts.push({ text: manualPrompt });

            const contents = { parts };
            // @ts-ignore
            const config = {}; // responseModalities removed to fix "invalid argument" error

            if (onInspectRequest) {
                const confirmed = await onInspectRequest({ model, parts, config });
                if (!confirmed) {
                    setIsGenerating(false);
                    return;
                }
            }

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                if (deductCredit) await deductCredit();
                const newResultUrl = `data:image/png;base64,${newImageBase64}`;
                // 4. Update result & history
                updateResult(newResultUrl);
                setIsGenerating(false);
                pushToHistory({ result: newResultUrl });
            } else {
                alert("La IA no generó una imagen.");
            }

        } catch (error) {
            console.error("Error generating render:", error);
            alert(`Error al generar render: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpscale = async () => {
        if (!resultImage) return;

        setIsUpscaling(true);
        try {
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = GEMINI_MODEL_ID;

            const prompt = "Upscale this architectural render to 4K resolution. Enhance fine details, sharpen textures, and improve overall clarity while maintaining the exact composition and Aspect Ratio of the original image. Output as a high-fidelity photorealistic image. Do not add black bars or change the framing.";

            const base64Data = resultImage.split(',')[1];
            // @ts-ignore
            const imagePart = { inlineData: { mimeType: 'image/png', data: base64Data } };
            const textPart = { text: prompt };

            const contents = { parts: [imagePart, textPart] };
            const config = {}; // Remove problematic responseModalities

            let newImageBase64: string | null = null;
            try {
                const response = await ai.models.generateContent({ model, contents, config });
                for (const part of response.candidates?.[0]?.content.parts || []) {
                    if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
                }
            } catch (aiError) {
                console.warn("AI Upscale failed, falling back to high-quality client-side scaling:", aiError);
            }

            // --- 4K Processing (AI Result or Fallback to Original) ---
            const upscaleSource = newImageBase64 ? `data:image/png;base64,${newImageBase64}` : resultImage;

            if (newImageBase64) {
                updateResult(upscaleSource);
                pushToHistory({ result: upscaleSource });
            }

            // --- 4K Processing with Smart AR Correction ---

            // 1. Determine Original Aspect Ratio (from Canvas)
            // We STRICTLY use the canvas dimensions to ensure WYSIWYG (What You See Is What You Get).
            // If the user cropped the canvas, we want the 4K render to match that crop, not the original input file.
            const originalAR = canvasDimensions.width / canvasDimensions.height;

            const img = new Image();
            img.onload = () => {

                const MAX_DIM = 3840;
                let targetWidth, targetHeight;

                // 2. Calculate Target Dimensions (4K) based on ORIGINAL Aspect Ratio
                if (originalAR >= 1) {
                    // Landscape/Square
                    targetWidth = MAX_DIM;
                    targetHeight = Math.round(MAX_DIM / originalAR);
                } else {
                    // Portrait
                    targetHeight = MAX_DIM;
                    targetWidth = Math.round(MAX_DIM * originalAR);
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // 3. Draw using "Object Fit: Cover" logic (Center Crop)
                    // This ensures we fill the target dimensions (Original AR) without stretching the AI image.
                    const aiAR = img.naturalWidth / img.naturalHeight;

                    let renderX = 0;
                    let renderY = 0;
                    let renderW = targetWidth;
                    let renderH = targetHeight;

                    // If AI AR differs from Target AR, we need to calculate crop
                    if (Math.abs(aiAR - originalAR) > 0.01) {
                        // If AI is wider than Target -> Crop sides (Fit Height)
                        if (aiAR > originalAR) {
                            renderH = targetHeight;
                            renderW = targetHeight * aiAR;
                            renderX = (targetWidth - renderW) / 2; // Center horizontally
                        }
                        // If AI is taller than Target -> Crop top/bottom (Fit Width)
                        else {
                            renderW = targetWidth;
                            renderH = targetWidth / aiAR;
                            renderY = (targetHeight - renderH) / 2; // Center vertically
                        }
                    }

                    // Draw!
                    ctx.drawImage(img, renderX, renderY, renderW, renderH);

                    const finalDataUrl = canvas.toDataURL('image/png');

                    // --- Substitution Logic (NEW) ---
                    // After generating the 4K version, we substitute the current result in the UI
                    // so the user sees the clean/sharp version they just downloaded.
                    updateResult(finalDataUrl);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const downloadUrl = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = `Architectural_Render_4K_${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(downloadUrl);
                        }
                    }, 'image/png');
                }
            };
            img.src = upscaleSource;
        } catch (error) {
            console.error("Error upscaling:", error);
            alert("Error al escalar la imagen.");
        } finally {
            setIsUpscaling(false);
        }
    };


    const handleSaveToLibrary = async () => {
        if (!resultImage) return;

        try {
            const res = await fetch(resultImage);
            const blob = await res.blob();
            const file = new File([blob], `Render_${Date.now()}.png`, { type: 'image/png' });
            if (onSaveToLibrary) {
                onSaveToLibrary(file);
                alert("Imagen guardada en la galería.");
            }
        } catch (error) {
            console.error("Error saving to library:", error);
            alert("Error al guardar en la galería.");
        }
    };

    // -- Options Configuration --
    // -- Options Configuration --
    const timeOptions = [{ label: 'Mañana', value: 'morning' }, { label: 'Mediodía', value: 'noon' }, { label: 'Tarde', value: 'afternoon' }, { label: 'Hora Dorada', value: 'golden_hour' }, { label: 'Noche', value: 'night' }];
    const weatherOptions = [{ label: 'Soleado', value: 'sunny' }, { label: 'Nublado', value: 'overcast' }, { label: 'Lluvia', value: 'rainy' }, { label: 'Niebla', value: 'foggy' }];

    // Scene Type Options
    const sceneTypeOptions = [
        { label: 'Exterior Arquitectónico', value: 'exterior' },
        { label: 'Interior Arquitectónico', value: 'interior' },
        { label: 'Objeto (Interior)', value: 'object_interior' },
        { label: 'Objeto (Exterior)', value: 'object_exterior' },
        { label: 'Fotografía de Estudio', value: 'studio' },
        { label: 'Automotriz', value: 'automotive' },
    ];

    // Render Style Options (Technique)
    const renderStyleOptions = [
        { label: 'Fotorealista', value: 'photorealistic' },
        { label: 'Acuarela', value: 'watercolor' },
        { label: 'Lápiz de Color', value: 'colored_pencil' },
        { label: 'Grafito', value: 'graphite' },
        { label: 'Marcador', value: 'ink_marker' },
        { label: 'Carboncillo', value: 'charcoal' },
        { label: 'Pintura Digital', value: 'digital_painting' },
        { label: 'Cartoon 3D', value: '3d_cartoon' }
    ];

    // Architectural/Subject Options (Removed Artistic Styles)
    const archStyleOptions = [
        { label: 'Ninguno / Genérico', value: 'none' },
        { label: 'Moderno', value: 'modern' },
        { label: 'Moderno Mid-Century', value: 'mid_century_modern' },
        { label: 'Contemporáneo', value: 'contemporary' },
        { label: 'Minimalista', value: 'minimalist' },
        { label: 'Escandinavo', value: 'scandinavian' },
        { label: 'Industrial & Loft', value: 'industrial_loft' },
        { label: 'Lujo & Clásico', value: 'luxury_classic' },
        { label: 'Bohemio', value: 'bohemian' },
        { label: 'Farmhouse', value: 'farmhouse' },
        { label: 'Biofílico', value: 'biophilic' },
        { label: 'Art Deco', value: 'art_deco' },
        { label: 'Rústico Cozy', value: 'cozy_rustic' },
        { label: 'Tradicional', value: 'traditional' },
        { label: 'Costero', value: 'coastal' },
        { label: 'Cape Cod', value: 'cape_cod' },
        { label: 'Craftsman', value: 'craftsman' },
        { label: 'Victoriano', value: 'victorian' },
        { label: 'Colonial', value: 'colonial' },
        { label: 'Rancho', value: 'ranch' },
        { label: 'Modernismo Brasileño', value: 'brazilian_modernism' },
        { label: 'Mediterráneo', value: 'mediterranean' },
        { label: 'Brutalista', value: 'brutalist' },
        { label: 'Futurista', value: 'futuristic' },
        { label: 'Cinematográfico', value: 'cinematic' }
    ];

    const roomOptions = [{ label: 'Sala', value: 'living_room' }, { label: 'Cocina', value: 'kitchen' }, { label: 'Dormitorio', value: 'bedroom' }, { label: 'Baño', value: 'bathroom' }, { label: 'Oficina', value: 'office' }, { label: 'Aula', value: 'classroom' }, { label: 'Laboratorio', value: 'laboratory' }, { label: 'Taller', value: 'workshop' }, { label: 'Gym', value: 'gym' }, { label: 'Hotel', value: 'hotel_room' }, { label: 'Retail', value: 'retail_store' }, { label: 'Restaurante', value: 'restaurant' }, { label: 'Lobby', value: 'lobby' }, { label: 'Mall', value: 'mall_hallway' }];
    const lightingOptions = [{ label: 'Natural', value: 'natural' }, { label: 'Natural (Mañana)', value: 'natural_morning' }, { label: 'Natural (Tarde)', value: 'natural_afternoon' }, { label: 'Cálida (3000K)', value: 'warm_artificial' }, { label: 'Neutra (4000K)', value: 'neutral_artificial' }, { label: 'Fría (5000K)', value: 'cold_artificial' }, { label: 'Studio', value: 'studio' }, { label: 'Moody (Dramático)', value: 'moody' }];

    // New Options
    const studioLightOptions = [{ label: 'Softbox (Suave)', value: 'softbox' }, { label: 'Rim Light (Silueta)', value: 'rim_light' }, { label: 'Luz Dura (Hard Key)', value: 'hard_key' }, { label: 'Dramático', value: 'dramatic' }];
    const studioBgOptions = [{ label: 'Infinito Blanco', value: 'infinity_white' }, { label: 'Infinito Negro', value: 'infinity_black' }, { label: 'Concreto', value: 'concrete' }, { label: 'Gel Color', value: 'colored_gel' }];
    const studioShotOptions = [{ label: 'Plano Medio', value: 'full_shot' }, { label: 'Primer Plano (Macro)', value: 'close_up' }, { label: 'Knolling (Top Down)', value: 'knolling' }];

    const carAngleOptions = [{ label: 'Frente 3/4', value: 'front_three_quarter' }, { label: 'Perfil Lateral', value: 'side_profile' }, { label: 'Trasera', value: 'rear' }, { label: 'Contrapicado (Hero)', value: 'low_angle_hero' }];
    const carEnvOptions = [{ label: 'Estudio Limpio', value: 'studio' }, { label: 'Calle Ciudad', value: 'city_street' }, { label: 'Pista Carreras', value: 'raceway' }, { label: 'Naturaleza', value: 'nature_scenic' }];
    const carColorOptions = [{ label: 'Original', value: 'none' }, { label: 'Rojo Ferrari', value: 'rosso_corsa' }, { label: 'Plata Metálico', value: 'silver_metallic' }, { label: 'Negro Mate', value: 'matte_black' }, { label: 'Blanco Perla', value: 'pearl_white' }, { label: 'Azul Midnight', value: 'midnight_blue' }];

    const objMatOptions = [{ label: 'Plástico Mate', value: 'matte_plastic' }, { label: 'Metal Cepillado', value: 'brushed_metal' }, { label: 'Vidrio', value: 'glass' }, { label: 'Cerámica', value: 'ceramic' }, { label: 'Madera Fina', value: 'wood' }];
    const objDofOptions = [{ label: 'Macro (Bokeh)', value: 'macro_focus' }, { label: 'Retrato (f/1.8)', value: 'shallow_depth_of_field' }, { label: 'Todo en Foco', value: 'wide_focus' }];
    const objContextOptions = [{ label: 'Mesa de Estudio', value: 'table_top' }, { label: 'Exterior Desenfocado', value: 'outdoor_blur' }];


    return (
        <div className="flex w-full h-full bg-theme-bg-primary relative overflow-hidden">

            {/* NEW: Collapsible Left Panel (Configuration) */}
            <aside className={`${isLeftPanelOpen ? 'w-64' : 'w-0'} bg-theme-bg-secondary border-r border-theme-bg-tertiary transition-all duration-300 flex-shrink-0 overflow-hidden`}>
                <VisualPromptingControls
                    regions={regions}
                    onDeleteRegion={handleDeleteRegion}
                    onUpdateRegionPrompt={handleUpdateRegionPrompt}
                    onUpdateRegionImage={handleUpdateRegionImage}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    brushColor={brushColor}
                    onBrushColorChange={setBrushColor}
                    activeTool={activeTool}
                    onToolChange={setActiveTool}
                    onProcessChanges={handleProcessChanges}
                    onClearAll={handleClearAllAnnotations}
                    isGenerating={isGenerating}
                    generalInstructions={vpGeneralInstructions}
                    onGeneralInstructionsChange={setVpGeneralInstructions}
                    referenceImage={vpReferenceImage}
                    onReferenceImageChange={setVpReferenceImage}
                    structuredPrompt={aiStructuredPrompt}
                    onStructuredPromptChange={(v) => { setAiStructuredPrompt(v); setIsPromptManuallyEdited(true); }}
                    onResetStructuredPrompt={() => setIsPromptManuallyEdited(false)}
                    isPromptModified={isPromptManuallyEdited}
                />
            </aside>

            {/* Floating Left Panel Toggle */}
            <button
                onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                className="absolute top-1/2 -translate-y-1/2 bg-theme-bg-secondary p-2 rounded-full shadow-xl z-40 border border-theme-bg-tertiary hover:bg-theme-bg-tertiary transition-all"
                style={{ left: isLeftPanelOpen ? '16.25rem' : '0.25rem' }}
                title={isLeftPanelOpen ? "Cerrar Panel" : "Abrir Panel"}
            >
                {isLeftPanelOpen ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
            </button>

            {/* 1. MAIN AREA (Flexible) */}
            <div className="flex-grow flex flex-col h-full relative min-w-0">

                {/* 1.1 Viewport (Image Area) */}
                <div ref={viewportRef} className="flex-grow bg-theme-bg-primary relative overflow-hidden">
                    {/* Image Display Wrapper for Zoom/Pan */}
                    <div className="w-full h-full">
                        {inputImage ? (
                            <LayeredCanvas
                                ref={canvasRef}
                                baseImage={showOriginal ? inputImage : (resultImage || inputImage)}
                                width={canvasDimensions.width}
                                height={canvasDimensions.height}
                                activeTool={activeTool}
                                regions={regions}
                                brushSize={brushSize}
                                brushColor={brushColor}
                                zoom={transform.zoom}
                                pan={{ x: transform.x, y: transform.y }}
                                onPanChange={(p) => setTransform(prev => ({ ...prev, x: p.x, y: p.y }))}
                                onZoomChange={(z) => setTransform(prev => ({ ...prev, zoom: z }))}
                                onRegionCreated={handleAddRegion}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center select-none text-theme-text-secondary flex-col">
                                <PhotoIcon className="w-16 h-16 opacity-30 mb-6" />
                                <h3 className="text-xl font-bold opacity-50 mb-4">Empezar Proyecto</h3>
                                <div className="flex gap-4">
                                    <button onClick={handleImport} className="px-6 py-3 bg-theme-accent-primary hover:bg-theme-accent-secondary rounded-lg text-white font-bold shadow-lg shadow-theme-accent-primary/20 transition-all hover:scale-105 flex items-center gap-2 w-full justify-center">
                                        <UndoIcon className="w-5 h-5 rotate-180" /> Importar Sketch
                                    </button>
                                    <button onClick={onOpenLibrary} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold shadow-lg shadow-purple-600/20 transition-all hover:scale-105 flex items-center gap-2 w-full justify-center">
                                        <GalleryIcon className="w-5 h-5" /> Importar de Librería
                                    </button>
                                    <label className="px-6 py-3 bg-theme-bg-secondary hover:bg-theme-bg-tertiary border border-theme-bg-tertiary rounded-lg text-theme-text-primary font-bold shadow-lg transition-all hover:scale-105 flex items-center gap-2 cursor-pointer w-full justify-center">
                                        <UploadIcon className="w-5 h-5" /> Subir Imagen
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Toolbar (Floating Navigation) */}
                    {/* Bottom Toolbar (Floating Navigation) */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 p-1 bg-theme-bg-primary/80 backdrop-blur-sm rounded-lg shadow-lg z-20">
                        {/* Import Dropdown */}
                        <div className="relative">
                            <div className="flex items-center bg-theme-accent-primary rounded-md overflow-hidden">
                                <button
                                    onClick={handleImport}
                                    className="px-2 py-1.5 text-xs font-bold text-white hover:bg-theme-accent-secondary transition-colors flex items-center gap-1.5"
                                    title="Importar desde Sketch"
                                >
                                    <UndoIcon className="w-3 h-3 rotate-180" />
                                    Importar
                                </button>
                                <div className="w-px h-4 bg-white/20"></div>
                                <button
                                    onClick={() => setShowImportMenu(!showImportMenu)}
                                    className="px-1 py-1.5 text-white hover:bg-theme-accent-secondary transition-colors"
                                >
                                    <ChevronDownIcon className="w-3 h-3" />
                                </button>
                            </div>

                            {showImportMenu && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-theme-bg-secondary border border-theme-bg-tertiary rounded-lg shadow-xl overflow-hidden flex flex-col z-50">
                                    <button
                                        onClick={() => { setShowImportMenu(false); handleImport(); }}
                                        className="px-3 py-2 text-left text-xs text-theme-text-primary hover:bg-theme-bg-hover flex items-center gap-2"
                                    >
                                        <UndoIcon className="w-3 h-3 rotate-180" /> Importar Sketch
                                    </button>
                                    <button
                                        onClick={() => { setShowImportMenu(false); onOpenLibrary(); }}
                                        className="px-3 py-2 text-left text-xs text-theme-text-primary hover:bg-theme-bg-hover flex items-center gap-2"
                                    >
                                        <GalleryIcon className="w-3 h-3" /> De Librería
                                    </button>
                                    <label className="px-3 py-2 text-left text-xs text-theme-text-primary hover:bg-theme-bg-hover flex items-center gap-2 cursor-pointer w-full">
                                        <UploadIcon className="w-3 h-3" /> Subir Imagen
                                        <input type="file" accept="image/*" onChange={(e) => { setShowImportMenu(false); handleFileUpload(e); }} className="hidden" />
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => setTransform(p => ({ ...p, zoom: p.zoom / 1.2 }))} className="p-1.5 hover:bg-theme-bg-hover rounded-md text-theme-text-primary transition-colors" title="Zoom Out"><ZoomOutIcon className="w-4 h-4" /></button>
                            <button onClick={resetView} className="p-1.5 hover:bg-theme-bg-hover rounded-md text-theme-text-primary transition-colors" title="Reset View"><MaximizeIcon className="w-4 h-4" /></button>
                            <button onClick={() => setTransform(p => ({ ...p, zoom: p.zoom * 1.2 }))} className="p-1.5 hover:bg-theme-bg-hover rounded-md text-theme-text-primary transition-colors" title="Zoom In"><ZoomInIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Toggle View */}
                        <button onClick={() => setShowOriginal(!showOriginal)} disabled={!resultImage} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-xs font-bold text-theme-text-primary disabled:opacity-50 transition-colors">
                            {showOriginal ? <SparklesIcon className="w-3 h-3 text-purple-400" /> : <PhotoIcon className="w-3 h-3" />}
                            {showOriginal ? "Ver Render" : "Ver Original"}
                        </button>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Undo / Redo */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleLocalUndo}
                                disabled={historyIndex < 0}
                                className="p-1.5 hover:bg-theme-bg-hover rounded-md text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Deshacer Generación"
                            >
                                <UndoIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleLocalRedo}
                                disabled={historyIndex >= generationHistory.length - 1}
                                className="p-1.5 hover:bg-theme-bg-hover rounded-md text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Rehacer Generación"
                            >
                                <RedoIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Upscale */}
                        <button onClick={handleUpscale} disabled={!resultImage || isUpscaling} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            {isUpscaling ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                            4K
                        </button>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Save to Gallery */}
                        <button
                            onClick={handleSaveToLibrary}
                            disabled={!resultImage}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${resultImage ? 'bg-theme-bg-tertiary hover:bg-theme-bg-hover text-theme-text-primary' : 'bg-transparent text-gray-500 cursor-not-allowed'}`}
                        >
                            <FolderOpenIcon className="w-3 h-3" /> Guardar
                        </button>


                        {/* Download */}
                        <a
                            href={resultImage || '#'}
                            download={resultImage ? `Render_${Date.now()}.png` : undefined}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${resultImage ? 'bg-theme-bg-tertiary hover:bg-theme-bg-hover text-theme-text-primary' : 'bg-transparent text-gray-500 cursor-not-allowed'}`}
                            onClick={(e) => !resultImage && e.preventDefault()}
                        >
                            <SaveIcon className="w-3 h-3" /> Descargar
                        </a>

                        {/* Clear */}
                        <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 text-xs font-bold transition-all" title="Limpiar Todo">
                            <CloseIcon className="w-3 h-3" /> Limpiar
                        </button>
                    </div>

                    {/* Generation Loading Overlay */}
                    {isGenerating && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-theme-accent-primary border-t-transparent rounded-full animate-spin"></div>
                                <SparklesIcon className="w-8 h-8 text-theme-accent-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                            </div>
                            <h3 className="text-white font-bold text-2xl mt-6 animate-pulse">Generando Visualización...</h3>
                        </div>
                    )}
                </div>

                {/* 1.2 Footer (Prompt Editor & Payload Preview) */}

            </div>

            {/* 2. SIDEBAR (Fixed Width) */}
            <aside
                className={`w-80 bg-theme-bg-secondary border-l border-theme-bg-tertiary flex flex-col transition-all duration-300 ease-in-out transform relative z-30 shadow-2xl flex-shrink-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full hidden'}`} // hidden when closed to allow full expansion if we wanted, but logic says overlay. Here we use relative flex so it pushes content.
                style={{ display: isSidebarOpen ? 'flex' : 'none' }} // Force verify layout
            >
                <div className="p-4 border-b border-theme-bg-tertiary flex items-center justify-between bg-theme-bg-secondary">
                    <h2 className="font-semibold text-theme-text-primary flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-theme-accent-primary" />
                        Configuración
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-theme-bg-tertiary">
                    {/* Scene Type Select */}
                    <div className="space-y-4">
                        <CollapsiblePillGroup label="Tipo de Escena" options={sceneTypeOptions} value={sceneType} onChange={(v) => setSceneType(v as SceneType)} />
                    </div>

                    {/* Style Reference Upload (Moved here) */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center justify-between">
                            Referencia de Estilo
                            {styleReferenceImage && <button onClick={() => setStyleReferenceImage(null)} className="text-[9px] text-red-400 hover:text-red-300">Borrar</button>}
                        </label>
                        <div className={`border border-dashed rounded-lg p-2 flex flex-col items-center justify-center transition-colors cursor-pointer relative overflow-hidden group h-32 ${styleReferenceImage ? 'border-theme-accent-primary bg-black/20' : 'border-theme-bg-tertiary hover:bg-theme-bg-primary hover:border-theme-text-secondary'}`}>
                            {styleReferenceImage ? (
                                <img src={styleReferenceImage} className="w-full h-full object-cover rounded" />
                            ) : (
                                <div className="flex flex-col items-center p-2 text-center">
                                    <UploadIcon className="w-6 h-6 text-theme-text-tertiary mb-2" />
                                    <span className="text-[10px] text-theme-text-secondary">Arrastra o Click para subir imagen de estilo</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleStyleRefUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Subir referencia" />
                        </div>
                    </div>

                    <div className="h-px bg-theme-bg-tertiary"></div>

                    {/* Dynamic Controls based on SceneType */}
                    {/* Dynamic Controls based on SceneType */}
                    <div className="space-y-4">
                        {/* 2. RENDER STYLE (Technique) */}
                        <CollapsiblePillGroup label="Estilo de Renderizado" options={renderStyleOptions} value={renderStyle} onChange={(v) => setRenderStyle(v as RenderStyleMode)} />

                        <div className="h-px bg-theme-bg-tertiary"></div>

                        {/* 3. SCENE OPTIONS (3 per type) */}
                        {sceneType === 'exterior' && (
                            <>
                                <CollapsiblePillGroup label="Estilo Arquitectónico" options={archStyleOptions} value={archStyle} onChange={setArchStyle} />
                                <CollapsiblePillGroup label="Hora del día" options={timeOptions} value={timeOfDay} onChange={setTimeOfDay} />
                                <CollapsiblePillGroup label="Clima" options={weatherOptions} value={weather} onChange={setWeather} />
                            </>
                        )}
                        {sceneType === 'interior' && (
                            <>
                                <CollapsiblePillGroup label="Estilo Interior" options={archStyleOptions} value={archStyle} onChange={setArchStyle} />
                                <CollapsiblePillGroup label="Tipo de Habitación" options={roomOptions} value={roomType} onChange={setRoomType} />
                                <CollapsiblePillGroup label="Iluminación" options={lightingOptions} value={lighting} onChange={setLighting} />
                            </>
                        )}
                        {sceneType === 'studio' && (
                            <>
                                <CollapsiblePillGroup label="Tipo de Plano" options={studioShotOptions} value={studioShot} onChange={setStudioShot} />
                                <CollapsiblePillGroup label="Iluminación" options={studioLightOptions} value={studioLighting} onChange={setStudioLighting} />
                                <CollapsiblePillGroup label="Fondo" options={studioBgOptions} value={studioBackground} onChange={setStudioBackground} />
                            </>
                        )}
                        {sceneType === 'automotive' && (
                            <>
                                <CollapsiblePillGroup label="Pintura / Color" options={carColorOptions} value={carColor} onChange={setCarColor} />
                                <CollapsiblePillGroup label="Ángulo Cámara" options={carAngleOptions} value={carAngle} onChange={setCarAngle} />
                                <CollapsiblePillGroup label="Entorno" options={carEnvOptions} value={carEnvironment} onChange={setCarEnvironment} />
                            </>
                        )}
                        {(sceneType === 'object_interior' || sceneType === 'object_exterior') && (
                            <>
                                <CollapsiblePillGroup label="Contexto" options={objContextOptions} value={objectContext} onChange={setObjectContext} />
                                <CollapsiblePillGroup label="Material Foco" options={objMatOptions} value={objectMaterial} onChange={setObjectMaterial} />
                                <CollapsiblePillGroup label="Lente / Foco" options={objDofOptions} value={objectDoF} onChange={setObjectDoF} />
                            </>
                        )}
                    </div>


                    <div className="h-px bg-theme-bg-tertiary"></div>

                    {/* Sliders */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Libertad Creativa</label>
                            <span className="text-xs text-theme-text-secondary font-mono">{creativeFreedom}</span>
                        </div>
                        <input type="range" min="0" max="200" value={creativeFreedom} onChange={(e) => setCreativeFreedom(parseInt(e.target.value))} className="w-full h-1.5 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent-primary" />
                        <div className="flex justify-between text-[8px] text-theme-text-tertiary uppercase font-bold tracking-widest mt-1">
                            <span>Fiel (0)</span>
                            <span>Interp. (100)</span>
                            <span>Trans. (200)</span>
                        </div>
                    </div>

                    {/* Additional Prompt */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Detalles Adicionales</label>
                        <textarea
                            value={additionalPrompt}
                            onChange={(e) => setAdditionalPrompt(e.target.value)}
                            placeholder="Ej: Fachada de madera..."
                            className="w-full h-20 bg-theme-bg-primary border border-theme-bg-tertiary rounded-md p-2 text-xs text-theme-text-primary focus:border-theme-accent-primary outline-none resize-none placeholder:text-theme-text-tertiary"
                        />
                    </div>
                </div>

                {/* Footer Controls (Generate, Actions) */}
                <div className="p-4 border-t border-theme-bg-tertiary space-y-3 bg-theme-bg-secondary">
                    {/* Input Management in Sidebar removed as it's now in Center Canvas */}
                    {inputImage && (
                        <div className="flex gap-2">
                            <div className="flex-1 relative h-16 bg-black/40 rounded overflow-hidden border border-theme-bg-tertiary">
                                <img src={resultImage || inputImage || ''} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center gap-1">
                                <span className="text-[10px] text-theme-text-secondary font-bold">IMAGEN INPUT</span>
                                <span className="text-[9px] text-theme-text-tertiary truncate">Base para el render</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleConvertToPhotorealistic}
                        disabled={!inputImage || isGenerating}
                        className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isGenerating ? "Generando..." : <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Renderizar</>}
                    </button>
                </div>
            </aside >
        </div >
    );
}));
