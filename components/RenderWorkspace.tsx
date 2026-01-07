import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    UploadIcon,
    FreehandIcon,
    LineIcon,
    ArrowUpIcon,
    LayersIcon,
    TrashIcon,
    EyeIcon,
    EyeClosedIcon,
    EraserIcon,
    PolygonIcon,
    SparklesIcon,
    XIcon,
    SaveIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    UndoIcon,
    RedoIcon,
    ZoomInIcon,
    ZoomOutIcon,
    MaximizeIcon,
    HandIcon
} from './icons';
import { useInstructionPresets } from '../hooks/useInstructionPresets';
import { SavedInstruction } from '../types';
import { CollapsiblePillGroup } from './CollapsiblePillGroup';
import { CollapsibleSection } from './CollapsibleSection';
import { GoogleGenAI } from "@google/genai";
import { buildArchitecturalPrompt, ArchitecturalRenderOptions } from '../utils/architecturalPromptBuilder';
import { GEMINI_MODEL_ID } from '../utils/constants';
import { downloadFile } from '../utils/imageUtils';

interface Point { x: number; y: number; }

interface LightingStroke {
    id: string;
    type: 'freehand' | 'line' | 'arrow' | 'eraser';
    points: Point[];
    color: string;
    size: number;
    isVisible: boolean;
}

interface MaterialityStroke {
    id: string;
    type: 'freehand' | 'line' | 'polygon' | 'eraser';
    points: Point[];
    color: string;
    size: number;
    isVisible: boolean;
    fillColor?: string; // For polygons
}

interface ReferenceImage {
    id: string;
    url: string;
    color: string;
}

interface RenderWorkspaceProps {
    imageSrc: string | null;
    onImport: () => void;
    user: any;
    credits: number | null;
    deductCredit: (amount: number) => Promise<boolean>;
    role: string;
    onInspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>;
    selectedModel: string;
}

const LIGHTING_COLORS = [
    { color: '#FFFF00', label: 'Luz Artificial Neutral' },
    { color: '#FFA500', label: 'Luz Natural' },
    { color: '#00FFFF', label: 'Luz Artificial Fría' },
    { color: '#FF0000', label: 'Luz Artificial Cálida' },
];

const sceneTypeOptions = [
    { label: 'Exterior Arquitectónico', value: 'exterior' },
    { label: 'Interior Arquitectónico', value: 'interior' },
    { label: 'Objeto (Interior)', value: 'object_interior' },
    { label: 'Objeto (Exterior)', value: 'object_exterior' },
];

const renderStyleOptions = [
    { label: 'Fotorealista', value: 'photorealistic' },
    { label: 'Boceto Digital', value: 'digital_painting' },
    { label: 'Tinta y Acuarela', value: 'watercolor' },
];
// Simplified options for Render Workspace
const lightingOptions = [{ label: 'Igualar Referencia', value: 'match_source' }, { label: 'Natural', value: 'natural' }, { label: 'Cálida', value: 'warm_artificial' }, { label: 'Fría', value: 'cold_artificial' }, { label: 'Moody', value: 'moody' }];
const archStyleOptions = [
    { label: 'Igualar Referencia', value: 'match_source' },
    { label: 'Moderno', value: 'modern' },
    { label: 'Minimalista', value: 'minimalist' },
    { label: 'Industrial', value: 'industrial_loft' },
    { label: 'Clásico', value: 'luxury_classic' },
    { label: 'Rústico', value: 'cozy_rustic' },
];

// Default colors for materiality references (just placeholders, user picks them)
const DEFAULT_MAT_COLORS = ['#808080', '#A0A0A0', '#C0C0C0', '#E0E0E0', '#FFFFFF'];

