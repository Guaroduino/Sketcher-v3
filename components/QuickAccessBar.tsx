import React, { useRef, useState } from 'react';
import type { QuickAccessSettings, QuickAccessTool, Tool } from '../types';
import { SelectIcon, BrushIcon, EraserIcon, MarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, FreeTransformIcon, MagicWandIcon, CropIcon, PlusIcon } from './icons';

interface QuickAccessBarProps {
  settings: QuickAccessSettings;
  onUpdateColor: (index: number, newColor: string) => void;
  onUpdateSize: (index: number, newSize: number) => void;
  onUpdateTool: (index: number, newTool: QuickAccessTool) => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: number) => void;
  onSelectTool: (tool: QuickAccessTool) => void;
  onOpenToolSelector: (index: number) => void;
  activeTool?: Tool;
  activeColor?: string;
  activeSize?: number;
}

const toolIconMap: Record<Tool, React.FC<{ className?: string }>> = {
    'select': SelectIcon,
    'brush': BrushIcon,
    'eraser': EraserIcon,
    'marker': MarkerIcon,
    'airbrush': AirbrushIcon,
    'fx-brush': FXBrushIcon,
    'transform': TransformIcon,
    'free-transform': FreeTransformIcon,
    'enhance': MagicWandIcon,
    'crop': CropIcon,
    'pan': () => null, // Pan tool doesn't have a permanent slot
    // FIX: Add 'debug-brush' to the toolIconMap to satisfy the Tool type.
    'debug-brush': BrushIcon,
};


export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
  settings,
  onUpdateColor,
  onUpdateSize,
  onSelectColor,
  onSelectSize,
  onSelectTool,
  onOpenToolSelector,
  activeTool,
  activeColor,
  activeSize,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const editingColorIndexRef = useRef<number | null>(null);

  const [editingSize, setEditingSize] = useState<{ index: number; value: string } | null>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);

  const handleColorDoubleClick = (index: number) => {
    editingColorIndexRef.current = index;
    const colorInput = colorInputRef.current;
    if (colorInput) {
      colorInput.value = settings.colors[index];
      colorInput.click();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingColorIndexRef.current !== null) {
      onUpdateColor(editingColorIndexRef.current, e.target.value);
      editingColorIndexRef.current = null;
    }
  };

  const handleSizeDoubleClick = (index: number, currentSize: number) => {
    setEditingSize({ index, value: String(currentSize) });
    setTimeout(() => sizeInputRef.current?.select(), 0);
  };
  
  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingSize !== null) {
        setEditingSize({ ...editingSize, value: e.target.value });
    }
  };

  const handleSizeBlur = () => {
    if (editingSize !== null) {
        const newSize = parseInt(editingSize.value, 10);
        if (!isNaN(newSize)) {
            onUpdateSize(editingSize.index, newSize);
        }
        setEditingSize(null);
    }
  };

  const handleSizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleSizeBlur();
    } else if (e.key === 'Escape') {
        setEditingSize(null);
    }
  };


  const renderToolIcon = (tool: QuickAccessTool | null) => {
    if (!tool) return <PlusIcon className="w-6 h-6 text-[--text-secondary]" />;
    if (tool.type === 'tool') {
        const Icon = toolIconMap[tool.tool];
        return Icon ? <Icon className="w-6 h-6" /> : null;
    }
    if (tool.type === 'fx-preset') {
        return <FXBrushIcon className="w-6 h-6" />;
    }
    return null;
  };
  
  const getToolTitle = (tool: QuickAccessTool | null): string => {
      if (!tool) return "Seleccionar herramienta";
      if (tool.type === 'tool') return tool.tool;
      if (tool.type === 'fx-preset') return `Preset: ${tool.name}`;
      return "";
  };


  return (
    <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:right-auto bg-[--bg-primary]/80 backdrop-blur-sm rounded-lg p-2 flex flex-wrap items-center justify-center gap-2 md:gap-4 shadow-lg z-10">
      {/* Color Palette */}
      <div className="flex items-center gap-2">
        <input
            type="color"
            ref={colorInputRef}
            onChange={handleColorChange}
            className="w-0 h-0 opacity-0 absolute"
        />
        {settings.colors.map((color, index) => {
          const isActive = activeColor && color.toLowerCase() === activeColor.toLowerCase();
          return (
            <button
              key={index}
              onClick={() => onSelectColor(color)}
              onDoubleClick={() => handleColorDoubleClick(index)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:border-[--accent-primary] ${
                isActive ? 'border-[--accent-primary]' : 'border-[--bg-secondary]'
              }`}
              style={{ backgroundColor: color }}
              title={`Color: ${color} (doble clic para cambiar)`}
            />
          );
        })}
      </div>

      <div className="h-8 w-px bg-[--bg-hover]" />

      {/* Size Presets */}
      <div className="flex items-center gap-2">
        {settings.sizes.map((size, index) => {
          const isActive = size === activeSize;
          return (
            <div key={index} className="relative">
              {editingSize?.index === index ? (
                  <input
                      ref={sizeInputRef}
                      type="number"
                      value={editingSize.value}
                      onChange={handleSizeChange}
                      onBlur={handleSizeBlur}
                      onKeyDown={handleSizeKeyDown}
                      className="w-16 text-center bg-[--bg-hover] text-[--text-primary] p-2 rounded-md text-sm"
                  />
              ) : (
                  <button
                      onClick={() => onSelectSize(size)}
                      onDoubleClick={() => handleSizeDoubleClick(index, size)}
                      className={`w-16 p-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
                      }`}
                      title={`Tamaño: ${size}px (doble clic para cambiar)`}
                  >
                      {size}px
                  </button>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="h-8 w-px bg-[--bg-hover]" />

      {/* Tool Shortcuts */}
      <div className="flex items-center gap-2">
        {settings.tools.map((tool, index) => {
          const isActive = tool !== null && activeTool !== undefined && (
            (tool.type === 'tool' && tool.tool === activeTool) ||
            (tool.type === 'fx-preset' && activeTool === 'fx-brush')
          );
          return (
            <button
              key={index}
              onClick={() => tool && onSelectTool(tool)}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenToolSelector(index);
              }}
              className={`p-3 rounded-lg text-[--text-primary] transition-colors ${
                isActive ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'
              }`}
              title={`${getToolTitle(tool)} (clic derecho para cambiar)`}
            >
              {renderToolIcon(tool)}
            </button>
          );
        })}
      </div>
    </div>
  );
};