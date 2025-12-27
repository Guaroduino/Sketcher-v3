import React, { useState, useEffect } from 'react';
import { XIcon } from '../icons';

interface CanvasSizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSize: { width: number, height: number };
    onApply: (width: number, height: number, scale?: boolean) => void;
}

const PRESETS = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 },
};

export const CanvasSizeModal: React.FC<CanvasSizeModalProps> = ({
    isOpen,
    onClose,
    currentSize,
    onApply,
}) => {
    const [width, setWidth] = useState(currentSize.width);
    const [height, setHeight] = useState(currentSize.height);
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [lockAspectRatio, setLockAspectRatio] = useState(true);
    const [aspectRatio, setAspectRatio] = useState(currentSize.width / currentSize.height);
    const [shouldScaleContent, setShouldScaleContent] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setWidth(currentSize.width);
            setHeight(currentSize.height);
            setOrientation(currentSize.width >= currentSize.height ? 'horizontal' : 'vertical');
            setAspectRatio(currentSize.width / currentSize.height);
        }
    }, [isOpen, currentSize]);

    const handlePreset = (preset: keyof typeof PRESETS) => {
        const newWidth = PRESETS[preset].width;
        const newHeight = PRESETS[preset].height;
        if (orientation === 'horizontal') {
            setWidth(newWidth);
            setHeight(newHeight);
        } else {
            setWidth(newHeight);
            setHeight(newWidth);
        }
    };

    const handleOrientation = (newOrientation: 'horizontal' | 'vertical') => {
        if (newOrientation !== orientation) {
            setOrientation(newOrientation);
            setWidth(height);
            setHeight(width);
        }
    };

    const handleApply = () => {
        const newWidth = Number(width);
        const newHeight = Number(height);
        if (!isNaN(newWidth) && !isNaN(newHeight) && newWidth > 0 && newHeight > 0) {
            onApply(newWidth, newHeight, shouldScaleContent);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-md flex flex-col space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Tamaño del Lienzo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-tertiary">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Presets</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handlePreset('720p')} className="p-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-sm">720p</button>
                        <button onClick={() => handlePreset('1080p')} className="p-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-sm">1080p</button>
                        <button onClick={() => handlePreset('4K')} className="p-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-sm">2160p (4K)</button>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Orientación</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleOrientation('horizontal')} className={`p-2 rounded-md text-sm transition-colors ${orientation === 'horizontal' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}>Horizontal</button>
                        <button onClick={() => handleOrientation('vertical')} className={`p-2 rounded-md text-sm transition-colors ${orientation === 'vertical' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}>Vertical</button>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Personalizado</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="canvas-width" className="block text-xs text-theme-text-secondary mb-1">Ancho (px)</label>
                            <input
                                type="number"
                                id="canvas-width"
                                value={width}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setWidth(val);
                                    if (lockAspectRatio) {
                                        setHeight(Math.round(val / aspectRatio));
                                    }
                                }}
                                className="w-full bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md p-2 focus:ring-1 focus:ring-theme-accent-primary outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="canvas-height" className="block text-xs text-theme-text-secondary mb-1">Alto (px)</label>
                            <input
                                type="number"
                                id="canvas-height"
                                value={height}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setHeight(val);
                                    if (lockAspectRatio) {
                                        setWidth(Math.round(val * aspectRatio));
                                    }
                                }}
                                className="w-full bg-theme-bg-tertiary text-theme-text-primary text-sm rounded-md p-2 focus:ring-1 focus:ring-theme-accent-primary outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="lock-aspect-ratio"
                            checked={lockAspectRatio}
                            onChange={(e) => {
                                setLockAspectRatio(e.target.checked);
                                if (e.target.checked) {
                                    setAspectRatio(width / height);
                                }
                            }}
                            className="w-4 h-4 rounded border-theme-bg-tertiary text-theme-accent-primary focus:ring-theme-accent-primary"
                        />
                        <label htmlFor="lock-aspect-ratio" className="text-sm text-theme-text-primary cursor-pointer select-none">
                            Mantener Relación de Aspecto
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="scale-content"
                            checked={shouldScaleContent}
                            onChange={(e) => setShouldScaleContent(e.target.checked)}
                            className="w-4 h-4 rounded border-theme-bg-tertiary text-theme-accent-primary focus:ring-theme-accent-primary"
                        />
                        <label htmlFor="scale-content" className="text-sm text-theme-text-primary cursor-pointer select-none">
                            Redimensionar contenido (Escalar imagen)
                        </label>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-2">
                    <button onClick={onClose} className="px-6 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover">
                        Cancelar
                    </button>
                    <button onClick={handleApply} className="px-6 py-2 rounded-md bg-theme-accent-primary hover:bg-theme-accent-hover text-white">
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};
