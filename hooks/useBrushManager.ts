import { useMemo } from 'react';
import type { Tool, BrushSettings, EraserSettings, SimpleMarkerSettings, NaturalMarkerSettings, AirbrushSettings, FXBrushSettings, AdvancedMarkerSettings, WatercolorSettings } from '../types';
import { PencilBrush } from '../lib/brushes/PencilBrush';
import { EraserBrush } from '../lib/brushes/EraserBrush';
import { SimpleMarkerBrush } from '../lib/brushes/SolidMarkerBrush';
import { NaturalMarkerBrush } from '../lib/brushes/NaturalMarkerBrush';
import { AirbrushBrush } from '../lib/brushes/AirbrushBrush';
import { FxBrush } from '../lib/brushes/FxBrush';
import { DebugBrush } from '../lib/brushes/DebugBrush';
import type { BaseBrush } from '../lib/brushes/BaseBrush';
import { AdvancedMarkerBrush } from './useCanvasDrawing';
import { WatercolorBrush } from '../lib/brushes/WatercolorBrush';

// This hook manages the lifecycle and state of all brush instances.
export function useBrushManager({
    brushSettings,
    eraserSettings,
    simpleMarkerSettings,
    naturalMarkerSettings,
    airbrushSettings,
    fxBrushSettings,
    advancedMarkerSettings,
    watercolorSettings,
}: {
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    simpleMarkerSettings: SimpleMarkerSettings;
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    advancedMarkerSettings: AdvancedMarkerSettings;
    watercolorSettings: WatercolorSettings;
}) {
    // useMemo ensures brush instances are created only once
    const brushes = useMemo(() => ({
        'brush': new PencilBrush(brushSettings),
        'eraser': new EraserBrush(eraserSettings),
        'simple-marker': new SimpleMarkerBrush(simpleMarkerSettings),
        'natural-marker': new NaturalMarkerBrush(naturalMarkerSettings),
        'airbrush': new AirbrushBrush(airbrushSettings),
        'fx-brush': new FxBrush(fxBrushSettings),
        'debug-brush': new DebugBrush(),
        'advanced-marker': new AdvancedMarkerBrush(advancedMarkerSettings),
        'watercolor': new WatercolorBrush(watercolorSettings),
    }), []); // Empty dependency array means this runs only on mount

    // On every render, update the settings of each brush instance.
    // This is cheap and ensures the brushes always have the latest state from the UI.
    brushes['brush'].updateSettings(brushSettings);
    brushes['eraser'].updateSettings(eraserSettings);
    brushes['simple-marker'].updateSettings(simpleMarkerSettings);
    brushes['natural-marker'].updateSettings(naturalMarkerSettings);
    brushes['airbrush'].updateSettings(airbrushSettings);
    brushes['fx-brush'].updateSettings(fxBrushSettings);
    brushes['advanced-marker'].updateSettings(advancedMarkerSettings);
    brushes['watercolor'].updateSettings(watercolorSettings);


    // This function is passed down to usePointerEvents to get the correct brush for the current tool.
    const getBrushForTool = (tool: Tool): BaseBrush | null => {
        return brushes[tool as keyof typeof brushes] || null;
    };

    return { getBrushForTool };
}