import { useState, useEffect } from 'react';
import type { BrushSettings, EraserSettings, SolidMarkerSettings, NaturalMarkerSettings, AirbrushSettings, FXBrushSettings, BrushPreset, MagicWandSettings, TextSettings } from '../types';

const initialBrushSettings: BrushSettings = {
    size: 3,
    opacity: 1,
    color: '#000000',
    lineCap: 'round',
    lineJoin: 'round',
    hasStrokeCaps: true,
    pressureControl: {
        size: true,
    }
};

const initialEraserSettings: EraserSettings = {
    size: 50,
    opacity: 1,
    hardness: 100,
    tipShape: 'round',
};

const initialSolidMarkerSettings: SolidMarkerSettings = {
    size: 20,
    opacity: 0.7,
    color: '#ef4444',
    tipShape: 'line',
    blendMode: 'source-over',
    pressureControl: {
        opacity: true,
    },
};

const initialNaturalMarkerSettings: NaturalMarkerSettings = {
    size: 30,
    flow: 0.1,
    color: '#3b82f6',
    hardness: 80,
    spacing: 1,
    tipShape: 'line',
    blendMode: 'source-over',
    pressureControl: {
        size: true,
        flow: true,
    },
};


const initialAirbrushSettings: AirbrushSettings = {
    size: 75,
    density: 0.4,
    color: '#000000',
    softness: 0.9,
    blendMode: 'source-over',
};

const initialFxBrushSettings: FXBrushSettings = {
    size: 50,
    opacity: 1,
    flow: 0.5,
    color: '#000000',
    blendMode: 'source-over',
    hardness: 100,
    spacing: 25,
    angle: 0,
    angleFollowsStroke: false,
    tipShape: 'round',
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0,
    texture: { dataUrl: null, name: null },
    hueJitter: 0,
    saturationJitter: 0,
    brightnessJitter: 0,
    pressureControl: {
        size: true,
        opacity: false,
    },
};

const initialMagicWandSettings: MagicWandSettings = {
    tolerance: 20,
    contiguous: true,
};

const initialTextSettings: TextSettings = {
  content: 'Texto de ejemplo',
  fontFamily: 'Arial',
  fontSize: 48,
  color: '#000000',
  textAlign: 'left',
  fontWeight: 'normal',
};

export function useToolSettings() {
    const [brushSettings, setBrushSettings] = useState<BrushSettings>(initialBrushSettings);
    const [eraserSettings, setEraserSettings] = useState<EraserSettings>(initialEraserSettings);
    const [solidMarkerSettings, setSolidMarkerSettings] = useState<SolidMarkerSettings>(initialSolidMarkerSettings);
    const [naturalMarkerSettings, setNaturalMarkerSettings] = useState<NaturalMarkerSettings>(initialNaturalMarkerSettings);
    const [airbrushSettings, setAirbrushSettings] = useState<AirbrushSettings>(initialAirbrushSettings);
    const [fxBrushSettings, setFxBrushSettings] = useState<FXBrushSettings>(initialFxBrushSettings);
    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>([]);
    const [magicWandSettings, setMagicWandSettings] = useState<MagicWandSettings>(initialMagicWandSettings);
    const [textSettings, setTextSettings] = useState<TextSettings>(initialTextSettings);

    useEffect(() => {
        try {
            const savedPresets = localStorage.getItem('brushPresets');
            if (savedPresets) {
                setBrushPresets(JSON.parse(savedPresets));
            }
        } catch (e) {
            console.error("Failed to load brush presets from localStorage", e);
        }
    }, []);

    const handleSavePreset = (name: string, settings: FXBrushSettings): string => {
        const newPreset: BrushPreset = { id: `preset-${Date.now()}`, name, settings };
        const updatedPresets = [...brushPresets, newPreset];
        setBrushPresets(updatedPresets);
        localStorage.setItem('brushPresets', JSON.stringify(updatedPresets));
        return newPreset.id;
    };

    const handleUpdatePreset = (id: string, updates: Partial<Omit<BrushPreset, 'id'>>) => {
        const updatedPresets = brushPresets.map(p =>
            p.id === id ? { ...p, ...updates } : p
        );
        setBrushPresets(updatedPresets);
        localStorage.setItem('brushPresets', JSON.stringify(updatedPresets));
    };

    const handleLoadPreset = (id: string) => {
        const preset = brushPresets.find(p => p.id === id);
        if (preset) {
            setFxBrushSettings(preset.settings);
        }
    };

    const handleDeletePreset = (id: string) => {
        const updatedPresets = brushPresets.filter(p => p.id !== id);
        setBrushPresets(updatedPresets);
        localStorage.setItem('brushPresets', JSON.stringify(updatedPresets));
    };
    
    return {
        brushSettings, setBrushSettings,
        eraserSettings, setEraserSettings,
        solidMarkerSettings, setSolidMarkerSettings,
        naturalMarkerSettings, setNaturalMarkerSettings,
        airbrushSettings, setAirbrushSettings,
        fxBrushSettings, setFxBrushSettings,
        magicWandSettings, setMagicWandSettings,
        textSettings, setTextSettings,
        brushPresets,
        onSavePreset: handleSavePreset,
        onUpdatePreset: handleUpdatePreset,
        onLoadPreset: handleLoadPreset,
        onDeletePreset: handleDeletePreset,
    };
}