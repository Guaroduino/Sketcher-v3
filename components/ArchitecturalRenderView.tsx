import React, { useState } from 'react';
import { PhotoIcon, SparklesIcon, UploadIcon, UndoIcon, RedoIcon, SaveIcon, XIcon as CloseIcon } from './icons';
import { GoogleGenAI, Modality } from "@google/genai";

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

    // -- Form State --
    const [timeOfDay, setTimeOfDay] = useState('día');
    const [weather, setWeather] = useState('soleado');
    const [archStyle, setArchStyle] = useState('moderno');
    const [roomType, setRoomType] = useState('sala de estar'); // For interior
    const [lighting, setLighting] = useState('natural'); // For interior

    const [creativeFreedom, setCreativeFreedom] = useState(50);
    const [additionalPrompt, setAdditionalPrompt] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false); // New state for toggle

    // Upscale State
    const [isUpscaling, setIsUpscaling] = useState(false);

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

    const handleReset = () => {
        if (confirm("¿Estás seguro de que quieres limpiar todo y restablecer la configuración?")) {
            setInputImage(null);
            setResultImage(null);
            setShowOriginal(false);
            setAdditionalPrompt('');
            setCreativeFreedom(50);
            setTimeOfDay('día');
            setWeather('soleado');
            setArchStyle('moderno');
            // Reset other defaults if needed
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

            // Construct Prompt
            let prompt = `Genera un render arquitectónico fotorealista de alta calidad basado en la imagen de entrada. `;

            if (sceneType === 'exterior') {
                prompt += `Escena exterior. Estilo arquitectónico: ${archStyle}. Hora del día: ${timeOfDay}. Clima: ${weather}. `;
            } else {
                prompt += `Escena interior. Tipo de habitación: ${roomType}. Estilo: ${archStyle}. Iluminación: ${lighting}. `;
            }

            if (additionalPrompt.trim()) {
                prompt += `Detalles adicionales: ${additionalPrompt}. `;
            }

            // Creativity Instructions
            if (creativeFreedom < 30) {
                prompt += `MANTÉN ALTA FIDELIDAD a la estructura y trazos originales. Solo mejora texturas e iluminación. `;
            } else if (creativeFreedom > 70) {
                prompt += `Usa la imagen original como inspiración, siéntete libre de añadir detalles creativos y mejorar la arquitectura. `;
            } else {
                prompt += `Balancea la fidelidad a la estructura original con mejoras fotorealistas. `;
            }

            prompt += `El resultado debe parecer una fotografía profesional de arquitectura.`;

            // Prepare Image Part
            const base64Data = inputImage.split(',')[1];
            // @ts-ignore
            const imagePart = { inlineData: { mimeType: 'image/png', data: base64Data } };
            const textPart = { text: prompt };

            const contents = { parts: [imagePart, textPart] };
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
            console.log("Render View using model:", model);

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


    return (
        <div className="flex w-full h-full bg-[#1e1e1e] relative overflow-hidden">
            {/* Main Preview Area - Full Scale */}
            <div className="flex-grow flex flex-col items-center justify-center relative w-full h-full p-0">

                {/* Result / Original Toggle View */}
                {resultImage ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/20">

                        {/* Image Display */}
                        <img
                            src={showOriginal ? inputImage! : resultImage}
                            alt={showOriginal ? "Original Sketch" : "Render Prediction"}
                            className="w-full h-full object-contain"
                        />

                        {/* Top Controls Overlay */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-black/60 backdrop-blur-md p-2 rounded-full z-20">
                            <button
                                onClick={() => setShowOriginal(!showOriginal)}
                                className="px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 border border-transparent hover:border-white/20 hover:bg-white/10 text-white"
                            >
                                {showOriginal ? (
                                    <>
                                        <SparklesIcon className="w-4 h-4 text-[--accent-primary]" />
                                        Ver Resultado
                                    </>
                                ) : (
                                    <>
                                        <PhotoIcon className="w-4 h-4" />
                                        Ver Original
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Action Buttons Overlay */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                            <button
                                onClick={() => { setResultImage(null); setShowOriginal(false); }}
                                className="bg-black/60 text-white p-3 rounded-full hover:bg-red-500/80 transition-colors shadow-lg"
                                title="Cerrar y Volver"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Upscale Button (Bottom Center) - Only show if showing result and not generating/upscaling */}
                        {!showOriginal && !isGenerating && !isUpscaling && (
                            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                                <button
                                    onClick={handleUpscale}
                                    className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <SparklesIcon className="w-5 h-5" />
                                    Escalar a 4K con IA
                                </button>
                            </div>
                        )}

                        {/* Loading States */}
                        {isUpscaling && (
                            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 bg-black/80 px-6 py-3 rounded-full flex items-center gap-3 border border-emerald-500/50">
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-emerald-400 font-bold text-sm">Escalando imagen...</span>
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center p-8">
                        {inputImage ? (
                            <div className="relative w-full h-full max-w-5xl max-h-[85vh] group">
                                <img src={inputImage} alt="Input Sketch" className="w-full h-full object-contain rounded-lg shadow-2xl bg-black/40" />
                                <button
                                    onClick={() => setInputImage(null)}
                                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-md hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Limpiar imagen"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-xl aspect-video border-2 border-dashed border-[--bg-tertiary] rounded-xl flex flex-col items-center justify-center text-[--text-secondary] bg-[--bg-secondary]/30 hover:bg-[--bg-secondary]/50 transition-colors">
                                <PhotoIcon className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-xl font-medium">Render Studio</p>
                                <p className="text-sm opacity-70 mt-2 mb-6">Arrastra una imagen o importa tu sketch</p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleImport}
                                        className="px-6 py-3 rounded-full bg-[--accent-primary] text-white font-bold hover:bg-[--accent-hover] transition-colors shadow-lg flex items-center gap-2"
                                    >
                                        <UploadIcon className="w-4 h-4" /> Importar desde Sketch
                                    </button>
                                    <label className="px-6 py-3 rounded-full bg-[--bg-tertiary] border border-[--text-secondary] text-[--text-primary] font-bold hover:bg-[--bg-primary] transition-colors shadow-lg cursor-pointer flex items-center gap-2">
                                        <PhotoIcon className="w-4 h-4" /> Subir Imagen
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Generation Loading Overlay */}
                {isGenerating && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-[--accent-primary] border-t-transparent rounded-full animate-spin"></div>
                            <SparklesIcon className="w-8 h-8 text-[--accent-primary] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <h3 className="text-white font-bold text-2xl mt-6 animate-pulse">Generando Visualización...</h3>
                        <p className="text-white/60 text-sm mt-2">Interpretando trazos y aplicando estilo...</p>
                    </div>
                )}

            </div>

            {/* Controls Sidebar - Hidden when Sidebar Closed */}
            <aside
                className={`w-80 bg-[--bg-secondary] border-l border-[--bg-tertiary] flex flex-col transition-all duration-300 ease-in-out transform absolute right-0 top-0 bottom-0 z-30 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="p-4 border-b border-[--bg-tertiary] flex items-center justify-between bg-[--bg-secondary]">
                    <h2 className="font-semibold text-[--text-primary] flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-[--accent-primary]" />
                        Render Config
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-[--bg-tertiary]">

                    {/* Scene Type */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[--text-secondary] uppercase tracking-wider">Tipo de Escena</label>
                        <div className="flex bg-[--bg-primary] p-1 rounded-lg border border-[--bg-tertiary]">
                            <button
                                onClick={() => setSceneType('exterior')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sceneType === 'exterior' ? 'bg-[--accent-primary] text-white shadow-md' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                            >
                                Exterior
                            </button>
                            <button
                                onClick={() => setSceneType('interior')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sceneType === 'interior' ? 'bg-[--accent-primary] text-white shadow-md' : 'text-[--text-secondary] hover:text-[--text-primary]'}`}
                            >
                                Interior
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Controls based on Scene Type */}
                    <div className="space-y-4">
                        {sceneType === 'exterior' ? (
                            <>
                                <PillGroup label="Hora del día" options={['Amanecer', 'Mañana', 'Mediodía', 'Atardecer', 'Noche', 'Hora dorada']} value={timeOfDay} onChange={setTimeOfDay} />
                                <PillGroup label="Clima" options={['Soleado', 'Nublado', 'Lluvioso', 'Niebla', 'Nieve']} value={weather} onChange={setWeather} />
                                <PillGroup label="Estilo Arquitectónico" options={['Moderno', 'Contemporáneo', 'Minimalista', 'Industrial', 'Brutalista', 'Clásico', 'Futurista']} value={archStyle} onChange={setArchStyle} />
                            </>
                        ) : (
                            <>
                                <PillGroup label="Tipo de Habitación" options={['Sala de estar', 'Dormitorio', 'Cocina', 'Baño', 'Oficina', 'Comedor', 'Lobby']} value={roomType} onChange={setRoomType} />
                                <PillGroup label="Estilo de Interior" options={['Moderno', 'Escandinavo', 'Industrial', 'Boho', 'Minimalista', 'Lujoso']} value={archStyle} onChange={setArchStyle} />
                                <PillGroup label="Iluminación" options={['Natural', 'Cálida', 'Fría', 'Cinemática', 'Estudio', 'Neón']} value={lighting} onChange={setLighting} />
                            </>
                        )}
                    </div>

                    <div className="h-px bg-[--bg-tertiary]"></div>

                    {/* Sliders */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-[10px] font-bold text-[--text-secondary] uppercase tracking-wider">Libertad Creativa</label>
                            <span className="text-xs text-[--text-secondary] font-mono">{creativeFreedom}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={creativeFreedom}
                            onChange={(e) => setCreativeFreedom(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer accent-[--accent-primary]"
                        />
                        <p className="text-[10px] text-[--text-tertiary] leading-tight">
                            {creativeFreedom < 30 ? "Alta fidelidad al trazo original" : creativeFreedom > 70 ? "Más creatividad e interpretación" : "Balanceado"}
                        </p>
                    </div>

                    {/* Additional Prompt */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[--text-secondary] uppercase tracking-wider">Detalles Adicionales</label>
                        <textarea
                            value={additionalPrompt}
                            onChange={(e) => setAdditionalPrompt(e.target.value)}
                            placeholder="Ej: Fachada de madera, muchas plantas, luces cálidas..."
                            className="w-full h-20 bg-[--bg-primary] border border-[--bg-tertiary] rounded-md p-2 text-xs text-[--text-primary] focus:border-[--accent-primary] outline-none resize-none placeholder:text-[--text-tertiary]"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-[--bg-tertiary] space-y-3 bg-[--bg-secondary]">

                    {/* Undo/Redo Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={onUndo} disabled={!canUndo}
                            className="flex-1 py-1.5 bg-[--bg-primary] text-[--text-secondary] rounded-md border border-[--bg-tertiary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Deshacer"
                        >
                            <UndoIcon className="w-4 h-4" /> Deshacer
                        </button>
                        <button
                            onClick={onRedo} disabled={!canRedo}
                            className="flex-1 py-1.5 bg-[--bg-primary] text-[--text-secondary] rounded-md border border-[--bg-tertiary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Rehacer"
                        >
                            Rehacer <RedoIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={handleConvertToPhotorealistic}
                        disabled={!inputImage || isGenerating}
                        className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isGenerating ? "Generando..." : <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Convertir a Fotorealista</>}
                    </button>

                    {/* Bottom Actions Row: Save | Reset */}
                    <div className="flex gap-2">
                        {/* Save Button */}
                        {resultImage ? (
                            <a
                                href={resultImage}
                                download={`Render_${Date.now()}.png`}
                                className="flex-1 py-2 rounded-md bg-emerald-600/10 border border-emerald-600/30 text-emerald-500 font-bold text-xs hover:bg-emerald-600/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <SaveIcon className="w-4 h-4" /> Guardar
                            </a>
                        ) : (
                            <button disabled className="flex-1 py-2 rounded-md bg-[--bg-tertiary] border border-[--bg-tertiary] text-[--text-tertiary] font-medium text-xs flex items-center justify-center gap-1 cursor-not-allowed">
                                <SaveIcon className="w-4 h-4" /> Guardar
                            </button>
                        )}

                        {/* Reset Button */}
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

const PillGroup: React.FC<{ label: string, options: string[], value: string, onChange: (val: string) => void }> = ({ label, options, value, onChange }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[--text-secondary] uppercase tracking-wider">{label}</label>
        <div className="flex flex-wrap gap-1.5">
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onChange(opt.toLowerCase())}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${value.toLowerCase() === opt.toLowerCase()
                        ? 'bg-[--text-primary] text-[--bg-primary] border-[--text-primary]'
                        : 'bg-transparent text-[--text-secondary] border-[--bg-tertiary] hover:border-[--text-secondary]'
                        }`}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
);
