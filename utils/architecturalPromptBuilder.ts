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
}

const getRoleDefinition = () => "Eres un experto en visualización arquitectónica fotorrealista.";

const getCameraRule = () => "MANTÉN EXÁCTAMENTE la misma cámara, perspectiva y geometría que la imagen original. No cambies el ángulo de visión.";

const getCreativityInstruction = (level: number): string => {
    if (level <= 50) {
        return "NIVEL DE CREATIVIDAD: FIEL (0-50). PROHIBIDO cambiar nada estructural. Solo cambia los shaders por materiales reales y mejora la iluminación. La geometría base es sagrada.";
    } else if (level <= 100) {
        return "NIVEL DE CREATIVIDAD: INTERPRETATIVO (51-100). Puedes añadir detalles realistas (plantas, muebles, decoración) siempre que la arquitectura base se mantenga reconocible.";
    } else if (level <= 150) {
        return "NIVEL DE CREATIVIDAD: DESVIACIÓN (101-150). Se permite alterar la forma arquitectónica ligeramente para que se vea más estética o moderna. Prioriza la belleza sobre la fidelidad estricta.";
    } else {
        return "NIVEL DE CREATIVIDAD: TRANSFORMATIVO (151-200). La imagen original es solo una idea o boceto vago. Ignora la geometría exacta si es necesario y crea un concepto nuevo y espectacular basado en la composición original.";
    }
};

const getExteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "";

    // Time of Day
    const shadowMap: Record<string, string> = {
        'morning': "Mañana: Sombras alargadas y frescas. Luz suave.",
        'noon': "Mediodía: Sol cenital, pocas sombras, iluminación dura y clara.",
        'afternoon': "Tarde: Iluminación clara pero con sombras definidas.",
        'golden_hour': "HORA DORADA: Luz cálida (naranja/dorado) baja en el horizonte. 'Rim lighting' en las aristas del edificio. Sombras suaves y largas.",
        'night': "NOCHE: Cielo oscuro. Activa fuentes de luz artificial (ventanas iluminadas, farolas). Reflejos sutiles de luz de luna."
    };
    if (options.timeOfDay && shadowMap[options.timeOfDay]) {
        prompt += `${shadowMap[options.timeOfDay]} `;
    }

    // Weather
    const weatherMap: Record<string, string> = {
        'sunny': "Soleado: Sombras duras y alto contraste. Cielo despejado y azul.",
        'overcast': "NUBLADO (Overcast): Iluminación difusa (Global Illumination). Sin sombras marcadas, ideal para resaltar materiales. Luz blanca y suave.",
        'rainy': "LLUVIOSO: Suelo mojado ('wet look'), reflejos especulares en el pavimento. Ambiente húmedo.",
        'foggy': "NIEBLA: Reduce el contraste a distancia. Añade profundidad atmosférica y misterio."
    };
    if (options.weather && weatherMap[options.weather]) {
        prompt += `${weatherMap[options.weather]} `;
    }

    // Style specifics (examples)
    const styleMap: Record<string, string> = {
        'brutalist': "Estilo Brutalista: Hormigón visto con texturas de encofrado marcadas. Pesadez visual.",
        'modern': "Estilo Moderno: Acero, vidrio grandes ventanales, líneas limpias y rectas.",
        'mediterranean': "Estilo Mediterráneo: Estuco blanco, tejas cerámicas, madera rústica."
    };
    // Use mapped style if available, otherwise just use the name
    prompt += styleMap[options.archStyle] || `Estilo Arquitectónico: ${options.archStyle}. `;

    return prompt;
};

const getInteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "";

    // Room Type (Asset Staging)
    if (options.roomType) {
        prompt += `Tipo de Habitación: ${options.roomType}. Usa esta información para inferir el mobiliario y decoración adecuados (Asset Staging). `;
    }

    // Lighting
    const lightingMap: Record<string, string> = {
        'natural': "Iluminación NATURAL: Luz suave y aireada proveniente de grandes ventanales. Ambiente diurno.",
        'warm_artificial': "Iluminación ARTIFICIAL CÁLIDA: Capas de luz de lámparas y colgantes. Ambiente acogedor (3000K).",
        'moody': "Iluminación MOODY: Contraste alto, sombras profundas, charcos de luz focalizada. Dramático."
    };
    if (options.lighting && lightingMap[options.lighting]) {
        prompt += `${lightingMap[options.lighting]} `;
    }

    // Style specifics
    const styleMap: Record<string, string> = {
        'scandinavian': "Estilo Escandinavo: Maderas claras (fresno/pino), tejidos naturales, paredes blancas, minimalismo acogedor.",
        'industrial': "Estilo Industrial: Ladrillo visto, conductos metálicos expuestos, suelo de hormigón o microcemento.",
        'art_deco': "Estilo Art Deco: Materiales nobles, mármol, latón dorado, terciopelo, patrones geométricos."
    };
    prompt += styleMap[options.archStyle] || `Estilo Interior: ${options.archStyle}. `;

    return prompt;
};

export const buildArchitecturalPrompt = (options: ArchitecturalRenderOptions): string => {
    let promptParts: string[] = [];

    // 1. Definition of Role
    promptParts.push(getRoleDefinition());

    // 2. Camera Rule (Golden Rule)
    promptParts.push(getCameraRule());

    // 3. Creativity Mandate
    promptParts.push(getCreativityInstruction(options.creativeFreedom));

    // 4. Scene Block
    if (options.sceneType === 'exterior') {
        promptParts.push("CONFIGURACIÓN DE EXTERIOR:");
        promptParts.push(getExteriorPrompts(options));
    } else {
        promptParts.push("CONFIGURACIÓN DE INTERIOR:");
        promptParts.push(getInteriorPrompts(options));
    }

    // 5. Additional Instructions (User Override)
    if (options.additionalPrompt && options.additionalPrompt.trim().length > 0) {
        promptParts.push("INSTRUCCIONES ADICIONALES (PRIORIDAD ALTA):");
        promptParts.push(options.additionalPrompt);
    }

    // 6. Quality suffix
    promptParts.push("Calidad: 8k, photorealistic, architectural photography, V-Ray render style.");

    return promptParts.join("\n\n");
};
