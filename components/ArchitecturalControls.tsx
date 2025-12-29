
import React, { useState } from 'react';
import { SparklesIcon, ChevronLeftIcon, ChevronRightIcon, UploadIcon, ChevronUpIcon, ChevronDownIcon, SaveIcon, TrashIcon } from './icons';
import { useInstructionPresets } from '../hooks/useInstructionPresets';
import { SavedInstruction } from '../types';

const CollapsibleSection = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="space-y-2 border border-theme-bg-tertiary rounded-lg p-3 bg-theme-bg-primary/20">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-[10px] font-black text-theme-accent-primary uppercase tracking-[0.2em] hover:text-theme-text-primary transition-colors py-1 focus:outline-none group"
            >
                <span className="group-hover:translate-x-1 transition-transform">{title}</span>
                {isOpen ? <ChevronUpIcon className="w-3 h-3 text-theme-text-tertiary" /> : <ChevronDownIcon className="w-3 h-3 text-theme-text-tertiary" />}
            </button>
            {isOpen && <div className="space-y-4 pt-2 animate-in slide-in-from-top-1 fade-in duration-200 border-t border-theme-bg-tertiary/50">{children}</div>}
        </div>
    );
};
import { SceneType, RenderStyleMode } from '../utils/architecturalPromptBuilder';
import { RenderStyleSettings } from '../types';

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
    renderStyleSettings: RenderStyleSettings;
    setRenderStyleSettings: (v: RenderStyleSettings) => void;
    matchMateriality: boolean;
    setMatchMateriality: (v: boolean) => void;
    additionalPrompt: string;
    setAdditionalPrompt: (v: string) => void;
    styleReferenceImage: string | null;
    setStyleReferenceImage: (v: string | null) => void;
    styleReferenceDescription?: string;
    isAnalyzingReference?: boolean;
    analyzeReferenceImage?: () => void;
    onRender: () => void;
    isGenerating: boolean;
    previewBackground?: string | null;
    previewComposite?: string | null;
    userId?: string;
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
    renderStyleSettings, setRenderStyleSettings,
    matchMateriality, setMatchMateriality,
    additionalPrompt, setAdditionalPrompt,
    styleReferenceImage, setStyleReferenceImage,
    styleReferenceDescription, isAnalyzingReference, analyzeReferenceImage,
    onRender,
    isGenerating,
    previewBackground,
    previewComposite,
    userId
}) => {
    // Local state for debouncing additionalPrompt
    const [localPrompt, setLocalPrompt] = React.useState(additionalPrompt);

    // Presets State
    const { savedInstructions, addPreset, deletePreset } = useInstructionPresets(userId);
    const [saveName, setSaveName] = useState('');
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isPresetsDropdownOpen, setIsPresetsDropdownOpen] = useState(false);

    const handleSavePreset = () => {
        if (!saveName.trim() || !localPrompt.trim()) return;
        addPreset(saveName.trim(), localPrompt, 'advanced');
        setSaveName('');
        setIsSaveOpen(false);
    };

    const handleLoadPreset = (preset: SavedInstruction) => {
        setLocalPrompt(preset.content);
        // Prompt will sync via effect
    };

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
    // Options
    const timeOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Mañana', value: 'morning' }, { label: 'Mediodía', value: 'noon' }, { label: 'Tarde', value: 'afternoon' }, { label: 'Hora Dorada', value: 'golden_hour' }, { label: 'Noche', value: 'night' }];
    const weatherOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Soleado', value: 'sunny' }, { label: 'Nublado', value: 'overcast' }, { label: 'Lluvia', value: 'rainy' }, { label: 'Niebla', value: 'foggy' }];
    const sceneTypeOptions = [
        { label: 'Exterior Arquitectónico', value: 'exterior' },
        { label: 'Interior Arquitectónico', value: 'interior' },
        { label: 'Objeto (Interior)', value: 'object_interior' },
        { label: 'Objeto (Exterior)', value: 'object_exterior' },
        { label: 'Fotografía de Estudio', value: 'studio' },
        { label: 'Automotriz', value: 'automotive' }
    ];
    const renderStyleOptions = [
        { label: 'Fotorealista', value: 'photorealistic' },
        { label: 'Boceto Digital', value: 'digital_painting' },
        { label: 'Tinta y Acuarela', value: 'watercolor' },
        { label: 'Plano Técnico', value: 'technical_plan' },
        { label: 'Carboncillo', value: 'charcoal' },
        { label: 'Maqueta de Arcilla', value: 'clay_model' },
        { label: 'Lápiz de Color', value: 'colored_pencil' },
        { label: 'Marcador', value: 'ink_marker' },
        { label: 'Cartoon 3D', value: '3d_cartoon' }
    ];

    // Helper for Style Specific Options
    const updateStyleSetting = (key: keyof RenderStyleSettings, val: string) => {
        setRenderStyleSettings({ ...renderStyleSettings, [key]: val });
    };

    const getStyleSpecificControls = () => {
        switch (renderStyle) {
            case 'photorealistic':
                return (
                    <>
                        <CollapsiblePillGroup label="Cámara" options={[{ l: 'DSLR', v: 'dslr' }, { l: 'Formato Medio', v: 'large_format' }, { l: 'Aérea/Drone', v: 'drone' }, { l: 'Polaroid', v: 'instant' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.phCamera} onChange={(v) => updateStyleSetting('phCamera', v)} />
                        <CollapsiblePillGroup label="Película" options={[{ l: 'Digital', v: 'digital' }, { l: 'Kodak Portra', v: 'kodak_portra' }, { l: 'Fuji Pro', v: 'fujifilm' }, { l: 'B&W', v: 'bw_film' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.phFilm} onChange={(v) => updateStyleSetting('phFilm', v)} />
                        <CollapsiblePillGroup label="Efecto de Lente" options={[{ l: 'Limpio', v: 'clean' }, { l: 'Bokeh', v: 'bokeh' }, { l: 'Viñeta', v: 'vignette' }, { l: 'Glow', v: 'cinematic_bloom' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.phEffect} onChange={(v) => updateStyleSetting('phEffect', v)} />
                    </>
                );
            case 'digital_painting':
                return (
                    <>
                        <CollapsiblePillGroup label="Pincel" options={[{ l: 'Óleo', v: 'oil' }, { l: 'Marcador', v: 'marker' }, { l: 'Aerógrafo', v: 'airbrush' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.dsBrush} onChange={(v) => updateStyleSetting('dsBrush', v)} />
                        <CollapsiblePillGroup label="Acabado" options={[{ l: 'Limpio', v: 'clean' }, { l: 'Sucio', v: 'messy' }, { l: 'Pulido', v: 'polished' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.dsFinish} onChange={(v) => updateStyleSetting('dsFinish', v)} />
                        <CollapsiblePillGroup label="Trazo" options={[{ l: 'Fino', v: 'fine' }, { l: 'Medio', v: 'medium' }, { l: 'Grueso', v: 'thick' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.dsStroke} onChange={(v) => updateStyleSetting('dsStroke', v)} />
                    </>
                );
            case 'watercolor':
                return (
                    <>
                        <CollapsiblePillGroup label="Técnica" options={[{ l: 'Húmedo', v: 'wet' }, { l: 'Seco', v: 'dry' }, { l: 'Lavado', v: 'wash' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.wcTechnique} onChange={(v) => updateStyleSetting('wcTechnique', v)} />
                        <CollapsiblePillGroup label="Papel" options={[{ l: 'Grano Fino', v: 'fine_grain' }, { l: 'Rugoso', v: 'rough' }, { l: 'Liso', v: 'smooth' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.wcPaper} onChange={(v) => updateStyleSetting('wcPaper', v)} />
                        <CollapsiblePillGroup label="Tinta" options={[{ l: 'Estilográfica', v: 'fountain' }, { l: 'Pincel', v: 'brush_pen' }, { l: 'Pluma', v: 'dip_pen' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.wcInk} onChange={(v) => updateStyleSetting('wcInk', v)} />
                    </>
                );
            case 'technical_plan':
                return (
                    <>
                        <CollapsiblePillGroup label="Fondo" options={[{ l: 'Azul Blueprint', v: 'blue' }, { l: 'Blanco', v: 'white' }, { l: 'Gris', v: 'gray' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tpBackground} onChange={(v) => updateStyleSetting('tpBackground', v)} />
                        <CollapsiblePillGroup label="Precisión" options={[{ l: 'CAD', v: 'cad' }, { l: 'Mano Alzada', v: 'hand_drawn' }, { l: 'Borrador', v: 'draft' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tpPrecision} onChange={(v) => updateStyleSetting('tpPrecision', v)} />
                        <CollapsiblePillGroup label="Detalles" options={[{ l: 'Mínimos', v: 'low' }, { l: 'Ricos', v: 'high' }, { l: 'Solo Masas', v: 'massing' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tpDetails} onChange={(v) => updateStyleSetting('tpDetails', v)} />
                    </>
                );
            case 'charcoal':
                return (
                    <>
                        <CollapsiblePillGroup label="Difuminado" options={[{ l: 'Suave', v: 'soft' }, { l: 'Rudo', v: 'hard' }, { l: 'Limpio', v: 'clean' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.chSmudge} onChange={(v) => updateStyleSetting('chSmudge', v)} />
                        <CollapsiblePillGroup label="Contraste" options={[{ l: 'Gris Suave', v: 'soft_gray' }, { l: 'Negro Profundo', v: 'deep_black' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.chContrast} onChange={(v) => updateStyleSetting('chContrast', v)} />
                        <CollapsiblePillGroup label="Trazado" options={[{ l: 'Cruzado', v: 'cross' }, { l: 'Vertical', v: 'vertical' }, { l: 'Libre', v: 'free' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.chHatch} onChange={(v) => updateStyleSetting('chHatch', v)} />
                    </>
                );
            case 'clay_model':
                return (
                    <>
                        <CollapsiblePillGroup label="Material" options={[{ l: 'Arcilla Blanca', v: 'white_clay' }, { l: 'Resina', v: 'resin' }, { l: 'Terracota', v: 'terracotta' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cmMaterial} onChange={(v) => updateStyleSetting('cmMaterial', v)} />
                        <CollapsiblePillGroup label="Superficie" options={[{ l: 'Pulida', v: 'smooth' }, { l: 'Esculpida', v: 'sculpted' }, { l: 'Rugosa', v: 'rough' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cmSurface} onChange={(v) => updateStyleSetting('cmSurface', v)} />
                        <CollapsiblePillGroup label="Iluminación" options={[{ l: 'Estudio Soft', v: 'studio_soft' }, { l: 'Contraste', v: 'high_contrast' }, { l: 'Natural', v: 'natural' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cmLighting} onChange={(v) => updateStyleSetting('cmLighting', v)} />
                    </>
                );
            case 'ink_marker':
                return (
                    <>
                        <CollapsiblePillGroup label="Papel" options={[{ l: 'Bond', v: 'im_bond_paper' }, { l: 'Marker Paper', v: 'im_marker_paper' }, { l: 'Vegetal', v: 'im_tracing_paper' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.imPaper} onChange={(v) => updateStyleSetting('imPaper', v)} />
                        <CollapsiblePillGroup label="Técnica" options={[{ l: 'Suelto', v: 'im_loose' }, { l: 'Capas', v: 'im_layered' }, { l: 'Preciso', v: 'im_precise' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.imTechnique} onChange={(v) => updateStyleSetting('imTechnique', v)} />
                        <CollapsiblePillGroup label="Paleta" options={[{ l: 'Vibrante', v: 'im_vibrant' }, { l: 'Grises', v: 'im_grayscale' }, { l: 'Pastel', v: 'im_muted' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.imColor} onChange={(v) => updateStyleSetting('imColor', v)} />
                    </>
                );
            case '3d_cartoon':
                return (
                    <>
                        <CollapsiblePillGroup label="Estilo" options={[{ l: 'Pixar', v: 'tc_pixar' }, { l: 'Clay', v: 'tc_clay' }, { l: 'Juguete', v: 'tc_toy' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tcStyle} onChange={(v) => updateStyleSetting('tcStyle', v)} />
                        <CollapsiblePillGroup label="Material" options={[{ l: 'Plástico', v: 'tc_plastic' }, { l: 'Mate', v: 'tc_matte' }, { l: 'Glossy', v: 'tc_glossy' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tcMaterial} onChange={(v) => updateStyleSetting('tcMaterial', v)} />
                        <CollapsiblePillGroup label="Iluminación" options={[{ l: 'Suave', v: 'tc_soft' }, { l: 'Estudio', v: 'tc_studio' }, { l: 'Solar', v: 'tc_sun' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.tcLighting} onChange={(v) => updateStyleSetting('tcLighting', v)} />
                    </>
                );
            case 'colored_pencil':
                return (
                    <>
                        <CollapsiblePillGroup label="Técnica" options={[{ l: 'Tramado', v: 'cp_hatching' }, { l: 'Suave', v: 'cp_smooth' }, { l: 'Boceto', v: 'cp_sketchy' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cpTechnique} onChange={(v) => updateStyleSetting('cpTechnique', v)} />
                        <CollapsiblePillGroup label="Papel" options={[{ l: 'Blanco', v: 'cp_white' }, { l: 'Tonificado', v: 'cp_toned' }, { l: 'Texturado', v: 'cp_textured' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cpPaper} onChange={(v) => updateStyleSetting('cpPaper', v)} />
                        <CollapsiblePillGroup label="Vibrancia" options={[{ l: 'Suave', v: 'cp_soft' }, { l: 'Vibrante', v: 'cp_vibrant' }, { l: 'Realista', v: 'cp_realistic' }].map(o => ({ label: o.l, value: o.v }))} value={renderStyleSettings.cpVibrancy} onChange={(v) => updateStyleSetting('cpVibrancy', v)} />
                    </>
                );
            default:
                return <div className="text-[10px] text-theme-text-secondary italic p-2">Sin opciones específicas para este estilo.</div>;
        }
    };
    const archStyleOptions = [
        { label: 'Igualar Referencia', value: 'match_source' },
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
    const roomOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Sala', value: 'living_room' }, { label: 'Cocina', value: 'kitchen' }, { label: 'Dormitorio', value: 'bedroom' }, { label: 'Baño', value: 'bathroom' }, { label: 'Oficina', value: 'office' }, { label: 'Aula', value: 'classroom' }, { label: 'Laboratorio', value: 'laboratory' }, { label: 'Taller', value: 'workshop' }, { label: 'Gym', value: 'gym' }, { label: 'Hotel', value: 'hotel_room' }, { label: 'Retail', value: 'retail_store' }, { label: 'Restaurante', value: 'restaurant' }, { label: 'Lobby', value: 'lobby' }, { label: 'Mall', value: 'mall_hallway' }];
    const lightingOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Natural', value: 'natural' }, { label: 'Natural (Mañana)', value: 'natural_morning' }, { label: 'Natural (Tarde)', value: 'natural_afternoon' }, { label: 'Cálida (3000K)', value: 'warm_artificial' }, { label: 'Neutra (4000K)', value: 'neutral_artificial' }, { label: 'Fría (5000K)', value: 'cold_artificial' }, { label: 'Studio', value: 'studio' }, { label: 'Moody (Dramático)', value: 'moody' }];
    const studioLightOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Softbox (Suave)', value: 'softbox' }, { label: 'Rim Light (Silueta)', value: 'rim_light' }, { label: 'Luz Dura (Hard Key)', value: 'hard_key' }, { label: 'Dramático', value: 'dramatic' }];
    const studioBgOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Infinito Blanco', value: 'infinity_white' }, { label: 'Infinito Negro', value: 'infinity_black' }, { label: 'Concreto', value: 'concrete' }, { label: 'Gel Color', value: 'colored_gel' }];
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
                {/* 1. Tipo de escena */}
                <div className="space-y-4">
                    <CollapsiblePillGroup label="Tipo de Escena" options={sceneTypeOptions} value={sceneType} onChange={(v) => setSceneType(v as SceneType)} />
                </div>

                {/* 2. Estilo de renderizado */}
                {sceneType !== 'object_integration' && (
                    <div className="space-y-4">
                        <CollapsiblePillGroup label="Estilo de Renderizado" options={renderStyleOptions} value={renderStyle} onChange={(v) => setRenderStyle(v as RenderStyleMode)} />
                    </div>
                )}

                {/* 3. Estilo de referencia (Imagen) */}
                {sceneType !== 'object_integration' && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center justify-between">
                            Referencia de Estilo
                            {styleReferenceImage && <button onClick={() => setStyleReferenceImage(null)} className="text-[9px] text-red-400 hover:text-red-300">Borrar</button>}
                        </label>
                        <div className={`border border-dashed rounded-lg p-2 flex flex-col items-center justify-center transition-colors cursor-pointer relative overflow-hidden group h-32 ${styleReferenceImage ? 'border-theme-accent-primary bg-black/20' : 'border-theme-bg-tertiary hover:bg-theme-bg-primary hover:border-theme-text-secondary'}`}>
                            {styleReferenceImage ? (
                                <img src={styleReferenceImage} className="w-full h-full object-cover rounded" title="Imagen de referencia" />
                            ) : (
                                <div className="flex flex-col items-center p-2 text-center">
                                    <UploadIcon className="w-6 h-6 text-theme-text-tertiary mb-2" />
                                    <span className="text-[10px] text-theme-text-secondary">Arrastra o Click para subir imagen de estilo</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleStyleRefUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Subir referencia" />
                        </div>
                        {(isAnalyzingReference || styleReferenceDescription) && (
                            <div className="p-2 bg-theme-bg-tertiary/20 rounded border border-theme-bg-tertiary mt-2">
                                <div className="text-[9px] font-bold text-theme-text-secondary mb-1 flex items-center gap-1">
                                    <SparklesIcon className={`w-3 h-3 text-theme-accent-primary ${isAnalyzingReference ? 'animate-spin' : ''}`} />
                                    {isAnalyzingReference ? "ANALIZANDO ESTILO..." : "ANÁLISIS IA DETECTADO:"}
                                </div>
                                {!isAnalyzingReference && <p className="text-[10px] text-theme-text-tertiary italic leading-relaxed max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-theme-bg-tertiary/50 pr-1">{styleReferenceDescription}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* INTEGRATION PREVIEW SECTION */}
                {sceneType === 'object_integration' && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-2">Input Visual (Integración)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Background Preview */}
                            <div className="aspect-square bg-black/20 rounded border border-theme-bg-tertiary relative overflow-hidden group">
                                {previewBackground ? (
                                    <img src={previewBackground} className="w-full h-full object-cover" />
                                ) : <div className="text-[9px] text-theme-text-tertiary flex items-center justify-center h-full text-center p-2">Sin Fondo<br />(Añade imagen al canvas)</div>}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-1 text-center font-bold">Fondo Sketch</div>
                            </div>
                            {/* Sketch Preview */}
                            <div className="aspect-square bg-black/20 rounded border border-theme-bg-tertiary relative overflow-hidden group">
                                {previewComposite ? (
                                    <img src={previewComposite} className="w-full h-full object-cover" />
                                ) : <div className="text-[9px] text-theme-text-tertiary flex items-center justify-center h-full text-center p-2">Sin Objeto<br />(Dibuja algo)</div>}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-1 text-center font-bold">Composite</div>
                            </div>
                        </div>
                        <p className="text-[9px] text-theme-text-tertiary italic">
                            * La IA integrará el objeto dibujado en el fondo, respetando la iluminación y perspectiva de la imagen de fondo.
                        </p>
                    </div>
                )}

                {/* 4. Opciones de estilo (Render Style Specifics) */}
                {sceneType !== 'object_integration' && (
                    <CollapsibleSection title="Opciones de estilo" defaultOpen={false}>
                        {getStyleSpecificControls()}
                    </CollapsibleSection>
                )}

                {/* 5. Opciones de Escena (Sujeto + Entorno) */}
                {sceneType !== 'object_integration' && (
                    <CollapsibleSection title="Opciones de Escena" defaultOpen={false}>
                        {(sceneType === 'exterior' || sceneType === 'interior') && (
                            <>
                                <div className="flex items-center justify-between p-2 rounded bg-theme-bg-tertiary/30 border border-theme-bg-tertiary mb-1">
                                    <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Preservar Materialidad Original</span>
                                    <input
                                        type="checkbox"
                                        checked={matchMateriality}
                                        onChange={(e) => setMatchMateriality(e.target.checked)}
                                        className="accent-theme-accent-primary w-3 h-3 cursor-pointer"
                                    />
                                </div>
                                <CollapsiblePillGroup label="Estilo Arquitectónico" options={archStyleOptions} value={archStyle} onChange={setArchStyle} />
                            </>
                        )}
                        {sceneType === 'exterior' && (
                            <>
                                <CollapsiblePillGroup label="Hora del día" options={timeOptions} value={timeOfDay} onChange={setTimeOfDay} />
                                <CollapsiblePillGroup label="Clima" options={weatherOptions} value={weather} onChange={setWeather} />
                            </>
                        )}
                        {sceneType === 'interior' && (
                            <>
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
                                <CollapsiblePillGroup label="Material Principal" options={objMatOptions} value={objectMaterial} onChange={setObjectMaterial} />
                                <CollapsiblePillGroup label="Contexto" options={objContextOptions} value={objectContext} onChange={setObjectContext} />
                                <CollapsiblePillGroup label="Lente / Foco" options={objDofOptions} value={objectDoF} onChange={setObjectDoF} />
                            </>
                        )}
                    </CollapsibleSection>
                )}

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
                    {/* Additional Prompt */}
                    <div className="space-y-2 relative z-10">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Detalles Adicionales</label>
                            <div className="flex items-center gap-2">
                                {/* Presets Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsPresetsDropdownOpen(!isPresetsDropdownOpen)}
                                        className="text-[10px] text-theme-text-secondary hover:text-theme-text-primary flex items-center gap-1"
                                        title="Cargar Preset"
                                    >
                                        Presets <ChevronDownIcon className="w-3 h-3" />
                                    </button>
                                    {isPresetsDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-1 w-48 bg-theme-bg-primary border border-theme-bg-tertiary rounded shadow-xl max-h-48 overflow-y-auto z-20">
                                            {savedInstructions.length === 0 ? (
                                                <div className="p-2 text-[10px] text-theme-text-tertiary italic text-center">No hay presets.</div>
                                            ) : (
                                                savedInstructions.map(preset => (
                                                    <div
                                                        key={preset.id}
                                                        className="flex items-center justify-between p-2 hover:bg-theme-bg-secondary cursor-pointer group border-b border-theme-bg-tertiary last:border-0"
                                                    >
                                                        <span className="text-xs text-theme-text-primary truncate flex-1" onClick={() => { handleLoadPreset(preset); setIsPresetsDropdownOpen(false); }}>{preset.name}</span>
                                                        {preset.source === 'simple' && <span className="text-[9px] text-theme-text-tertiary mr-1" title="Creado en Render Simple">(S)</span>}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); if (confirm('¿Borrar?')) deletePreset(preset.id); }}
                                                            className="p-1 text-theme-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsSaveOpen(!isSaveOpen)}
                                    className="text-[10px] text-theme-accent-primary hover:text-theme-accent-hover flex items-center gap-1"
                                    title="Guardar instrucciones actuales como preset"
                                >
                                    <SaveIcon className="w-3 h-3" /> Guardar
                                </button>
                            </div>
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
                    </div>
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
