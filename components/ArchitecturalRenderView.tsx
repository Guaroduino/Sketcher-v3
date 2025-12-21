import React, { useState, useRef, useEffect } from 'react';
import { PhotoIcon, SparklesIcon, UploadIcon, UndoIcon, RedoIcon, SaveIcon, XIcon as CloseIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, HandIcon, TrashIcon, DownloadIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { buildArchitecturalPrompt, ArchitecturalRenderOptions } from '../utils/architecturalPromptBuilder';

interface ArchitecturalRenderViewProps {
    onImportFromSketch: () => string | null; // Returns dataURL or null
    isSidebarOpen: boolean;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
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
    onUndo,
    onRedo,
    canUndo,
    canRedo
}) => {
    const [sceneType, setSceneType] = useState<SceneType>('exterior');
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);

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

    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false);

    // Upscale State
    const [isUpscaling, setIsUpscaling] = useState(false);

    // Navigation State
    const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

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


    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.max(0.1, Math.min(10, transform.zoom * (1 + delta)));

        setTransform(prev => ({ ...prev, zoom: newZoom }));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;

        setTransform(prev => ({
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));

        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const resetView = () => setTransform({ zoom: 1, x: 0, y: 0 });

    const handleImport = () => {
        const dataUrl = onImportFromSketch();
        if (dataUrl) {
            setInputImage(dataUrl);
            setResultImage(null);
            setShowOriginal(false);
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
                    setInputImage(ev.target.result as string);
                    setResultImage(null);
                    setShowOriginal(false);
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
            const model = 'gemini-3-pro-image-preview';
            console.log("Render View using model:", model);
            console.log("[Prompt Maestro] Sending Prompt:\n", manualPrompt);

            // Prepare Contents
            const parts: any[] = [];

            // 1. Input Image (Sketch)
            const inputBase64 = inputImage.split(',')[1];
            parts.push({ inlineData: { mimeType: 'image/png', data: inputBase64 } });

            // 2. Style Reference (if any)
            if (styleReferenceImage) {
                const styleBase64 = styleReferenceImage.split(',')[1];
                parts.push({ inlineData: { mimeType: 'image/png', data: styleBase64 } });
            }

            // 3. Prompt
            parts.push({ text: manualPrompt });

            const contents = { parts };
            // @ts-ignore
            const config = { responseModalities: ["IMAGE"] };

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            // Check candidates
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                setResultImage(`data:image/png;base64,${newImageBase64}`);
            } else {
                console.log("Full Response", response);
                alert("La IA no generó una imagen. Revisa la consola para más detalles.");
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
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = 'gemini-3-pro-image-preview';

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
                setResultImage(`data:image/png;base64,${newImageBase64}`);
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

            {/* 1. MAIN AREA (Flexible) */}
            <div className="flex-grow flex flex-col h-full relative min-w-0">

                {/* 1.1 Viewport (Image Area) */}
                <div className="flex-grow bg-black/20 relative overflow-hidden">
                    {/* Image Display Wrapper for Zoom/Pan */}
                    <div
                        className="w-full h-full flex items-center justify-center cursor-move"
                        onWheel={handleWheel}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        {inputImage ? (
                            <img
                                src={showOriginal ? inputImage : (resultImage || inputImage)}
                                alt="Render View"
                                className="object-contain max-w-none origin-center transition-transform duration-75 ease-linear"
                                draggable={false}
                                style={{
                                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
                                    maxHeight: '100%',
                                    maxWidth: '100%'
                                }}
                            />
                        ) : (
                            <div className="text-theme-text-secondary flex flex-col items-center select-none">
                                <PhotoIcon className="w-16 h-16 opacity-30 mb-4" />
                                <p className="opacity-50">Visualización Arquitectónica</p>
                                <p className="text-xs opacity-30 mt-2">Usa el panel derecho para importar</p>
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

                        {/* Upscale */}
                        <button onClick={handleUpscale} disabled={!resultImage || isUpscaling} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            {isUpscaling ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                            4K
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

                {/* 1.2 Footer (Prompt Editor) */}
                <div className="h-40 bg-theme-bg-secondary border-t border-theme-bg-tertiary p-3 flex gap-4 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">

                    {/* Image Verification Thumbnails (New Feature) */}
                    <div className="flex flex-col gap-2 w-32 flex-shrink-0">
                        <div className="flex gap-2 h-full">
                            {/* Input Thumb */}
                            <div className="flex-1 border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group select-none">
                                {inputImage ? (
                                    <img src={inputImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <span className="text-[8px] text-gray-600">Sin Input</span>
                                )}
                                <span className="absolute bottom-0 left-0 bg-black/60 text-[8px] text-white px-1 font-bold">INPUT</span>
                            </div>

                            {/* Style Ref Thumb */}
                            <div className="flex-1 border border-theme-bg-tertiary bg-black/40 rounded relative overflow-hidden flex items-center justify-center group select-none">
                                {styleReferenceImage ? (
                                    <img src={styleReferenceImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <span className="text-[8px] text-gray-600 text-center px-1">Sin Ref</span>
                                )}
                                <span className="absolute bottom-0 left-0 bg-black/60 text-[8px] text-emerald-400 px-1 font-bold">REF</span>
                            </div>
                        </div>
                        <div className="text-[9px] text-center text-theme-text-secondary">Previsualización de Envío</div>
                    </div>

                    <div className="flex-grow flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                                <SparklesIcon className="w-3 h-3 text-theme-accent-primary" />
                                Prompt Generado (Previsualización)
                            </span>
                            <div className="flex gap-2">
                                {/* Saved Prompts */}
                                <div className="relative group">
                                    <button className="text-[10px] bg-theme-bg-tertiary hover:bg-theme-bg-hover px-2 py-1 rounded text-theme-text-primary flex items-center gap-1 transition-colors">
                                        <DownloadIcon className="w-3 h-3" /> Cargar ({savedPrompts.length})
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-1 w-64 bg-theme-bg-secondary border border-theme-bg-tertiary rounded shadow-xl hidden group-hover:block max-h-48 overflow-y-auto z-50">
                                        {savedPrompts.map((p, i) => (
                                            <div key={i} onClick={() => handleLoadPrompt(p)} className="p-2 text-[10px] hover:bg-theme-bg-hover cursor-pointer truncate border-b border-theme-bg-tertiary last:border-0 text-theme-text-secondary hover:text-white transition-colors">
                                                {p.substring(0, 60)}...
                                            </div>
                                        ))}
                                        {savedPrompts.length > 0 && <div onClick={handleClearSavedPrompts} className="p-2 text-[10px] text-red-400 hover:bg-red-900/20 cursor-pointer text-center transition-colors">Borrar Todo</div>}
                                        {savedPrompts.length === 0 && <div className="p-2 text-[10px] text-gray-500 text-center">Vacío</div>}
                                    </div>
                                </div>
                                <button onClick={handleSavePrompt} className="text-[10px] bg-theme-bg-tertiary hover:bg-theme-bg-hover px-2 py-1 rounded text-theme-text-primary flex items-center gap-1 transition-colors" title="Guardar Prompt">
                                    <SaveIcon className="w-3 h-3" /> Guardar
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={manualPrompt}
                            onChange={(e) => setManualPrompt(e.target.value)}
                            className="w-full flex-grow bg-theme-bg-primary border border-theme-bg-tertiary rounded p-2 text-xs font-mono text-theme-text-tertiary focus:text-theme-text-primary focus:border-theme-accent-primary outline-none resize-none transition-colors"
                            spellCheck={false}
                        />
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
                    {/* Input Management */}
                    {!inputImage && (
                        <div className="flex gap-2 mb-2">
                            <button onClick={handleImport} className="flex-1 py-2 bg-theme-bg-tertiary hover:bg-theme-bg-hover rounded-md text-xs font-bold text-theme-text-primary border border-theme-bg-tertiary transition-colors flex items-center justify-center gap-2">
                                <UploadIcon className="w-3 h-3" /> Importar Sketch
                            </button>
                            <label className="flex-1 py-2 bg-theme-bg-tertiary hover:bg-theme-bg-hover rounded-md text-xs font-bold text-theme-text-primary border border-theme-bg-tertiary transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                <PhotoIcon className="w-3 h-3" /> Subir Imagen
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    )}
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

                    <div className="flex gap-2">
                        {/* Save Button */}
                        {resultImage ? (
                            <a
                                href={resultImage}
                                download={`Render_${Date.now()}.png`}
                                className="flex-1 py-2 rounded-md bg-emerald-600/10 border border-emerald-600/30 text-emerald-500 font-bold text-xs hover:bg-emerald-600/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <SaveIcon className="w-4 h-4" /> Descargar
                            </a>
                        ) : (
                            <button disabled className="flex-1 py-2 rounded-md bg-theme-bg-tertiary border border-theme-bg-tertiary text-theme-text-tertiary font-medium text-xs flex items-center justify-center gap-1 cursor-not-allowed">
                                <SaveIcon className="w-4 h-4" /> Descargar
                            </button>
                        )}

                        <button
                            onClick={handleReset}
                            className="flex-1 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 font-bold text-xs hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                        >
                            <CloseIcon className="w-4 h-4" /> Limpiar
                        </button>
                    </div>
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
