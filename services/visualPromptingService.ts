
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
    mode?: 'edit' | 'render'; // 'edit' = Strict Preservation + Local Edits. 'render' = Global Photo Transition.
    visualGuideImage?: string; // Optional: direct snapshot from client
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

        // 0. Load Base Image (Background) - USE ONLY IF EDIT MODE
        // For 'render' mode, showing the base image + red boxes might confuse the model into thinking the base image is the "result" to preserve.
        // Actually, the model needs to see the sketch to know where the regions are relative to the content.
        // So we keep the base image.
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
 * Incorporates Reference Image labeling (Ref 1, Ref 2...) to match the multimodal parts.
 */
export function buildVisualPrompt(payload: VisualPromptingPayload): string {
    const mode = payload.mode || 'edit';

    let prompt = `SYSTEM ROLE:
You are an expert Image-to-Image AI assistant specialized in architectural visualization and semantic editing. You receive a SOURCE_IMAGE (base content) and a SPATIAL_MARKUP_GUIDE (coordinate metadata). Your task is to apply edits described in text strictly at the pixel locations indicated by the markup guide.

INSTRUCTIONS:
1. SPATIAL ANCHORING (MANDATORY): You are provided with two primary images:
   - IMAGE 1 (SOURCE_IMAGE): The clean, high-visibility base content.
   - IMAGE 2 (SPATIAL_MARKUP_GUIDE): An overlay of the SOURCE_IMAGE with RED BOUNDING BOXES and REGION NUMBERS.
2. The red boxes in the SPATIAL_MARKUP_GUIDE define the EXACT PIXEL COORDINATES for editing. You MUST localize your generations strictly within these identified areas.
3. The numbers (1, 2, 3...) inside the red boxes correspond directly to the "Specific Region Instructions" below.
4. CONTENT FIDELITY: Preserve all content from the SOURCE_IMAGE that is NOT contained within a region perfectly. 
5. DO NOT render the red boxes, the numbers, or any markup lines in the final output. They are pure coordinate metadata.

USER INSTRUCTION:
`;

    if (mode === 'render') {
        prompt += `Global Instruction: Transform this SKETCH/DRAWING into a HIGH-END PHOTOREALISTIC ARCHITECTURAL PHOTOGRAPH. Maintain the geometry and perspective exactly.\n`;
        if (payload.globalPrompt) prompt += `Context/Description: ${payload.globalPrompt}\n`;
        if (payload.globalInstructions) prompt += `Style Notes: ${payload.globalInstructions}\n`;
    } else {
        prompt += `Global Instruction: Edit the attached Base Image according to the following specific region instructions. Preserve everything outside the regions exactly.\n`;
        if (payload.globalInstructions) prompt += `Global Enhancement Notes: ${payload.globalInstructions}\n`;
    }

    let refCounter = 1;
    if (payload.globalReferenceImage) {
        prompt += `(Note: Using Reference Image ${refCounter} as global style/structure source)\n`;
        refCounter++;
    }

    if (payload.regions.length > 0) {
        prompt += `\nSpecific Region Instructions:\n`;
        payload.regions.sort((a, b) => a.regionNumber - b.regionNumber).forEach(region => {
            let regionText = `- Region ${region.regionNumber} [LOCATION: Inside Region ${region.regionNumber}]: ${region.prompt}`;
            if (region.referenceImage) {
                regionText += ` (Matching Reference Image ${refCounter})`;
                refCounter++;
            }
            prompt += `${regionText}\n`;
        });
    }

    prompt += `\nReturn ONLY the final generated image.`;

    return prompt;
}

/**
 * Prepares the full request payload for the Gemini API.
 */
export async function prepareVisualPromptingRequest(payload: VisualPromptingPayload, apiKey: string, promptOverride?: string) {
    // 1. Generate or Use provided Guide Image
    let guideImageBase64 = '';
    if (payload.visualGuideImage) {
        guideImageBase64 = payload.visualGuideImage.split(',')[1];
    } else {
        guideImageBase64 = (await composeVisualGuide(payload)).split(',')[1];
    }

    // 2. Get Base Image (Source of Truth)
    const baseImageBase64 = payload.baseImage.split(',')[1];

    // 3. Build Text Prompt (or use override)
    const textPrompt = promptOverride || buildVisualPrompt(payload);

    // 4. Construct API Payload with STRICT SEQUENCING
    const parts: any[] = [
        // PART 1: Source of Truth (Clean)
        { text: "SOURCE_IMAGE:" },
        { inlineData: { mimeType: 'image/png', data: baseImageBase64 } },

        // PART 2: Visual Guide (Sketches + Regions + Numbers)
        { text: "SPATIAL_MARKUP_GUIDE:" },
        { inlineData: { mimeType: 'image/png', data: guideImageBase64 } },
    ];

    // PART 3: Labeled Reference Images (Sequence must match buildVisualPrompt's refCounter)
    let refCounter = 1;

    // Add Global Reference Image (Style Ref)
    if (payload.globalReferenceImage) {
        const globalRefBase64 = payload.globalReferenceImage.split(',')[1];
        parts.push({ text: `Reference Image ${refCounter}:` });
        parts.push({ inlineData: { mimeType: 'image/png', data: globalRefBase64 } });
        refCounter++;
    }

    // Add Region Reference Images
    payload.regions.sort((a, b) => a.regionNumber - b.regionNumber).forEach(region => {
        if (region.referenceImage) {
            const refBase64 = region.referenceImage.split(',')[1];
            parts.push({ text: `Reference Image ${refCounter}:` });
            parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
            refCounter++;
        }
    });

    // PART 4: Final Text Instruction
    parts.push({ text: textPrompt });

    const contents = { parts };

    return { contents, textPrompt, guideImageBase64 };
}
