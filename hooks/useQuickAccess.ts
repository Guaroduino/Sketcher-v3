import { useState } from 'react';
import type { QuickAccessSettings, WorkspaceTemplate, Tool } from '../types';

const initialQuickAccessSettings: QuickAccessSettings = {
  colors: ['#ef4444', '#22c55e', '#3b82f6'],
  sizes: [10, 40, 150],
  tools: [
    { type: 'tool', tool: 'brush' },
    { type: 'tool', tool: 'eraser' },
    null,
  ],
};

export function useQuickAccess() {
  const [settings, setSettings] = useState<QuickAccessSettings>(initialQuickAccessSettings);

  const updateColor = (index: number, newColor: string) => {
    setSettings(prev => {
      const newColors = [...prev.colors];
      newColors[index] = newColor;
      return { ...prev, colors: newColors };
    });
  };

  const updateSize = (index: number, newSize: number) => {
    if (newSize > 0 && newSize <= 1000) {
      setSettings(prev => {
        const newSizes = [...prev.sizes];
        newSizes[index] = newSize;
        return { ...prev, sizes: newSizes };
      });
    }
  };

  const updateTool = (index: number, newTool: { type: 'tool', tool: Tool } | { type: 'fx-preset', id: string, name: string } | null) => {
    setSettings(prev => {
      const newTools = [...prev.tools];
      newTools[index] = newTool;
      return { ...prev, tools: newTools };
    });
  };

  const loadState = (loadedSettings: WorkspaceTemplate['quickAccessSettings']) => {
    // Basic validation to ensure we don't load malformed data
    if (
      loadedSettings &&
      Array.isArray(loadedSettings.colors) && loadedSettings.colors.length === 3 &&
      Array.isArray(loadedSettings.sizes) && loadedSettings.sizes.length === 3 &&
      Array.isArray(loadedSettings.tools) && loadedSettings.tools.length === 3
    ) {
      setSettings(loadedSettings);
    } else {
      // Fallback to initial settings if loaded data is invalid
      setSettings(initialQuickAccessSettings);
    }
  };

  return {
    quickAccessSettings: settings,
    updateColor,
    updateSize,
    updateTool,
    loadState,
  };
}