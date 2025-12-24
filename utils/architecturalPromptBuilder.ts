export type SceneType = 'exterior' | 'interior' | 'object_interior' | 'object_exterior' | 'studio' | 'automotive';
export type RenderStyleMode = 'photorealistic' | 'watercolor' | 'colored_pencil' | 'graphite' | 'ink_marker' | 'charcoal' | 'digital_painting' | '3d_cartoon';

export interface ArchitecturalRenderOptions {
    sceneType: SceneType;
    renderStyle: RenderStyleMode;

    // Exterior specific
    timeOfDay?: string; // 'morning', 'noon', 'afternoon', 'golden_hour', 'night'
    weather?: string;   // 'sunny', 'overcast', 'rainy', 'foggy'

    // Interior specific
    roomType?: string;  // 'living_room', 'kitchen', etc.
    lighting?: string;  // 'natural', 'warm_artificial', etc.

    // Studio specific
    studioLighting?: string; // 'softbox', 'rim_light', etc.
    studioBackground?: string; // 'infinity_white', 'concrete', etc.
    studioShot?: string; // NEW: 'close_up', 'full_shot', 'knolling'

    // Automotive specific
    carAngle?: string;
    carEnvironment?: string;
    carColor?: string; // NEW: Paint color/finish

    // Object Focus specific
    objectMaterial?: string;
    objectDoF?: string;
    objectContext?: string; // NEW: 'table_top', 'outdoor_blur'

    // Common Content
    archStyle: string;  // Describes the SUBJECT's style (Modern, Minimalist), NOT the art technique
    creativeFreedom: number;
    additionalPrompt?: string;
    hasStyleReference?: boolean;
}

const getRoleDefinition = () =>
    "ROLE: You are an expert Visual Artist and Photographer. TASK: Convert the input Mixed-Media Composite Layout into a final visual realization based on the requested style.";

const getInputAnalysisAndRules = () => `
INPUT ANALYSIS: The input is a concept collage/sketch.
RULES:
1. GEOMETRY: Retain the structural forms and perspective of the input.
2. MATERIALIZATION: Convert loose shapes/blobs into the materials implied by the prompt context.
`;

const getRenderStyleInstruction = (style: RenderStyleMode): string => {
    switch (style) {
        case 'watercolor': return "STYLE MODE: WATERCOLOR PAINTING. Medium: Transparent watercolor on textured paper. Technique: Wet-on-wet washes, expressive edge bleeding, artistic abstraction. NOT A PHOTO.";
        case 'colored_pencil': return "STYLE MODE: COLORED PENCIL SKETCH. Medium: Prismacolor pencils on grain paper. Technique: Visible cross-hatching, vibrant wax layering, hand-drawn aesthetic.";
        case 'graphite': return "STYLE MODE: GRAPHITE PENCIL DRAWING. Medium: HB/2B/4B Graphite. Technique: Smooth shading, sharp details, monochrome gray scale. Technical architectural sketch.";
        case 'ink_marker': return "STYLE MODE: ALCOHOL MARKER RENDERING. Medium: Copic Markers. Technique: Bold colors, strong outlines, felt-tip stroke texture. Architectural presentation style.";
        case 'charcoal': return "STYLE MODE: CHARCOAL DRAWING. Medium: Willow Charcoal. Technique: Smudged shadows, high contrast, dramatic lighting, rich blacks.";
        case 'digital_painting': return "STYLE MODE: DIGITAL CONCEPT ART. Technique: Clean edges, painterly lighting, matte painting aesthetic. Artstation style.";
        case '3d_cartoon': return "STYLE MODE: 3D CARTOON RENDER. Texture: Smooth plastic/clay surfaces, exaggerated soft lighting, Pixar/Disney aesthetic.";
        case 'photorealistic':
        default: return "STYLE MODE: PHOTOREALISTIC RENDERING. Quality: Professional architectural photography, 8k resolution, highly detailed, sharp focus, natural lighting, realistic textures and materials, cinematic composition.";
    }
};

const getExteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "SCENE: EXTERIOR ARCHITECTURE.\n";
    // Time
    const shadowMap: Record<string, string> = {
        'morning': "LIGHT: Morning sun, low angle, long shadows.",
        'noon': "LIGHT: High noon, harsh shadows.",
        'afternoon': "LIGHT: Golden afternoon sun.",
        'golden_hour': "LIGHT: Golden Hour, warm glow, rim light.",
        'night': "LIGHT: Night shot, artificial building lights, blue hour sky."
    };
    if (options.timeOfDay) prompt += (shadowMap[options.timeOfDay] || "") + " ";

    // Weather
    const weatherMap: Record<string, string> = {
        'sunny': "WEATHER: Clear blue sky.",
        'overcast': "WEATHER: Overcast, soft diffuse light.",
        'rainy': "WEATHER: Rainy, wet surfaces, reflections.",
        'foggy': "WEATHER: Foggy, atmospheric mist."
    };
    if (options.weather) prompt += (weatherMap[options.weather] || "") + " ";

    return prompt;
};

const getInteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "SCENE: INTERIOR DESIGN.\n";

    // Room
    const roomMap: Record<string, string> = {
        'living_room': "ROOM: Living Room.", 'kitchen': "ROOM: Kitchen.", 'bedroom': "ROOM: Bedroom.",
        'bathroom': "ROOM: Bathroom.", 'office': "ROOM: Office.", 'retail_store': "ROOM: Retail Store."
    };
    prompt += (roomMap[options.roomType || ''] || `ROOM: ${options.roomType}`) + " ";

    // Lighting
    const lightMap: Record<string, string> = {
        'natural': "LIGHT: Natural daylight.", 'warm_artificial': "LIGHT: Warm indoor lighting (3000K).",
        'moody': "LIGHT: Dark, moody, dramatic shadows."
    };
    if (options.lighting) prompt += (lightMap[options.lighting] || "") + " ";

    return prompt;
};

const getStudioPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "SCENE: STUDIO PRODUCT PHOTOGRAPHY.\n";

    // Shot Type (NEW)
    const shotMap: Record<string, string> = {
        'close_up': "SHOT: Macro Close-up detail.",
        'full_shot': "SHOT: Full product view.",
        'knolling': "SHOT: Knolling layout (top-down flat lay)."
    };
    if (options.studioShot) prompt += (shotMap[options.studioShot] || "") + " ";

    // Lighting
    const lightMap: Record<string, string> = {
        'softbox': "LIGHT: Large Softbox (soft shadows).",
        'rim_light': "LIGHT: Rim Lighting (silhouette edge).",
        'hard_key': "LIGHT: Hard Key Light (dramatic contrast).",
        'dramatic': "LIGHT: Chiaroscuro high contrast."
    };
    if (options.studioLighting) prompt += (lightMap[options.studioLighting] || "") + " ";

    // Background
    const bgMap: Record<string, string> = {
        'infinity_white': "BG: Pure White Cyclorama.",
        'infinity_black': "BG: Deep Black Void.",
        'concrete': "BG: Industrial Concrete texture.",
        'colored_gel': "BG: Vibrant Colored Gel lighting."
    };
    if (options.studioBackground) prompt += (bgMap[options.studioBackground] || "") + " ";

    return prompt;
};

const getAutomotivePrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "SCENE: AUTOMOTIVE VISUALIZATION.\n";

    // Color (NEW)
    if (options.carColor && options.carColor !== 'none') {
        prompt += `PAINT: ${options.carColor.replace('_', ' ')} finish. `;
    }

    // Angle
    const angleMap: Record<string, string> = {
        'front_three_quarter': "ANGLE: Front 3/4 view.", 'side_profile': "ANGLE: Side profile.",
        'rear': "ANGLE: Rear view.", 'low_angle_hero': "ANGLE: Low angle hero shot."
    };
    if (options.carAngle) prompt += (angleMap[options.carAngle] || "") + " ";

    // Env
    const envMap: Record<string, string> = {
        'studio': "ENV: Clean Studio.", 'city_street': "ENV: City Street at Night.",
        'raceway': "ENV: Race Track.", 'nature_scenic': "ENV: Scenic Nature Road."
    };
    if (options.carEnvironment) prompt += (envMap[options.carEnvironment] || "") + " ";

    return prompt;
};

