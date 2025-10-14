import React, { useState, useEffect } from 'react';
import { XIcon } from '../icons';

interface CanvasSizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSize: { width: number, height: number };
    onApply: (width: number, height: number) => void;
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

    useEffect(() => {
        if (isOpen) {
            setWidth(currentSize.width);
            setHeight(currentSize.height);
            setOrientation(currentSize.width >= currentSize.height ? 'horizontal' : 'vertical');
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
        const newWidth = parseFloat(String(width));
        const newHeight = parseFloat(String(height));
        if (!isNaN(newWidth) && !isNaN(newHeight) && newWidth > 0 && newHeight > 0) {
            onApply(newWidth, newHeight);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-md flex flex-col space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Tamaño del Lienzo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[--bg-tertiary]">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Presets</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handlePreset('720p')} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] text-sm">720p</button>
                        <button onClick={() => handlePreset('1080p')} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] text-sm">1080p</button>
                        <button onClick={() => handlePreset('4K')} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] text-sm">2160p (4K)</button>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Orientación</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleOrientation('horizontal')} className={`p-2 rounded-md text-sm transition-colors ${orientation === 'horizontal' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Horizontal</button>
                        <button onClick={() => handleOrientation('vertical')} className={`p-2 rounded-md text-sm transition-colors ${orientation === 'vertical' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Vertical</button>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Personalizado</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="canvas-width" className="block text-xs text-[--text-secondary] mb-1">Ancho</label>
                            <input
                                type="number"
                                id="canvas-width"
                                value={width}
                                // FIX: Convert input string value to number before setting state.
                                onChange={(e) => setWidth(Number(e.target.value))}
                                className="w-full bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md p-2"
                            />
                        </div>
                        <div>
                            <label htmlFor="canvas-height" className="block text-xs text-[--text-secondary] mb-1">Alto</label>
                            <input
                                type="number"
                                id="canvas-height"
                                value={height}
                                // FIX: Convert input string value to number before setting state.
                                onChange={(e) => setHeight(Number(e.target.value))}
                                className="w-full bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md p-2"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-2">
                    <button onClick={onClose} className="px-6 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">
                        Cancelar
                    </button>
                    <button onClick={handleApply} className="px-6 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white">
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};