
import { CanvasItem, SketchObject, CropRect } from '../types';
import { GoogleGenAI } from "@google/genai";
import { resizeImageForAI } from './imageUtils';

export const generateContentWithRetry = async (
    apiKey: string,
    model: string,
    contents: any,
    config: any = {},
    maxRetries: number = 3
) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey });
            // @ts-ignore
            const response = await ai.models.generateContent({ model, contents, config });
            return response;
        } catch (error: any) {
            attempt++;
            const isNetworkError = error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch");

            if (isNetworkError && attempt < maxRetries) {
                const delayStr = Math.pow(2, attempt) * 1000;
                console.warn(`AI Request failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delayStr}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delayStr));
                continue;
            }
            throw error; // Re-throw if not a retryable error or max retries reached
        }
    }
    throw new Error("Max retries reached for AI request.");
};

// function to convert dataURL to base64
const dataURLtoBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// Helper to prepare the AI request payload
// This function needs to be pure or explicitly passed all dependencies
export const prepareAIRequest = async (
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
            const { enhancementPrompt, enhancementStylePrompt, enhancementNegativePrompt, enhancementCreativity, enhancementChromaKey, enhancementPreviewBgColor, enhancementTextOnly } = payload;

            if (enhancementTextOnly) {
                // --- TEXT ONLY FLOW ---

                // 1. Construct Prompt
                finalPrompt = `Genera una imagen basada en la siguiente descripción: "${enhancementPrompt}".\nEstilo: "${enhancementStylePrompt}".\n`;
                let creativityInstruction = '';
                if (enhancementCreativity <= 40) creativityInstruction = 'Sé muy preciso y literal con la descripción.';
                else if (enhancementCreativity <= 80) creativityInstruction = 'Interpreta la descripción con buen gusto artístico.';
                else if (enhancementCreativity <= 120) creativityInstruction = 'Sé creativo e imaginativo con la descripción.';
                else creativityInstruction = 'Prioriza la creatividad y el impacto visual sobre la literalidad de la descripción.';

                finalPrompt += creativityInstruction + ' ';

                if (enhancementNegativePrompt && enhancementNegativePrompt.trim()) {
                    finalPrompt += `Asegúrate de evitar estrictamente lo siguiente: "${enhancementNegativePrompt}". `;
                }
                if (enhancementChromaKey && enhancementChromaKey !== 'none') {
                    const colorHex = enhancementChromaKey === 'green' ? '#00FF00' : '#0000FF';
                    finalPrompt += `Importante: La imagen resultante DEBE tener un fondo de croma sólido y uniforme de color ${enhancementChromaKey} (${colorHex}). El sujeto principal no debe contener este color. El objeto debe estar iluminado neutramente y NO debe reflejar el color del fondo ni tener contaminación lumínica (color spill) del croma en sus bordes o superficies. Para objetos transparentes o reflectantes (vidrio, metal, agua), los reflejos y refracciones DEBEN provenir de un entorno de estudio neutro imaginario (blanco/gris), IGNORANDO FÍSICAMENTE el color verde/azul del fondo para estos efectos. ¡CRÍTICO! Genera UNA SOLA IMAGEN integrada. NO generes collages, ni comparaciones "antes/después", ni pantallas dividida. Solo el objeto final sobre el fondo croma.`;
                }

                // No debug image for text only input, maybe we can add a placeholder?
                // parts remains empty effectively (no image parts)
            } else {
                // --- EXISTING IMAGE TO IMAGE FLOW ---
                // For preview, we tolerate empty prompt (show what we have)
                const description = enhancementPrompt || "";

                // FIX: Add Isolated Background Image (Requested by User: "Fondo: Como esta actualmente")
                if (backgroundObject?.canvas && backgroundObject.isVisible && (!enhancementChromaKey || enhancementChromaKey === 'none')) {
                    const bgUrl = backgroundObject.canvas.toDataURL('image/png');
                    const resizedBg = await resizeImageForAI(bgUrl);
                    debugImages.push({ name: 'Fondo Original', url: resizedBg });
                    parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedBg) } });
                }

                // Manual Composite Logic for filteredObjects
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvasSize.width;
                tempCanvas.height = canvasSize.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) return null;

                // FIX: Include Background if available and visible
                if (backgroundObject?.canvas && backgroundObject.isVisible) {
                    tempCtx.drawImage(backgroundObject.canvas, 0, 0);
                }

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

                const dataUrl = finalImageCanvas.toDataURL('image/png');
                const resizedDataUrl = await resizeImageForAI(dataUrl);

                debugImages.push({ name: 'Imagen de Entrada', url: resizedDataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedDataUrl) } });

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
                    promptParts.push(`Importante: La imagen resultante DEBE tener un fondo de croma sólido y uniforme de color ${enhancementChromaKey} (${colorHex}). El sujeto principal no debe contener este color. El objeto debe estar iluminado neutramente y NO debe reflejar el color del fondo ni tener contaminación lumínica (color spill) del croma en sus bordes o superficies. Para objetos transparentes o reflectantes (vidrio, metal, agua), los reflejos y refracciones DEBEN provenir de un entorno de estudio neutro imaginario (blanco/gris), IGNORANDO FÍSICAMENTE el color verde/azul del fondo para estos efectos. ¡CRÍTICO! Genera UNA SOLA IMAGEN integrada. NO generes collages, ni comparaciones "antes/después", ni pantallas dividida. Solo el objeto final sobre el fondo croma.`);
                }
                finalPrompt = promptParts.join(' ');
            }
            break;
        }
        case 'composition': {
            // FIX: Align with 'object' payload (Simple Render) - user calls it 'simp'
            // 1. Isolated Background (PNG) - User calls it 'Fondo Sketch'
            if (backgroundObject?.canvas && backgroundObject.isVisible) {
                const bgUrl = backgroundObject.canvas.toDataURL('image/png');
                const resizedBg = await resizeImageForAI(bgUrl);
                debugImages.push({ name: 'Fondo Sketch', url: resizedBg });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedBg) } });
            }

            // 2. Cropped Sketch Composite (PNG) - User calls it 'Composite'
            // Use helper to ensure consistent composition (background + objects)
            const compositionCanvas = getCompositeCanvas(true, canvasSize, () => filteredObjects, backgroundObject);

            if (!compositionCanvas) return null;

            let imageCanvas = compositionCanvas;

            // Bbox Logic
            const combinedBbox = getCombinedBbox(filteredObjects);

            if (combinedBbox && combinedBbox.width > 0 && combinedBbox.height > 0) {
                referenceWidth = combinedBbox.width;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = combinedBbox.width;
                cropCanvas.height = combinedBbox.height;
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                    cropCtx.drawImage(compositionCanvas, combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height, 0, 0, combinedBbox.width, combinedBbox.height);
                    imageCanvas = cropCanvas;
                }
            }

            const dataUrl = imageCanvas.toDataURL('image/png');
            const resizedComposite = await resizeImageForAI(dataUrl);

            debugImages.push({ name: 'Composite', url: resizedComposite });
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedComposite) } });


            if (payload.styleRef?.url) {
                const resizedRef = await resizeImageForAI(payload.styleRef.url);
                debugImages.push({ name: 'Referencia de Estilo', url: resizedRef });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedRef) } });
            }


            const userStyleInstruction = payload.compositionPrompt || "realistic materialization";

            finalPrompt = `SYSTEM ROLE: You are an Expert AI in "Sketch-to-Reality Inpainting" using a dual-image reference system. Your goal is to transform a specific sketched element into a photorealistic object.

INPUTS:

IMAGE_SOURCE (Clean Base): The original, clean photograph (e.g., the house without the red box).

IMAGE_GUIDE (Annotation): The same photograph containing a Red Markup Box. Inside this box is a sketch or drawing that needs to be materialized.

STYLE_INSTRUCTION (Text): The user's description of the desired material or style for the sketched object.

CRITICAL EXECUTION PROCEDURE:

1. LOCATE & IDENTIFY (The "What" and "Where"):

Look at IMAGE_GUIDE. Find the Red Markup Box.

Focus exclusively on the sketched content directly inside that red box. Do NOT read the STYLE_INSTRUCTION text as content to be generated.

2. MATERIALIZE (The "How"):

Take the identified sketch.

Transform this shape into a photorealistic 3D object.

Apply the material, texture, and style described in the STYLE_INSTRUCTION.

3. INTEGRATE & CLEAN (The Final Image):

Place the newly created photorealistic object onto the IMAGE_SOURCE (the clean base image) at the exact coordinates where the red box was.

Ensure the new object is perfectly lit by the scene's existing light sources (shadows, highlights).

CRITICAL: The final output must be utterly clean. Completely remove the Red Markup Box and any UI elements.

USER STYLE_INSTRUCTION: "${userStyleInstruction}"

NEGATIVE PROMPT: The text "${userStyleInstruction}" rendered literally, red box, red outline, UI elements, annotations, flat sketch, drawing marks, low quality, blurred edges.`;
            break;
        }

        case 'free': {
            const slots: ('main' | 'a' | 'b' | 'c')[] = ['main', 'a', 'b', 'c'];
            const slotNames = ['Objeto Principal', 'Elemento A', 'Elemento B', 'Elemento C'];
            for (const [index, slot] of slots.entries()) {
                const slotData = payload.freeFormSlots[slot];
                if (slotData?.url) {
                    const resizedSlot = await resizeImageForAI(slotData.url);
                    debugImages.push({ name: slotNames[index], url: resizedSlot });
                    parts.push({ text: `[Imagen: ${slotNames[index]}]` });
                    parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedSlot) } });
                }
            }
            finalPrompt = payload.freeFormPrompt || '';
            break;
        }

        case 'upscale': {
            // Upscale Mode: Send ONLY the full composition as a single image.

            // 1. Generate Full Composition (Background + Layers)
            const compositionCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);

            if (compositionCanvas) {
                const compDataUrl = compositionCanvas.toDataURL('image/png'); // High quality PNG
                // For upscale, we MIGHT want to keep resolution, but user rule says "Todos los envios".
                // Let's apply resize for now to be safe with payload limits, or maybe 2048 if explicitly needed?
                // User said "1536px... o 2048px ... aumenta riesgo error".
                // Let's stick to 1536px for consistency as requested "dame un plan para aplicar esto, se debe aplicar a todos los envios"
                const resizedUpscale = await resizeImageForAI(compDataUrl);
                debugImages.push({ name: 'Imagen a Escalar', url: resizedUpscale });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedUpscale) } });
            }

            // 2. High-Res Prompt Engineering
            let baseScalerPrompt = `Genera una versión de súper alta resolución (4K) y altamente detallada de esta imagen. 
            Mejora la nitidez, las texturas y la iluminación manteniendo fielmente la composición y los colores originales.`;

            const creativity = payload.upscaleCreativity || 0;

            if (creativity < 30) {
                // Tier 1: Strict Fidelity
                baseScalerPrompt += `
                MODO: RE-RENDERIZADO DE ALTA FIDELIDAD.
                Mantén la geometría, colores e iluminación exactos.
                Tu objetivo es eliminar el ruido y artefactos de compresión, definiendo los bordes con precisión quirúrgica.
                Añade micro-texturas sutiles que solo se aprecian en alta resolución (porosidad del hormigón, vetas de madera, reflejos nítidos).`;
            } else if (creativity <= 80) {
                // Tier 2: Balanced Detail
                baseScalerPrompt += `
                MODO: ENRIQUECIMIENTO DE DETALLE FOTORREALISTA.
                La imagen original es solo una guía de volumen.
                PROYECTA nuevas texturas de alta frecuencia: añade imperfecciones realistas, suciedad sutil en juntas, reflejos complejos en vidrios y detalle individual en hojas de plantas.
                El resultado debe parecer una fotografía tomada con una lente profesional 4K nítida.`;
            } else {
                // Tier 3: High Imagination
                baseScalerPrompt += `
                MODO: RE-IMAGINACIÓN ULTRA-REALISTA.
                Trata la entrada como un borrador. Reconstruye la escena con el máximo realismo posible.
                Usa iluminación volumétrica, cáusticas nítidas y materiales de catálogo premium.
                No tengas miedo de "alucinar" detalles que no están en el original si eso hace que la imagen se vea espectacularmente nítida y profesional.`;
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
                const compDataUrl = compositionCanvas.toDataURL('image/png');
                const resizedSketch = await resizeImageForAI(compDataUrl);
                debugImages.push({ name: 'Imagen Base', url: resizedSketch });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(resizedSketch) } });
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