const getObjectPrompts = (options: ArchitecturalRenderOptions, type: 'interior' | 'exterior'): string => {
    let prompt = `SCENE: OBJECT CLOSE-UP (${type.toUpperCase()}).\n`;

    // Context (NEW)
    if (options.objectContext === 'table_top') prompt += "CONTEXT: Table-top setup. ";
    if (options.objectContext === 'outdoor_blur') prompt += "CONTEXT: Outdoor environment with bokeh blur. ";

    // Material
    const matMap: Record<string, string> = {
        'matte_plastic': "MAT: Matte Plastic.", 'brushed_metal': "MAT: Brushed Metal.",
        'glass': "MAT: Glass.", 'wood': "MAT: Wood.", 'ceramic': "MAT: Ceramic."
    };
    if (options.objectMaterial) prompt += (matMap[options.objectMaterial] || "") + " ";

    // DoF
    const dofMap: Record<string, string> = {
        'macro_focus': "LENS: Macro focus.", 'shallow_depth_of_field': "LENS: Shallow DoF (f/1.8).",
        'wide_focus': "LENS: Deep focus (f/11)."
    };
    if (options.objectDoF) prompt += (dofMap[options.objectDoF] || "") + " ";

    return prompt;
};


export const buildArchitecturalPrompt = (options: ArchitecturalRenderOptions): string => {
    let promptParts: string[] = [];

    // 1. Role
    promptParts.push(getRoleDefinition());

    // 2. Render Style (Technique) - PRIMARY INSTRUCTION
    promptParts.push(getRenderStyleInstruction(options.renderStyle));

    // 3. Scene Content (Subject matter)
    if (options.sceneType === 'exterior') promptParts.push(getExteriorPrompts(options));
    else if (options.sceneType === 'interior') promptParts.push(getInteriorPrompts(options));
    else if (options.sceneType === 'studio') promptParts.push(getStudioPrompts(options));
    else if (options.sceneType === 'automotive') promptParts.push(getAutomotivePrompts(options));
    else if (options.sceneType === 'object_interior') promptParts.push(getObjectPrompts(options, 'interior'));
    else if (options.sceneType === 'object_exterior') promptParts.push(getObjectPrompts(options, 'exterior'));

    // 4. Architectural/Subject Style (Content description)
    // This is distinct from Render Style. E.g "Modern" house painted in "Watercolor"
    if (options.archStyle && options.archStyle !== 'none') {
        promptParts.push(`SUBJECT STYLE: ${options.archStyle.replace(/_/g, ' ').toUpperCase()}. Apply the physical characteristics of this design style to the subject.`);
    }

    // 5. Additional User Prompt
    if (options.additionalPrompt?.trim()) {
        promptParts.push("ADDITIONAL USER DETAILS:\n" + options.additionalPrompt);
    }

    // 6. Style Reference Guide
    if (options.hasStyleReference) {
        promptParts.push("REFERENCE IMAGE: A style reference image is attached. Mimic the color palette, lighting mood, and texture execution of this reference exactly.");
    }

    // 7. Negative Prompt (Dynamic based on Render Style)
    if (options.renderStyle === 'photorealistic') {
        promptParts.push("NEGATIVE PROMPT: Sketch, painting, drawing, cartoon, illustration, blueprint, abstract, low quality, blurry, distorted.");
    } else {
        // If artistic, we don't want it to look like a photo
        promptParts.push("NEGATIVE PROMPT: Photorealistic, 3d render, photograph, shiny 3d, plastic looking. Do NOT make it look like a photo. Keep the artistic medium texture.");
    }

    return promptParts.join("\n\n");
};
