
import { GoogleGenAI } from "@google/genai";

export interface Region {
    id: string;
    regionNumber: number;
    type: 'rectangle' | 'polygon';
    points?: { x: number, y: number }[]; // For polygons
    x: number; // Bounding box x (calculated for polygons)
    y: number; // Bounding box y
    width: number; // Bounding box width
    height: number; // Bounding box height
    prompt: string;
    referenceImage?: string; // DataURL of the reference image
}

export interface VisualPromptingPayload {
    baseImage: string; // DataURL of the clean background
    layersImage: string; // DataURL of the user drawings (red lines, etc)
    regions: Region[];
    globalPrompt: string; // The main specific prompt ("Modern house", etc)
    globalInstructions?: string; // General guidance ("Make it realistic", "Use warm colors", etc)
    globalReferenceImage?: string; // DataURL of a global style/structure reference
    width: number;
    height: number;
}

/**
 * Composes the "Visual Guide" image.
 * It takes the user's drawing layers and superimposes the region bounding boxes and numbers.
 * This image tells the model WHERE and HOW to edit.
 */
export async function composeVisualGuide(payload: VisualPromptingPayload): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = payload.width;
        canvas.height = payload.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        // 0. Load Base Image (Background)
        const baseImg = new Image();
        baseImg.onload = () => {
            // Draw Base Image
            ctx.drawImage(baseImg, 0, 0, payload.width, payload.height);

            const drawRegions = () => {
                // 2. Draw Region Indicators (Boxes and Numbers)
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#FF0000'; // Red boxes standard for "edit regions" usually
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#FF0000';
                ctx.textBaseline = 'top';

                payload.regions.forEach(region => {
                    // Draw Region shape
                    ctx.beginPath();
                    if (region.type === 'polygon' && region.points && region.points.length > 0) {
                        ctx.moveTo(region.points[0].x, region.points[0].y);
                        for (let i = 1; i < region.points.length; i++) {
                            ctx.lineTo(region.points[i].x, region.points[i].y);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        // Fallback to bounding box (Rectangle)
                        ctx.strokeRect(region.x, region.y, region.width, region.height);
                    }

                    // Draw Number Tag (centered or at top-left of bbox)
                    const text = `${region.regionNumber}`;
                    const textMetrics = ctx.measureText(text);
                    const textBgWidth = textMetrics.width + 10;
                    const textBgHeight = 30;

                    // Position tag at top-left of bounding box
                    const tagX = region.x;
                    const tagY = region.y - textBgHeight;

                    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
                    ctx.fillRect(tagX, tagY, textBgWidth, textBgHeight);

                    ctx.fillStyle = 'white';
                    ctx.fillText(text, tagX + 5, tagY + 3);

                    // Reset fill for next box
                    ctx.fillStyle = '#FF0000';
                });

                resolve(canvas.toDataURL('image/png'));
            };

            // 1. Draw the user's drawing layers (red lines/sketches)
            if (payload.layersImage && payload.layersImage.length > 20) { // arbitrary length check for valid data url
                const layerImg = new Image();
                layerImg.onload = () => {
                    ctx.drawImage(layerImg, 0, 0);
                    drawRegions();
                };
                layerImg.onerror = () => {
                    console.warn("Failed to load drawing layer image, proceeding without it.");
                    drawRegions();
                };
                layerImg.src = payload.layersImage;
            } else {
                drawRegions();
            }
        };
        baseImg.onerror = reject;
        baseImg.src = payload.baseImage;
    });
}

/**
 * Builds the structured text prompt that maps global instructions and region-specific instructions.
 */
export function buildVisualPrompt(payload: VisualPromptingPayload): string {
    let prompt = `Global Instruction: ${payload.globalPrompt}\n\n`;

    if (payload.regions.length > 0) {
        prompt += `Region Instructions:\n`;
        payload.regions.sort((a, b) => a.regionNumber - b.regionNumber).forEach(region => {
            prompt += `- Region ${region.regionNumber}: ${region.prompt}\n`;
        });
    }

    /* 
     * System Instruction / Guidelines for the model (can be appended or sent as system instruction)
     * For the "text" part of the user prompt, we keep it focused on the user's intent.
     * The "System Prompt" is usually handled at the model config level or prepended here 
     * if the API doesn't support system instructions well for this specific mode.
     * We will append a small guide interpretation cue just in case.
     */
    prompt += `\n\n(Interpret the red boxes in the visual guide as the edit regions matching these numbers. The sketches indicate the desired shape/composition.)`;

    return prompt;
}

/**
 * Prepares the full request payload for the Gemini API.
 */
export async function prepareVisualPromptingRequest(payload: VisualPromptingPayload, apiKey: string) {
    // 1. Generate the Guide Image
    const guideImageBase64 = (await composeVisualGuide(payload)).split(',')[1];

    // 2. Get Base Image (Source of Truth)
    const baseImageBase64 = payload.baseImage.split(',')[1];

    // 3. Build Text Prompt
    let textPrompt = buildVisualPrompt(payload);

    // 4. Construct API Payload
    // Note: The order usually matters for multi-modal. 
    // [Base Image, Guide Image, Text Prompt] is a good standard.

    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: baseImageBase64 } }, // Image 1: Context/Background
        { inlineData: { mimeType: 'image/png', data: guideImageBase64 } }, // Image 2: Guide (Sketches + Regions)
    ];

    // Add Global Reference Image (if any)
    if (payload.globalReferenceImage) {
        const globalRefBase64 = payload.globalReferenceImage.split(',')[1];
        parts.push({ inlineData: { mimeType: 'image/png', data: globalRefBase64 } });
    }

    // Add Region Reference Images
    payload.regions.forEach(region => {
        if (region.referenceImage) {
            const refBase64 = region.referenceImage.split(',')[1];
            parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
        }
    });

    // Append General Instructions to Prompt
    if (payload.globalInstructions) {
        // We prepend or append? Appending is usually fine as "Global Context".
        textPrompt += `\n\nGeneral Guidelines: ${payload.globalInstructions}`;
    }

    parts.push({ text: textPrompt });

    const contents = { parts };

    return { contents, textPrompt, guideImageBase64 };
}
