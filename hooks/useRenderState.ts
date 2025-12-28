
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SceneType, RenderStyleMode, buildArchitecturalPrompt, ArchitecturalRenderOptions } from '../utils/architecturalPromptBuilder';
import { RenderStyleSettings } from '../types';
import { GEMINI_MODEL_ID } from '../utils/constants';
import { resizeImageForAI } from '../utils/imageUtils';

// Define the Hook
export function useRenderState(
    credits: number | null,
    deductCredit: (() => Promise<boolean>) | undefined,
    selectedModel: string,
    onRenderCompleteRequest?: (dataUrl: string) => void,
    onInspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>
) {
    // --- State ---
    const [sceneType, setSceneType] = useState<SceneType>('exterior');
    const [renderStyle, setRenderStyle] = useState<RenderStyleMode>('photorealistic');
    const [creativeFreedom, setCreativeFreedom] = useState(50);
    const [additionalPrompt, setAdditionalPrompt] = useState('');
    const [manualPrompt, setManualPrompt] = useState('');
    const [matchMateriality, setMatchMateriality] = useState(false);
    const [styleReferenceDescription, setStyleReferenceDescription] = useState('');
    const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);

    const [renderStyleSettings, setRenderStyleSettings] = useState<RenderStyleSettings>({
        phCamera: 'dslr', phFilm: 'digital', phEffect: 'clean',
        dsBrush: 'oil', dsFinish: 'clean', dsStroke: 'medium',
        wcTechnique: 'wet', wcPaper: 'rough', wcInk: 'fountain',
        tpBackground: 'blue', tpPrecision: 'cad', tpDetails: 'high',
        chSmudge: 'soft', chContrast: 'hgh', chHatch: 'cross',
        cmMaterial: 'white_clay', cmSurface: 'smooth', cmLighting: 'studio_soft',
        imPaper: 'im_marker_paper', imTechnique: 'im_layered', imColor: 'im_vibrant',
        tcStyle: 'tc_pixar', tcMaterial: 'tc_plastic', tcLighting: 'tc_soft',
        cpTechnique: 'cp_hatching', cpPaper: 'cp_white', cpVibrancy: 'cp_vibrant'
    });

    // Detailed Options
    const [archStyle, setArchStyle] = useState('modern');
    const [timeOfDay, setTimeOfDay] = useState('noon');
    const [weather, setWeather] = useState('sunny');
    const [roomType, setRoomType] = useState('living_room');
    const [lighting, setLighting] = useState('natural');
    const [studioLighting, setStudioLighting] = useState('softbox');
    const [studioBackground, setStudioBackground] = useState('infinity_white');
    const [studioShot, setStudioShot] = useState('full_shot');
    const [carAngle, setCarAngle] = useState('front_three_quarter');
    const [carEnvironment, setCarEnvironment] = useState('studio');
    const [carColor, setCarColor] = useState('none');
    const [objectMaterial, setObjectMaterial] = useState('matte_plastic');
    const [objectDoF, setObjectDoF] = useState('macro_focus');
    const [objectContext, setObjectContext] = useState('table_top');

    const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);

    // Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);

    const canvasAspectRatio = useRef<number | undefined>(undefined);
    const lastOptions = useRef<ArchitecturalRenderOptions | null>(null);

    // Prompt Builder Effect (Debounced)
    useEffect(() => {
        const renderOptions: ArchitecturalRenderOptions = {
            sceneType,
            renderStyle,
            creativeFreedom,
            additionalPrompt,
            archStyle,
            hasStyleReference: !!styleReferenceImage,
            canvasAspectRatio: canvasAspectRatio.current,
            ...(sceneType === 'exterior' && { timeOfDay, weather }),
            ...(sceneType === 'interior' && { roomType, lighting }),
            ...(sceneType === 'studio' && { studioLighting, studioBackground, studioShot }),
            ...(sceneType === 'automotive' && { carAngle, carEnvironment, carColor }),
            ...((sceneType === 'object_interior' || sceneType === 'object_exterior') && { objectMaterial, objectDoF, objectContext }),
            renderStyleSettings,
            matchMateriality,
            styleReferenceDescription
        };
        lastOptions.current = renderOptions;

        const timer = setTimeout(() => {
            const generatedPrompt = buildArchitecturalPrompt(renderOptions);
            setManualPrompt(generatedPrompt);
        }, 300);

        return () => clearTimeout(timer);
    }, [sceneType, renderStyle, creativeFreedom, additionalPrompt, archStyle, timeOfDay, weather, roomType, lighting, styleReferenceImage, studioLighting, studioBackground, studioShot, carAngle, carEnvironment, carColor, objectMaterial, objectDoF, objectContext, renderStyleSettings, matchMateriality]);


    // Actions
    const handleRender = async (sourceImage: string, targetDimensions?: { width: number, height: number }, aspectRatio?: number, overrideImages?: { background?: string, composite?: string }) => {
        if (aspectRatio !== undefined) {
            canvasAspectRatio.current = aspectRatio;
            // Force prompt update for aspect ratio changes
            if (lastOptions.current) {
                lastOptions.current.canvasAspectRatio = aspectRatio;
                const newPrompt = buildArchitecturalPrompt(lastOptions.current);
                setManualPrompt(newPrompt);
            }
        }
        if (!sourceImage && !overrideImages) {
            alert("No hay imagen base para renderizar.");
            return;
        }

        if (credits === null) {
            alert("Debes iniciar sesión para usar la IA.");
            return;
        }

        if (credits <= 0) {
            alert("No tienes suficientes créditos.");
            return;
        }

        setIsGenerating(true);
        setInputImage(sourceImage); // Capture what was sent
        setResultImage(null);

        try {
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const model = selectedModel;

            const parts: any[] = [];

            if (sceneType === 'object_integration' && overrideImages && overrideImages.background && overrideImages.composite) {
                // INTEGRATION MODE SPECIAL PIPELINE
                parts.push({ text: manualPrompt });

                parts.push({ text: "IMAGE 1: BACKGROUND / CONTEXT (Do not modify perspective/lighting of this)" });
                const bgOptimized = await resizeImageForAI(overrideImages.background);
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: bgOptimized.split(',')[1] } });

                parts.push({ text: "IMAGE 2: SKETCH / OBJECT TO INTEGRATE (Apply lighting/perspective from Image 1)" });
                const compOptimized = await resizeImageForAI(overrideImages.composite);
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: compOptimized.split(',')[1] } });
            } else {
                // STANDARD PIPELINE
                // OPTIMIZATION: Resize Input Image
                const optimizedInput = await resizeImageForAI(sourceImage);
                const inputBase64 = optimizedInput.split(',')[1];
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: inputBase64 } });

                if (styleReferenceImage) {
                    // OPTIMIZATION: Resize Reference Image
                    const optimizedStyle = await resizeImageForAI(styleReferenceImage);
                    const styleBase64 = optimizedStyle.split(',')[1];
                    parts.push({ inlineData: { mimeType: 'image/jpeg', data: styleBase64 } });
                }
                parts.push({ text: manualPrompt });
            }

            const contents = { parts };

            // INSPECTOR CHECK
            if (onInspectRequest) {
                const confirmed = await onInspectRequest({
                    model,
                    parts: contents.parts,
                    config: lastOptions.current || {
                        sceneType,
                        renderStyle,
                        creativeFreedom,
                        archStyle,
                        aspectRatio: canvasAspectRatio.current
                    }
                });
                if (!confirmed) {
                    setIsGenerating(false);
                    return;
                }
            }

            const response = await ai.models.generateContent({ model, contents });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                if (deductCredit) await deductCredit();
                let newResultUrl = `data:image/png;base64,${newImageBase64}`;

                // Force Resize if targetDimensions provided
                if (targetDimensions && targetDimensions.width && targetDimensions.height) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = targetDimensions.width;
                    tempCanvas.height = targetDimensions.height;
                    const ctx = tempCanvas.getContext('2d');
                    if (ctx) {
                        const img = new Image();
                        await new Promise((resolve) => {
                            img.onload = resolve;
                            img.src = newResultUrl;
                        });
                        ctx.drawImage(img, 0, 0, targetDimensions.width, targetDimensions.height);
                        newResultUrl = tempCanvas.toDataURL('image/png');
                    }
                }

                setResultImage(newResultUrl);
                if (onRenderCompleteRequest) onRenderCompleteRequest(newResultUrl);
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

    // Auto-Analyze Effect
    useEffect(() => {
        if (styleReferenceImage) {
            analyzeReferenceImage();
        } else {
            setStyleReferenceDescription('');
        }
    }, [styleReferenceImage]);

    const analyzeReferenceImage = useCallback(async () => {
        if (!styleReferenceImage) return;
        setIsAnalyzingReference(true);
        try {
            const optimized = await resizeImageForAI(styleReferenceImage);
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: [{
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: optimized.split(',')[1] } },
                        { text: "Analyze the architectural materiality of this image. Describe NOT JUST the materials, but specifically WHERE they are applied (their distribution). Focus on textures, colors, and finishes mapping. DO NOT describe the geometry, volumetry, or shape of the building itself. Output a concise description of the material palette application." }
                    ]
                }]
            });

            let text = "";
            if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) {
                        text += part.text;
                    }
                }
            }

            setStyleReferenceDescription(text);
        } catch (e) {
            console.error(e);
            alert("Error analizando referencia. Verifica tu API Key o cuota.");
        } finally {
            setIsAnalyzingReference(false);
        }
    }, [styleReferenceImage, selectedModel]);

    // Persistence Helpers
    const getFullState = useCallback(() => ({
        sceneType, renderStyle, creativeFreedom, additionalPrompt, manualPrompt,
        archStyle, timeOfDay, weather, roomType, lighting,
        studioLighting, studioBackground, studioShot,
        carAngle, carEnvironment, carColor,
        objectMaterial, objectDoF, objectContext,
        styleReferenceImage,
        renderStyleSettings,
        matchMateriality,
        styleReferenceDescription
    }), [
        sceneType, renderStyle, creativeFreedom, additionalPrompt, manualPrompt,
        archStyle, timeOfDay, weather, roomType, lighting,
        studioLighting, studioBackground, studioShot,
        carAngle, carEnvironment, carColor,
        objectMaterial, objectDoF, objectContext,
        styleReferenceImage, renderStyleSettings, matchMateriality, styleReferenceDescription
    ]);

    const setFullState = useCallback((state: any) => {
        if (!state) return;
        if (state.sceneType) setSceneType(state.sceneType);
        if (state.renderStyle) setRenderStyle(state.renderStyle);
        if (state.creativeFreedom) setCreativeFreedom(state.creativeFreedom);
        if (state.additionalPrompt) setAdditionalPrompt(state.additionalPrompt);
        if (state.manualPrompt) setManualPrompt(state.manualPrompt);
        if (state.archStyle) setArchStyle(state.archStyle);
        if (state.timeOfDay) setTimeOfDay(state.timeOfDay);
        if (state.weather) setWeather(state.weather);
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
        if (state.styleReferenceImage) setStyleReferenceImage(state.styleReferenceImage);
        if (state.renderStyleSettings) setRenderStyleSettings(state.renderStyleSettings);
        if (state.matchMateriality !== undefined) setMatchMateriality(state.matchMateriality);
        if (state.styleReferenceDescription) setStyleReferenceDescription(state.styleReferenceDescription);
    }, []);

    return {
        // State
        sceneType, setSceneType,
        renderStyle, setRenderStyle,
        renderStyleSettings, setRenderStyleSettings,
        creativeFreedom, setCreativeFreedom,
        additionalPrompt, setAdditionalPrompt,
        manualPrompt, setManualPrompt, // Manual prompt currently read-only gen from builders in this version, or editable? Component allows edit but useEffect overwrites.
        // We might want to allow override. For now, sticking to builder.
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
        styleReferenceImage, setStyleReferenceImage,

        isGenerating,
        setIsGenerating,
        inputImage,
        resultImage,
        setResultImage, // Allow manual clear or update

        // Actions
        handleRender,
        analyzeReferenceImage,
        getFullState,
        setFullState,
        styleReferenceDescription,
        isAnalyzingReference
    };
}
