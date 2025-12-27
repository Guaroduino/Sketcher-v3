
import React, { useState } from 'react';
import { SparklesIcon, ChevronLeftIcon, ChevronRightIcon, UploadIcon } from './icons';
import { SceneType, RenderStyleMode } from '../utils/architecturalPromptBuilder';

interface ArchitecturalControlsProps {
    sceneType: SceneType;
    setSceneType: (v: SceneType) => void;
    renderStyle: RenderStyleMode;
    setRenderStyle: (v: RenderStyleMode) => void;
    archStyle: string;
    setArchStyle: (v: string) => void;
    timeOfDay: string;
    setTimeOfDay: (v: string) => void;
    weather: string;
    setWeather: (v: string) => void;
    roomType: string;
    setRoomType: (v: string) => void;
    lighting: string;
    setLighting: (v: string) => void;
    studioLighting: string;
    setStudioLighting: (v: string) => void;
    studioBackground: string;
    setStudioBackground: (v: string) => void;
    studioShot: string;
    setStudioShot: (v: string) => void;
    carAngle: string;
    setCarAngle: (v: string) => void;
    carEnvironment: string;
    setCarEnvironment: (v: string) => void;
    carColor: string;
    setCarColor: (v: string) => void;
    objectMaterial: string;
    setObjectMaterial: (v: string) => void;
    objectDoF: string;
    setObjectDoF: (v: string) => void;
    objectContext: string;
    setObjectContext: (v: string) => void;
    creativeFreedom: number;
    setCreativeFreedom: (v: number) => void;
    additionalPrompt: string;
    setAdditionalPrompt: (v: string) => void;
    styleReferenceImage: string | null;
    setStyleReferenceImage: (v: string | null) => void;
    onRender: () => void;
    isGenerating: boolean;
}

