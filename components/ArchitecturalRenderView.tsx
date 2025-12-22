import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhotoIcon, SparklesIcon, UploadIcon, UndoIcon, RedoIcon, SaveIcon, XIcon as CloseIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { buildArchitecturalPrompt, ArchitecturalRenderOptions } from '../utils/architecturalPromptBuilder';
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
}

type SceneType = 'exterior' | 'interior';

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const ArchitecturalRenderView: React.FC<ArchitecturalRenderViewProps> = ({
    onImportFromSketch,
    isSidebarOpen,
    onRenderComplete,
}) => {
    const [sceneType, setSceneType] = useState<SceneType>('exterior');
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);

    // -- Visual Prompting State --
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [lastGuideImage, setLastGuideImage] = useState<string | null>(null); // To debug what we sent
    const [lastSentPrompt, setLastSentPrompt] = useState<string | null>(null); // To debug exact text sent
    const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'region' | 'polygon' | 'pan'>('pan');
    const [regions, setRegions] = useState<Region[]>([]);
    const [brushSize, setBrushSize] = useState(5);
    const [brushColor, setBrushColor] = useState('#FF0000');

    // Canvas Refs
    const canvasRef = useRef<LayeredCanvasRef>(null);

    // -- Form State --
    const [timeOfDay, setTimeOfDay] = useState('noon');
    const [weather, setWeather] = useState('sunny');
    const [archStyle, setArchStyle] = useState('modern');
    const [roomType, setRoomType] = useState('living_room'); // For interior
    const [lighting, setLighting] = useState('natural'); // For interior

    // Creativity now 0-200
    const [creativeFreedom, setCreativeFreedom] = useState(50);
    const [additionalPrompt, setAdditionalPrompt] = useState('');

    // -- Prompt Management State --
    const [manualPrompt, setManualPrompt] = useState('');
    const [savedPrompts, setSavedPrompts] = useState<string[]>([]);

    // -- Refs for Handler Access (Closure Fix) --
    const resultImageRef = useRef<string | null>(null);
    const inputImageRef = useRef<string | null>(null);

    // -- Canvas State --
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 1024, height: 1024 });

    // -- Visual Prompting State --
    const [vpGeneralInstructions, setVpGeneralInstructions] = useState('');
    const [vpReferenceImage, setVpReferenceImage] = useState<string | null>(null);
    const [aiStructuredPrompt, setAiStructuredPrompt] = useState('');
    const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);

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

    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false);

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

    // -- local History State for Generations --
    const [generationHistory, setGenerationHistory] = useState<{ input: string | null, result: string | null }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const pushToHistory = useCallback((input: string | null, result: string | null) => {
        setGenerationHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, { input, result }];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const handleLocalUndo = useCallback(() => {
        if (historyIndex > 0) {
            const prev = generationHistory[historyIndex - 1];
            setInputImage(prev.input);
            setResultImage(prev.result);
            setHistoryIndex(prevIdx => prevIdx - 1);
        } else if (historyIndex === 0) {
            // Back to initial state (null result)
            const initial = generationHistory[0];
            setInputImage(initial.input);
            setResultImage(null);
            setHistoryIndex(-1);
        }
    }, [historyIndex, generationHistory]);

    const handleLocalRedo = useCallback(() => {
        if (historyIndex < generationHistory.length - 1) {
            const next = generationHistory[historyIndex + 1];
            setInputImage(next.input);
            setResultImage(next.result);
            setHistoryIndex(prev => prev + 1);
        }
    }, [historyIndex, generationHistory]);

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
    useEffect(() => {
        const renderOptions: ArchitecturalRenderOptions = {
            sceneType,
            creativeFreedom,
            additionalPrompt,
            archStyle,
            hasStyleReference: !!styleReferenceImage,
            ...(sceneType === 'exterior' && { timeOfDay, weather }),
            ...(sceneType === 'interior' && { roomType, lighting }),
        };
        const generatedPrompt = buildArchitecturalPrompt(renderOptions);
        setManualPrompt(generatedPrompt);
    }, [sceneType, creativeFreedom, additionalPrompt, archStyle, timeOfDay, weather, roomType, lighting, styleReferenceImage]);

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
                    setInputImage(bakedUrl);
                    setResultImage(null);
                    setShowOriginal(false);
                    setGenerationHistory([]);
                    setHistoryIndex(-1);
                }
            };
            img.src = dataUrl;
        } else {
            alert("No hay contenido visible en el sketch para importar.");
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const result = ev.target.result as string;
                    const img = new Image();
                    img.onload = () => {
                        // Max dimension 2048 for performance and consistency
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
                            const bakedUrl = canvas.toDataURL('image/png'); // Strip EXIF
                            setCanvasDimensions({ width: w, height: h });
                            setInputImage(bakedUrl);
                            setResultImage(null);
                            setShowOriginal(false);
                            setGenerationHistory([]);
                            setHistoryIndex(-1);
                        }
                    };
                    img.src = result;
                }
            };
            reader.readAsDataURL(file);
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
            setInputImage(null);
            setResultImage(null);
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

        // Iterative Workflow: Use Ref to guarantee latest state
        const activeBaseImage = currentResult || currentInput;

        if (!activeBaseImage) return; // Should not happen

        // Commit the current state as the new input to avoid UI jumping back to original
        if (currentResult) {
            setInputImage(currentResult);
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
            const model = GEMINI_MODEL_ID;
            const config = { responseModalities: ["IMAGE"] };
            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                const newResult = `data:image/png;base64,${newImageBase64}`;
                updateResult(newResult);
                pushToHistory(currentResult || currentInput, newResult);
            } else {
                console.log("Full Response", response);
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

        setIsGenerating(true);
        setResultImage(null);
        setShowOriginal(false);

        try {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = GEMINI_MODEL_ID;
            console.log("Render View using model:", model);

            // Determine Pipeline: Simple vs Visual Prompting
            // If we have regions or drawings, use Visual Prompting pipeline
            const hasVisualEdits = regions.length > 0 || (canvasRef.current?.getDrawingDataUrl() !== '');

            if (hasVisualEdits) {
                // Use New Pipeline
                const layersImage = canvasRef.current?.getDrawingDataUrl() || ''; // Should get transparent png
                const visualGuideImage = await canvasRef.current?.getVisualGuideSnapshot() || '';

                const img = new Image();
                img.src = inputImage;
                await img.decode();

                const payload = {
                    baseImage: inputImage,
                    layersImage,
                    visualGuideImage,
                    regions,
                    globalPrompt: manualPrompt,
                    globalInstructions: vpGeneralInstructions,
                    globalReferenceImage: styleReferenceImage || vpReferenceImage || undefined,
                    width: img.width,
                    height: img.height,
                    mode: 'render' as const // Force Render Mode (Sketch -> Photo)
                };

                const { contents, guideImageBase64, textPrompt } = await prepareVisualPromptingRequest(payload, import.meta.env.VITE_GEMINI_API_KEY, aiStructuredPrompt);
                setLastGuideImage(`data:image/png;base64,${guideImageBase64}`);
                setLastSentPrompt(textPrompt);

                // @ts-ignore
                const config = { responseModalities: ["IMAGE"] };
                const response = await ai.models.generateContent({ model, contents, config });

                let newImageBase64: string | null = null;
                for (const part of response.candidates?.[0]?.content.parts || []) {
                    if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
                }

                if (newImageBase64) {
                    const newResult = `data:image/png;base64,${newImageBase64}`;
                    updateResult(newResult);
                    pushToHistory(inputImage, newResult);

                    // Reset Visual Prompting State for next cycle?
                    setRegions([]);
                    canvasRef.current?.clearDrawing();
                } else {
                    console.log("Full Response", response);
                    alert("La IA no generó una imagen.");
                }

            } else {
                // Use Classic Pipeline
                console.log("[Prompt Maestro] Sending Classic Prompt:\n", manualPrompt);

                const parts: any[] = [];
                const inputBase64 = inputImage.split(',')[1];
                parts.push({ inlineData: { mimeType: 'image/png', data: inputBase64 } });

                if (styleReferenceImage) {
                    const styleBase64 = styleReferenceImage.split(',')[1];
                    parts.push({ inlineData: { mimeType: 'image/png', data: styleBase64 } });
                }
                parts.push({ text: manualPrompt });

                const contents = { parts };
                // @ts-ignore
                const config = { responseModalities: ["IMAGE"] };
                const response = await ai.models.generateContent({ model, contents, config });

                let newImageBase64: string | null = null;
                for (const part of response.candidates?.[0]?.content.parts || []) {
                    if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
                }

                if (newImageBase64) {
                    const newResult = `data:image/png;base64,${newImageBase64}`;
                    updateResult(newResult);
                    pushToHistory(inputImage, newResult);
                } else {
                    alert("La IA no generó una imagen.");
                }
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

            const prompt = "Upscale this architectural render to 4K resolution. Enhance fine details, sharpen textures, and improve overall clarity while maintaining the exact composition and style of the original image. Output as a high-fidelity photorealistic image.";

            const base64Data = resultImage.split(',')[1];
            // @ts-ignore
            const imagePart = { inlineData: { mimeType: 'image/png', data: base64Data } };
            const textPart = { text: prompt };

            const contents = { parts: [imagePart, textPart] };
            // @ts-ignore
            const config = { responseModalities: ["IMAGE"] };

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                const newResult = `data:image/png;base64,${newImageBase64}`;
                updateResult(newResult);
                pushToHistory(resultImage, newResult);

                // Client-side 4K scaling and download (Matching Sketch behavior)
                const img = new Image();
                img.onload = () => {
                    const TARGET_WIDTH = 3840;
                    const scale = TARGET_WIDTH / img.width;
                    const targetHeight = Math.round(img.height * scale);

                    const canvas = document.createElement('canvas');
                    canvas.width = TARGET_WIDTH;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
                img.src = newResult;

            } else {
                alert("La IA no pudo escalar la imagen.");
            }

        } catch (error) {
            console.error("Error upscaling:", error);
            alert("Error al escalar la imagen.");
        } finally {
            setIsUpscaling(false);
        }
    };


    // -- Options Configuration (Keep existing options arrays) --
    const timeOptions = [{ label: 'Mañana', value: 'morning' }, { label: 'Mediodía', value: 'noon' }, { label: 'Tarde', value: 'afternoon' }, { label: 'Hora Dorada', value: 'golden_hour' }, { label: 'Noche', value: 'night' }];
    const weatherOptions = [{ label: 'Soleado', value: 'sunny' }, { label: 'Nublado', value: 'overcast' }, { label: 'Lluvia', value: 'rainy' }, { label: 'Niebla', value: 'foggy' }];
    const extStyleOptions = [{ label: 'Moderno', value: 'modern' }, { label: 'Moderno Mid-Century', value: 'mid_century_modern' }, { label: 'Contemporáneo', value: 'contemporary' }, { label: 'Cape Cod', value: 'cape_cod' }, { label: 'Craftsman (Artesano)', value: 'craftsman' }, { label: 'Victoriano', value: 'victorian' }, { label: 'Colonial', value: 'colonial' }, { label: 'Rancho', value: 'ranch' }, { label: 'Farmhouse', value: 'farmhouse' }, { label: 'Modernismo Brasileño', value: 'brazilian_modernism' }, { label: 'Mediterráneo', value: 'mediterranean' }, { label: 'Brutalista', value: 'brutalist' }, { label: 'Futurista', value: 'futuristic' }, { label: 'Cinematográfico', value: 'cinematic' }];
    const roomOptions = [{ label: 'Sala', value: 'living_room' }, { label: 'Cocina', value: 'kitchen' }, { label: 'Dormitorio', value: 'bedroom' }, { label: 'Baño', value: 'bathroom' }, { label: 'Oficina', value: 'office' }, { label: 'Aula', value: 'classroom' }, { label: 'Laboratorio', value: 'laboratory' }, { label: 'Taller', value: 'workshop' }, { label: 'Gym', value: 'gym' }, { label: 'Hotel', value: 'hotel_room' }, { label: 'Retail', value: 'retail_store' }, { label: 'Restaurante', value: 'restaurant' }, { label: 'Lobby', value: 'lobby' }, { label: 'Mall', value: 'mall_hallway' }];
    const lightingOptions = [{ label: 'Natural', value: 'natural' }, { label: 'Natural (Mañana)', value: 'natural_morning' }, { label: 'Natural (Tarde)', value: 'natural_afternoon' }, { label: 'Cálida (3000K)', value: 'warm_artificial' }, { label: 'Neutra (4000K)', value: 'neutral_artificial' }, { label: 'Fría (5000K)', value: 'cold_artificial' }, { label: 'Studio', value: 'studio' }, { label: 'Moody (Dramático)', value: 'moody' }];
    const intStyleOptions = [{ label: 'Minimalista', value: 'minimalist' }, { label: 'Escandinavo', value: 'scandinavian' }, { label: 'Industrial & Loft', value: 'industrial_loft' }, { label: 'Lujo & Clásico', value: 'luxury_classic' }, { label: 'Bohemio', value: 'bohemian' }, { label: 'Moderno Mid-Century', value: 'mid_century_modern' }, { label: 'Farmhouse', value: 'farmhouse' }, { label: 'Biofílico', value: 'biophilic' }, { label: 'Art Deco', value: 'art_deco' }, { label: 'Rústico Cozy', value: 'cozy_rustic' }, { label: 'Tradicional', value: 'traditional' }, { label: 'Costero', value: 'coastal' }, { label: 'Moderno', value: 'modern' }];


    return (
        <div className="flex w-full h-full bg-[#1e1e1e] relative overflow-hidden">

            {/* NEW: Collapsible Left Panel (Configuration) */}
            <aside className={`${isLeftPanelOpen ? 'w-64' : 'w-0'} bg-[#1e1e1e] border-r border-[#333] transition-all duration-300 flex-shrink-0 overflow-hidden`}>
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
                style={{ left: isLeftPanelOpen ? '19.25rem' : '3.25rem' }}
                title={isLeftPanelOpen ? "Cerrar Panel" : "Abrir Panel"}
            >
                {isLeftPanelOpen ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
            </button>

            {/* 1. MAIN AREA (Flexible) */}
            <div className="flex-grow flex flex-col h-full relative min-w-0">

                {/* 1.1 Viewport (Image Area) */}
                <div ref={viewportRef} className="flex-grow bg-black/20 relative overflow-hidden">
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
                                    <button onClick={handleImport} className="px-6 py-3 bg-theme-accent-primary hover:bg-theme-accent-secondary rounded-lg text-white font-bold shadow-lg shadow-theme-accent-primary/20 transition-all hover:scale-105 flex items-center gap-2">
                                        <UndoIcon className="w-5 h-5 rotate-180" /> Importar Sketch
                                    </button>
                                    <label className="px-6 py-3 bg-theme-bg-secondary hover:bg-theme-bg-tertiary border border-theme-bg-tertiary rounded-lg text-white font-bold shadow-lg transition-all hover:scale-105 flex items-center gap-2 cursor-pointer">
                                        <UploadIcon className="w-5 h-5" /> Subir Imagen
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Toolbar (Floating Navigation) */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-[#121212]/90 backdrop-blur border border-theme-bg-tertiary rounded-full shadow-2xl z-20">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => setTransform(p => ({ ...p, zoom: p.zoom / 1.2 }))} className="p-1.5 hover:bg-theme-bg-hover rounded-full text-white transition-colors" title="Zoom Out"><ZoomOutIcon className="w-4 h-4" /></button>
                            <button onClick={resetView} className="p-1.5 hover:bg-theme-bg-hover rounded-full text-white transition-colors" title="Reset View"><MaximizeIcon className="w-4 h-4" /></button>
                            <button onClick={() => setTransform(p => ({ ...p, zoom: p.zoom * 1.2 }))} className="p-1.5 hover:bg-theme-bg-hover rounded-full text-white transition-colors" title="Zoom In"><ZoomInIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Toggle View */}
                        <button onClick={() => setShowOriginal(!showOriginal)} disabled={!resultImage} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-bg-tertiary hover:bg-theme-bg-hover text-xs font-bold text-white disabled:opacity-50 transition-colors">
                            {showOriginal ? <SparklesIcon className="w-3 h-3 text-purple-400" /> : <PhotoIcon className="w-3 h-3" />}
                            {showOriginal ? "Ver Render" : "Ver Original"}
                        </button>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Undo / Redo */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleLocalUndo}
                                disabled={historyIndex < 0}
                                className="p-1.5 hover:bg-theme-bg-hover rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Deshacer Generación"
                            >
                                <UndoIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleLocalRedo}
                                disabled={historyIndex >= generationHistory.length - 1}
                                className="p-1.5 hover:bg-theme-bg-hover rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                title="Rehacer Generación"
                            >
                                <RedoIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Upscale */}
                        <button onClick={handleUpscale} disabled={!resultImage || isUpscaling} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            {isUpscaling ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                            4K
                        </button>

                        <div className="h-4 w-px bg-theme-bg-tertiary"></div>

                        {/* Download */}
                        <a
                            href={resultImage || '#'}
                            download={resultImage ? `Render_${Date.now()}.png` : undefined}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${resultImage ? 'bg-theme-bg-tertiary hover:bg-theme-bg-hover text-white' : 'bg-transparent text-gray-500 cursor-not-allowed'}`}
                            onClick={(e) => !resultImage && e.preventDefault()}
                        >
                            <SaveIcon className="w-3 h-3" /> Descargar
                        </a>

                        {/* Clear */}
                        <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 text-xs font-bold transition-all" title="Limpiar Todo">
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
                <div className="h-64 bg-theme-bg-secondary border-t border-theme-bg-tertiary p-0 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] grid grid-cols-2 divide-x divide-theme-bg-tertiary">

                    {/* LEFT COLUMN: VISUAL PROMPTING FLOW (Make Changes) */}
                    <div className="flex flex-col h-full overflow-hidden bg-[#1a1a1a]">
                        <div className="p-2 border-b border-theme-bg-tertiary flex justify-between items-center bg-[#222]">
                            <span className="text-[10px] font-bold text-theme-accent-primary uppercase tracking-wider flex items-center gap-2">
                                <SparklesIcon className="w-3 h-3" />
                                Flujo 1: Visual Prompting (Edición)
                            </span>
                            <span className="text-[9px] text-theme-text-tertiary">{regions.length} Regiones</span>
                        </div>

                        <div className="flex-grow p-3 flex flex-col gap-3 overflow-hidden">
                            {/* Images Carousel */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-theme-bg-tertiary h-24 flex-shrink-0">
                                {/* 1. VP Base Input */}
                                <div className="min-w-[80px] w-[80px] border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group flex-shrink-0">
                                    {(resultImage || inputImage) ? (
                                        <img src={resultImage || inputImage || undefined} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <span className="text-[8px] text-gray-600">N/A</span>
                                    )}
                                    <span className="absolute bottom-0 left-0 bg-black/60 text-[7px] text-white px-1 font-bold rounded-tr">INPUT</span>
                                </div>

                                {/* 2. VP Guide (Drawing Layer) */}
                                {/* 2. VP Guide (Drawing Layer + Base + Regions) */}
                                <div className="min-w-[80px] w-[80px] border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group flex-shrink-0 border-dashed border-gray-600">
                                    {lastGuideImage ? (
                                        <img src={lastGuideImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="p-1 text-center opacity-50">
                                            <span className="text-[7px] block">Guía</span>
                                            <div className="w-4 h-4 bg-gray-500 rounded-full mx-auto my-1 opacity-50"></div>
                                            <span className="text-[6px] block text-theme-text-tertiary">(Pendiente)</span>
                                        </div>
                                    )}
                                    <span className="absolute bottom-0 left-0 bg-black/60 text-[7px] text-purple-400 px-1 font-bold rounded-tr">GUÍA</span>
                                </div>

                                {/* 3. Region Refs */}
                                {regions.filter(r => r.referenceImage).map(r => (
                                    <div key={r.id} className="min-w-[80px] w-[80px] border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group flex-shrink-0">
                                        <img src={r.referenceImage} className="w-full h-full object-cover" />
                                        <span className="absolute top-0 right-0 bg-red-600 text-[8px] text-white px-1 font-bold rounded-bl shadow-sm">R{r.regionNumber}</span>
                                        <span className="absolute bottom-0 left-0 bg-black/60 text-[7px] text-gray-300 px-1 font-bold rounded-tr">REF</span>
                                    </div>
                                ))}
                                {regions.length === 0 && (
                                    <div className="flex-shrink-0 text-[9px] text-gray-600 flex items-center px-2 italic">Sin regiones definidas</div>
                                )}
                            </div>

                            {/* Shared Prompt Editor */}
                            <div className="flex-grow flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[9px] font-bold text-theme-text-tertiary uppercase">Prompt Estructurado Visual</label>
                                    {isPromptManuallyEdited && (
                                        <button onClick={() => setIsPromptManuallyEdited(false)} className="text-[8px] text-blue-400 hover:text-blue-300 font-bold">Reset Auto</button>
                                    )}
                                </div>
                                <textarea
                                    value={aiStructuredPrompt}
                                    onChange={(e) => { setAiStructuredPrompt(e.target.value); setIsPromptManuallyEdited(true); }}
                                    className={`flex-grow bg-[#111] rounded p-2 text-[10px] font-mono border outline-none resize-none transition-colors ${isPromptManuallyEdited ? 'border-blue-500/50 text-blue-100' : 'border-theme-bg-tertiary text-gray-400'}`}
                                    placeholder="Prompt Visual..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: PHOTOREALISTIC FLOW (Generate) */}
                    <div className="flex flex-col h-full overflow-hidden bg-theme-bg-secondary">
                        <div className="p-2 border-b border-theme-bg-tertiary flex justify-between items-center bg-[#252525]">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <SparklesIcon className="w-3 h-3 text-blue-400" />
                                Flujo 2: Fotorealista (Generación)
                            </span>

                            <div className="flex gap-2">
                                {/* Saved Prompts */}
                                <div className="relative group">
                                    <button className="text-[10px] bg-theme-bg-tertiary hover:bg-theme-bg-hover px-2 py-0.5 rounded text-theme-text-primary flex items-center gap-1 transition-colors">
                                        <DownloadIcon className="w-3 h-3" /> Cargar
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-1 w-64 bg-theme-bg-secondary border border-theme-bg-tertiary rounded shadow-xl hidden group-hover:block max-h-48 overflow-y-auto z-50">
                                        {savedPrompts.map((p, i) => (
                                            <div key={i} onClick={() => handleLoadPrompt(p)} className="p-2 text-[10px] hover:bg-theme-bg-hover cursor-pointer truncate border-b border-theme-bg-tertiary last:border-0 text-theme-text-secondary hover:text-white transition-colors">
                                                {p.substring(0, 60)}...
                                            </div>
                                        ))}
                                        {savedPrompts.length > 0 && <div onClick={handleClearSavedPrompts} className="p-2 text-[10px] text-red-400 hover:bg-red-900/20 cursor-pointer text-center transition-colors">Borrar Todo</div>}
                                    </div>
                                </div>
                                <button onClick={handleSavePrompt} className="text-[10px] bg-theme-bg-tertiary hover:bg-theme-bg-hover px-2 py-0.5 rounded text-theme-text-primary flex items-center gap-1 transition-colors" title="Guardar">
                                    <SaveIcon className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow p-3 flex flex-col gap-3 overflow-hidden">
                            {/* Images Carousel */}
                            <div className="flex gap-2 pb-2 h-24 flex-shrink-0 items-center">
                                {/* 1. PR Base Input */}
                                <div className="min-w-[80px] w-[80px] h-full border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group flex-shrink-0">
                                    {inputImage ? (
                                        <img src={inputImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[8px] text-gray-600">Sin Input</span>
                                    )}
                                    <span className="absolute bottom-0 left-0 bg-black/60 text-[7px] text-white px-1 font-bold rounded-tr">INPUT</span>
                                </div>

                                {/* 2. PR Style Ref */}
                                <div className={`min-w-[80px] w-[80px] h-full border border-theme-bg-tertiary rounded relative overflow-hidden flex items-center justify-center group flex-shrink-0 ${styleReferenceImage ? 'bg-black/40' : 'bg-transparent border-dashed'}`}>
                                    {styleReferenceImage ? (
                                        <img src={styleReferenceImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[8px] text-gray-600 text-center leading-tight">Sin Ref<br />Estilo</span>
                                    )}
                                    <span className="absolute bottom-0 left-0 bg-black/60 text-[7px] text-emerald-400 px-1 font-bold rounded-tr">ESTILO</span>
                                </div>

                                <span className="text-2xl text-theme-text-tertiary px-1 font-thin">+</span>

                                <div className="flex-1 h-full bg-[#111] border border-theme-bg-tertiary rounded flex items-center justify-center text-[10px] text-theme-text-tertiary italic">
                                    Prompt Textual
                                </div>
                            </div>

                            {/* Editable Prompt */}
                            <div className="flex-grow flex flex-col min-h-0">
                                <label className="text-[9px] font-bold text-theme-text-secondary uppercase mb-1">Editor de Prompt</label>
                                <textarea
                                    value={manualPrompt}
                                    onChange={(e) => setManualPrompt(e.target.value)}
                                    className="w-full flex-grow bg-theme-bg-primary border border-theme-bg-tertiary rounded p-2 text-xs font-mono text-theme-text-tertiary focus:text-theme-text-primary focus:border-theme-accent-primary outline-none resize-none transition-colors leading-relaxed"
                                    spellCheck={false}
                                    placeholder="Describe tu visión arquitectónica..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
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
                    {/* Scene Type */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Tipo de Escena</label>
                        <div className="flex bg-theme-bg-primary p-1 rounded-lg border border-theme-bg-tertiary">
                            <button onClick={() => setSceneType('exterior')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sceneType === 'exterior' ? 'bg-theme-accent-primary text-white shadow-md' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}>Exterior</button>
                            <button onClick={() => setSceneType('interior')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sceneType === 'interior' ? 'bg-theme-accent-primary text-white shadow-md' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}>Interior</button>
                        </div>
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

                    {/* Dynamic Controls */}
                    <div className="space-y-2">
                        {sceneType === 'exterior' ? (
                            <>
                                <CollapsiblePillGroup label="Hora del día" options={timeOptions} value={timeOfDay} onChange={setTimeOfDay} />
                                <CollapsiblePillGroup label="Clima" options={weatherOptions} value={weather} onChange={setWeather} />
                                <CollapsiblePillGroup label="Estilo Arquitectónico" options={extStyleOptions} value={archStyle} onChange={setArchStyle} />
                            </>
                        ) : (
                            <>
                                <CollapsiblePillGroup label="Tipo de Habitación" options={roomOptions} value={roomType} onChange={setRoomType} />
                                <CollapsiblePillGroup label="Estilo de Interior" options={intStyleOptions} value={archStyle} onChange={setArchStyle} />
                                <CollapsiblePillGroup label="Iluminación" options={lightingOptions} value={lighting} onChange={setLighting} />
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
                            <div className="flex-1 relative group h-16 bg-black/40 rounded overflow-hidden border border-theme-bg-tertiary">
                                <img src={inputImage} className="w-full h-full object-cover" />
                                <button onClick={() => setInputImage(null)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">Cambiar</button>
                            </div>
                            <div className="flex-1 flex flex-col justify-center gap-1">
                                <span className="text-[10px] text-theme-text-secondary font-bold">IMAGEN INPUT</span>
                                <span className="text-[10px] text-emerald-500">✓ Cargada</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleConvertToPhotorealistic}
                        disabled={!inputImage || isGenerating}
                        className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isGenerating ? "Generando..." : <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Convertir a Fotorealista</>}
                    </button>
                </div>
            </aside>
        </div>
    );
};

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
