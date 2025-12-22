export type SceneType = 'exterior' | 'interior';

export interface ArchitecturalRenderOptions {
    sceneType: SceneType;
    // Exterior specific
    timeOfDay?: string; // 'morning', 'noon', 'afternoon', 'golden_hour', 'night'
    weather?: string;   // 'sunny', 'overcast', 'rainy', 'foggy'
    // Interior specific
    roomType?: string;  // 'kitchen', 'living_room', 'bedroom', etc.
    lighting?: string;  // 'natural', 'warm_artificial', 'moody'
    // Common
    archStyle: string;  // 'modern', 'brutalist', 'mediterranean', 'industrial', 'scandinavian', etc.
    creativeFreedom: number; // 0-200
    additionalPrompt?: string;
    hasStyleReference?: boolean;
}

const getRoleDefinition = () =>
    "ROLE: You are an expert Architectural Photographer. TASK: Convert the input Mixed-Media Composite Layout into a photorealistic 8k architectural photograph.";

const getInputAnalysisAndRules = () => `
INPUT ANALYSIS (CRITICAL): The input image is a concept collage. It contains two types of data:
1. Linear Structure: Represents the fixed architecture (walls, windows, roof).
2. Loose Shapes/Stickers/Colors: Represent volumes of entourage (vegetation, trees, people, cars, furniture).

PROCESSING RULES:
- ARCHITECTURAL LAYER (STRICT): You must retain the exact perspective and geometry of the linear structural elements. Do not move walls or change the building design.
- ENTOURAGE LAYER (INTERPRETIVE): You must materialize all loose shapes, colored blobs, or pasted elements into realistic physical objects based on their context.
  * Example: A green shape on the lawn = A realistic tree or bush.
  * Example: A boxy shape on the driveway = A realistic car.
  * Example: Vertical shapes on paths = People.

OBJECTIVE: Do NOT clean up or remove the "messy" elements. Instead, transform them into high-fidelity textures and objects that match the lighting of the scene. The final image must look cohesive, as if taken by a single camera.`;

const getCreativityInstruction = (level: number): string => {
    if (level <= 50) {
        return "MODE: FAITHFUL ARCHITECTURAL REALIZATION (STRICT). \nGeometry is the absolute priority. Do NOT invent new structure.";
    } else if (level <= 100) {
        return "MODE: BALANCED ENHANCEMENT. Refine textures and add secondary details while staying true to structural lines.";
    } else if (level <= 150) {
        return "MODE: CREATIVE INTERPRETATION. You have freedom to optimize structural proportions and modernize the aesthetic.";
    } else {
        return "MODE: CONCEPTUAL REIMAGINING. Prioritize visual impact and mood over literal translation of the rough lines.";
    }
};

const getExteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "";

    // Time of Day
    const shadowMap: Record<string, string> = {
        'morning': "LIGHTING: Morning sun (low angle, cool temps, long soft shadows). Fresh atmosphere.",
        'noon': "LIGHTING: High Noon (harsh top-down shadows, high contrast, vibrant colors).",
        'afternoon': "LIGHTING: Afternoon (warm sun, defined shadows, rich depth).",
        'golden_hour': "LIGHTING: GOLDEN HOUR (Magic hour, warm orange glow, rim lighting, dramatic shadows).",
        'night': "LIGHTING: NIGHT PHOTOGRAPHY (Blue hour sky, artificial interior lights glowing warm, exterior accent lighting)."
    };
    if (options.timeOfDay && shadowMap[options.timeOfDay]) {
        prompt += `${shadowMap[options.timeOfDay]} `;
    }

    // Weather
    const weatherMap: Record<string, string> = {
        'sunny': "WEATHER: Clear blue sky.",
        'overcast': "WEATHER: Overcast/Cloudy (Soft diffuse light, no hard shadows, even exposure).",
        'rainy': "WEATHER: Rainy (Wet pavement reflections, droplets, moody atmosphere).",
        'foggy': "WEATHER: Foggy/Mist (Atmospheric depth, reduced background contrast, dreamy)."
    };
    if (options.weather && weatherMap[options.weather]) {
        prompt += `${weatherMap[options.weather]} `;
    }

    // Comprehensive Style Dictionary
    const styleDescriptors: Record<string, string> = {
        'modern': "STYLE: Modern Minimalist. Materials: Concrete, Glass, Black Steel.",
        'mid_century_modern': "STYLE: Mid-Century Modern. Materials: Walnut wood, stone, glass walls.",
        'contemporary': "STYLE: Contemporary. Materials: Mixed cladding, sustainable green walls, metal panels.",
        'cape_cod': "STYLE: Cape Cod. Materials: Weathered shingles, white trim, classic brick.",
        'craftsman': "STYLE: Craftsman. Materials: Handcrafted wood, stone columns, earthy tones.",
        'victorian': "STYLE: Victorian. Materials: Ornamental wood, colorful paint, slate roof.",
        'colonial': "STYLE: Colonial. Materials: Red brick, white columns, symmetry.",
        'ranch': "STYLE: Ranch. Materials: Brick veneer, horizontal lines, low profile.",
        'farmhouse': "STYLE: Modern Farmhouse. Materials: White board-and-batten, black window frames, metal roof.",
        'brazilian_modernism': "STYLE: Brazilian Modernism. Materials: Raw concrete, tropical wood, vegetation integration.",
        'mediterranean': "STYLE: Mediterranean. Materials: Stucco, terracotta tiles, arches.",
        'brutalist': "STYLE: Brutalist. Materials: Raw concrete (beton brut), heavy massing.",
        'futuristic': "STYLE: Futuristic. Materials: Curved white panels, LED lines, parametric glass.",
        'cinematic': "STYLE: Cinematic/Dramatic. Focus on mood and storytelling lighting."
    };

    const styleDesc = styleDescriptors[options.archStyle] || `STYLE: ${options.archStyle}`;
    prompt += `\n${styleDesc}\n`;

    return prompt;
};

const getInteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "";

    // 1. ROOM TYPE (Context)
    const roomTypeDescriptors: Record<string, string> = {
        'living_room': "CONTEXT: High-end Living Room. Furniture: Designer sofa, coffee table, rug.",
        'kitchen': "CONTEXT: Gourmet Kitchen. Surfaces: Marble countertops, stainless steel appliances.",
        'bedroom': "CONTEXT: Luxury Master Bedroom. Texture: Soft linens, plush carpet.",
        'bathroom': "CONTEXT: Spa Bathroom. Materials: Stone tile, glass, premium fixtures.",
        'office': "CONTEXT: Modern Office. Furniture: Ergonomic desk, shelving, tech.",
        'classroom': "CONTEXT: Modern Classroom/Education space.",
        'laboratory': "CONTEXT: Clean Science Lab.",
        'workshop': "CONTEXT: Industrial Workshop.",
        'gym': "CONTEXT: Fitness Center / Gym.",
        'hotel_room': "CONTEXT: Boutique Hotel Room.",
        'retail_store': "CONTEXT: High-end Retail Store.",
        'restaurant': "CONTEXT: Fine Dining Restaurant.",
        'lobby': "CONTEXT: Corporate Lobby.",
        'mall_hallway': "CONTEXT: Shopping Mall Corridor."
    };
    prompt += (roomTypeDescriptors[options.roomType || ''] || `CONTEXT: ${options.roomType}`) + " ";

    // 2. LIGHTING TYPE
    const lightingMap: Record<string, string> = {
        'natural': "LIGHTING: Soft Natural Daylight (Global Illumination).",
        'natural_morning': "LIGHTING: Morning Sun beams.",
        'natural_afternoon': "LIGHTING: Warm Afternoon Sun.",
        'warm_artificial': "LIGHTING: Warm Interior Lights (3000K). Cozy atmosphere.",
        'neutral_artificial': "LIGHTING: Neutral/Bright Lights (4000K).",
        'cold_artificial': "LIGHTING: Cool/Work Lights (5000K).",
        'studio': "LIGHTING: Professional Studio Lighting.",
        'moody': "LIGHTING: Low-key Moody Lighting. Dramatic shadows."
    };
    if (options.lighting && lightingMap[options.lighting]) {
        prompt += `${lightingMap[options.lighting]} `;
    }

    // 3. INTERIOR STYLE
    prompt += `\nINTERIOR STYLE: ${options.archStyle.toUpperCase().replace('_', ' ')}. Apply generic characteristics of this style.`;

    return prompt;
};

export const buildArchitecturalPrompt = (options: ArchitecturalRenderOptions): string => {
    let promptParts: string[] = [];

    // 1. Role (Photographer)
    promptParts.push(getRoleDefinition());

    // 2. Input Analysis & Processing Rules (Mixed-Media Logic)
    promptParts.push(getInputAnalysisAndRules());

    // 3. Dynamic Creativity Level
    promptParts.push(getCreativityInstruction(options.creativeFreedom));

    // 4. Dynamic Scene Details (Style, Weather, Light)
    if (options.sceneType === 'exterior') {
        promptParts.push("SCENE CONTEXT (EXTERIOR):");
        promptParts.push(getExteriorPrompts(options));
    } else {
        promptParts.push("SCENE CONTEXT (INTERIOR):");
        promptParts.push(getInteriorPrompts(options));
    }

    // 5. User Additional Prompt
    if (options.additionalPrompt && options.additionalPrompt.trim().length > 0) {
        promptParts.push("ADDITIONAL USER DETAILS (High Priority):");
        promptParts.push(options.additionalPrompt);
    }

    // 6. Style Reference
    if (options.hasStyleReference) {
        promptParts.push("STYLE REFERENCE INSTRUCTION:");
        promptParts.push("A reference image is attached. CAPTURE the exact mood, color grading, and material quality of that reference image and apply it to the sketch geometry.");
    }

    // 7. Negative Prompt (Updated)
    promptParts.push("NEGATIVE PROMPT: Abstract, cartoon, illustration, drawing, blurred, low quality, disappearing objects, empty lawn. Do NOT output a drawing or painting. NO structural AI hallucinations.");

    return promptParts.join("\n\n");
};
