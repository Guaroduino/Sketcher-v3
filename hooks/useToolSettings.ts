import { useState, useEffect } from 'react';
import type { BrushSettings, EraserSettings, MarkerSettings, AirbrushSettings, FXBrushSettings, BrushPreset } from '../types';

const initialBrushSettings: BrushSettings = {
    size: 10,
    opacity: 1,
    color: '#000000',
    lineCap: 'round',
    lineJoin: 'round',
    smoothness: 50,
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

const initialMarkerSettings: MarkerSettings = {
    size: 20,
    opacity: 0.7,
    color: '#ef4444',
    tipShape: 'line',
    pressureControl: {
        opacity: true,
    },
    smoothness: 50,
};

const initialAirbrushSettings: AirbrushSettings = {
    size: 75,
    density: 0.05,
    color: '#000000',
    softness: 0.9,
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
    smoothness: 50,
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


export function useToolSettings() {
    const [brushSettings, setBrushSettings] = useState<BrushSettings>(initialBrushSettings);
    const [eraserSettings, setEraserSettings] = useState<EraserSettings>(initialEraserSettings);
    const [markerSettings, setMarkerSettings] = useState<MarkerSettings>(initialMarkerSettings);
    const [airbrushSettings, setAirbrushSettings] = useState<AirbrushSettings>(initialAirbrushSettings);
    const [fxBrushSettings, setFxBrushSettings] = useState<FXBrushSettings>(initialFxBrushSettings);
    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>([]);

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
        markerSettings, setMarkerSettings,
        airbrushSettings, setAirbrushSettings,
        fxBrushSettings, setFxBrushSettings,
        brushPresets,
        onSavePreset: handleSavePreset,
        onUpdatePreset: handleUpdatePreset,
        onLoadPreset: handleLoadPreset,
        onDeletePreset: handleDeletePreset,
    };
}