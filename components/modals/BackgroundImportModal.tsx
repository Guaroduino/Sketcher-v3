import React, { useEffect, useState } from 'react';
import { XIcon } from '../icons';

interface BackgroundImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResizeCanvas: () => void;
    onFitImage: (cropToFit: boolean) => void;

}

export const BackgroundImportModal: React.FC<BackgroundImportModalProps> = ({
    isOpen,
    onClose,
    onResizeCanvas,
    onFitImage,
}) => {
    const [cropToFit, setCropToFit] = useState(false);

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Importar Fondo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[--bg-tertiary]">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-[--text-secondary] mb-6">
                    ¿Cómo quieres ajustar la imagen importada?
                </p>

                <div className="space-y-3">
                    <button
                        onClick={onResizeCanvas}
                        className="w-full text-left p-3 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] flex flex-col transition-colors"
                    >
                        <span className="font-bold text-sm">Ajustar Lienzo a Imagen</span>
                        <span className="text-xs text-[--text-secondary] mt-1">El lienzo cambiará de tamaño para coincidir con la imagen.</span>
                    </button>

                    <div className="space-y-2">
                        <button
                            onClick={() => onFitImage(cropToFit)}
                            className="w-full text-left p-3 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] flex flex-col transition-colors"
                        >
                            <span className="font-bold text-sm">Ajustar Imagen al Lienzo</span>
                            <span className="text-xs text-[--text-secondary] mt-1">La imagen se redimensionará para caber dentro del lienzo (manteniendo proporción).</span>
                        </button>

                        <div className="flex items-center space-x-2 pl-2">
                            <input
                                type="checkbox"
                                id="crop-to-fit"
                                checked={cropToFit}
                                onChange={(e) => setCropToFit(e.target.checked)}
                                className="w-4 h-4 rounded border-[--bg-tertiary] text-[--accent-primary] focus:ring-[--accent-primary]"
                            />
                            <label htmlFor="crop-to-fit" className="text-xs text-[--text-secondary] cursor-pointer selection:bg-transparent">
                                Ajustar también el tamaño del lienzo (recortar sobrante)
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-transparent hover:bg-[--bg-hover] text-[--text-secondary] text-sm font-medium">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
