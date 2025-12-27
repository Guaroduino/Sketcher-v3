import React, { useRef, useState, useEffect } from 'react';
import type { QuickAccessSettings, QuickAccessTool, Tool, StrokeMode } from '../types';
// FIX: Replaced MarkerIcon with SolidMarkerIcon and NaturalMarkerIcon
// FIX: Added missing icons for new tool types.
import { SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, FreeTransformIcon, SparklesIcon, CropIcon, PlusIcon, MarqueeRectIcon, LassoIcon, MagicWandIcon, TextIcon, AdvancedMarkerIcon, WatercolorIcon, ChevronUpIcon, ChevronDownIcon, CubeIcon } from './icons';

interface QuickAccessBarProps {
  settings: QuickAccessSettings;
  onUpdateColor: (index: number, newColor: string) => void;
  onAddColor: (color: string) => void;
  onRemoveColor: (index: number) => void;
  onUpdateSize: (index: number, newSize: number) => void;
  onUpdateTool: (index: number, newTool: QuickAccessTool) => void;
  onAddToolSlot: () => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: number) => void;
  onSelectTool: (tool: QuickAccessTool) => void;
  onOpenToolSelector: (index: number) => void;
  onToggleHeader: () => void;
  isHeaderVisible: boolean;
  activeTool?: Tool;
  activeColor?: string;
  activeSize?: number;
  strokeMode?: StrokeMode;
}

// FIX: Replaced 'solid-marker' with 'simple-marker'
// FIX: Added new tools to the icon map.
const toolIconMap: Record<Tool, React.FC<{ className?: string }>> = {
  'select': SelectIcon,
  'brush': BrushIcon,
  'eraser': EraserIcon,
  // FIX: Renamed 'solid-marker' to 'simple-marker' to match Tool type.
  'simple-marker': SolidMarkerIcon,
  'natural-marker': NaturalMarkerIcon,
  'airbrush': AirbrushIcon,
  'fx-brush': FXBrushIcon,
  'transform': TransformIcon,
  'free-transform': FreeTransformIcon,
  'crop': CropIcon,
  'pan': () => null, // Pan tool doesn't have a permanent slot
  'marquee-rect': MarqueeRectIcon,
  'lasso': LassoIcon,
  'magic-wand': MagicWandIcon,
  // FIX: Add 'debug-brush' to the toolIconMap to satisfy the Tool type.
  'debug-brush': BrushIcon,
  // FIX: Add 'text' to the toolIconMap to satisfy the Tool type.
  'text': TextIcon,
  'advanced-marker': AdvancedMarkerIcon,
  // FIX: Added 'watercolor' to the tool icon map to satisfy the Record type.
  'watercolor': WatercolorIcon,
};

