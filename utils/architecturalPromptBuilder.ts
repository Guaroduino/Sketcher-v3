
import { RenderStyleSettings } from '../types';

export type SceneType = 'exterior' | 'interior' | 'object_interior' | 'object_exterior' | 'studio' | 'automotive';
export type RenderStyleMode = 'photorealistic' | 'watercolor' | 'colored_pencil' | 'graphite' | 'ink_marker' | 'charcoal' | 'digital_painting' | '3d_cartoon' | 'technical_plan' | 'clay_model';

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
    studioShot?: string; // 'close_up', 'full_shot', 'knolling'

    // Automotive specific
    carAngle?: string;
    carEnvironment?: string;
    carColor?: string; // Paint color/finish

    // Object Focus specific
    objectMaterial?: string;
    objectDoF?: string;
    objectContext?: string; // 'table_top', 'outdoor_blur'

    // Common Content
    archStyle: string;  // Describes the SUBJECT's style
    creativeFreedom: number;
    additionalPrompt?: string;
    hasStyleReference?: boolean;
    canvasAspectRatio?: number; // Width / Height
    matchMateriality?: boolean; // New: Preserve materials from input/ref
    styleReferenceDescription?: string; // New: AI Analysis of the reference

    renderStyleSettings?: RenderStyleSettings;
}

const getRoleAndTask = (style: RenderStyleMode) => {
    const role = style === 'photorealistic' ? "World-Class Architectural Photographer" : "Expert Architectural Concept Artist";
    return `# ROLE
You are a ${role}.

# TASK
Interpret the heterogeneous input data and generate a ${style.replace(/_/g, ' ').toUpperCase()} visualization.`;
};

const getCreativityInstruction = (freedom: number) => {
    if (freedom <= 39) return "**Strict Adherence (Level 0-40):** Retain every single line and geometry. Straighten shaky lines but do NOT alter design or massing. Maintain the exact perspective of the input.";
    if (freedom <= 79) return "**Geometric Alignment (Level 40-80):** Follow input volumes closely. Clean up lines and spacing, but keep core structure unchanged.";
    if (freedom <= 119) return "**Balanced Interpretation (Level 80-120):** Use input as a definitive guide. Add details (mullions, trim, textures) and adjust proportions slightly for realism.";
    if (freedom <= 159) return "**Creative Redesign (Level 120-160):** Use input as a conceptual starting point. Optimize geometry and refine the design.";
    return "**Unrestricted Freedom (Level 160+):** Treat input as a loose sketch. Radically reinterpret forms and structure.";
};

const getDetailedStylePrompts = (style: RenderStyleMode, settings?: RenderStyleSettings, isStrict?: boolean): string => {
    if (!settings) return "Standard";
    let p = "";
    const format = (s?: string) => s ? s.replace(/_/g, ' ') : '';

    switch (style) {
        case 'photorealistic':
            // Camera Type
            const camMap: Record<string, string> = {
                'dslr': 'Professional Digital SLR',
                'large_format': 'Medium Format (Hasselblad) high detail',
                'drone': 'Aerial Drone Shot',
                'instant': 'Polaroid Instant Film aesthetic'
            };
            if (settings.phCamera) p += `Camera: ${camMap[settings.phCamera] || format(settings.phCamera)}. `;

            // Film Stock
            if (settings.phFilm) p += `Film: ${format(settings.phFilm)}. `;

            // Lens Effect (replacing Sharpness)
            const fxMap: Record<string, string> = {
                'clean': 'Clean lens, no artifacts',
                'bokeh': 'Depth of Field with creamy bokeh',
                'vignette': 'Subtle vignetting',
                'cinematic_bloom': 'Cinematic bloom and diffusion'
            };
            if (settings.phEffect) p += `Effect: ${fxMap[settings.phEffect] || format(settings.phEffect)}. `;
            break;
        case 'digital_painting':
            if (settings.dsBrush) p += `Brush: ${format(settings.dsBrush)}. `;
            if (settings.dsFinish) p += `Finish: ${format(settings.dsFinish)}. `;
            if (settings.dsStroke) p += `Stroke: ${format(settings.dsStroke)}. `;
            break;
        case 'watercolor':
            if (settings.wcTechnique) p += `Technique: ${format(settings.wcTechnique)}. `;
            if (settings.wcPaper) p += `Paper: ${format(settings.wcPaper)}. `;
            if (settings.wcInk) p += `Ink: ${format(settings.wcInk)}. `;
            break;
        case 'technical_plan':
            if (settings.tpBackground) p += `Background: ${format(settings.tpBackground)}. `;
            if (settings.tpPrecision) p += `Linework: ${format(settings.tpPrecision)}. `;
            if (settings.tpDetails) p += `Details: ${format(settings.tpDetails)}. `;
            break;
        case 'charcoal':
            if (settings.chSmudge) p += `Smudge: ${format(settings.chSmudge)}. `;
            if (settings.chContrast) p += `Contrast: ${format(settings.chContrast)}. `;
            if (settings.chHatch) p += `Hatch: ${format(settings.chHatch)}. `;
            break;
        case 'clay_model':
            if (settings.cmMaterial) p += `Material: ${format(settings.cmMaterial)}. `;
            if (settings.cmSurface) p += `Surface: ${format(settings.cmSurface)}. `;
            if (settings.cmLighting) p += `Light: ${format(settings.cmLighting)}. `;
            break;
        case 'ink_marker':
            if (settings.imPaper) p += `Paper: ${format(settings.imPaper)}. `;
            if (settings.imTechnique) p += `Technique: ${format(settings.imTechnique)}. `;
            if (settings.imColor) p += `Color: ${format(settings.imColor)}. `;
            break;
        case '3d_cartoon':
            if (settings.tcStyle) p += `Style: ${format(settings.tcStyle)}. `;
            if (settings.tcMaterial) p += `Material: ${format(settings.tcMaterial)}. `;
            if (settings.tcLighting) p += `Light: ${format(settings.tcLighting)}. `;
            break;
        case 'colored_pencil':
            if (settings.cpTechnique) p += `Technique: ${format(settings.cpTechnique)}. `;
            if (settings.cpPaper) p += `Paper: ${format(settings.cpPaper)}. `;
            if (settings.cpVibrancy) p += `Vibrancy: ${format(settings.cpVibrancy)}. `;
            break;
    }
    return p.trim();
};

