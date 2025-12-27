
import { GoogleGenAI } from "@google/genai";

/**
 * Handles the communication with the Gemini API for Architectural Rendering.
 * Strictly mirrors the payload structure of Visual Prompting to ensure compatibility with Gemini 3.
 */
export async function generateArchitecturalRender(
    apiKey: string,
    modelId: string,
    baseImage: string, // DataURL
    prompt: string,
    styleReferenceImage?: string | null // DataURL
) {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenAI({ apiKey });

    // Construct Payload
    const parts: any[] = [];

    // 1. Label
    parts.push({ text: "IMAGE:" });

    // 2. Base Image
    const baseMime = baseImage.substring(baseImage.indexOf(':') + 1, baseImage.indexOf(';'));
    const baseData = baseImage.split(',')[1];

    // Sanity check for data
    if (!baseData || baseData.length < 100) throw new Error("Invalid Base Image Data");

    parts.push({ inlineData: { mimeType: baseMime, data: baseData } });

    // 3. Style Reference (Optional)
    if (styleReferenceImage) {
        parts.push({ text: "REFERENCE_IMAGE:" });
        const styleMime = styleReferenceImage.substring(styleReferenceImage.indexOf(':') + 1, styleReferenceImage.indexOf(';'));
        const styleData = styleReferenceImage.split(',')[1];
        parts.push({ inlineData: { mimeType: styleMime, data: styleData } });
    }

    // 4. Prompt
    parts.push({ text: prompt });

    const contents = { parts };

    console.log("[ArchService] Calling Model:", modelId);
    // console.log("[ArchService] Payload:", JSON.stringify(contents, null, 2));

    // 5. Execute Call (No Config)
    const response = await genAI.models.generateContent({
        model: modelId,
        contents
        // config: undefined // Explicitly removed
    });

    return response;
}
