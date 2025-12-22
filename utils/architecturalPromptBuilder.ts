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

const getRoleDefinition = () => "ROLE: You are an Architectural Photographer using high-end equipment (Phase One XF IQ4, 150MP). Your task is to transform a visual sketch/drawing into a indistinguishable-from-reality PHOTOGRAPH.";

const getCameraRule = () => "COMPOSITION RULE: The input image is a sketch/drawing. You must KEEP the exact camera angle and perspective, but you must REPLACE the sketch strokes with realistic physical materials, light, and atmosphere. The output must NOT look like a drawing.";

const getCreativityInstruction = (level: number): string => {
    if (level <= 50) {
        return "MODE: FAITHFUL ARCHITECTURAL REALIZATION (STRICT). \nGEOMETRY LOCK: You must respect the EXACT volumes, masses, and spatial proportions defined in the input sketch/visual guide. Treat every line as a physical boundary or wall. Do NOT invent new structure. Your mission is to materialize the sketch into a high-end photograph without changing a single wall position or pillar. The geometry is the absolute priority.";
    } else if (level <= 100) {
        return "MODE: BALANCED ENHANCEMENT. The sketch is a strong guide for the overall volumes. You can refine textures and add secondary details (furniture, plants, light fixtures) while staying true to the main structural lines provided.";
    } else if (level <= 150) {
        return "MODE: CREATIVE INTERPRETATION. Use the sketch as a conceptual massing model. You have the freedom to optimize structural proportions, modify cladding styles, and modernize the architecture for a superior aesthetic result.";
    } else {
        return "MODE: CONCEPTUAL REIMAGINING. The sketch is a loose inspiration for composition. Focus on creating a stunning, award-winning architectural masterpiece. Prioritize visual impact and mood over literal translation of the rough lines.";
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

    // Comprehensive Style Dictionary (Simplified for direct visual impact)
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
    prompt += `\nINTERIOR STYLE: ${options.archStyle.toUpperCase().replace('_', ' ')}. Apply generic characteristics of this style (materials, furniture shapes, colors).`;

    return prompt;
};

export const buildArchitecturalPrompt = (options: ArchitecturalRenderOptions): string => {
    let promptParts: string[] = [];

    // 1. Definition of Role & Output Format
    promptParts.push(getRoleDefinition());
    promptParts.push("OUTPUT FORMAT: High-Resolution Photograph. 8k, ISO 100, f/8.");

    // 2. Camera & Creativity
    promptParts.push(getCameraRule());
    promptParts.push(getCreativityInstruction(options.creativeFreedom));

    // 3. Scene Block
    if (options.sceneType === 'exterior') {
        promptParts.push("SCENE: EXTERIOR ARCHITECTURE.");
        promptParts.push(getExteriorPrompts(options));
    } else {
        promptParts.push("SCENE: INTERIOR DESIGN.");
        promptParts.push(getInteriorPrompts(options));
    }

    // 4. Additional Instructions
    if (options.additionalPrompt && options.additionalPrompt.trim().length > 0) {
        promptParts.push("SPECIFIC DETAILS (High Priority):");
        promptParts.push(options.additionalPrompt);
    }

    // 5. Style Reference
    if (options.hasStyleReference) {
        promptParts.push("STYLE REFERENCE INSTRUCTION:");
        promptParts.push("A reference image is attached. CAPTURE the exact mood, color grading, and material quality of that reference image and apply it to the sketch geometry.");
    }

    // 6. Negative Prompt (Embedded in text)
    promptParts.push("RESTRICTIONS & NEGATIVE PROMPT: \n1. Do NOT move walls, change roof slopes, or alter the building's footprint. \n2. Do NOT output a drawing, painting, sketch, or illustration. \n3. Do NOT output messy lines. \n4. The image must look utterly real. \n5. NO structural AI hallucinations; do not invent windows or doors where there are none in the sketch.");

    return promptParts.join("\n\n");
};
