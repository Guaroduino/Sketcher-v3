import { useState, useCallback, useEffect } from 'react';
// FIX: Added missing types for new brush tools
import type { BrushSettings, EraserSettings, SimpleMarkerSettings, MagicWandSettings, TextSettings, NaturalMarkerSettings, AirbrushSettings, FXBrushSettings, BrushPreset, AdvancedMarkerSettings, WatercolorSettings } from '../types';

const initialBrushSettings: BrushSettings = {
    size: 3,
    opacity: 1,
    color: '#000000',
    fillColor: 'transparent', // Default fill transparent
    hardness: 100,
    softnessCurve: 'linear',
    // FIX: Corrected lineCap to be a valid value 'round' instead of an empty/truncated string.
    lineCap: 'round',
    lineJoin: 'round',
    hasStrokeCaps: true,
    pressureControl: {
        size: true,
    },
};

const initialEraserSettings: EraserSettings = {
    size: 50,
    opacity: 1,
    hardness: 100,
    softnessCurve: 'linear',
    tipShape: 'round',
};

const initialSimpleMarkerSettings: SimpleMarkerSettings = {
    size: 10,
    opacity: 0.8,
    color: '#facc15',
    // Default tip is now a line
    tipShape: 'line',
    blendMode: 'source-over',
    fillColor: 'transparent',
    pressureControl: {
        opacity: true,
    },
};

const initialNaturalMarkerSettings: NaturalMarkerSettings = {
    size: 20,
    opacity: 0.7,
    color: '#34d399',
    fillColor: 'transparent',
    pressureControl: {
        size: true,
        opacity: true,
    },
};

const initialAirbrushSettings: AirbrushSettings = {
    size: 60,
    flow: 0.5,
    color: '#60a5fa',
    fillColor: 'transparent',
    pressureControl: {
        flow: true,
    },
};

const initialFxBrushSettings: FXBrushSettings = {
    presetId: null,
    size: 50,
    opacity: 1,
    color: '#c084fc',
    fillColor: 'transparent',
};

const initialAdvancedMarkerSettings: AdvancedMarkerSettings = {
    // Defaults adjusted: smaller pencil-like size and light flow
    size: 5,
    color: '#f87171',
    tipShape: 'circle',
    tipAngle: 0,
    hardness: 80,
    softnessCurve: 'linear',
    flow: 5,
    wetness: 10,
    spacing: 25,
    blendMode: 'source-over',
    fillColor: 'transparent',
    pressureControl: {
        size: true,
        flow: true,
    },
};

const initialWatercolorSettings: WatercolorSettings = {
    size: 40,
    flow: 50,
    wetness: 50,
    opacity: 0.9,
    color: '#3b82f6',
    fillColor: 'transparent',
    pressureControl: {
        size: true,
        flow: false,
        opacity: false,
    },
};

const initialMagicWandSettings: MagicWandSettings = {
    tolerance: 30,
    contiguous: true,
};

const initialTextSettings: TextSettings = {
    content: 'Texto',
    fontFamily: 'Arial',
    fontSize: 48,
    color: '#000000',
    textAlign: 'left',
    fontWeight: 'normal',
};

const FX_PRESETS_STORAGE_KEY = 'sketcher-fx-presets';

// FIX: Export 'useToolSettings' to make it available for other modules.
export function useToolSettings() {
    const [brushSettings, setBrushSettings] = useState<BrushSettings>(initialBrushSettings);
    const [eraserSettings, setEraserSettings] = useState<EraserSettings>(initialEraserSettings);
    const [simpleMarkerSettings, setSimpleMarkerSettings] = useState<SimpleMarkerSettings>(initialSimpleMarkerSettings);
    const [naturalMarkerSettings, setNaturalMarkerSettings] = useState<NaturalMarkerSettings>(initialNaturalMarkerSettings);
    const [airbrushSettings, setAirbrushSettings] = useState<AirbrushSettings>(initialAirbrushSettings);
    const [fxBrushSettings, setFxBrushSettings] = useState<FXBrushSettings>(initialFxBrushSettings);
    const [advancedMarkerSettings, setAdvancedMarkerSettings] = useState<AdvancedMarkerSettings>(initialAdvancedMarkerSettings);
    const [watercolorSettings, setWatercolorSettings] = useState<WatercolorSettings>(initialWatercolorSettings);
    const [magicWandSettings, setMagicWandSettings] = useState<MagicWandSettings>(initialMagicWandSettings);
    const [textSettings, setTextSettings] = useState<TextSettings>(initialTextSettings);

    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(FX_PRESETS_STORAGE_KEY);
            if (saved) {
                setBrushPresets(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load FX presets from localStorage", e);
        }
    }, []);

    const savePresetsToStorage = useCallback((presets: BrushPreset[]) => {
        try {
            localStorage.setItem(FX_PRESETS_STORAGE_KEY, JSON.stringify(presets));
        } catch (e) {
            console.error("Failed to save FX presets to localStorage", e);
        }
    }, []);

    const onSavePreset = useCallback((name: string) => {
        const newPreset: BrushPreset = { id: `fx-${Date.now()}`, name };
        setBrushPresets(prev => {
            const updated = [...prev, newPreset];
            savePresetsToStorage(updated);
            return updated;
        });
    }, [savePresetsToStorage]);

    const onUpdatePreset = useCallback((id: string, updates: Partial<BrushPreset>) => {
        setBrushPresets(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
            savePresetsToStorage(updated);
            return updated;
        });
    }, [savePresetsToStorage]);

    const onLoadPreset = useCallback((id: string) => {
        setFxBrushSettings(s => ({ ...s, presetId: id }));
    }, []);

    const onDeletePreset = useCallback((id: string) => {
        setBrushPresets(prev => {
            const updated = prev.filter(p => p.id !== id);
            savePresetsToStorage(updated);
            return updated;
        });
    }, [savePresetsToStorage]);


    return {
        brushSettings, setBrushSettings,
        eraserSettings, setEraserSettings,
        simpleMarkerSettings, setSimpleMarkerSettings,
        naturalMarkerSettings, setNaturalMarkerSettings,
        airbrushSettings, setAirbrushSettings,
        fxBrushSettings, setFxBrushSettings,
        advancedMarkerSettings, setAdvancedMarkerSettings,
        watercolorSettings, setWatercolorSettings,
        magicWandSettings, setMagicWandSettings,
        textSettings, setTextSettings,
        brushPresets,
        onSavePreset,
        onUpdatePreset,
        onLoadPreset,
        onDeletePreset,
    };
}