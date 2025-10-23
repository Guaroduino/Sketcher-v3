import React from 'react';
import { renderToString } from 'react-dom/server';
import { Toolbar } from './Toolbar';
import { test, expect } from 'vitest';

// Minimal mock props matching ToolbarProps used in the component
const baseProps: any = {
  tool: 'select',
  setTool: () => {},
  brushSettings: { size: 5, opacity: 1, flow: 1 },
  setBrushSettings: () => {},
  eraserSettings: { size: 10 },
  setEraserSettings: () => {},
  solidMarkerSettings: { size: 5, opacity: 1, color: '#000000', tipShape: 'line', blendMode: 'source-over', pressureControl: { opacity: false, size: false } },
  setSolidMarkerSettings: () => {},
  naturalMarkerSettings: { size: 5, flow: 1, color: '#000000', hardness: 50, spacing: 10, blendMode: 'source-over' },
  setNaturalMarkerSettings: () => {},
  airbrushSettings: { size: 5 },
  setAirbrushSettings: () => {},
  fxBrushSettings: { size: 5, saturationJitter: 0, brightnessJitter: 0, pressureControl: { opacity: false, size: false } },
  setFxBrushSettings: () => {},
  magicWandSettings: { tolerance: 10 },
  setMagicWandSettings: () => {},
  textSettings: { fontSize: 12 },
  setTextSettings: () => {},
  brushPresets: [],
  onSavePreset: () => '',
  onUpdatePreset: () => {},
  onLoadPreset: () => {},
  onDeletePreset: () => {},
  activeGuide: 'ruler',
  setActiveGuide: () => {},
  isOrthogonalVisible: false,
  onToggleOrthogonal: () => {},
  onExportClick: () => {},
  onEnhance: () => {},
  isEnhancing: false,
  enhancementPreview: null,
  onGenerateEnhancementPreview: () => {},
  objects: [],
  libraryItems: [],
  backgroundDataUrl: null,
  debugInfo: null,
  strokeMode: 'freehand',
  setStrokeMode: () => {},
  strokeModifier: { style: 'solid', scale: 1 },
  setStrokeModifier: () => {},
};

test('Toolbar server-side renders and contains select button title', () => {
  const html = renderToString(<Toolbar {...baseProps} />);
  // The select button has a title 'Seleccionar'
  expect(/Seleccionar/i.test(html)).toBe(true);
});