const ColorEditorPopover = ({
  anchorEl,
  initialColor,
  onColorChange,
  onClose,
}: {
  anchorEl: HTMLElement;
  initialColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}) => {
  const [color, setColor] = useState(initialColor);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && !anchorEl.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorEl]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHexValue = e.target.value.toLowerCase();
    const newHex = `#${newHexValue}`;
    setColor(newHex);
    if (/^#[0-9a-f]{6}$/i.test(newHex)) {
      onColorChange(newHex);
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    onColorChange(newColor);
  };

  const rect = anchorEl.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    zIndex: 50
  };

  const presets = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#78716c', '#ffffff', '#000000'];

  return (
    <div ref={popoverRef} style={style} className="bg-theme-bg-secondary p-3 rounded-lg shadow-2xl border border-theme-bg-tertiary space-y-3" onPointerDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10">
          <input
            type="color"
            value={color}
            onChange={handlePickerChange}
            className="absolute inset-0 w-full h-full p-0 bg-transparent border-none rounded-md cursor-pointer opacity-0"
          />
          <div className="w-10 h-10 rounded-md border border-theme-bg-hover" style={{ backgroundColor: color }}></div>
        </div>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-text-secondary font-mono">#</span>
          <input
            type="text"
            value={color.substring(1)}
            onChange={handleHexChange}
            className="w-24 bg-theme-bg-tertiary text-theme-text-primary rounded-md p-2 pl-5 font-mono text-sm"
            maxLength={6}
          />
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-theme-text-secondary mb-2">Presets</h4>
        <div className="grid grid-cols-7 gap-1">
          {presets.map(preset => (
            <button
              key={preset}
              onClick={() => {
                setColor(preset);
                onColorChange(preset);
              }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${preset === color ? 'border-theme-accent-primary' : 'border-transparent hover:border-gray-400'}`}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};


export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
  settings,
  onUpdateColor,
  onAddColor,
  onRemoveColor,
  onUpdateSize,
  onSelectColor,
  onSelectSize,
  onSelectTool,
  onAddToolSlot,
  onOpenToolSelector,
  onToggleHeader,
  isHeaderVisible,
  activeTool,
  activeColor,
  activeSize,
  strokeMode,
}) => {
  const [editingColor, setEditingColor] = useState<{ index: number; initialColor: string; anchorEl: HTMLElement } | null>(null);
  const [colorContextMenu, setColorContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [editingSize, setEditingSize] = useState<{ index: number; value: string } | null>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorContextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setColorContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorContextMenu]);

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
    if (!tool) return <PlusIcon className="w-5 h-5 text-theme-text-secondary" />;
    if (tool.type === 'tool') {
      const Icon = toolIconMap[tool.tool];
      return Icon ? <Icon className="w-5 h-5" /> : null;
    }
    if (tool.type === 'fx-preset') {
      return <FXBrushIcon className="w-5 h-5" />;
    }
    if (tool.type === 'mode-preset') {
      if (tool.mode === 'parallelepiped') return <CubeIcon className="w-5 h-5" />;
      return <BrushIcon className="w-5 h-5" />;
    }
    return null;
  };

  const getToolTitle = (tool: QuickAccessTool | null): string => {
    if (!tool) return "Seleccionar herramienta";
    if (tool.type === 'tool') return tool.tool;
    if (tool.type === 'fx-preset') return `Preset: ${tool.name}`;
    if (tool.type === 'mode-preset') return tool.label || tool.mode;
    return "";
  };

  // Long press hook implementation
  const useLongPress = (
    onLongPress: (e: React.MouseEvent | React.TouchEvent) => void,
    onClick: () => void,
    defaultOptions = { shouldPreventDefault: true, delay: 500 }
  ) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeout = useRef<NodeJS.Timeout>();
    const target = useRef<EventTarget>();

    const start = (event: React.MouseEvent | React.TouchEvent) => {
      if (defaultOptions.shouldPreventDefault && event.target) {
        target.current = event.target;
      }
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, defaultOptions.delay);
    };

    const clear = (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      if (shouldTriggerClick && !longPressTriggered) {
        onClick();
      }
      setLongPressTriggered(false);
      target.current = undefined;
    };

    return {
      onMouseDown: (e: React.MouseEvent) => start(e),
      onTouchStart: (e: React.TouchEvent) => start(e),
      onMouseUp: (e: React.MouseEvent) => clear(e),
      onMouseLeave: (e: React.MouseEvent) => clear(e, false),
      onTouchEnd: (e: React.TouchEvent) => clear(e),
    };
  };

  interface QuickAccessToolButtonProps {
    tool: QuickAccessTool | null;
    index: number;
    activeTool?: Tool;
    strokeMode?: StrokeMode;
    onOpenToolSelector: (index: number) => void;
    onSelectTool: (tool: QuickAccessTool) => void;
  }

  const QuickAccessToolButton: React.FC<QuickAccessToolButtonProps> = ({
    tool,
    index,
    activeTool,
    strokeMode,
    onOpenToolSelector,
    onSelectTool
  }) => {
    // FIX: Correctly check active state for union type.
    const isActive = tool !== null && activeTool !== undefined && (
      (tool.type === 'tool' && tool.tool === activeTool) ||
      (tool.type === 'fx-preset' && activeTool === 'fx-brush') ||
      (tool.type === 'mode-preset' && activeTool === tool.tool && strokeMode === tool.mode)
    );

    // Construct handlers for this specific tool button using the hook
    const longPressHandlers = useLongPress(
      () => { if (tool) onOpenToolSelector(index); }, // On Long Press
      () => { if (tool) onSelectTool(tool); },       // On Click
      { shouldPreventDefault: true, delay: 500 }
    );

    return (
      <button
        {...longPressHandlers}
        onContextMenu={(e) => {
          e.preventDefault();
          // Fallback: Right click STILL opens it, for desktop users who prefer it.
          onOpenToolSelector(index);
        }}
        className={`p-2 rounded-lg text-theme-text-primary transition-colors ${isActive ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'
          } select-none touch-manipulation`} // Add touch-manipulation to improve mobile response
        title={`${getToolTitle(tool)} (mantén presionado para cambiar)`}
      >
        {renderToolIcon(tool)}
      </button>
    );
  };


  // Long press hook implementation inline


  return (
    <>
      <div className="absolute top-4 left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:w-auto md:right-auto bg-theme-bg-primary/80 backdrop-blur-sm rounded-lg p-1 flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-visible items-center justify-start md:justify-center gap-2 shadow-lg z-10 scrollbar-hide">
        {/* Header Toggle */}
        <button
          onClick={onToggleHeader}
          className="p-1 rounded-md text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary transition-colors"
          title={isHeaderVisible ? "Ocultar Encabezado" : "Mostrar Encabezado"}
        >
          {isHeaderVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>

        <div className="h-6 w-px bg-theme-bg-hover" />

        {/* Color Palette */}
        <div className="flex items-center gap-2">
          {settings.colors.map((color, index) => {
            const isActive = activeColor && color.toLowerCase() === activeColor.toLowerCase();
            // Colors logic remains mostly same but could benefit from long press too. 
            // For now, keeping double click/context menu as requested only for tools.
            return (
              <button
                key={index}
                onClick={() => onSelectColor(color)}
                onDoubleClick={(e) => {
                  setEditingColor({ index, initialColor: color, anchorEl: e.currentTarget });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setColorContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
                className={`w-7 h-7 rounded-full border-2 transition-all hover:border-theme-accent-primary ${isActive ? 'border-theme-accent-primary' : 'border-theme-bg-secondary'
                  }`}
                style={{ backgroundColor: color }}
                title={`Color: ${color} (clic para seleccionar, doble clic para editar, clic derecho para eliminar)`}
              />
            );
          })}
          <button
            onClick={() => onAddColor('#ffffff')}
            className="w-7 h-7 rounded-full border-2 border-dashed border-theme-bg-hover flex items-center justify-center text-theme-text-secondary hover:bg-theme-bg-tertiary hover:border-theme-accent-primary transition-colors"
            title="Agregar color"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-theme-bg-hover" />

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
                    className="w-14 text-center bg-theme-bg-hover text-theme-text-primary p-1 rounded-md text-xs"
                  />
                ) : (
                  <button
                    onClick={() => onSelectSize(size)}
                    onDoubleClick={() => handleSizeDoubleClick(index, size)}
                    className={`w-14 p-1 rounded-md text-xs transition-colors ${isActive ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'
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

        <div className="h-6 w-px bg-theme-bg-hover" />

        {/* Tool Shortcuts */}
        <div className="flex items-center gap-2">
          {(settings && settings.tools ? settings.tools : []).map((tool, index) => (
            <QuickAccessToolButton
              key={index}
              tool={tool}
              index={index}
              activeTool={activeTool}
              strokeMode={strokeMode}
              onOpenToolSelector={onOpenToolSelector}
              onSelectTool={onSelectTool}
            />
          ))}
          <button
            onClick={onAddToolSlot}
            className="w-9 h-9 rounded-lg border-2 border-dashed border-theme-bg-hover flex items-center justify-center text-theme-text-secondary hover:bg-theme-bg-tertiary hover:border-theme-accent-primary transition-colors"
            title="Agregar ranura de herramienta"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>

      </div>
      {editingColor && (
        <ColorEditorPopover
          anchorEl={editingColor.anchorEl}
          initialColor={editingColor.initialColor}
          onClose={() => setEditingColor(null)}
          onColorChange={(newColor) => {
            if (editingColor.index !== null) {
              onUpdateColor(editingColor.index, newColor);
              setEditingColor(prev => prev ? { ...prev, initialColor: newColor } : null);
            }
          }}
        />
      )}
      {colorContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-theme-bg-secondary rounded-md shadow-lg border border-theme-bg-tertiary py-1"
          style={{ top: colorContextMenu.y, left: colorContextMenu.x }}
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (settings.colors.length > 1) {
                onRemoveColor(colorContextMenu.index);
              } else {
                alert("No se puede eliminar el último color.");
              }
              setColorContextMenu(null);
            }}
            className="block w-full text-left px-3 py-1 text-sm text-red-500 hover:bg-theme-bg-hover"
          >
            Eliminar
          </button>
        </div>
      )}
    </>
  );
};