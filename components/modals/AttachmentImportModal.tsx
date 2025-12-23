import React, { useRef } from 'react';
import { XIcon, UploadIcon, LayersIcon } from '../icons';
import type { LibraryItem, LibraryImage } from '../../types';

interface AttachmentImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFileSelected: (dataUrl: string) => void;
    libraryItems: LibraryItem[];
}

export const AttachmentImportModal: React.FC<AttachmentImportModalProps> = ({
    isOpen,
    onClose,
    onFileSelected,
    libraryItems = []
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLocalSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    onFileSelected(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLibrarySelect = (item: LibraryItem) => {
        if (item.type !== 'image') return;
        const imgItem = item as LibraryImage;
        if (!imgItem.dataUrl) return;
        onFileSelected(imgItem.dataUrl);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Adjuntar Imagen de Referencia</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-theme-bg-tertiary">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

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

                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-transparent hover:bg-theme-bg-hover text-theme-text-secondary text-sm font-medium">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
