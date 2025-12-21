import React from 'react';
import type { LibraryItem } from '../../types';

interface ConfirmDeleteLibraryItemModalProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    itemToDelete: LibraryItem | null;
}

export const ConfirmDeleteLibraryItemModal: React.FC<ConfirmDeleteLibraryItemModalProps> = ({ isOpen, onCancel, onConfirm, itemToDelete }) => {
    if (!isOpen || !itemToDelete) return null;

    const isFolder = itemToDelete.type === 'folder';
    const message = `¿Estás seguro de que quieres eliminar "${itemToDelete.name}"?`;
    const folderWarning = `Esto también eliminará permanentemente todo su contenido. Esta acción no se puede deshacer.`;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2>
                <p className="text-theme-text-secondary mb-6">
                    {message}
                    {isFolder && <strong className="block mt-2 text-theme-text-primary">{folderWarning}</strong>}
                </p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white">
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
};