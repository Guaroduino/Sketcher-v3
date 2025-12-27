import React from 'react';
// FIX: Added BrushPreset to imports
import type { Tool, BrushPreset, QuickAccessTool } from '../../types';
// FIX: Replaced MarkerIcon with SolidMarkerIcon and NaturalMarkerIcon.
// FIX: Imported missing icons.
import { XIcon, SelectIcon, BrushIcon, EraserIcon, SolidMarkerIcon, NaturalMarkerIcon, AirbrushIcon, FXBrushIcon, TransformIcon, FreeTransformIcon, SparklesIcon, CropIcon, MarqueeRectIcon, LassoIcon, MagicWandIcon, TextIcon, AdvancedMarkerIcon, WatercolorIcon, CubeIcon } from '../icons';

interface ToolSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    // FIX: Updated type to allow for presets
    onSelectTool: (tool: QuickAccessTool) => void;
    fxPresets: BrushPreset[];
}

// FIX: Added new tools to the standard tools list.
const standardTools: { name: Tool, icon: React.FC<{ className?: string }> }[] = [
    { name: 'select', icon: SelectIcon },
    { name: 'marquee-rect', icon: MarqueeRectIcon },
    { name: 'lasso', icon: LassoIcon },
    { name: 'magic-wand', icon: MagicWandIcon },
    { name: 'text', icon: TextIcon },
    { name: 'brush', icon: BrushIcon },
    { name: 'eraser', icon: EraserIcon },
    { name: 'simple-marker', icon: SolidMarkerIcon },
    { name: 'advanced-marker', icon: AdvancedMarkerIcon },
    { name: 'natural-marker', icon: NaturalMarkerIcon },
    { name: 'watercolor', icon: WatercolorIcon },
    { name: 'airbrush', icon: AirbrushIcon },
    { name: 'fx-brush', icon: FXBrushIcon },
    { name: 'transform', icon: TransformIcon },
    { name: 'free-transform', icon: FreeTransformIcon },
    { name: 'crop', icon: CropIcon },
];

export const ToolSelectorModal: React.FC<ToolSelectorModalProps> = ({ isOpen, onClose, onSelectTool, fxPresets }) => {
    if (!isOpen) return null;

    const handleSelect = (tool: QuickAccessTool) => {
        onSelectTool(tool);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-lg flex flex-col space-y-4 max-h-[80vh]">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Seleccionar Herramienta de Acceso Rápido</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-tertiary">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                    <div>
                        <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Herramientas Estándar</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {standardTools.map(({ name, icon: Icon }) => (
                                <button
                                    key={name}
                                    onClick={() => handleSelect({ type: 'tool', tool: name })}
                                    className="flex flex-col items-center justify-center p-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover transition-colors"
                                    title={name}
                                >
                                    <Icon className="w-8 h-8" />
                                    <span className="text-xs mt-2 capitalize">{
                                        // Provide friendlier display names for specific tools
                                        name === 'advanced-marker' ? 'Lápiz de color'
                                            : name === 'natural-marker' ? 'Marcador sólido'
                                                : name.replace('-', ' ')
                                    }</span>
                                </button>
                            ))}
                            <button
                                onClick={() => handleSelect({ type: 'mode-preset', mode: 'parallelepiped', tool: 'brush', label: 'Cubo 3D' })}
                                className="flex flex-col items-center justify-center p-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover transition-colors"
                                title="Cubo 3D (Perspectiva)"
                            >
                                <CubeIcon className="w-8 h-8" />
                                <span className="text-xs mt-2 capitalize">Cubo 3D</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Presets de Pincel FX</h3>
                        {fxPresets.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {fxPresets.map(preset => (
                                    <button
                                        key={preset.id}
                                        // FIX: Correctly form the preset object for selection.
                                        onClick={() => handleSelect({ type: 'fx-preset', id: preset.id, name: preset.name })}
                                        className="p-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FXBrushIcon className="w-6 h-6 flex-shrink-0" />
                                            <span className="text-sm truncate">{preset.name}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-theme-text-secondary text-center p-4">No tienes presets de Pincel FX guardados.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};