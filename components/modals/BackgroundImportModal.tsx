import React, { useState, useRef } from 'react';
import { XIcon, UploadIcon, CheckIcon, LayersIcon } from '../icons';
import type { LibraryItem, LibraryImage } from '../../types';

interface BackgroundImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: 'resize-canvas' | 'fit-image', cropToFit: boolean, importAsObject: boolean) => void;
    pendingFile: File | null;
    onFileSelected: (file: File | null) => void;
    libraryItems: LibraryItem[];
}

export const BackgroundImportModal: React.FC<BackgroundImportModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    pendingFile,
    onFileSelected,
    libraryItems = []
}) => {
    const [cropToFit, setCropToFit] = useState(false);
    const [importAsObject, setImportAsObject] = useState(false);
    const [step, setStep] = useState<'source-select' | 'actions'>('source-select');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset step when opening
    React.useEffect(() => {
        if (isOpen) {
            if (pendingFile) {
                setStep('actions');
            } else {
                setStep('source-select');
            }
        }
    }, [isOpen, pendingFile]);

    const handleLocalSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelected(e.target.files[0]);
        }
    };

    const handleLibrarySelect = (item: LibraryItem) => {
        if (item.type !== 'image') return;
        const imgItem = item as LibraryImage;
        if (!imgItem.dataUrl) return;

        fetch(imgItem.dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], item.name, { type: 'image/png' });
                onFileSelected(file);
            });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className={`bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full ${step === 'source-select' ? 'max-w-2xl' : 'max-w-sm'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Importar Fondo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-tertiary">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {step === 'source-select' && (
                    <div className="space-y-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option 1: Local Device */}
                            <button
                                onClick={handleLocalSelect}
                                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-theme-bg-tertiary rounded-xl hover:bg-theme-bg-tertiary hover:border-theme-accent-primary transition-all group"
                            >
                                <div className="p-4 rounded-full bg-theme-bg-tertiary group-hover:bg-theme-accent-primary group-hover:text-white mb-4 transition-colors">
                                    <UploadIcon className="w-8 h-8" />
                                </div>
                                <span className="text-lg font-bold">Desde tu Equipo</span>
                                <span className="text-sm text-theme-text-secondary mt-1">Sube una imagen local</span>
                            </button>

                            {/* Option 2: Library (Grid) */}
                            <div className="flex flex-col h-full">
                                <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-2">Desde tu Librería</h3>
                                <div className="flex-grow bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary p-2 h-64 overflow-y-auto custom-scrollbar">
                                    {libraryItems.filter(i => i.type === 'image').length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-theme-text-secondary opacity-50">
                                            <LayersIcon className="w-8 h-8 mb-2" />
                                            <span className="text-xs">Librería vacía</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {libraryItems.filter(i => i.type === 'image').map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleLibrarySelect(item)}
                                                    className="aspect-square relative rounded-md overflow-hidden bg-theme-bg-tertiary hover:ring-2 hover:ring-theme-accent-primary transition-all group"
                                                    title={item.name}
                                                >
                                                    <img src={(item as LibraryImage).dataUrl || ''} alt={item.name} className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'actions' && (
                    <>
                        <p className="text-sm text-theme-text-secondary mb-6">
                            ¿Cómo quieres ajustar la imagen seleccionada?
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => onConfirm('resize-canvas', false, importAsObject)}
                                className="w-full text-left p-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover flex flex-col transition-colors"
                            >
                                <span className="font-bold text-sm">Ajustar Lienzo a Imagen</span>
                                <span className="text-xs text-theme-text-secondary mt-1">El lienzo cambiará de tamaño para coincidir con la imagen{importAsObject ? ' (importar como capa)' : ''}.</span>
                            </button>

                            <div className="space-y-2">
                                <button
                                    onClick={() => onConfirm('fit-image', cropToFit, importAsObject)}
                                    className="w-full text-left p-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover flex flex-col transition-colors"
                                >
                                    <span className="font-bold text-sm">Ajustar Imagen al Lienzo</span>
                                    <span className="text-xs text-theme-text-secondary mt-1">La imagen se redimensionará para caber dentro del lienzo{importAsObject ? ' (importar como capa)' : ''}.</span>
                                </button>

                                <div className="flex items-center space-x-2 pl-2">
                                    <input
                                        type="checkbox"
                                        id="crop-to-fit"
                                        checked={cropToFit}
                                        onChange={(e) => setCropToFit(e.target.checked)}
                                        className="w-4 h-4 rounded border-theme-bg-tertiary text-theme-accent-primary focus:ring-theme-accent-primary"
                                    />
                                    <label htmlFor="crop-to-fit" className="text-xs text-theme-text-secondary cursor-pointer selection:bg-transparent">
                                        Ajustar también el tamaño del lienzo (recortar sobrante)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2 pl-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="import-as-object"
                                        checked={importAsObject}
                                        onChange={(e) => setImportAsObject(e.target.checked)}
                                        className="w-4 h-4 rounded border-theme-bg-tertiary text-theme-accent-primary focus:ring-theme-accent-primary"
                                    />
                                    <label htmlFor="import-as-object" className="text-xs text-theme-text-secondary cursor-pointer selection:bg-transparent font-medium">
                                        Importar como objeto (nueva capa)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-6">
                            <button
                                onClick={() => onFileSelected(null)}
                                className="px-4 py-2 rounded-md bg-transparent hover:bg-theme-bg-hover text-theme-text-secondary text-sm font-medium"
                            >
                                Volver
                            </button>
                            <button onClick={onClose} className="px-4 py-2 rounded-md bg-transparent hover:bg-theme-bg-hover text-theme-text-secondary text-sm font-medium">
                                Cancelar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
