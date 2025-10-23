import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';
import { test, expect, vi } from 'vitest';

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

test('Toolbar renders and shows select tool button', () => {
  render(<Toolbar {...baseProps} />);
  const selectButton = screen.getByTitle(/Seleccionar/i);
  // Basic assertion using vitest expect (avoid jest-dom matcher)
  expect(selectButton).toBeTruthy();
});

test('Toolbar shows solid and artistic group buttons', () => {
  render(<Toolbar {...baseProps} />);
  // Solid group button has title indicating solid tools
  const solidButtons = screen.getAllByTitle(/Herramientas de Tinta Sólida/i);
  expect(solidButtons.length).toBeGreaterThanOrEqual(1);
  // Artistic group button
  const artisticButtons = screen.getAllByTitle(/Herramientas Artísticas/i);
  expect(artisticButtons.length).toBeGreaterThanOrEqual(1);
});

test('Double-clicking enhance triggers generation', async () => {
  const mockProps = { ...baseProps, onGenerateEnhancementPreview: vi.fn() } as any;
  render(<Toolbar {...mockProps} />);
  const enhanceButtons = screen.getAllByTitle(/Mejora con IA/i);
  // Try dblClick on each matched button until mock is called
  for (const btn of enhanceButtons) {
    await userEvent.dblClick(btn);
    if ((mockProps.onGenerateEnhancementPreview as any).mock.calls.length > 0) break;
  }
  expect((mockProps.onGenerateEnhancementPreview as any).mock.calls.length).toBeGreaterThanOrEqual(1);
});