const getSceneContent = (options: ArchitecturalRenderOptions): string => {
    const f = (s?: string) => s ? s.replace(/_/g, ' ') : '';
    const m = (s: string | undefined, prefix: string) => {
        if (!s) return '';
        if (s === 'match_source') return `${prefix}: MATCH INPUT/REFERENCE EXACTLY. `;
        return `${prefix}: ${f(s)}. `;
    };

    if (options.sceneType === 'exterior') {
        let s = `Scene: Exterior Architecture. `;
        s += m(options.archStyle, 'Style');
        s += m(options.timeOfDay, 'Time');
        s += m(options.weather, 'Weather');
        return s;
    }

    if (options.sceneType === 'interior') {
        let s = `Scene: Interior Design. `;
        s += m(options.archStyle, 'Style');
        s += m(options.roomType, 'Room');
        s += m(options.lighting, 'Light');
        return s;
    }

    if (options.sceneType === 'studio') {
        let s = `Scene: Studio Product Photography. `;
        s += m(options.studioShot, 'Shot');
        s += m(options.studioLighting, 'Lighting');
        s += m(options.studioBackground, 'Background');
        return s;
    }

    if (options.sceneType === 'automotive') {
        let s = `Scene: Automotive Visualization. `;
        s += m(options.carColor, 'Paint');
        s += m(options.carAngle, 'Angle');
        s += m(options.carEnvironment, 'Environment');
        return s;
    }

    if (options.sceneType === 'object_interior' || options.sceneType === 'object_exterior') {
        let s = `Scene: Object Close-up (${options.sceneType === 'object_interior' ? 'Interior' : 'Exterior'}). `;
        s += m(options.objectMaterial, 'Material');
        s += m(options.objectContext, 'Context');
        s += m(options.objectDoF, 'Focus');
        return s;
    }

    return "Scene: General Architecture.";
};

export const buildArchitecturalPrompt = (options: ArchitecturalRenderOptions): string => {
    const isStrict = options.creativeFreedom <= 39;
    const styleDetails = getDetailedStylePrompts(options.renderStyle, options.renderStyleSettings, isStrict);
    const sceneContent = getSceneContent(options);
    const creativityInstruction = getCreativityInstruction(options.creativeFreedom);
    const roleAndTask = getRoleAndTask(options.renderStyle);

    return `CORE INSTRUCTION:
ANALYZE the input image strictly based on the defined CREATIVITY LEVEL.
PRIORITY: GEOMETRY (Step 1) > MATERIALS (Step 2). Use the sketch lines as the rigid framework.
IDENTIFY the structural lines versus the stylistic noise.
GENERATE the final image combining the SCENE CONTENT with the RENDER STYLE.

${roleAndTask}

# INPUT DATA
- **Input Content:** Heterogeneous Mixed-Media Composite. Expect to see:
  - Loose sketches, technical lines, or CAD exports.
  - Collage of images, textures, or "stickers".
  - Basic shapes, color blocks, or volumetric massing.
  - Photographs of physical scale models or maquettes.
- **Creative Freedom Level:** ${options.creativeFreedom}/200

# VISUAL PIPELINE (Step-by-Step)
1. **GEOMETRY & COMPOSITION:**
   ${creativityInstruction}

2. **MATERIALIZATION:**
   - **Style Mode:** ${options.renderStyle.replace(/_/g, ' ').toUpperCase()}
   - **Technique Details:** ${styleDetails || "Standard"}
   - **Subject Style:** ${options.archStyle.replace(/_/g, ' ')}
   ${options.matchMateriality ? "- **MATERIALITY:** EXTRACT materials/textures from input/reference and MAP them strictly onto the geometry defined in Step 1. DO NOT alter structural lines or volumes to fit the texture." : ""}
   ${options.styleReferenceDescription ? `- **DETECTED REFERENCE MATERIALS (Use as Guide):** ${options.styleReferenceDescription}` : ""}

3. **ATMOSPHERE:**
   - ${sceneContent} 

# OUTPUT RULES
- **Canvas:** Fill the entire frame. No borders. Maximize detail.
- **Reference:** ${options.hasStyleReference ? "Match color grading and texture of reference image exactly." : "None."}
- **Negative Prompt:** Structural distortions, impossible geometry, blurry textures, low resolution, artifacts, watermarks, text, bad anatomy, crop.

${options.additionalPrompt ? `# ADDITIONAL USER INSTRUCTIONS\n${options.additionalPrompt}` : ""}
`.trim();
};
