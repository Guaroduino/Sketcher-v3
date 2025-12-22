
import { CanvasItem, SketchObject, CropRect } from '../types';
// function to convert dataURL to base64
const dataURLtoBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// Helper to prepare the AI request payload
// This function needs to be pure or explicitly passed all dependencies
export const prepareAIRequest = (
    payload: any,
    canvasSize: { width: number, height: number },
    getDrawableObjects: () => CanvasItem[],
    backgroundObject: SketchObject | undefined,
    activeItemId: string | null,
    allObjects: CanvasItem[],
    getCompositeCanvas: any, // Pass these as args to avoid dependency issues
    getCombinedBbox: any
) => {
    let finalPrompt = '';
    const parts: any[] = [];
    const debugImages: { name: string; url: string }[] = [];
    let referenceWidth = canvasSize.width;

    const visibleObjects = getDrawableObjects().filter((obj): obj is SketchObject => obj.type === 'object' && !obj.isBackground && obj.isVisible && !!obj.canvas);
    let filteredObjects = visibleObjects;

    if (payload.sourceScope === 'layer' && activeItemId) {
        const activeItem = allObjects.find(i => i.id === activeItemId);
        const parentId = activeItem?.type === 'group' ? activeItem.id : activeItem?.parentId;
        filteredObjects = visibleObjects.filter(obj => obj.parentId === (parentId || null));
    }

    switch (payload.activeAiTab) {
        case 'object': {
            const { enhancementPrompt, enhancementStylePrompt, enhancementNegativePrompt, enhancementCreativity, enhancementChromaKey, enhancementPreviewBgColor } = payload;
            // For preview, we tolerate empty prompt (show what we have)
            const description = enhancementPrompt || "";

            // Manual Composite Logic for filteredObjects
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasSize.width;
            tempCanvas.height = canvasSize.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return null;

            [...filteredObjects].reverse().forEach(obj => {
                if (obj.canvas) {
                    tempCtx.globalAlpha = obj.opacity;
                    tempCtx.drawImage(obj.canvas, 0, 0);
                }
            });
            tempCtx.globalAlpha = 1.0;

            const compositeCanvas = tempCanvas;
            let imageCanvas = compositeCanvas;

            // Bbox Logic
            const combinedBbox = getCombinedBbox(filteredObjects);

            if (combinedBbox && combinedBbox.width > 0 && combinedBbox.height > 0) {
                referenceWidth = combinedBbox.width;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = combinedBbox.width;
                cropCanvas.height = combinedBbox.height;
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                    cropCtx.drawImage(compositeCanvas, combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height, 0, 0, combinedBbox.width, combinedBbox.height);
                    imageCanvas = cropCanvas;
                }
            }

            let finalImageCanvas = document.createElement('canvas');
            finalImageCanvas.width = imageCanvas.width;
            finalImageCanvas.height = imageCanvas.height;
            const finalCtx = finalImageCanvas.getContext('2d');
            if (finalCtx) {
                finalCtx.fillStyle = enhancementPreviewBgColor || '#FFFFFF';
                finalCtx.fillRect(0, 0, finalImageCanvas.width, finalImageCanvas.height);
                finalCtx.drawImage(imageCanvas, 0, 0);
            } else {
                finalImageCanvas = imageCanvas;
            }

            const dataUrl = finalImageCanvas.toDataURL('image/jpeg');
            debugImages.push({ name: 'Imagen de Entrada', url: dataUrl });
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(dataUrl) } });

            let creativityInstruction = '';
            if (enhancementCreativity <= 40) creativityInstruction = 'Sé muy fiel a la imagen de entrada y a la descripción proporcionada. Realiza solo los cambios solicitados.';
            else if (enhancementCreativity <= 80) creativityInstruction = 'Mantén una fidelidad moderada a la imagen y descripción, pero puedes hacer pequeñas mejoras estéticas.';
            else if (enhancementCreativity <= 120) creativityInstruction = 'Usa la imagen y la descripción como una fuerte inspiración. Siéntete libre de reinterpretar elementos para un mejor resultado artístico.';
            else creativityInstruction = 'Usa la imagen y la descripción solo como una vaga inspiración. Prioriza un resultado impactante y altamente creativo sobre la fidelidad al original.';

            const promptParts = [
                `Tu tarea es mejorar o transformar una imagen de entrada.`,
                `Descripción de la transformación deseada: "${description}".`,
                `El estilo visual a aplicar es: "${enhancementStylePrompt}".`,
                creativityInstruction,
            ];
            if (enhancementNegativePrompt && enhancementNegativePrompt.trim()) promptParts.push(`Asegúrate de evitar estrictamente lo siguiente: "${enhancementNegativePrompt}".`);
            if (enhancementChromaKey && enhancementChromaKey !== 'none') {
                const colorHex = enhancementChromaKey === 'green' ? '#00FF00' : '#0000FF';
                promptParts.push(`Importante: La imagen resultante DEBE tener un fondo de croma sólido y uniforme de color ${enhancementChromaKey} (${colorHex}). El sujeto principal no debe contener este color.`);
            }
            finalPrompt = promptParts.join(' ');
            break;
        }
        case 'composition': {
            if (backgroundObject?.canvas && backgroundObject.isVisible) {
                const bgDataUrl = backgroundObject.canvas.toDataURL('image/jpeg');
                debugImages.push({ name: 'Fondo', url: bgDataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(bgDataUrl) } });
            }

            const compositionCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);
            if (compositionCanvas) {
                const compDataUrl = compositionCanvas.toDataURL('image/jpeg');
                debugImages.push({ name: 'Composición Completa', url: compDataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(compDataUrl) } });
            }

            if (payload.styleRef?.url) {
                debugImages.push({ name: 'Referencia de Estilo', url: payload.styleRef.url });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(payload.styleRef.url) } });
            }
            finalPrompt = payload.compositionPrompt || '';
            break;
        }

        case 'free': {
            const slots: ('main' | 'a' | 'b' | 'c')[] = ['main', 'a', 'b', 'c'];
            const slotNames = ['Objeto Principal', 'Elemento A', 'Elemento B', 'Elemento C'];
            slots.forEach((slot, index) => {
                const slotData = payload.freeFormSlots[slot];
                if (slotData?.url) {
                    debugImages.push({ name: slotNames[index], url: slotData.url });
                    parts.push({ text: `[Imagen: ${slotNames[index]}]` });
                    parts.push({ inlineData: { mimeType: 'image/png', data: dataURLtoBase64(slotData.url) } });
                }
            });
            finalPrompt = payload.freeFormPrompt || '';
            break;
        }

        case 'upscale': {
            // Upscale Mode: Send ONLY the full composition as a single image.

            // 1. Generate Full Composition (Background + Layers)
            const compositionCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);

            if (compositionCanvas) {
                const compDataUrl = compositionCanvas.toDataURL('image/jpeg', 1.0); // High quality
                debugImages.push({ name: 'Imagen a Escalar', url: compDataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(compDataUrl) } });
            }

            // 2. High-Res Prompt Engineering
            let baseScalerPrompt = `Genera una versión de súper alta resolución (4K) y altamente detallada de esta imagen. 
            Mejora la nitidez, las texturas y la iluminación manteniendo fielmente la composición y los colores originales.`;

            const creativity = payload.upscaleCreativity || 0;

            if (creativity < 30) {
                // Tier 1: Strict Fidelity
                baseScalerPrompt += `
                MODO: FIEL AL ORIGINAL.
                Mejora la nitidez y elimina el ruido, pero NO añadas elementos nuevos ni cambies texturas drásticamente.
                El objetivo es que se vea limpia y profesional, respetando al 100% la intención original.`;
            } else if (creativity <= 80) {
                // Tier 2: Balanced Detail
                baseScalerPrompt += `
                MODO: MEJORA DE DETALLE (BALANCEADO).
                La imagen original puede estar borrosa o tener baja resolución.
                TU TRABAJO ES "ALUCINAR" TEXTURAS REALISTAS para piel, telas, materiales y follaje.
                Inyecta micro-detalles para que parezca una foto 4K nativa, pero mantén la iluminación y formas generales.`;
            } else {
                // Tier 3: High Imagination
                baseScalerPrompt += `
                MODO: RE-IMAGINACIÓN CREATIVA (MAXIMO DETALLE).
                Libertad total para mejorar la imagen. Si hay texturas planas, cámbialas por materiales ultra-realistas.
                Mejora la iluminación para que sea dramática y cinemática (estilo render Unreal Engine 5).
                Prioriza que se vea "increíble" y "súper nítida" por encima de la fidelidad estricta puntapíxel.`;
            }

            finalPrompt = baseScalerPrompt;
            break;
        }
        case 'sketch': {
            // Sketch/Watercolor Mode
            const { sketchWaterLevel, sketchDetailLevel, sketchUserInstruction } = payload;

            // 1. Get Image (Full Composition)
            const compositionCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);
            if (compositionCanvas) {
                const compDataUrl = compositionCanvas.toDataURL('image/jpeg');
                debugImages.push({ name: 'Imagen Base', url: compDataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(compDataUrl) } });
            }

            // 2. Construct Prompt Hierarchy
            const promptParts = [];

            // A. Role and Action
            promptParts.push("Actúa como un maestro pintor. Transforma la imagen adjunta en una pintura de acuarela profesional o boceto artístico.");

            // B. Stylistic Descriptors (Dynamic)
            // Water Level (Agua)
            if (sketchWaterLevel >= 75) {
                promptParts.push("Utiliza una técnica de 'mojado sobre mojado', permitiendo que los colores se mezclen y sangren libremente en los bordes para un efecto etéreo y fluido.");
            } else if (sketchWaterLevel <= 25) {
                promptParts.push("Utiliza una técnica de 'pincel seco' o trazos de lápiz marcados, con bordes definidos, texturas rugosas y poca mezcla de colores.");
            } else {
                promptParts.push("Utiliza un balance equilibrado de agua y pigmento, logrando transiciones suaves pero manteniendo la definición de las formas principales.");
            }

            // Detail Level (Detalle)
            if (sketchDetailLevel >= 75) {
                promptParts.push("El estilo debe ser altamente detallado y realista (estilo ilustración botánica o arquitectónica), definiendo con precisión texturas y pequeños elementos.");
            } else if (sketchDetailLevel <= 25) {
                promptParts.push("Crea un boceto minimalista, gestual y esquemático (estilo 'urban sketching' rápido), ignorando los detalles finos y centrándote en la energía, la composición y las formas básicas.");
            } else {
                promptParts.push("Mantén un nivel medio de detalle, sugiriendo las texturas y formas sin sobrecargar la imagen, dejando algunas áreas más abstractas.");
            }

            // C. Output Constraints
            promptParts.push("No devuelvas la imagen original. No añadas texto, marcos, firmas ni marcas de agua. El fondo debe simular la textura del papel de acuarela o bloc de dibujo.");

            // D. User Instructions
            if (sketchUserInstruction && sketchUserInstruction.trim()) {
                promptParts.push(`Instrucción adicional del usuario: "${sketchUserInstruction}".`);
            }

            finalPrompt = promptParts.join(' ');
            break;
        }
    }

    return { parts, debugImages, finalPrompt, referenceWidth, filteredObjects, visibleObjects };
};