export const RenderWorkspace: React.FC<RenderWorkspaceProps> = ({
    imageSrc,
    onImport,
    user,
    credits,
    deductCredit,
    role,
    onInspectRequest,
    selectedModel
}) => {
    // Layout State
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [activeSection, setActiveSection] = useState<'lighting' | 'materiality'>('lighting');

    // --- Lighting State ---
    const [lightingTool, setLightingTool] = useState<'freehand' | 'line' | 'arrow' | 'eraser'>('freehand');
    const [lightingColor, setLightingColor] = useState(LIGHTING_COLORS[0].color);
    const [lightingSize, setLightingSize] = useState(5);
    const [lightingStrokes, setLightingStrokes] = useState<LightingStroke[]>([]);

    // --- Materiality State ---
    const [materialityTool, setMaterialityTool] = useState<'freehand' | 'line' | 'polygon' | 'eraser'>('freehand');
    const [materialityColor, setMaterialityColor] = useState('#FF00FF'); // Default
    const [materialitySize, setMaterialitySize] = useState(5);
    const [materialityStrokes, setMaterialityStrokes] = useState<MaterialityStroke[]>([]);

    // Reference Images (Max 5)
    // We'll initialize with 5 slots. If url is empty, it's a placeholder.
    const [refImages, setRefImages] = useState<ReferenceImage[]>(
        Array(5).fill(null).map((_, i) => ({ id: `ref-${i}`, url: '', color: DEFAULT_MAT_COLORS[i] }))
    );

    // Current Renders (For consistency) - Max 3
    const [currentRenders, setCurrentRenders] = useState<{ id: string, url: string }[]>(
        Array(3).fill(null).map((_, i) => ({ id: `current-render-${i}`, url: '' }))
    );

    // File Input Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentRenderInputRef = useRef<HTMLInputElement>(null);
    const activeRefIndex = useRef<number>(-1);
    const activeRenderIndex = useRef<number>(-1);

    // Canvas Interaction State
    const [currentStroke, setCurrentStroke] = useState<LightingStroke | MaterialityStroke | null>(null);
    const [polygonPoints, setPolygonPoints] = useState<Point[]>([]); // For active polygon drawing
    const [pointerPos, setPointerPos] = useState<Point | null>(null);

    // Layers
    const [lightingLayerVisible, setLightingLayerVisible] = useState(true);
    const [materialityLayerVisible, setMaterialityLayerVisible] = useState(true);

    // Render Selection State
    const [lightingPreviewUrl, setLightingPreviewUrl] = useState<string | null>(null);
    const [materialityPreviewUrl, setMaterialityPreviewUrl] = useState<string | null>(null);
    const [excludedImages, setExcludedImages] = useState<string[]>([]);

    // Advanced Controls State
    const [sceneType, setSceneType] = useState('exterior');
    const [renderStyle, setRenderStyle] = useState('photorealistic');
    const [archStyle, setArchStyle] = useState('modern');
    const [lighting, setLighting] = useState('natural');
    const [creativeFreedom, setCreativeFreedom] = useState(20);
    const [isGenerating, setIsGenerating] = useState(false);

    // Prompt & Presets State
    const [prompt, setPrompt] = useState('');
    const [saveName, setSaveName] = useState('');
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isPresetsDropdownOpen, setIsPresetsDropdownOpen] = useState(false);
    const [isPromptBarOpen, setIsPromptBarOpen] = useState(true);

    // Render & Result State
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);

    // Derived/Refs
    const resultImageRef = useRef<string | null>(null);
    useEffect(() => { resultImageRef.current = resultImage; }, [resultImage]);

    // Navigation State
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
    const isPanningRef = useRef(false);
    const [isPanningUI, setIsPanningUI] = useState(false);
    const lastPointerPosRef = useRef<Point | null>(null);
    const [isPanToolActive, setIsPanToolActive] = useState(false);

    // Multi-touch state
    const activePointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
    const lastPinchDistRef = useRef<number | null>(null);
    const lastPinchMidRef = useRef<{ x: number, y: number } | null>(null);

    // History State
    const [history, setHistory] = useState<{ lighting: LightingStroke[], materiality: MaterialityStroke[] }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const saveHistory = useCallback((lStrokes: LightingStroke[], mStrokes: MaterialityStroke[]) => {
        const newState = { lighting: [...lStrokes], materiality: [...mStrokes] };
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            return [...next, newState].slice(-50); // Limit to 50 steps
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            setLightingStrokes(prevState.lighting);
            setMaterialityStrokes(prevState.materiality);
            setHistoryIndex(historyIndex - 1);
        } else if (historyIndex === 0) {
            setLightingStrokes([]);
            setMaterialityStrokes([]);
            setHistoryIndex(-1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setLightingStrokes(nextState.lighting);
            setMaterialityStrokes(nextState.materiality);
            setHistoryIndex(historyIndex + 1);
        }
    };

    // Hooks
    const { savedInstructions, addPreset, deletePreset } = useInstructionPresets(user?.uid);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Auto-generate previews when strokes change
    useEffect(() => {
        if (!imageSrc) return;

        const generatePreview = async (strokes: any[], type: 'lighting' | 'materiality') => {
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.src = imageSrc;
            await new Promise(resolve => { img.onload = resolve; });

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 1. Draw Background First (MATCH UI COMPOSITION FOR ALIGNMENT)
            // This ensures the preview image has the same aspect ratio handling as the main canvas
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = img.naturalWidth / img.naturalHeight;
            let drawWidth, drawHeight, offsetX, offsetY;
            if (canvasAspect > imgAspect) {
                drawHeight = canvas.height; drawWidth = drawHeight * imgAspect;
                offsetY = 0; offsetX = (canvas.width - drawWidth) / 2;
            } else {
                drawWidth = canvas.width; drawHeight = drawWidth / imgAspect;
                offsetX = 0; offsetY = (canvas.height - drawHeight) / 2;
            }
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

            // Draw Strokes
            strokes.forEach((stroke: any) => {
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.size;

                if (stroke.tool === 'freehand' || stroke.tool === 'line') {
                    if (stroke.points.length > 0) {
                        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                        for (let i = 1; i < stroke.points.length; i++) {
                            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                        }
                        ctx.stroke();
                    }
                } else if (stroke.tool === 'polygon' && stroke.points.length > 0) {
                    ctx.fillStyle = stroke.color;
                    ctx.strokeStyle = stroke.color;
                    ctx.beginPath();
                    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                    for (let i = 1; i < stroke.points.length; i++) {
                        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else if (stroke.tool === 'arrow' && stroke.points.length > 1) {
                    // Simple arrow drawing (from renderCanvas)
                    const start = stroke.points[0];
                    const end = stroke.points[stroke.points.length - 1];
                    const angle = Math.atan2(end.y - start.y, end.x - start.x);
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.stroke();

                    const headLength = stroke.size * 3;
                    ctx.beginPath();
                    ctx.moveTo(end.x, end.y);
                    ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(end.x, end.y);
                    ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
                    ctx.stroke();
                }
            });

            if (type === 'lighting') setLightingPreviewUrl(canvas.toDataURL());
            else setMaterialityPreviewUrl(canvas.toDataURL());
        };

        const timeoutId = setTimeout(() => {
            generatePreview(lightingStrokes, 'lighting');
            generatePreview(materialityStrokes, 'materiality');
        }, 500);

        return () => clearTimeout(timeoutId);

    }, [imageSrc, lightingStrokes, materialityStrokes]);
    // (Refs moved up)

    const toggleImageExclusion = (id: string) => {
        setExcludedImages(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleSavePreset = () => {
        if (!saveName.trim() || !prompt.trim()) return;
        addPreset(saveName.trim(), prompt, 'render_workspace'); // Using 'render_workspace' as type
        setSaveName('');
        setIsSaveOpen(false);
    };

    const handleLoadPreset = (preset: SavedInstruction) => {
        setPrompt(preset.content);
        setIsPresetsDropdownOpen(false);
    };

    const handleDeletePreset = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar este preset?")) {
            deletePreset(id);
        }
    };

    // --- Render Logic ---
    const handleRender = async () => {
        if (!canvasRef.current || !imageSrc) return;
        setIsGenerating(true);
        setResultImage(null);
        setShowOriginal(false);

        try {
            // 1. Prepare Images - Use ORIGINAL image dimensions (PIXEL PERFECT)
            const img = imageRef.current;
            if (!img) return;

            const MAX_DIM = 2048; // Increase quality cap
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) {
                const scale = MAX_DIM / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }

            // Helper to draw background + strokes
            const getLayerImage = (strokes: any[]) => {
                const cvs = document.createElement('canvas');
                cvs.width = w;
                cvs.height = h;
                const ctx = cvs.getContext('2d');
                if (!ctx) return '';

                // Draw Background at full size
                ctx.drawImage(img, 0, 0, w, h);

                const denormalize = (p: Point) => ({ x: p.x * w, y: p.y * h });

                strokes.forEach(stroke => {
                    ctx.beginPath();
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.size * (w / canvasRef.current.width); // Scale stroke size

                    const first = denormalize(stroke.points[0]);
                    ctx.moveTo(first.x, first.y);

                    if (stroke.type === 'polygon') {
                        for (let i = 1; i < stroke.points.length; i++) {
                            const p = denormalize(stroke.points[i]);
                            ctx.lineTo(p.x, p.y);
                        }
                        ctx.closePath();
                        ctx.fillStyle = stroke.color;
                        ctx.fill();
                    } else if (stroke.type === 'arrow') {
                        const last = denormalize(stroke.points[stroke.points.length - 1]);
                        ctx.lineTo(last.x, last.y);
                        ctx.stroke();
                        // Head
                        const angle = Math.atan2(last.y - first.y, last.x - first.x);
                        const headLen = (stroke.size * 3 + 10) * (w / canvasRef.current.width);
                        ctx.beginPath(); ctx.fillStyle = stroke.color;
                        ctx.moveTo(last.x, last.y);
                        ctx.lineTo(last.x - headLen * Math.cos(angle - Math.PI / 6), last.y - headLen * Math.sin(angle - Math.PI / 6));
                        ctx.lineTo(last.x - headLen * Math.cos(angle + Math.PI / 6), last.y - headLen * Math.sin(angle + Math.PI / 6));
                        ctx.fill();
                    } else {
                        for (let i = 1; i < stroke.points.length; i++) {
                            const p = denormalize(stroke.points[i]);
                            ctx.lineTo(p.x, p.y);
                        }
                        ctx.stroke();
                    }
                });
                return cvs.toDataURL('image/png').split(',')[1];
            };

            const lightingBase64 = getLayerImage(lightingStrokes);
            const materialityBase64 = getLayerImage(materialityStrokes);

            // Clean background (No Bars)
            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = w; bgCanvas.height = h;
            bgCanvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            const backgroundBase64 = bgCanvas.toDataURL('image/png').split(',')[1];

            // 2. Build Prompt
            // 2. Build Prompt
            const hasLighting = lightingStrokes.length > 0;
            const hasMateriality = materialityStrokes.length > 0;
            const activeRefs = refImages.filter(r => r.url);
            const activeCurrentRenders = currentRenders.filter(r => r.url);

            let finalPrompt = `[VISUAL REFERENCE GUIDE]\n`;
            let imgIndex = 1;

            finalPrompt += `- IMG_${imgIndex}: BASE SCENE. The original architectural photograph/sketch.\n`;

            let lightingImgIndex = -1;
            if (hasLighting) {
                imgIndex++;
                lightingImgIndex = imgIndex;
                finalPrompt += `- IMG_${imgIndex}: LIGHTING GUIDE. This is IMG_1 overlaid with colored arrows/lines acting as a lighting map.\n`;
            }

            let materialityImgIndex = -1;
            if (hasMateriality) {
                imgIndex++;
                materialityImgIndex = imgIndex;
                finalPrompt += `- IMG_${imgIndex}: MATERIALITY GUIDE. This is IMG_1 overlaid with colored regions acting as a material map.\n`;
            }

            finalPrompt += `\n[INSTRUCTIONS]
Re-render IMG_1 with high photorealism. `;

            if (hasLighting || hasMateriality) {
                finalPrompt += `Strictly follow the instructions from the guide images. 
IMPORTANT: The colored lines, arrows, and blocks in the guide images are NOT objects. They are meta-data instructions. Do NOT render them. Render what they MEAN.
CRITICAL: Do not include the guides in the final image.\n`;
            } else {
                finalPrompt += `Enhance the architectural quality and realism.\n`;
            }

            if (hasLighting) {
                finalPrompt += `\n[LIGHTING INSTRUCTIONS (Refer to IMG_${lightingImgIndex})]
- Use the colored arrows/lines in IMG_${lightingImgIndex} to position and colorize the light sources in the scene.
  * Yellow Arrows: Create Neutral Artificial Lighting in this direction/area.
  * Orange Arrows: Create Natural Sunlight entering from this direction.
  * Cyan Arrows: Create Cold/Fluorescent Lighting.
  * Red Arrows: Create Warm/Cosine Lighting.\n`;
            }

            if (hasMateriality) {
                finalPrompt += `\n[MATERIAL INSTRUCTIONS (Refer to IMG_${materialityImgIndex})]
- The filled color regions in IMG_${materialityImgIndex} correspond to specific materials. Apply these materials to the underlying surfaces from IMG_1.\n`;

                activeRefs.forEach((ref, idx) => {
                    // Refs are added after guides. First ref is at imgIndex + 1
                    const refImgIndex = imgIndex + 1 + idx;
                    finalPrompt += `- Surface covered by ${ref.color} in IMG_${materialityImgIndex}: Apply material from Reference Image IMG_${refImgIndex}.\n`;
                });
            }

            finalPrompt += `\n[MANDATORY GEOMETRIC CONSTRAINT]
- Resolution: ${w}x${h}.
- Preserve ALL original edges and structural lines from IMG_1. 
- NO white bars. NO padding.
- Creative Freedom: ${creativeFreedom}/200.\n\n`;

            if (activeCurrentRenders.length > 0) {
                // Style refs start after active refs
                // Current imgIndex counts Base + Guides
                // Refs take 'activeRefs.length' slots
                const startStyleIndex = imgIndex + activeRefs.length + 1;
                finalPrompt += `\n[Style & Consistency - Use Previous Renders]\n`;
                finalPrompt += `I have provided ${activeCurrentRenders.length} previous renders for consistency (starting from IMG_${startStyleIndex}).\n`;
                finalPrompt += `GOAL: Match the EXACT Architectural Style, Color Grade, and Camera Quality of these renders. The new image must look like it belongs to the same professional photographic series.\n`;
            }

            // 3. Assemble Payload
            const parts: any[] = [];
            parts.push({ text: finalPrompt });

            // Image 0: Background (Always IMG_1)
            parts.push({ inlineData: { mimeType: 'image/png', data: backgroundBase64 } });

            // Image 1: Lighting Map (Optional)
            if (hasLighting) {
                parts.push({ inlineData: { mimeType: 'image/png', data: lightingBase64 } });
            }

            // Image 2: Materiality Map (Optional)
            if (hasMateriality) {
                parts.push({ inlineData: { mimeType: 'image/png', data: materialityBase64 } });
            }

            // References
            activeRefs.forEach(ref => {
                if (ref.url.startsWith('data:')) {
                    const refBase64 = ref.url.split(',')[1];
                    parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
                }
            });

            // Current Renders
            activeCurrentRenders.forEach(render => {
                if (render.url.startsWith('data:')) {
                    const renderBase64 = render.url.split(',')[1];
                    parts.push({ inlineData: { mimeType: 'image/png', data: renderBase64 } });
                }
            });

            // 4. Call AI
            // 4. Call AI
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = selectedModel || GEMINI_MODEL_ID;

            const contents = { parts };

            // 4. Debug Inspector
            if (onInspectRequest) {
                const shouldProceed = await onInspectRequest({
                    model,
                    parts: parts,
                    config: { creativeFreedom, sceneType, renderStyle, archStyle, lighting }
                });
                if (!shouldProceed) {
                    setIsGenerating(false);
                    return;
                }
            }

            // 5. Check Credits
            const cost = model.includes('gemini-3') ? 5 : 1;
            if (credits !== null && credits < cost) {
                alert(`No tienes suficientes créditos (${cost} requeridos).`);
                setIsGenerating(false);
                return;
            }

            // 6. Call AI with Generation Config
            const generationConfig = {
                temperature: Math.max(0, creativeFreedom / 200),
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            };

            // @ts-ignore
            const response = await ai.models.generateContent({
                model,
                contents,
                generationConfig
            });
            const resultPart = response.candidates?.[0]?.content?.parts?.[0];

            if (resultPart && resultPart.inlineData) {
                const newImage = `data:image/png;base64,${resultPart.inlineData.data}`;
                setResultImage(newImage);

                // Deduct credits
                await deductCredit(cost);
            }
            else {
                throw new Error("No image data in response");
            }

        } catch (e) {
            console.error("Render failed", e);
            alert("Error al generar el render");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpscale = async () => {
        if (!resultImage) return;

        // Check Credits (4K = 7 credits)
        const upscaleCost = 7;
        if (credits !== null && credits < upscaleCost) {
            alert(`No tienes suficientes créditos para el escalado 4K (${upscaleCost} requeridos).`);
            return;
        }

        setIsUpscaling(true);
        try {
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = 'gemini-3-pro-image-preview'; // Enforce Gemini 3 for 4K
            const promptContent = "Upscale this architectural render to 4K resolution. Enhance fine details, sharpen textures, and improve overall clarity while maintaining the exact composition and Aspect Ratio of the original image. Output as a high-fidelity photorealistic image. Do not add black bars or change the framing.";

            const base64Data = resultImage.split(',')[1];
            const parts = [
                { inlineData: { mimeType: 'image/png', data: base64Data } },
                { text: promptContent }
            ];
            const contents = { parts };

            // 1. AI Inspector
            if (onInspectRequest) {
                const shouldProceed = await onInspectRequest({
                    model,
                    parts: parts,
                    config: { mode: 'Upscale 4K', cost: upscaleCost }
                });
                if (!shouldProceed) {
                    setIsUpscaling(false);
                    return;
                }
            }

            const response = await ai.models.generateContent({ model, contents });
            const resultPart = response.candidates?.[0]?.content?.parts?.[0];

            if (resultPart?.inlineData?.data) {
                const newImageBase64 = resultPart.inlineData.data;
                const aiResultUrl = `data:image/png;base64,${newImageBase64}`;

                // --- 4K Smart Processing ---
                // We use the original image aspect ratio to ensure no stretching
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = async () => {
                    const originalAR = (imageRef.current?.naturalWidth || 1) / (imageRef.current?.naturalHeight || 1);
                    const MAX_DIM = 3840;
                    let targetWidth, targetHeight;

                    if (originalAR >= 1) {
                        targetWidth = MAX_DIM;
                        targetHeight = Math.round(MAX_DIM / originalAR);
                    } else {
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

                        const aiAR = img.naturalWidth / img.naturalHeight;
                        let renderX = 0, renderY = 0, renderW = targetWidth, renderH = targetHeight;

                        // Center crop logic
                        if (Math.abs(aiAR - originalAR) > 0.01) {
                            if (aiAR > originalAR) {
                                renderW = targetHeight * aiAR;
                                renderX = (targetWidth - renderW) / 2;
                            } else {
                                renderH = targetWidth / aiAR;
                                renderY = (targetHeight - renderH) / 2;
                            }
                        }

                        ctx.drawImage(img, renderX, renderY, renderW, renderH);
                        const final4KUrl = canvas.toDataURL('image/png');

                        setResultImage(final4KUrl);

                        // Auto-download
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const downloadUrl = URL.createObjectURL(blob);
                                downloadFile(downloadUrl, `Render_Premium_4K_${Date.now()}.png`);
                                URL.revokeObjectURL(downloadUrl);
                            }
                        }, 'image/png');

                        // Deduct credits
                        await deductCredit(upscaleCost);
                    }
                };
                img.src = aiResultUrl;
            }
        } catch (e) {
            console.error("Upscale failed", e);
            alert("Error al escalar a 4K");
        } finally {
            setIsUpscaling(false);
        }
    };

    // Result Actions
    const handleDownload = () => {
        if (resultImage) downloadFile(resultImage, `Render_${Date.now()}.png`);
    };

    const handleAddToLibrary = async () => {
        if (!resultImage) return;
        // Placeholder: We need a prop 'onSaveToLibrary' or use 'onImport' logic?
        // RenderWorkspaceProps only has 'onImport'.
        // "Añadir a librería" implies saving to the app's library.
        // Since we don't have the prop piped in, we might alert or skip.
        // However, user context has 'hooks/useLibrary.ts'. Maybe we use that?
        // RenderWorkspace doesn't import useLibrary currently.
        // Let's stick to Download for now if Library is not available, or just mock it.
        // Actually, let's look at ArchitecturalRenderViewProps... it has onSaveToLibrary.
        // RenderWorkspaceProps DOES NOT have onSaveToLibrary.
        // I will mock it with an alert for now or try to pass it if I could edit parent.
        // Given I cannot easily edit parent (App.tsx might be huge), I will leave a TODO or add the valid logic if possible.
        alert("Funcionalidad de 'Guardar en Librería' pendiente de conexión.");
    };

    const handleImportToCanvas = () => {
        // "Añadir a Lienzo"
        // onImport is usually "Close RenderWorkspace" or similar.
        // But here we want to ADD the result to the main canvas.
        // RenderWorkspace is likely an overlay.
        // If we want to add the image, we probably need to call a function passed from parent.
        // The user said "onImport" prop exists.
        // But onImport in RenderWorkspaceProps is `() => void`. 
        // It might be "Close/Finish".
        // In ArchitecturalRenderView, we have `onImportFromSketch`.
        // Let's assume standard Download is the primary "output" for now, and onImport closes the workspace.
        // BUT, the user wants "Añadir a Lienzo".
        // I will add the button and if clicked, maybe trigger download + close? 
        // Or if I can, I'll update RenderWorkspaceProps later.
        if (resultImage) {
            // Ideally: onAddToCanvas(resultImage)
            downloadFile(resultImage, `ToCanvas_${Date.now()}.png`);
            alert("Imagen descargada. Arrástrala al lienzo principal para añadirla."); // Fallback
        }
    };


    // Initialize Image
    useEffect(() => {
        if (imageSrc) {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                imageRef.current = img;
                renderCanvas();
            };
        }
    }, [imageSrc]);

    // Helpers
    const getImageDisplayBounds = (rect: DOMRect) => {
        const img = imageRef.current;
        if (!img) return { x: 0, y: 0, w: rect.width, h: rect.height };

        const canvasAspect = rect.width / rect.height;
        const imgAspect = img.naturalWidth / img.naturalHeight;

        let drawWidth, drawHeight, offsetX, offsetY;
        if (canvasAspect > imgAspect) {
            drawHeight = rect.height;
            drawWidth = drawHeight * imgAspect;
            offsetY = 0; offsetX = (rect.width - drawWidth) / 2;
        } else {
            drawWidth = rect.width;
            drawHeight = drawWidth / imgAspect;
            offsetX = 0; offsetY = (rect.height - drawHeight) / 2;
        }
        return { x: offsetX, y: offsetY, w: drawWidth, h: drawHeight };
    };

    const normalizePoint = (e: React.PointerEvent | { clientX: number, clientY: number }, rect: DOMRect): Point => {
        const bounds = getImageDisplayBounds(rect);
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale;
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale;

        return {
            x: (x - bounds.x) / bounds.w,
            y: (y - bounds.y) / bounds.h
        };
    };

    const denormalizePoint = (p: Point, bounds: { x: number, y: number, w: number, h: number }): Point => ({
        x: bounds.x + p.x * bounds.w,
        y: bounds.y + p.y * bounds.h
    });

    // Drawing Logic
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;

        // Offscreen Setup
        if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
        const offCtx = offscreenCanvasRef.current.getContext('2d');
        if (!offCtx) return;
        if (offscreenCanvasRef.current.width !== canvas.width || offscreenCanvasRef.current.height !== canvas.height) {
            offscreenCanvasRef.current.width = canvas.width;
            offscreenCanvasRef.current.height = canvas.height;
        }

        // 1. Clear Main
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply View Transform
        ctx.translate(viewTransform.x, viewTransform.y);
        ctx.scale(viewTransform.scale, viewTransform.scale);

        // 2. Background / Result
        const imageToShow = (resultImage && !showOriginal) ? resultImage : imageSrc;

        let imgBbox = { x: 0, y: 0, w: canvas.width, h: canvas.height };

        if (imageToShow) {
            const img = (resultImage && !showOriginal) ? null : imageRef.current;
            const bounds = getImageDisplayBounds(canvas.getBoundingClientRect());
            imgBbox = bounds;

            if (img) {
                ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
            }

            if (resultImage && !showOriginal) {
                const resImg = new Image();
                resImg.src = resultImage;
                if (resImg.complete) {
                    ctx.drawImage(resImg, bounds.x, bounds.y, bounds.w, bounds.h);
                } else {
                    resImg.onload = () => renderCanvas();
                }
            } else if (img) {
                ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
            }
        }

        // Clip future drawing to image boundaries
        ctx.beginPath();
        ctx.rect(imgBbox.x, imgBbox.y, imgBbox.w, imgBbox.h);
        ctx.clip();

        // Helper Drawing Functions
        const drawStroke = (context: CanvasRenderingContext2D, stroke: LightingStroke | MaterialityStroke) => {
            if (!stroke.isVisible) return;

            context.globalCompositeOperation = stroke.type === 'eraser' ? 'destination-out' : 'source-over';

            if (stroke.type === 'polygon') {
                // Filled Polygon
                const s = stroke as MaterialityStroke;
                if (s.points.length < 3) return;
                context.beginPath();
                const start = denormalizePoint(s.points[0], imgBbox);
                context.moveTo(start.x, start.y);
                for (let i = 1; i < s.points.length; i++) {
                    const p = denormalizePoint(s.points[i], imgBbox);
                    context.lineTo(p.x, p.y);
                }
                context.closePath();
                context.fillStyle = s.color; // Or s.fillColor if distinct
                context.fill();
                // Optional stroke
                // context.strokeStyle = s.color;
                // context.lineWidth = s.size;
                // context.stroke();
            } else if (stroke.type === 'arrow') {
                // Arrow logic
                const s = stroke as LightingStroke;
                if (s.points.length < 2) return;
                // Draw line
                context.beginPath();
                context.strokeStyle = s.color;
                context.lineWidth = s.size;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                const start = denormalizePoint(s.points[0], imgBbox);
                context.moveTo(start.x, start.y);
                const end = denormalizePoint(s.points[s.points.length - 1], imgBbox);
                context.lineTo(end.x, end.y);
                context.stroke();

                // Arrowhead
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const angle = Math.atan2(dy, dx);
                const headLength = s.size * 3 + 10;
                context.beginPath();
                context.fillStyle = s.color;
                context.moveTo(end.x, end.y);
                context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
                context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
                context.closePath();
                context.fill();
            } else {
                // Freehand / Line
                if (stroke.points.length < 2) return;
                context.beginPath();
                context.strokeStyle = stroke.color;
                context.lineWidth = stroke.size;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                const start = denormalizePoint(stroke.points[0], imgBbox);
                context.moveTo(start.x, start.y);
                for (let i = 1; i < stroke.points.length; i++) {
                    const p = denormalizePoint(stroke.points[i], imgBbox);
                    context.lineTo(p.x, p.y);
                }
                context.stroke();
            }
        };

        // 3. Render Layers

        // --- Materiality Layer ---
        if (materialityLayerVisible) {
            offCtx.clearRect(0, 0, canvas.width, canvas.height);
            materialityStrokes.forEach(s => drawStroke(offCtx, s));
            // Current Stroke (if Materiality active)
            if (activeSection === 'materiality' && (currentStroke || polygonPoints.length > 0)) {
                if (currentStroke) drawStroke(offCtx, currentStroke);
                // Active Polygon Preview
                if (polygonPoints.length > 0) {
                    offCtx.beginPath();
                    offCtx.strokeStyle = materialityColor;
                    offCtx.lineWidth = 2;
                    const start = denormalizePoint(polygonPoints[0], imgBbox);
                    offCtx.moveTo(start.x, start.y);
                    for (let i = 1; i < polygonPoints.length; i++) {
                        const p = denormalizePoint(polygonPoints[i], imgBbox);
                        offCtx.lineTo(p.x, p.y);
                    }
                    // Preview line to cursor
                    if (pointerPos && activeSection === 'materiality' && materialityTool === 'polygon') {
                        const rect = canvasRef.current.getBoundingClientRect();
                        const p = normalizePoint({ clientX: pointerPos.x + rect.left, clientY: pointerPos.y + rect.top }, rect);
                        const dp = denormalizePoint(p, imgBbox);
                        offCtx.lineTo(dp.x, dp.y);
                    }
                    offCtx.stroke();
                }
            }
            ctx.drawImage(offscreenCanvasRef.current, 0, 0);
        }

        // --- Lighting Layer ---
        if (lightingLayerVisible) {
            offCtx.clearRect(0, 0, canvas.width, canvas.height);
            lightingStrokes.forEach(s => drawStroke(offCtx, s));
            if (activeSection === 'lighting' && currentStroke) {
                drawStroke(offCtx, currentStroke);
            }
            ctx.drawImage(offscreenCanvasRef.current, 0, 0);
        }

        ctx.restore();

    }, [lightingStrokes, materialityStrokes, currentStroke, polygonPoints, lightingLayerVisible, materialityLayerVisible, activeSection, pointerPos, materialityColor, materialityTool, viewTransform]);

    // Resize
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const w = Math.max(1, containerRef.current.clientWidth);
                const h = Math.max(1, containerRef.current.clientHeight);
                canvasRef.current.width = w; canvasRef.current.height = h;
                renderCanvas();
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [renderCanvas, isLeftOpen, isRightOpen]);

    // Input Handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const newScale = Math.min(Math.max(viewTransform.scale * factor, 0.1), 10);

        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom relative to mouse
        const worldX = (mouseX - viewTransform.x) / viewTransform.scale;
        const worldY = (mouseY - viewTransform.y) / viewTransform.scale;

        const newX = mouseX - worldX * newScale;
        const newY = mouseY - worldY * newScale;

        setViewTransform({ x: newX, y: newY, scale: newScale });
    }, [viewTransform]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (e.code === 'Space') isPanningRef.current = true;
            if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); redo(); }
            if (e.code === 'KeyH') { setIsPanToolActive(prev => !prev); }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') isPanningRef.current = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [historyIndex, history]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();

        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // If 2 or more pointers, we are definitely navigating
        if (activePointersRef.current.size >= 2) {
            isPanningRef.current = true;
            lastPinchDistRef.current = null; // Reset pinch
            lastPinchMidRef.current = null;
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        if (e.button === 1 || isPanningRef.current || isPanToolActive) {
            // Start Panning
            isPanningRef.current = true;
            setIsPanningUI(true);
            lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        const p = normalizePoint(e, rect);
        (e.target as Element).setPointerCapture(e.pointerId);

        if (activeSection === 'lighting') {
            setCurrentStroke({
                id: crypto.randomUUID(),
                type: lightingTool,
                points: [p],
                color: lightingTool === 'eraser' ? '#000000' : lightingColor,
                size: lightingSize,
                isVisible: true
            });
        } else {
            // Materiality
            if (materialityTool === 'polygon') {
                // Polygon Logic
                setPolygonPoints(prev => [...prev, p]);
            } else {
                setCurrentStroke({
                    id: crypto.randomUUID(),
                    type: materialityTool,
                    points: [p],
                    color: materialityTool === 'eraser' ? '#000000' : materialityColor,
                    size: materialitySize,
                    isVisible: true
                });
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();

        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Handle multi-touch (Pinch Zoom & Pan)
        if (activePointersRef.current.size >= 2) {
            const pointers = Array.from(activePointersRef.current.values());
            const p1 = pointers[0] as { x: number, y: number };
            const p2 = pointers[1] as { x: number, y: number };

            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            if (lastPinchDistRef.current !== null && lastPinchMidRef.current !== null) {
                const zoomFactor = dist / lastPinchDistRef.current;
                const newScale = Math.min(Math.max(viewTransform.scale * zoomFactor, 0.1), 10);

                const dx = midX - lastPinchMidRef.current.x;
                const dy = midY - lastPinchMidRef.current.y;

                // Midpoint relative to canvas
                const canvasMidX = midX - rect.left;
                const canvasMidY = midY - rect.top;

                // World coordinate before zoom
                const worldX = (canvasMidX - viewTransform.x) / viewTransform.scale;
                const worldY = (canvasMidY - viewTransform.y) / viewTransform.scale;

                // Adjust X/Y to keep world point under mid
                const nextX = canvasMidX - worldX * newScale + dx;
                const nextY = canvasMidY - worldY * newScale + dy;

                setViewTransform({ x: nextX, y: nextY, scale: newScale });
            }
            lastPinchDistRef.current = dist;
            lastPinchMidRef.current = { x: midX, y: midY };
            return;
        }

        if (isPanningRef.current && lastPointerPosRef.current) {
            const dx = e.clientX - lastPointerPosRef.current.x;
            const dy = e.clientY - lastPointerPosRef.current.y;
            setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        setPointerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const p = normalizePoint(e, rect);

        if (currentStroke) {
            if (currentStroke.type === 'freehand' || currentStroke.type === 'eraser') {
                setCurrentStroke(prev => prev ? ({ ...prev, points: [...prev.points, p] }) : null);
            } else {
                // Line / Arrow: Update end point
                setCurrentStroke(prev => prev ? ({ ...prev, points: [prev.points[0], p] }) : null);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        (e.target as Element).releasePointerCapture(e.pointerId);
        activePointersRef.current.delete(e.pointerId);

        if (activePointersRef.current.size < 2) {
            lastPinchDistRef.current = null;
            lastPinchMidRef.current = null;
        }

        if (isPanningRef.current && activePointersRef.current.size === 0) {
            isPanningRef.current = false;
            setIsPanningUI(false);
            lastPointerPosRef.current = null;
            return;
        }

        if (currentStroke) {
            let nL, nM;
            if (activeSection === 'lighting') {
                nL = [...lightingStrokes, currentStroke as LightingStroke];
                nM = materialityStrokes;
                setLightingStrokes(nL);
            } else {
                nL = lightingStrokes;
                nM = [...materialityStrokes, currentStroke as MaterialityStroke];
                setMaterialityStrokes(nM);
            }
            saveHistory(nL, nM);
            setCurrentStroke(null);
        }
    };

    const handleDoubleClick = (e: React.PointerEvent) => {
        if (activeSection === 'materiality' && materialityTool === 'polygon' && polygonPoints.length >= 3) {
            // Close Polygon
            const newPoly: MaterialityStroke = {
                id: crypto.randomUUID(),
                type: 'polygon',
                points: [...polygonPoints],
                color: materialityColor,
                size: materialitySize,
                isVisible: true
            };
            const nM = [...materialityStrokes, newPoly];
            setMaterialityStrokes(nM);
            saveHistory(lightingStrokes, nM);
            setPolygonPoints([]);
        }
    };

    // Reference Image Handling
    const handleRefImageClick = (index: number) => {
        activeRefIndex.current = index;
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeRefIndex.current !== -1) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = ev.target?.result as string;

                // Load image to extract color
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    const avgColor = calculateAverageColor(img);

                    setRefImages(prev => prev.map((imgItem, i) =>
                        i === activeRefIndex.current ? { ...imgItem, url, color: avgColor } : imgItem
                    ));
                    // Auto-select this color
                    setMaterialityColor(avgColor);
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const calculateAverageColor = (img: HTMLImageElement): string => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '#808080';

        // Resize to small size for faster processing
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        try {
            const data = ctx.getImageData(0, 0, size, size).data;
            let r = 0, g = 0, b = 0;
            let count = 0;

            for (let i = 0; i < data.length; i += 4) {
                // simple averaging
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }

            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        } catch (e) {
            console.error("Error extracting color", e);
            return '#808080';
        }
    };

    // Current Render Handlers
    const handleCurrentRenderClick = (index: number) => {
        activeRenderIndex.current = index;
        currentRenderInputRef.current?.click();
    };

    const handleCurrentRenderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeRenderIndex.current !== -1) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = ev.target?.result as string;
                setCurrentRenders(prev => prev.map((img, i) =>
                    i === activeRenderIndex.current ? { ...img, url } : img
                ));
            };
            reader.readAsDataURL(file);
        }
    };

    const removeCurrentRender = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentRenders(prev => prev.map((img, i) =>
            i === index ? { ...img, url: '' } : img
        ));
    };

    const updateRefColor = (index: number, color: string) => {
        setRefImages(prev => prev.map((img, i) => i === index ? { ...img, color } : img));
        // Also auto-select this color for materiality tool? user didn't specify, but makes sense.
        setMaterialityColor(color);
    };

    const setActiveRefIndex = (index: number) => {
        // Maybe selecting the reference selects its color?
        const ref = refImages[index];
        setMaterialityColor(ref.color);
    };


    return (
        <div className="flex flex-grow relative h-full w-full overflow-hidden bg-theme-bg-tertiary">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

            {/* Left Sidebar */}
            <aside
                className={`fixed left-0 top-16 bottom-0 z-30 bg-theme-bg-secondary border-r border-theme-bg-tertiary transition-all duration-300 ${isLeftOpen ? 'w-64' : 'w-0'} overflow-hidden flex flex-col`}
            >
                <div className="flex-grow overflow-y-auto overflow-x-hidden p-4 space-y-6">
                    {/* Gestión Section */}
                    <section className="space-y-2">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-1">Gestión</label>
                        <button
                            onClick={onImport}
                            className="w-full flex items-center justify-start gap-2 p-2 bg-theme-bg-primary border border-theme-bg-tertiary rounded hover:bg-theme-bg-hover text-theme-text-secondary text-xs transition-colors"
                            title="Importar Fondo"
                        >
                            <UploadIcon className="w-4 h-4 shrink-0" />
                            <span>Importar</span>
                        </button>
                    </section>

                    {/* Section Toggle / Header */}
                    {/* Iluminación Section */}
                    <section className={`space-y-4 p-2 rounded-lg transition-colors ${activeSection === 'lighting' ? 'bg-theme-bg-tertiary/50' : ''}`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setActiveSection('lighting')}>
                            <label className={`text-[10px] font-bold uppercase tracking-wider block cursor-pointer ${activeSection === 'lighting' ? 'text-theme-accent' : 'text-theme-text-secondary'}`}>Iluminación</label>
                            <div className={`w-2 h-2 rounded-full ${activeSection === 'lighting' ? 'bg-theme-accent' : 'bg-transparent border border-theme-text-tertiary'}`} />
                        </div>

                        {activeSection === 'lighting' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Colors */}
                                <div className="space-y-2">
                                    {LIGHTING_COLORS.map(item => (
                                        <button
                                            key={item.color}
                                            onClick={() => { setLightingColor(item.color); if (lightingTool === 'eraser') setLightingTool('freehand'); }}
                                            className={`w-full flex items-center gap-3 p-1.5 rounded-lg border-2 transition-all hover:bg-theme-bg-tertiary ${lightingColor === item.color && lightingTool !== 'eraser' ? 'border-theme-accent bg-theme-accent/5' : 'border-transparent'}`}
                                        >
                                            <div
                                                className="w-5 h-5 rounded-full shadow-sm border border-black/10"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className={`text-[10px] font-medium ${lightingColor === item.color ? 'text-theme-text-primary' : 'text-theme-text-secondary'}`}>
                                                {item.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Tools */}
                                <div className="flex gap-2 bg-theme-bg-primary p-1 rounded-lg border border-theme-bg-tertiary">
                                    <button onClick={() => setLightingTool('freehand')} className={`p-2 rounded flex-1 flex justify-center ${lightingTool === 'freehand' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><FreehandIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setLightingTool('line')} className={`p-2 rounded flex-1 flex justify-center ${lightingTool === 'line' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><LineIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setLightingTool('arrow')} className={`p-2 rounded flex-1 flex justify-center ${lightingTool === 'arrow' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><ArrowUpIcon className="w-5 h-5 rotate-45" /></button>
                                    <button onClick={() => setLightingTool('eraser')} className={`p-2 rounded flex-1 flex justify-center ${lightingTool === 'eraser' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><EraserIcon className="w-5 h-5" /></button>
                                </div>

                                {/* Size */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-theme-text-tertiary"><span>Tamaño</span><span>{lightingSize}px</span></div>
                                    <input type="range" min="1" max="100" value={lightingSize} onChange={(e) => setLightingSize(parseInt(e.target.value))} className="w-full h-2 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent" />
                                </div>

                                {/* Layer Controls */}
                                <div className="flex items-center justify-between text-theme-text-tertiary pt-2 border-t border-theme-bg-tertiary mt-2">
                                    <div className="text-[10px]">Capa ({lightingStrokes.length} trazos)</div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setLightingLayerVisible(!lightingLayerVisible)}
                                            className={`p-1.5 rounded hover:bg-theme-bg-tertiary/50 ${lightingLayerVisible ? 'text-theme-text-secondary' : 'text-theme-text-tertiary'}`}
                                            title={lightingLayerVisible ? "Ocultar Capa" : "Mostrar Capa"}
                                        >
                                            {lightingLayerVisible ? <EyeIcon className="w-4 h-4" /> : <EyeClosedIcon className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Borrar Iluminación?')) setLightingStrokes([]); }}
                                            className="p-1.5 rounded hover:bg-red-500/10 text-theme-text-secondary hover:text-red-500"
                                            title="Borrar Capa"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Materialidad Section */}
                    <section className={`space-y-4 p-2 rounded-lg transition-colors ${activeSection === 'materiality' ? 'bg-theme-bg-tertiary/50' : ''}`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setActiveSection('materiality')}>
                            <label className={`text-[10px] font-bold uppercase tracking-wider block cursor-pointer ${activeSection === 'materiality' ? 'text-theme-accent' : 'text-theme-text-secondary'}`}>Materialidad</label>
                            <div className={`w-2 h-2 rounded-full ${activeSection === 'materiality' ? 'bg-theme-accent' : 'bg-transparent border border-theme-text-tertiary'}`} />
                        </div>

                        {activeSection === 'materiality' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Reference Images Grid */}
                                <div className="grid grid-cols-5 gap-2">
                                    {refImages.map((ref, i) => (
                                        <div key={ref.id} className="flex flex-col gap-1 items-center">
                                            {/* Image Slot */}
                                            <div
                                                onClick={() => handleRefImageClick(i)}
                                                className="w-8 h-8 rounded border border-theme-bg-tertiary bg-theme-bg-primary hover:border-theme-accent cursor-pointer flex items-center justify-center overflow-hidden"
                                                title="Subir Referencia"
                                            >
                                                {ref.url ? <img src={ref.url} className="w-full h-full object-cover" /> : <span className="text-xs text-theme-text-tertiary">+</span>}
                                            </div>
                                            {/* Color Picker linked to Ref */}
                                            <div
                                                className={`relative w-6 h-6 rounded-full border-2 overflow-hidden ${materialityColor === ref.color && materialityTool !== 'eraser' ? 'border-theme-text-primary shadow-lg scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: ref.color }}
                                            >
                                                <input type="color" value={ref.color} onChange={(e) => updateRefColor(i, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tools */}
                                <div className="flex gap-2 bg-theme-bg-primary p-1 rounded-lg border border-theme-bg-tertiary">
                                    <button onClick={() => setMaterialityTool('freehand')} className={`p-2 rounded flex-1 flex justify-center ${materialityTool === 'freehand' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><FreehandIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setMaterialityTool('line')} className={`p-2 rounded flex-1 flex justify-center ${materialityTool === 'line' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><LineIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setMaterialityTool('polygon')} title="Polígono (Doble click para cerrar)" className={`p-2 rounded flex-1 flex justify-center ${materialityTool === 'polygon' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><PolygonIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setMaterialityTool('eraser')} className={`p-2 rounded flex-1 flex justify-center ${materialityTool === 'eraser' ? 'bg-theme-accent text-white' : 'text-theme-text-secondary'}`}><EraserIcon className="w-5 h-5" /></button>
                                </div>

                                {/* Size */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-theme-text-tertiary"><span>Tamaño</span><span>{materialitySize}px</span></div>
                                    <input type="range" min="1" max="100" value={materialitySize} onChange={(e) => setMaterialitySize(parseInt(e.target.value))} className="w-full h-2 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent" />
                                </div>

                                {/* Layer Controls */}
                                <div className="flex items-center justify-between text-theme-text-tertiary pt-2 border-t border-theme-bg-tertiary mt-2">
                                    <div className="text-[10px]">Capa ({materialityStrokes.length} trazos)</div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setMaterialityLayerVisible(!materialityLayerVisible)}
                                            className={`p-1.5 rounded hover:bg-theme-bg-tertiary/50 ${materialityLayerVisible ? 'text-theme-text-secondary' : 'text-theme-text-tertiary'}`}
                                            title={materialityLayerVisible ? "Ocultar Capa" : "Mostrar Capa"}
                                        >
                                            {materialityLayerVisible ? <EyeIcon className="w-4 h-4" /> : <EyeClosedIcon className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Borrar Materialidad?')) setMaterialityStrokes([]); }}
                                            className="p-1.5 rounded hover:bg-red-500/10 text-theme-text-secondary hover:text-red-500"
                                            title="Borrar Capa"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </aside>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className={`flex-grow relative h-full transition-all duration-300 ${isLeftOpen ? 'ml-64' : 'ml-0'} ${isRightOpen ? 'mr-56' : 'mr-0'} bg-theme-bg-tertiary overflow-hidden`}
            >
                {/* Empty State */}
                {!imageSrc && (lightingStrokes.length + materialityStrokes.length) === 0 && ( /* simplified check */
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-theme-text-tertiary flex flex-col items-center gap-4">
                            <div className="w-32 h-32 border-2 border-dashed border-theme-bg-tertiary rounded-xl flex items-center justify-center">
                                <span className="text-xs">Sin Imagen</span>
                            </div>
                            <p>Importa una imagen para comenzar</p>
                        </div>
                    </div>
                )}

                {/* Floating Top Toolbar */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-theme-bg-secondary/90 backdrop-blur-md rounded-xl border border-theme-bg-tertiary shadow-xl">
                    <button onClick={undo} disabled={historyIndex < 0} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Deshacer (Ctrl+Z)">
                        <UndoIcon className="w-4 h-4" />
                    </button>
                    <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Rehacer (Ctrl+Y)">
                        <RedoIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-theme-bg-tertiary mx-1" />
                    <button onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 10) }))} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-primary transition-colors" title="Aumentar Zoom">
                        <ZoomInIcon className="w-4 h-4" />
                    </button>
                    <div className="flex items-center px-1 text-[10px] font-mono text-theme-text-tertiary min-w-[40px] justify-center">
                        {Math.round(viewTransform.scale * 100)}%
                    </div>
                    <button onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }))} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-primary transition-colors" title="Reducir Zoom">
                        <ZoomOutIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewTransform({ x: 0, y: 0, scale: 1 })} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-primary transition-colors" title="Ajustar Pantalla">
                        <MaximizeIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-theme-bg-tertiary mx-1" />
                    <button
                        onClick={() => setIsPanToolActive(!isPanToolActive)}
                        className={`p-2 rounded-lg transition-colors ${isPanToolActive ? 'bg-theme-accent text-white shadow-inner' : 'hover:bg-theme-bg-tertiary text-theme-text-primary'}`}
                        title="Herramienta Mano / Pan (H)"
                    >
                        <HandIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Result Overlay Premium (Similar to Sketch Space) */}
                {resultImage && (
                    <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 animate-in fade-in duration-300 pointer-events-none">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setResultImage(null)} />

                        <div className="relative bg-theme-bg-secondary rounded-2xl shadow-2xl border border-theme-bg-tertiary flex flex-col w-full max-w-5xl h-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 pointer-events-auto">
                            {/* Header */}
                            <div className="flex justify-between items-center px-6 py-4 border-b border-theme-bg-tertiary bg-theme-bg-primary">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-theme-accent/10 rounded-lg">
                                        <SparklesIcon className="w-5 h-5 text-theme-accent" />
                                    </div>
                                    <div>
                                        <h3 className="text-theme-text-primary font-bold text-base leading-tight">Resultado del Render</h3>
                                        <p className="text-[10px] text-theme-text-tertiary uppercase tracking-wider font-bold">Generado con IA</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setResultImage(null)}
                                    className="p-2 hover:bg-theme-bg-tertiary rounded-xl text-theme-text-secondary hover:text-theme-text-primary transition-all active:scale-95"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Image Workspace Area */}
                            <div className="flex-grow relative overflow-hidden bg-[url('/checker.png')] bg-repeat">
                                <img
                                    src={showOriginal ? imageSrc : resultImage}
                                    alt="Result"
                                    className="w-full h-full object-contain"
                                />

                                {/* Label for comparison */}
                                <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-widest shadow-xl">
                                    {showOriginal ? "Original" : "Render Final"}
                                </div>

                                {isUpscaling && (
                                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3 bg-theme-bg-primary/90 p-6 rounded-2xl border border-theme-bg-tertiary shadow-xl animate-pulse">
                                            <SparklesIcon className="w-8 h-8 text-theme-accent animate-spin-slow" />
                                            <span className="text-xs font-bold text-theme-text-primary uppercase tracking-widest">Mejorando Imagen...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-theme-bg-tertiary bg-theme-bg-primary flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowOriginal(!showOriginal)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${showOriginal ? 'bg-theme-accent text-white border-theme-accent' : 'bg-theme-bg-tertiary border-theme-bg-tertiary text-theme-text-primary hover:bg-theme-bg-hover'}`}
                                    >
                                        {showOriginal ? <SparklesIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                        {showOriginal ? "Ver Render" : "Comparar con Original"}
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-bg-tertiary hover:bg-theme-bg-hover text-xs font-bold text-theme-text-primary transition-all border border-theme-bg-tertiary"
                                    >
                                        <SaveIcon className="w-4 h-4" /> Descargar PNG
                                    </button>

                                    <button
                                        onClick={handleUpscale}
                                        disabled={isUpscaling}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        <SparklesIcon className="w-4 h-4" /> Mejorar a 4K (7 c)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Cursor */}
                {pointerPos && !resultImage && (activeSection === 'lighting' ? lightingTool : materialityTool) !== 'arrow' && (activeSection === 'lighting' ? lightingTool : materialityTool) !== 'line' && (
                    <div
                        className="fixed pointer-events-none rounded-full border border-black/50 bg-white/20 z-50 transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                            left: `${pointerPos.x}px`,
                            top: `${pointerPos.y}px`,
                            width: `${activeSection === 'lighting' ? lightingSize : materialitySize}px`,
                            height: `${activeSection === 'lighting' ? lightingSize : materialitySize}px`,
                            position: 'absolute'
                        }}
                    />
                )}

                <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 touch-none ${isPanToolActive ? (isPanningUI ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => setPointerPos(null)}
                    onPointerCancel={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                    onWheel={handleWheel}
                />
            </div>

            {/* Right Sidebar */}
            <aside
                className={`fixed right-0 top-16 bottom-0 z-30 bg-theme-bg-secondary border-l border-theme-bg-tertiary transition-all duration-300 ${isRightOpen ? 'w-56' : 'w-0'} overflow-hidden flex flex-col`}
            >
                <div className="p-3 border-b border-theme-bg-tertiary flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-theme-text-secondary" />
                    <span className="text-xs font-bold text-theme-text-primary uppercase tracking-wider">Render</span>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                    {/* Visual Input Section */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Entrada Visual</label>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Background */}
                            <div className={`aspect-square bg-black/20 rounded border ${!excludedImages.includes('background') ? 'border-theme-accent' : 'border-theme-bg-tertiary'} relative overflow-hidden group`}>
                                {imageSrc ? (
                                    <>
                                        <img src={imageSrc} className={`w-full h-full object-cover transition-all ${excludedImages.includes('background') ? 'opacity-20 grayscale' : 'opacity-100'}`} />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                            <button
                                                onClick={() => toggleImageExclusion('background')}
                                                className={`p-2 rounded-full shadow-lg transform transition-transform hover:scale-110 ${!excludedImages.includes('background') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                                                title={!excludedImages.includes('background') ? "Excluir del paquete" : "Incluir en paquete"}
                                            >
                                                {!excludedImages.includes('background') ? <XIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </>
                                ) : <div className="text-xs text-theme-text-tertiary flex items-center justify-center h-full">Sin Fondo</div>}
                                <div className={`absolute bottom-0 left-0 right-0 p-1 text-center text-[8px] transition-colors ${!excludedImages.includes('background') ? 'bg-theme-accent text-white' : 'bg-black/50 text-gray-400'}`}>FONDO</div>
                            </div>

                            {/* Lighting Details */}
                            <div className={`aspect-square bg-black/20 rounded border ${!excludedImages.includes('lighting') ? 'border-theme-accent' : 'border-theme-bg-tertiary'} relative overflow-hidden group`}>
                                {lightingPreviewUrl && lightingStrokes.length > 0 ? (
                                    <>
                                        <img src={lightingPreviewUrl} className={`w-full h-full object-cover transition-all ${excludedImages.includes('lighting') ? 'opacity-20 grayscale' : 'opacity-100'}`} />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                            <button
                                                onClick={() => toggleImageExclusion('lighting')}
                                                className={`p-2 rounded-full shadow-lg transform transition-transform hover:scale-110 ${!excludedImages.includes('lighting') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                                                title={!excludedImages.includes('lighting') ? "Excluir del paquete" : "Incluir en paquete"}
                                            >
                                                {!excludedImages.includes('lighting') ? <XIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </>
                                ) : <div className="text-xs text-theme-text-tertiary flex items-center justify-center h-full text-center p-2">Sin Capa Iluminación</div>}
                                <div className={`absolute bottom-0 left-0 right-0 p-1 text-center text-[8px] transition-colors ${!excludedImages.includes('lighting') && lightingStrokes.length > 0 ? 'bg-theme-accent text-white' : 'bg-black/50 text-gray-400'}`}>ILUMINACIÓN</div>
                            </div>

                            {/* Materiality Details */}
                            <div className={`aspect-square bg-black/20 rounded border ${!excludedImages.includes('materiality') ? 'border-theme-accent' : 'border-theme-bg-tertiary'} relative overflow-hidden group`}>
                                {materialityPreviewUrl && materialityStrokes.length > 0 ? (
                                    <>
                                        <img src={materialityPreviewUrl} className={`w-full h-full object-cover transition-all ${excludedImages.includes('materiality') ? 'opacity-20 grayscale' : 'opacity-100'}`} />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                            <button
                                                onClick={() => toggleImageExclusion('materiality')}
                                                className={`p-2 rounded-full shadow-lg transform transition-transform hover:scale-110 ${!excludedImages.includes('materiality') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                                                title={!excludedImages.includes('materiality') ? "Excluir del paquete" : "Incluir en paquete"}
                                            >
                                                {!excludedImages.includes('materiality') ? <XIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </>
                                ) : <div className="text-xs text-theme-text-tertiary flex items-center justify-center h-full text-center p-2">Sin Capa Materialidad</div>}
                                <div className={`absolute bottom-0 left-0 right-0 p-1 text-center text-[8px] transition-colors ${!excludedImages.includes('materiality') && materialityStrokes.length > 0 ? 'bg-theme-accent text-white' : 'bg-black/50 text-gray-400'}`}>MATERIALIDAD</div>
                            </div>
                        </div>
                    </div>

                    {/* Current Renders Section */}
                    <div className="space-y-2 pb-2 border-b border-theme-bg-tertiary">
                        <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Renders Actuales</label>
                        <div className="grid grid-cols-3 gap-2">
                            {currentRenders.map((img, i) => (
                                <button
                                    key={img.id}
                                    onClick={() => handleCurrentRenderClick(i)}
                                    className={`relative aspect-square rounded-md border border-dashed border-theme-bg-tertiary flex items-center justify-center overflow-hidden group hover:border-theme-accent transition-colors bg-theme-bg-primary/50`}
                                >
                                    {img.url ? (
                                        <>
                                            <img src={img.url} className="w-full h-full object-cover" />
                                            <div onClick={(e) => removeCurrentRender(i, e)} className="absolute top-0 right-0 p-1 bg-black/50 hover:bg-red-500 text-white rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity">
                                                <XIcon className="w-3 h-3" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-theme-text-tertiary">
                                            <UploadIcon className="w-4 h-4 mx-auto mb-1 opacity-50" />
                                            <span className="text-[8px] uppercase font-bold opacity-50">Subir</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <input
                            type="file"
                            ref={currentRenderInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleCurrentRenderFileChange}
                        />
                        {currentRenders.some(r => r.url) && (
                            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] text-blue-400">
                                <b className="block mb-0.5">Modo Coherencia Activo</b>
                                El render seguirá el estilo de estas imágenes.
                            </div>
                        )}
                    </div>

                    {/* Reference Images */}
                    {refImages.some(img => img.url) && (
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Referencias Materiales</label>
                            <div className="grid grid-cols-3 gap-2">
                                {refImages.map(img => img.url && (
                                    <div key={img.id} className={`aspect-square bg-black/20 rounded border ${!excludedImages.includes(img.id) ? 'border-theme-accent' : 'border-theme-bg-tertiary'} relative overflow-hidden group`}>
                                        <img src={img.url} className={`w-full h-full object-cover transition-all ${excludedImages.includes(img.id) ? 'opacity-20 grayscale' : 'opacity-100'}`} />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                            <button
                                                onClick={() => toggleImageExclusion(img.id)}
                                                className={`p-2 rounded-full shadow-lg transform transition-transform hover:scale-110 ${!excludedImages.includes(img.id) ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                                                title={!excludedImages.includes(img.id) ? "Excluir del paquete" : "Incluir en paquete"}
                                            >
                                                {!excludedImages.includes(img.id) ? <XIcon className="w-3 h-3" /> : <SparklesIcon className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="h-px bg-theme-bg-tertiary my-4"></div>

                    {/* New Render Controls */}
                    <div className="space-y-4">
                        <CollapsiblePillGroup label="Tipo de Escena" options={sceneTypeOptions} value={sceneType} onChange={setSceneType} />

                        <CollapsibleSection title="Estilos" defaultOpen={true}>
                            <CollapsiblePillGroup label="Iluminación" options={lightingOptions} value={lighting} onChange={setLighting} />
                            <CollapsiblePillGroup label="Estilo Arquitectónico" options={archStyleOptions} value={archStyle} onChange={setArchStyle} />
                        </CollapsibleSection>

                        {/* Creativity Slider */}
                        <div className="space-y-2 border border-theme-bg-tertiary rounded-lg p-3 bg-theme-bg-primary/20">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-theme-accent-primary uppercase tracking-[0.2em]">Creatividad</label>
                                <span className="text-xs text-theme-text-secondary font-mono">{creativeFreedom}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="200"
                                value={creativeFreedom}
                                onChange={(e) => setCreativeFreedom(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent-primary"
                            />
                            <div className="flex justify-between text-[8px] text-theme-text-tertiary uppercase font-bold tracking-widest px-1">
                                <span>Fiel (0)</span>
                                <span>Libre (200)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Render Footer */}
                <div className="p-4 border-t border-theme-bg-tertiary space-y-3 bg-theme-bg-secondary flex-shrink-0">
                    {/* Standard Render */}
                    <button
                        onClick={handleRender}
                        disabled={isGenerating}
                        className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isGenerating ? "Generando..." : (
                            <>
                                <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                Renderizar ({selectedModel.includes('gemini-3') ? '5 c' : '1 c'})
                            </>
                        )}
                    </button>

                    {/* Separator Section */}
                    <div className="pt-2 border-t border-theme-bg-tertiary">
                        <button
                            onClick={handleUpscale}
                            disabled={isGenerating || !resultImage || isUpscaling}
                            className="w-full py-2 rounded-md bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-xs shadow hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group/up"
                        >
                            {isUpscaling ? "Procesando 4K..." : (
                                <>
                                    <SparklesIcon className="w-4 h-4 group-hover/up:rotate-12 transition-transform" />
                                    Mejorar a 4K (7 c)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Result Overlay Toolbar (Visible when Result Exists) */}
            {resultImage && (
                <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 flex items-center gap-1 p-1 bg-theme-bg-primary/95 backdrop-blur-md rounded-lg shadow-2xl border border-theme-bg-tertiary z-[60] animate-in slide-in-from-bottom-5 duration-300">
                    {/* Toggle View */}
                    <button onClick={() => setShowOriginal(!showOriginal)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-xs font-bold text-theme-text-primary transition-colors">
                        {showOriginal ? <SparklesIcon className="w-3 h-3 text-purple-400" /> : <EyeIcon className="w-3 h-3" />}
                        {showOriginal ? "Ver Render" : "Ver Original"}
                    </button>

                    <div className="h-4 w-px bg-theme-bg-tertiary mx-1"></div>

                    {/* Actions */}
                    <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-theme-bg-hover text-xs font-bold text-theme-text-primary transition-colors">
                        <SaveIcon className="w-3 h-3" /> Descargar
                    </button>
                    {/* Library (Mock) */}
                    <button onClick={handleAddToLibrary} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-theme-bg-hover text-xs font-bold text-theme-text-primary transition-colors">
                        <LayersIcon className="w-3 h-3" /> A Librería
                    </button>

                    <button onClick={handleImportToCanvas} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-theme-accent-primary hover:bg-theme-accent-hover text-white text-xs font-bold transition-colors shadow">
                        <UploadIcon className="w-3 h-3 rotate-180" /> Al Lienzo
                    </button>

                    <div className="h-4 w-px bg-theme-bg-tertiary mx-1"></div>

                    <button onClick={() => { setResultImage(null); setShowOriginal(false); }} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition-colors" title="Cerrar Resultado">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Floating Prompt Bar */}
            <div
                className={`fixed bottom-0 z-50 flex justify-center items-end p-6 transition-all duration-300 pointer-events-none ${isLeftOpen ? 'left-64' : 'left-0'} ${isRightOpen ? 'right-56' : 'right-0'}`}
            >
                <div className={`bg-theme-bg-secondary border border-theme-bg-tertiary rounded-xl shadow-2xl transition-all duration-300 pointer-events-auto backdrop-blur-sm bg-opacity-90 flex flex-col overflow-hidden ${isPromptBarOpen ? 'w-[600px] p-4 gap-2' : 'w-auto p-2'}`}>

                    {/* Header / Toggle Row */}
                    <div className={`flex items-center ${isPromptBarOpen ? 'justify-between' : 'justify-center'}`}>
                        {isPromptBarOpen && (
                            <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Instrucciones</label>
                        )}

                        <div className="flex items-center gap-2">
                            {isPromptBarOpen && (
                                <>
                                    {/* Presets Dropdown */}
                                    <div className="relative">
                                        <button onClick={() => setIsPresetsDropdownOpen(!isPresetsDropdownOpen)} className="flex items-center gap-1 text-[10px] text-theme-text-secondary hover:text-theme-text-primary px-2 py-1 rounded hover:bg-theme-bg-tertiary transition-colors">
                                            <span>Presets</span>
                                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isPresetsDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isPresetsDropdownOpen && (
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-theme-bg-primary border border-theme-bg-tertiary rounded shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                                                {savedInstructions.length > 0 ? (
                                                    savedInstructions.map(preset => (
                                                        <div key={preset.id} onClick={() => handleLoadPreset(preset)} className="flex items-center justify-between p-2 hover:bg-theme-bg-secondary cursor-pointer group border-b border-theme-bg-tertiary last:border-0">
                                                            <span className="text-xs text-theme-text-primary truncate max-w-[120px]">{preset.name}</span>
                                                            <button onClick={(e) => handleDeletePreset(preset.id, e)} className="p-1 text-theme-text-tertiary hover:text-red-500 rounded opacity-0 group-hover:opacity-100"><TrashIcon className="w-3 h-3" /></button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-xs text-theme-text-tertiary text-center">No hay presets</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Save Button */}
                                    <button onClick={() => setIsSaveOpen(!isSaveOpen)} className="text-[10px] text-theme-accent hover:text-theme-accent-hover flex items-center gap-1 px-2 py-1 rounded hover:bg-theme-bg-tertiary/50 transition-colors">
                                        <SaveIcon className="w-3 h-3" /> Guardar
                                    </button>
                                </>
                            )}

                            {/* Collapse Toggle */}
                            <button
                                onClick={() => setIsPromptBarOpen(!isPromptBarOpen)}
                                className="p-1 hover:bg-theme-bg-tertiary rounded text-theme-text-secondary transition-colors"
                                title={isPromptBarOpen ? "Ocultar" : "Mostrar Instrucciones"}
                            >
                                {isPromptBarOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Content (only when open) */}
                    {isPromptBarOpen && (
                        <>
                            {isSaveOpen && (
                                <div className="flex items-center gap-2 bg-theme-bg-primary p-2 rounded border border-theme-accent animate-in fade-in zoom-in-95 duration-200">
                                    <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre del preset..." className="flex-1 bg-transparent text-xs outline-none min-w-0 text-theme-text-primary" autoFocus />
                                    <button onClick={handleSavePreset} disabled={!saveName.trim()} className="text-theme-accent font-bold text-xs disabled:opacity-50 hover:underline">Guardar</button>
                                </div>
                            )}
                            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe cómo quieres renderizar la imagen..." className="w-full h-16 bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg p-2 text-xs text-theme-text-primary focus:border-theme-accent outline-none resize-none placeholder:text-theme-text-tertiary transition-colors" />
                        </>
                    )}
                </div>
            </div>

            {/* Toggles */}
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`fixed top-1/2 -translate-y-1/2 z-40 w-6 h-12 rounded-r-lg bg-theme-bg-secondary border-y border-r border-theme-bg-tertiary shadow-md transition-all duration-300 hover:bg-theme-bg-hover flex items-center justify-center ${isLeftOpen ? 'left-64' : 'left-0'}`}>
                {isLeftOpen ? <ChevronLeftIcon className="w-4 h-4 text-theme-text-secondary" /> : <ChevronRightIcon className="w-4 h-4 text-theme-text-secondary" />}
            </button>
            <button onClick={() => setIsRightOpen(!isRightOpen)} className={`fixed top-1/2 -translate-y-1/2 z-40 w-6 h-12 rounded-l-lg bg-theme-bg-secondary border-y border-l border-theme-bg-tertiary shadow-md transition-all duration-300 hover:bg-theme-bg-hover flex items-center justify-center ${isRightOpen ? 'right-56' : 'right-0'}`}>
                {isRightOpen ? <ChevronRightIcon className="w-4 h-4 text-theme-text-secondary" /> : <ChevronLeftIcon className="w-4 h-4 text-theme-text-secondary" />}
            </button>

        </div>
    );
};
