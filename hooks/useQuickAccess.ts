import { useState, useCallback } from 'react';
import type { QuickAccessSettings, WorkspaceTemplate, Tool, QuickAccessTool } from '../types';

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

  const updateColor = useCallback((index: number, newColor: string) => {
    setSettings(prev => {
      const newColors = [...prev.colors];
      newColors[index] = newColor;
      return { ...prev, colors: newColors };
    });
  }, []);

  const addColor = useCallback((newColor: string) => {
    setSettings(prev => ({
      ...prev,
      colors: [...prev.colors, newColor],
    }));
  }, []);

  const removeColor = useCallback((index: number) => {
    setSettings(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  }, []);

  const updateSize = useCallback((index: number, newSize: number) => {
    if (newSize > 0 && newSize <= 1000) {
      setSettings(prev => {
        const newSizes = [...prev.sizes];
        newSizes[index] = newSize;
        return { ...prev, sizes: newSizes };
      });
    }
  }, []);

  // FIX: Corrected type for newTool to match the QuickAccessTool union type.
  const updateTool = useCallback((index: number, newTool: QuickAccessTool | null) => {
    setSettings(prev => {
      const newTools = [...prev.tools];
      newTools[index] = newTool;
      return { ...prev, tools: newTools };
    });
  }, []);

  const loadState = useCallback((loadedSettings: WorkspaceTemplate['quickAccessSettings']) => {
    // More flexible validation
    if (
      loadedSettings &&
      Array.isArray(loadedSettings.colors) &&
      Array.isArray(loadedSettings.sizes) &&
      Array.isArray(loadedSettings.tools)
    ) {
      // Ensure arrays have the expected base length, but allow for more colors
      const newSettings = { ...initialQuickAccessSettings, ...loadedSettings };
      if (newSettings.sizes.length !== 3) newSettings.sizes = initialQuickAccessSettings.sizes;
      if (newSettings.tools.length !== 3) newSettings.tools = initialQuickAccessSettings.tools;
      if (newSettings.colors.length === 0) newSettings.colors = initialQuickAccessSettings.colors;

      setSettings(newSettings);
    } else {
      // Fallback to initial settings if loaded data is invalid
      setSettings(initialQuickAccessSettings);
    }
  }, []);

  return {
    quickAccessSettings: settings,
    updateColor,
    addColor,
    removeColor,
    updateSize,
    updateTool,
    loadState,
  };
}