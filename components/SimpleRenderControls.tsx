import React, { useState } from 'react';
import { SparklesIcon, SaveIcon, TrashIcon, ChevronDownIcon, EyeOpenIcon, EyeClosedIcon } from './icons';
import { useInstructionPresets } from '../hooks/useInstructionPresets';
import { SavedInstruction } from '../types';

interface SimpleRenderControlsProps {
    sketchImage: string | null;
    compositeImage: string | null;
    isGenerating: boolean;
    onRender: (prompt: string, refImages: File[], includeSketch: boolean, includeComposite: boolean) => void;
    userId?: string;
}

interface RefImage {
    id: string;
    file: File;
    preview: string;
}

export const SimpleRenderControls: React.FC<SimpleRenderControlsProps> = ({
    sketchImage,
    compositeImage,
    isGenerating,
    onRender,
    userId
}) => {
    const [prompt, setPrompt] = useState('');
    const [saveName, setSaveName] = useState('');
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isPresetsDropdownOpen, setIsPresetsDropdownOpen] = useState(false);
    const [refImages, setRefImages] = useState<RefImage[]>([]);
    const [includeSketch, setIncludeSketch] = useState(true);
    const [includeComposite, setIncludeComposite] = useState(true);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const newImage: RefImage = {
                        id: `REF_${slotIndex + 1}`,
                        file,
                        preview: ev.target.result as string
                    };
                    setRefImages(prev => {
                        const newImages = [...prev];
                        // Remove existing if any for this slot (by ID convention if we enforce order, or just filter)
                        // Actually, let's just stick to a list or map.
                        // Simplest: array of 3 possible slots.
                        const existingIndex = newImages.findIndex(img => img.id === `REF_${slotIndex + 1}`);
                        if (existingIndex >= 0) {
                            newImages[existingIndex] = newImage;
                        } else {
                            newImages.push(newImage);
                        }
                        return newImages.sort((a, b) => a.id.localeCompare(b.id));
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removeRefImage = (id: string) => {
        setRefImages(prev => prev.filter(img => img.id !== id));
    };

    const { savedInstructions, addPreset, deletePreset } = useInstructionPresets(userId);

    const handleSavePreset = () => {
        if (!saveName.trim() || !prompt.trim()) return;
        addPreset(saveName.trim(), prompt, 'simple');
        setSaveName('');
        setIsSaveOpen(false);
    };

    const handleDeletePreset = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar este preset?")) {
            deletePreset(id);
        }
    };

    const handleLoadPreset = (preset: SavedInstruction) => {
        setPrompt(preset.content);
    };

    // ... (rest of props)

    return (
        <div className="flex flex-col h-full bg-theme-bg-secondary p-4 space-y-6">
            <div className="space-y-4">
                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-2">Input Visual</label>
                <div className="grid grid-cols-2 gap-2">
                    <div className="aspect-square bg-black/20 rounded border border-theme-bg-tertiary relative overflow-hidden group">
                        {sketchImage ? (
                            <img src={sketchImage} className={`w-full h-full object-cover transition-opacity ${includeSketch ? 'opacity-100' : 'opacity-30'}`} />
                        ) : <div className="text-[9px] text-theme-text-tertiary flex items-center justify-center h-full">Sin Sketch</div>}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-1 text-center">Fondo Sketch</div>
                        {/* Toggle Button */}
                        <button
                            onClick={() => setIncludeSketch(!includeSketch)}
                            className={`absolute top-1 right-1 p-1 rounded-full transition-colors ${includeSketch ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-red-500/80 text-white hover:bg-red-600'}`}
                            title={includeSketch ? "Incluir imagen en render" : "No incluir imagen"}
                        >
                            {includeSketch ? <EyeOpenIcon className="w-3 h-3" /> : <EyeClosedIcon className="w-3 h-3" />}
                        </button>
                    </div>
                    <div className="aspect-square bg-black/20 rounded border border-theme-bg-tertiary relative overflow-hidden group">
                        {compositeImage ? (
                            <img src={compositeImage} className={`w-full h-full object-cover transition-opacity ${includeComposite ? 'opacity-100' : 'opacity-30'}`} />
                        ) : <div className="text-[9px] text-theme-text-tertiary flex items-center justify-center h-full">Sin Capas</div>}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-1 text-center">Composite</div>
                        {/* Toggle Button */}
                        <button
                            onClick={() => setIncludeComposite(!includeComposite)}
                            className={`absolute top-1 right-1 p-1 rounded-full transition-colors ${includeComposite ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-red-500/80 text-white hover:bg-red-600'}`}
                            title={includeComposite ? "Incluir imagen en render" : "No incluir imagen"}
                        >
                            {includeComposite ? <EyeOpenIcon className="w-3 h-3" /> : <EyeClosedIcon className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Reference Images Slots */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-1">Imágenes de Referencia</label>
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((index) => {
                        const id = `REF_${index + 1}`;
                        const existingImage = refImages.find(img => img.id === id);

                        return (
                            <div key={id} className="aspect-square bg-black/20 rounded border border-theme-bg-tertiary relative overflow-hidden group">
                                {existingImage ? (
                                    <>
                                        <img src={existingImage.preview} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeRefImage(id)}
                                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </>
                                ) : (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                                        <span className="text-[20px] text-theme-text-tertiary">+</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleImageUpload(e, index)}
                                        />
                                    </label>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white p-1 text-center font-mono">
                                    {id}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[9px] text-theme-text-tertiary">Usa los IDs (REF_1, etc) para referirte a ellas en el prompt.</p>
            </div>

            {/* Presets Section (Dropdown) */}
            <div className="space-y-2 relative z-10">
                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex justify-between items-center mb-1">
                    Presets Guardados
                    <span className="text-[9px] font-normal text-theme-text-tertiary">{savedInstructions.length}</span>
                </label>

                <div className="relative">
                    <button
                        onClick={() => setIsPresetsDropdownOpen(!isPresetsDropdownOpen)}
                        disabled={savedInstructions.length === 0}
                        className="w-full flex items-center justify-between p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded text-xs text-theme-text-primary hover:border-theme-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <span className="truncate">{savedInstructions.length > 0 ? "Seleccionar preset..." : "No hay presets guardados"}</span>
                        <ChevronDownIcon className={`w-3 h-3 text-theme-text-secondary transition-transform ${isPresetsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPresetsDropdownOpen && savedInstructions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-theme-bg-primary border border-theme-bg-tertiary rounded shadow-xl max-h-48 overflow-y-auto z-20">
                            {savedInstructions.map(preset => (
                                <div
                                    key={preset.id}
                                    onClick={() => { handleLoadPreset(preset); setIsPresetsDropdownOpen(false); }}
                                    className="flex items-center justify-between p-2 hover:bg-theme-bg-secondary cursor-pointer group border-b border-theme-bg-tertiary last:border-0"
                                >
                                    <span className="text-xs text-theme-text-primary truncate">{preset.name}</span>
                                    <button
                                        onClick={(e) => { handleDeletePreset(preset.id, e); }}
                                        className="p-1 text-theme-text-tertiary hover:text-red-500 hover:bg-theme-bg-tertiary rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Eliminar preset"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Instrucciones Generales</label>
                    <button
                        onClick={() => setIsSaveOpen(!isSaveOpen)}
                        className="text-[10px] text-theme-accent-primary hover:text-theme-accent-hover flex items-center gap-1"
                        title="Guardar instrucciones actuales como preset"
                    >
                        <SaveIcon className="w-3 h-3" /> Guardar
                    </button>
                </div>

                {isSaveOpen && (
                    <div className="flex items-center gap-2 mb-2 bg-theme-bg-primary p-2 rounded border border-theme-accent-primary animate-in fade-in zoom-in-95 duration-200">
                        <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="Nombre del preset..."
                            className="flex-1 bg-transparent text-xs outline-none min-w-0"
                            autoFocus
                        />
                        <button onClick={handleSavePreset} disabled={!saveName.trim()} className="text-theme-accent-primary font-bold text-xs disabled:opacity-50">OK</button>
                    </div>
                )}

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe el resultado deseado..."
                    className="w-full h-24 bg-theme-bg-primary border border-theme-bg-tertiary rounded-md p-2 text-xs text-theme-text-primary focus:border-theme-accent-primary outline-none resize-none placeholder:text-theme-text-tertiary"
                />
            </div>

            <div className="flex-grow"></div>

            <button
                onClick={() => onRender(prompt, refImages.map(r => r.file), includeSketch, includeComposite)}
                disabled={isGenerating}
                className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
                {isGenerating ? "Generando..." : <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Renderizar V2</>}
            </button>
        </div >
    );
};
