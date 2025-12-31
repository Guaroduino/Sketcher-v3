import React from 'react';

interface ConfirmDiscardChangesModalProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export const ConfirmDiscardChangesModal: React.FC<ConfirmDiscardChangesModalProps> = ({ isOpen, onCancel, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-sm border border-theme-bg-tertiary">
                <h2 className="text-xl font-bold mb-4">Cambios sin guardar</h2>
                <p className="text-theme-text-secondary mb-6">
                    Tienes cambios sin guardar en tu lienzo actual. Si cargas otro proyecto ahora,
                    <strong className="text-theme-text-primary"> perderás el trabajo no guardado.</strong>
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-theme-text-primary transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md transition-colors">
                        Descartar y Cargar
                    </button>
                </div>
            </div>
        </div>
    );
};
