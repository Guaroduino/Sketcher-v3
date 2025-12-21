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

const getRoleDefinition = () => "Eres un experto en visualización arquitectónica fotorrealista.";

const getCameraRule = () => "MANTÉN EXÁCTAMENTE la misma cámara, perspectiva y geometría que la imagen original. No cambies el ángulo de visión.";

const getCreativityInstruction = (level: number): string => {
    if (level <= 50) {
        return "MANDATO CREATIVO: FAITHFUL TRANSFORMATION (0-50). PRESERVAR GEOMETRÍA EXACTA. Estrictamente PROHIBIDO alterar la silueta, mover paredes o cambiar la perspectiva. Tu trabajo es solo mejorar materiales (texturas 8k) e iluminación física. La imagen de entrada es la verdad absoluta en cuanto a forma.";
    } else if (level <= 100) {
        return "MANDATO CREATIVO: INTERPRETATIVE (51-100). La arquitectura base debe ser reconocible, pero se permite 'Asset Staging'. Puedes añadir vegetación, personas, muebles y decoración realista que no estaban ahí, siempre que no rompas la estructura principal.";
    } else if (level <= 150) {
        return "MANDATO CREATIVO: DEVIATION (101-150). Rediseño permitido. Usa la imagen de entrada como guía conceptual y volumétrica, pero puedes modernizar ventanas, cambiar tipos de techo o alterar fachadas para mejorar la estética arquitectónica.";
    } else {
        return "MANDATO CREATIVO: TRANSFORMATION (151-200). LIBERTAD TOTAL. Ignora la geometría específica si limita el resultado artístico. Re-imagina el edificio basándote solo en la composición general y el tema. Haz algo espectacular.";
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

    // Comprehensive Style Dictionary
    const styleDescriptors: Record<string, { desc: string, materials: string, effect: string }> = {
        'modern': {
            desc: "Líneas limpias y ortogonales, grandes ventanales de piso a techo, plantas libres.",
            materials: "Acero negro, vidrio templado, concreto pulido liso y paneles de madera clara.",
            effect: "Estética minimalista y elegante donde la estructura es evidente."
        },
        'mid_century_modern': {
            desc: "Integración con la naturaleza, techos planos o con pendientes suaves, volados amplios.",
            materials: "Piedra natural en muros, madera de nogal, vigas expuestas y detalles en ladrillo.",
            effect: "Look 'retro-futurista' de los años 50-60, muy orgánico."
        },
        'contemporary': {
            desc: "Formas geométricas únicas, asimetría, enfoque en la sostenibilidad y luz natural.",
            materials: "Fachadas ventiladas, paneles metálicos, jardines verticales y materiales ecológicos.",
            effect: "Arquitectura de vanguardia actual, fluida y técnica."
        },
        'cape_cod': {
            desc: "Estilo costero clásico, simetría, techos a dos aguas muy inclinados y chimeneas laterales.",
            materials: "Revestimiento de madera (shingle) en tonos grises o blancos, ventanas con marcos blancos y contraventanas.",
            effect: "Sensación de casa de playa tradicional y acogedora."
        },
        'craftsman': {
            desc: "Énfasis en el trabajo manual, techos de poca pendiente con aleros anchos y soportes decorativos.",
            materials: "Piedra de río en la base, columnas de madera cónicas, porches amplios y detalles artesanales.",
            effect: "Imagen robusta, detallada y muy vinculada a los materiales naturales."
        },
        'victorian': {
            desc: "Fachadas ornamentadas, torres, techos empinados y formas asimétricas complejas.",
            materials: "Molduras de madera intrincadas (gingerbread trim), paletas de colores vibrantes y texturas variadas.",
            effect: "Estética histórica, dramática y muy rica en detalles visuales."
        },
        'colonial': {
            desc: "Formalismo puro, fachada rectangular simétrica, entrada central jerarquizada y ventanas alineadas.",
            materials: "Ladrillo rojo, columnas blancas (estilo dórico o jónico) y techos de pizarra negra.",
            effect: "Transmite orden, tradición, prestigio y solidez."
        },
        'ranch': {
            desc: "Estructura de una sola planta, perfil bajo, horizontalidad extendida y techos a dos aguas simples.",
            materials: "Revestimientos mixtos de madera y piedra, grandes puertas correderas hacia el patio.",
            effect: "Ambiente relajado, suburbano y funcional."
        },
        'farmhouse': {
            desc: "Combinación de lo rústico con lo moderno, techos altos de lámina metálica y grandes porches frontales.",
            materials: "Madera blanca 'lap siding', ventanas de marco negro (contraste) y lámparas de estilo industrial.",
            effect: "Estilo limpio, rural pero sofisticado."
        },
        'brazilian_modernism': {
            desc: "Uso audaz del concreto armado, pilotis (columnas) que elevan la casa, brise-soleil (parasoles) y abundante vegetación tropical integrada.",
            materials: "Concreto visto (raw concrete), piedra bruta y grandes vanos abiertos.",
            effect: "Arquitectura monumental pero fresca, muy adaptada al clima cálido."
        },
        'mediterranean': {
            desc: "Influencia española/italiana, techos de teja de barro, arcos y patios internos.",
            materials: "Estuco blanco o crema, detalles de hierro forjado y suelos de terracota.",
            effect: "Sensación de calidez solar, vacaciones y elegancia rústica."
        },
        'brutalist': {
            desc: "Estructuras monolíticas masivas, repetición de formas geométricas y ausencia de adornos.",
            materials: "Hormigón crudo (béton brut) con textura de la cimbra de madera, metal pesado y vidrio oscuro.",
            effect: "Imagen potente, honesta y casi escultórica."
        },
        'futuristic': {
            desc: "Formas aerodinámicas, curvas fluidas, elementos brillantes y estética de ciencia ficción.",
            materials: "Polímeros avanzados, luz LED integrada en la fachada, superficies de metal pulido y vidrio curvo.",
            effect: "Un edificio que parece sacado del futuro lejano."
        },
        'cinematic': {
            desc: "Composición dramática, iluminación con alto contraste (chiaroscuro), neblina atmosférica y enfoque narrativo.",
            materials: "Texturas ricas que reaccionen a la luz (mojado, metálico, rugoso).",
            effect: "Look cinematográfico, como un frame de película de Hollywood."
        }
    };

    const styleData = styleDescriptors[options.archStyle];
    if (styleData) {
        prompt += `\nESTILO ARQUITECTÓNICO: ${options.archStyle.toUpperCase().replace('_', ' ')}\n`;
        prompt += `Descripción Visual: ${styleData.desc}\n`;
        prompt += `Materiales Obligatorios: ${styleData.materials}\n`;
        prompt += `Efecto Deseado: ${styleData.effect}\n`;
    } else {
        prompt += `Estilo Arquitectónico: ${options.archStyle}. `;
    }

    return prompt;
};

const getInteriorPrompts = (options: ArchitecturalRenderOptions): string => {
    let prompt = "";

    // 1. ROOM TYPE (Context Anchors & Asset Staging)
    const roomTypeDescriptors: Record<string, string> = {
        'living_room': "Contexto: SALA DE ESTAR. Inyecta texturas textiles (sofás de lino, alfombras de lana), maderas para mesas de centro y elementos de electrónica.",
        'kitchen': "Contexto: COCINA. Fuerza el renderizado de superficies reflectantes (mármol, granito, acero inoxidable), electrodomésticos empotrados y utillaje culinario.",
        'bedroom': "Contexto: DORMITORIO. Prioriza textiles suaves, ropa de cama volumétrica, cortinas pesadas y una atmósfera de descanso.",
        'bathroom': "Contexto: BAÑO. Prioriza cerámicas de alta calidad, espejos con reflejos realistas, vidrio translúcido y grifería metálica (cromo/latón).",
        'office': "Contexto: OFICINA. Inyecta elementos funcionales como pantallas, sillas ergonómicas, iluminación técnica y superficies de trabajo ordenadas.",
        'classroom': "Contexto: AULA. Pupitres ordenados, pizarras, materiales educativos y una iluminación funcional uniforme.",
        'laboratory': "Contexto: LABORATORIO. Superficies asépticas, equipamiento científico metálico/vidrio, iluminación fría y clínica.",
        'workshop': "Contexto: TALLER/FABRICA. Herramientas, bancos de trabajo robustos, polvo en suspensión sutil, iluminación industrial.",
        'gym': "Contexto: GIMNASIO. Máquinas de ejercicio (metal/cuero), espejos de pared completa, suelo de goma o madera técnica.",
        'hotel_room': "Contexto: HABITACIÓN DE HOTEL. Diseño estandarizado de lujo, cama impecable, iluminación de acento en cabeceros, minibar.",
        'retail_store': "Contexto: TIENDA RETAIL. Iluminación comercial focalizada (spots), maniquíes o estanterías de producto, probadores.",
        'restaurant': "Contexto: RESTAURANTE. Mesas puestas, iluminación íntima sobre las mesas, barra de servicio, acústica visual suave.",
        'lobby': "Contexto: LOBBY/RECEPCIÓN. Espacios amplios, mostrador de recepción jerarquizado, zonas de espera con mobiliario de diseño.",
        'mall_hallway': "Contexto: PASILLO DE MALL. Suelos muy pulidos, vitrinas comerciales a los lados, iluminación general potente."
    };
    prompt += (roomTypeDescriptors[options.roomType || ''] || `Tipo de Habitación: ${options.roomType}.`) + " ";

    // 2. LIGHTING TYPE (Physics & Mood)
    const lightingMap: Record<string, string> = {
        'natural': "Iluminación: NATURAL (Global Illumination). Luz difusa y blanca que rebota en paredes y techos.",
        'natural_morning': "Iluminación: MAÑANA. Luz fría/azulada, sombras largas y nítidas entrando por las ventanas.",
        'natural_afternoon': "Iluminación: TARDE. Luz solar cálida y directa (Golden Hour interior), proyecciones de luz amarilla intensa.",
        'warm_artificial': "Iluminación: ARTIFICIAL CÁLIDA (3000K). Crea 'pools of light' (manchas de luz) acogedoras. Lámparas de mesa y pie activas.",
        'neutral_artificial': "Iluminación: ARTIFICIAL NEUTRA (4000K). Luz limpia y blanca, ideal para oficinas. Sin dominantes de color.",
        'cold_artificial': "Iluminación: ARTIFICIAL FRÍA (5000K+). Luz clínica/fluorescente. Sombras duras y ambiente aséptico.",
        'studio': "Iluminación: ESTUDIO. Perfectamente equilibrada, 'softbox lighting', sombras de relleno suaves. Look de revista de arquitectura.",
        'moody': "Iluminación: MOODY (Low-key). Sombras profundas, alto contraste. Solo se iluminan los puntos focales. Dramático e íntimo."
    };
    if (options.lighting && lightingMap[options.lighting]) {
        prompt += `${lightingMap[options.lighting]} `;
    }

    // 3. INTERIOR STYLE (Materiality & Design)
    const interiorStyleDescriptors: Record<string, { desc: string, materials: string }> = {
        'minimalist': {
            desc: "Espacios despejados, 'menos es más', líneas puras.",
            materials: "Colores neutros, concreto pulido, microcemento, superficies mate sin ruido visual."
        },
        'scandinavian': {
            desc: "Funcionalidad, simplicidad y conexión con la naturaleza nórdica.",
            materials: "Maderas claras (fresno/abedul), textiles blancos/grises, mantas de lana, mucha luz."
        },
        'industrial_loft': {
            desc: "Estética de fábrica renovada, estructura a la vista.",
            materials: "Ladrillo visto, tuberías expuestas, conductos de aire, metal negro mate, cuero envejecido."
        },
        'luxury_classic': {
            desc: "Opulencia, tradición y simetría.",
            materials: "Mármol veteado, detalles en pan de oro/latón, terciopelo, molduras en paredes y techos, arañas de cristal."
        },
        'bohemian': {
            desc: "Relajado, ecléctico, 'free-spirited'.",
            materials: "Mimbre, ratán, macramé, alfombras étnicas, madera recuperada, muchas plantas."
        },
        'mid_century_modern': {
            desc: "Estética icónica de los 50s/60s.",
            materials: "Madera de nogal, muebles con patas de aguja ('tapered legs'), colores mostaza/verde oliva, formas orgánicas."
        },
        'farmhouse': {
            desc: "Rústico refinado, acogedor y familiar.",
            materials: "Madera pintada de blanco (shiplap), vigas de madera rústica, hierro forjado, textiles de algodón."
        },
        'biophilic': {
            desc: "Fusión total entre interior y naturaleza.",
            materials: "Jardines verticales, abundante vegetación viva, materiales crudos y sostenibles, luz natural maximizada."
        },
        'art_deco': {
            desc: "Glamour de los años 20, geometría audaz.",
            materials: "Contrastes altos (negro/dorado), laca brillante, espejos biselados, patrones geométricos repetitivos."
        },
        'cozy_rustic': {
            desc: "Refugio de montaña o cabaña.",
            materials: "Piedra natural, madera gruesa sin tratar, chimenea, pieles, luz muy cálida."
        },
        'traditional': {
            desc: "Atemporal, ordenado y confortable.",
            materials: "Maderas oscuras (caoba/cerezo), tapicería estampada clásica, alfombras orientales."
        },
        'coastal': {
            desc: "Aireado, fresco y relajado junto al mar.",
            materials: "Tonos blancos y azules, lino, madera blanqueada, mimbre, decoración marina sutil."
        },
        'modern': {
            desc: "Actual, nítido y sin excesos.",
            materials: "Metal cromado, vidrio, superficies lisas, paleta monocromática con acentos de arte."
        }
    };

    const styleData = interiorStyleDescriptors[options.archStyle];
    if (styleData) {
        prompt += `\nESTILO INTERIOR: ${options.archStyle.toUpperCase().replace('_', ' ')}\n`;
        prompt += `Diseño: ${styleData.desc}\n`;
        prompt += `Paleta de Materiales: ${styleData.materials}\n`;
    } else {
        prompt += `Estilo Interior: ${options.archStyle}. `;
    }

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

    // 5.5 Style Reference Instruction
    if (options.hasStyleReference) {
        promptParts.push("REFERENCIA DE ESTILO:");
        promptParts.push("Se ha proporcionado una segunda imagen como REFERENCIA DE ESTILO. Analiza sus materiales, paleta de colores, iluminación y atmósfera. APLICA ese estilo exacto a la geometría de la primera imagen (input). Haz que el render final parezca pertenecer al mismo proyecto arquitectónico que la imagen de referencia.");
    }

    // 6. Quality suffix
    promptParts.push("Calidad: 8k, photorealistic, architectural photography, V-Ray render style.");

    return promptParts.join("\n\n");
};
