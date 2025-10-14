import React from 'react';

interface ConfirmDeleteLibraryItemModalProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export const ConfirmDeleteLibraryItemModal: React.FC<ConfirmDeleteLibraryItemModalProps> = ({ isOpen, onCancel, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2>
                <p className="text-[--text-secondary] mb-6">¿Estás seguro de que quieres eliminar este elemento de la librería? Esta acción no se puede deshacer.</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">
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
