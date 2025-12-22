
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
    const hasRegions = payload.regions.length > 0;

    // CASE 1: GLOBAL EDIT (No Spatial Guides)
    if (!hasRegions) {
        let prompt = `SYSTEM ROLE:
You are an expert Image-to-Image AI assistant specialized in architectural visualization. You receive a SOURCE_IMAGE. Your task is to apply global semantic edits to the image based on the USER INSTRUCTION below.

INSTRUCTIONS:
1. PRESERVATION: Preserve the core structure, geometry, and key elements of the SOURCE_IMAGE unless explicitly instructed to change them.
2. GLOBAL EDIT: Apply the changes to the entire scene or naturally to relevant objects (e.g. "make it night", "change wall color to blue").
3. DO NOT hallucinate any bounding boxes, markup, or UI elements. Return a clean, natural image.
`;

        if (mode === 'render') {
            prompt += `\nGlobal Context: This is a sketch/drawing. Transform it into a photorealistic architectural photo.\n`;
        }

        prompt += `\nUSER INSTRUCTION:\n`;
        if (payload.globalPrompt) prompt += `Description: ${payload.globalPrompt}\n`;
        if (payload.globalInstructions) prompt += `Instructions: ${payload.globalInstructions}\n`;

        if (payload.globalReferenceImage) {
            prompt += `(Note: Use Reference Image 1 as a global style/structure source)\n`;
        }

        prompt += `\nReturn ONLY the final generated image.`;
        return prompt;
    }

    // CASE 2: DUAL-REFERENCE SPATIAL EDIT (User's New Workflow)
    // We now use the exact prompt structure requested by the user.

    let prompt = `SYSTEM ROLE: You are an Expert Photo Editor utilizing a "Dual-Reference" workflow. You are provided with two images:

IMAGE 1 (SOURCE): The clean, original high-resolution architectural photo.

IMAGE 2 (GUIDE): The same photo containing RED MARKUP BOXES indicating active edit zones.

TASK: Apply the [USER CHANGE REQUEST] exclusively to the areas defined by the red boxes in IMAGE 2, but perform the edits on the canvas of IMAGE 1.

CRITICAL EXECUTION RULES:

SPATIAL MAPPING: Compare IMAGE 1 and IMAGE 2. Identify the exact pixels where the red boxes appear in IMAGE 2.

ZONE ISOLATION: Create a mental mask based only on the red boxes from IMAGE 2. Ignore the red color itself; look only at the coordinates it covers.

TARGETED EDITING: In the final output, modify only the pixels inside those coordinates.

Use the visual data from IMAGE 1 (Source) as the base.

Apply the requested change (e.g., "change material", "add light").

Ensure seamless blending with the surrounding pixels of IMAGE 1.

MARKUP ELIMINATION: The final output must look like a pristine photograph. It must NOT contain any red lines, boxes, or UI elements from IMAGE 2. The red boxes are strictly for your internal spatial logic, not for the final render.

USER CHANGE REQUEST:
`;

    // Inject Dynamic User Requests
    if (payload.regions.length > 0) {
        payload.regions.sort((a, b) => a.regionNumber - b.regionNumber).forEach(region => {
            prompt += `- Inside Red Box ${region.regionNumber}: ${region.prompt}\n`;

            // Note: Reference images are handled by the multimodal part indices, 
            // but we can mention them here if needed.
            // For now, we stick to the requested structure.
        });
    }

    if (payload.globalInstructions) {
        prompt += `- Global Note: ${payload.globalInstructions}\n`;
    }


    prompt += `\nNEGATIVE PROMPT: Red lines, red boxes, annotations, markup, borders, outlines, glitch, artifacts, changes outside the box, low resolution.`;

    return prompt;
}

/**
 * Prepares the full request payload for the Gemini API.
 */
export async function prepareVisualPromptingRequest(payload: VisualPromptingPayload, apiKey: string, promptOverride?: string) {
    const hasRegions = payload.regions.length > 0;

    // 1. Generate or Use provided Guide Image (ONLY needed if we have regions)
    let guideImageBase64 = '';
    if (hasRegions) {
        if (payload.visualGuideImage) {
            guideImageBase64 = payload.visualGuideImage.split(',')[1];
        } else {
            guideImageBase64 = (await composeVisualGuide(payload)).split(',')[1];
        }
    }

    // 2. Get Base Image (Source of Truth)
    const baseImageBase64 = payload.baseImage.split(',')[1];

    // 3. Build Text Prompt (or use override)
    // IMPORTANT: If override is provided by UI, we assume UI handles the logic. 
    // EXCEPT: If UI provides an override but we have NO regions, the override might still reference markup. 
    // Ideally, UI should also switch prompt builder.
    const textPrompt = promptOverride || buildVisualPrompt(payload);

    // 4. Construct API Payload
    const parts: any[] = [];

    // PART 1: Source of Truth (Clean)
    // If no regions, this is just "the image".
    parts.push({ text: hasRegions ? "SOURCE_IMAGE:" : "IMAGE:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: baseImageBase64 } });

    // PART 2: Visual Guide (Sketches + Regions + Numbers) - ONLY IF REGIONS EXIST
    if (hasRegions) {
        parts.push({ text: "SPATIAL_MARKUP_GUIDE:" });
        parts.push({ inlineData: { mimeType: 'image/png', data: guideImageBase64 } });
    }

    // PART 3: Labeled Reference Images (Sequence must match buildVisualPrompt's refCounter)
    // NOTE: The new Dual-Reference prompt doesn't explicitly ask for "Reference Image X" labels in the text,
    // but we still send them as parts. To avoid confusing the "Dual-Reference" logic (which expects exactly 2 images + task),
    // we should be careful. However, multimodal inputs just append. 
    // Let's simple append them as "Reference Material".
    let refCounter = 1;

    // Add Global Reference Image (Style Ref)
    if (payload.globalReferenceImage) {
        const globalRefBase64 = payload.globalReferenceImage.split(',')[1];
        parts.push({ text: `Reference Material ${refCounter}:` });
        parts.push({ inlineData: { mimeType: 'image/png', data: globalRefBase64 } });
        refCounter++;
    }

    // Add Region Reference Images
    payload.regions.sort((a, b) => a.regionNumber - b.regionNumber).forEach(region => {
        if (region.referenceImage) {
            const refBase64 = region.referenceImage.split(',')[1];
            parts.push({ text: `Region ${region.regionNumber} Reference Material:` });
            parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
            refCounter++;
        }
    });

    // PART 4: Final Text Instruction
    parts.push({ text: textPrompt });

    const contents = { parts };

    // Return guideImageBase64 mainly for debug, empty if unused
    return { contents, textPrompt, guideImageBase64 };
}