const CollapsiblePillGroup: React.FC<{ label: string, options: { label: string, value: string }[], value: string, onChange: (val: string) => void }> = ({ label, options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div className="border border-theme-bg-tertiary rounded-lg overflow-hidden transition-all bg-theme-bg-primary">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-theme-bg-tertiary/30 hover:bg-theme-bg-tertiary/50 transition-colors"
                title={selectedLabel}
            >
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-wider whitespace-nowrap">{label}</span>
                    {!isOpen && <span className="text-[10px] font-medium text-theme-accent-primary truncate max-w-[200px]">{selectedLabel}</span>}
                </div>
                {/* Chevron */}
                <svg className={`w-3 h-3 text-theme-text-secondary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export const ArchitecturalControls: React.FC<ArchitecturalControlsProps> = React.memo(({
    sceneType, setSceneType,
    renderStyle, setRenderStyle,
    archStyle, setArchStyle,
    timeOfDay, setTimeOfDay,
    weather, setWeather,
    roomType, setRoomType,
    lighting, setLighting,
    studioLighting, setStudioLighting,
    studioBackground, setStudioBackground,
    studioShot, setStudioShot,
    carAngle, setCarAngle,
    carEnvironment, setCarEnvironment,
    carColor, setCarColor,
    objectMaterial, setObjectMaterial,
    objectDoF, setObjectDoF,
    objectContext, setObjectContext,
    creativeFreedom, setCreativeFreedom,
    additionalPrompt, setAdditionalPrompt,
    styleReferenceImage, setStyleReferenceImage,
    onRender,
    isGenerating
}) => {
    // Local state for debouncing additionalPrompt
    const [localPrompt, setLocalPrompt] = React.useState(additionalPrompt);

    // Sync local state when external prop changes (e.g. project load)
    React.useEffect(() => {
        setLocalPrompt(additionalPrompt);
    }, [additionalPrompt]);

    // Debounce sync to parent
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localPrompt !== additionalPrompt) {
                setAdditionalPrompt(localPrompt);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localPrompt, additionalPrompt, setAdditionalPrompt]);

    // Options
    const timeOptions = [{ label: 'Mañana', value: 'morning' }, { label: 'Mediodía', value: 'noon' }, { label: 'Tarde', value: 'afternoon' }, { label: 'Hora Dorada', value: 'golden_hour' }, { label: 'Noche', value: 'night' }];
    const weatherOptions = [{ label: 'Soleado', value: 'sunny' }, { label: 'Nublado', value: 'overcast' }, { label: 'Lluvia', value: 'rainy' }, { label: 'Niebla', value: 'foggy' }];
    const sceneTypeOptions = [
        { label: 'Exterior Arquitectónico', value: 'exterior' },
        { label: 'Interior Arquitectónico', value: 'interior' },
        { label: 'Objeto (Interior)', value: 'object_interior' },
        { label: 'Objeto (Exterior)', value: 'object_exterior' },
        { label: 'Fotografía de Estudio', value: 'studio' },
        { label: 'Automotriz', value: 'automotive' },
    ];
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
    const studioLightOptions = [{ label: 'Softbox (Suave)', value: 'softbox' }, { label: 'Rim Light (Silueta)', value: 'rim_light' }, { label: 'Luz Dura (Hard Key)', value: 'hard_key' }, { label: 'Dramático', value: 'dramatic' }];
    const studioBgOptions = [{ label: 'Infinito Blanco', value: 'infinity_white' }, { label: 'Infinito Negro', value: 'infinity_black' }, { label: 'Concreto', value: 'concrete' }, { label: 'Gel Color', value: 'colored_gel' }];
    const studioShotOptions = [{ label: 'Plano Medio', value: 'full_shot' }, { label: 'Primer Plano (Macro)', value: 'close_up' }, { label: 'Knolling (Top Down)', value: 'knolling' }];
    const carAngleOptions = [{ label: 'Frente 3/4', value: 'front_three_quarter' }, { label: 'Perfil Lateral', value: 'side_profile' }, { label: 'Trasera', value: 'rear' }, { label: 'Contrapicado (Hero)', value: 'low_angle_hero' }];
    const carEnvOptions = [{ label: 'Estudio Limpio', value: 'studio' }, { label: 'Calle Ciudad', value: 'city_street' }, { label: 'Pista Carreras', value: 'raceway' }, { label: 'Naturaleza', value: 'nature_scenic' }];
    const carColorOptions = [{ label: 'Original', value: 'none' }, { label: 'Rojo Ferrari', value: 'rosso_corsa' }, { label: 'Plata Metálico', value: 'silver_metallic' }, { label: 'Negro Mate', value: 'matte_black' }, { label: 'Blanco Perla', value: 'pearl_white' }, { label: 'Azul Midnight', value: 'midnight_blue' }];
    const objMatOptions = [{ label: 'Plástico Mate', value: 'matte_plastic' }, { label: 'Metal Cepillado', value: 'brushed_metal' }, { label: 'Vidrio', value: 'glass' }, { label: 'Cerámica', value: 'ceramic' }, { label: 'Madera Fina', value: 'wood' }];
    const objDofOptions = [{ label: 'Macro (Bokeh)', value: 'macro_focus' }, { label: 'Retrato (f/1.8)', value: 'shallow_depth_of_field' }, { label: 'Todo en Foco', value: 'wide_focus' }];
    const objContextOptions = [{ label: 'Mesa de Estudio', value: 'table_top' }, { label: 'Exterior Desenfocado', value: 'outdoor_blur' }];

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

    return (
        <div className="flex flex-col h-full bg-theme-bg-secondary">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-theme-bg-tertiary">
                {/* Scene Type Select */}
                <div className="space-y-4">
                    <CollapsiblePillGroup label="Tipo de Escena" options={sceneTypeOptions} value={sceneType} onChange={(v) => setSceneType(v as SceneType)} />
                </div>

                {/* Style Reference Upload */}
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
                <div className="space-y-4">
                    {/* Render Style */}
                    <CollapsiblePillGroup label="Estilo de Renderizado" options={renderStyleOptions} value={renderStyle} onChange={(v) => setRenderStyle(v as RenderStyleMode)} />

                    <div className="h-px bg-theme-bg-tertiary"></div>

                    {/* Scene Options */}
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
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        placeholder="Ej: Fachada de madera..."
                        className="w-full h-20 bg-theme-bg-primary border border-theme-bg-tertiary rounded-md p-2 text-xs text-theme-text-primary focus:border-theme-accent-primary outline-none resize-none placeholder:text-theme-text-tertiary"
                    />
                </div>
            </div>

            {/* Footer with Render Button */}
            <div className="p-4 border-t border-theme-bg-tertiary space-y-3 bg-theme-bg-secondary flex-shrink-0">
                <button
                    onClick={onRender}
                    disabled={isGenerating}
                    className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                    {isGenerating ? "Generando..." : <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Renderizar</>}
                </button>
            </div>
        </div>
    );
});
