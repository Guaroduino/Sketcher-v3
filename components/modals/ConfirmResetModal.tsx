import React from 'react';

interface ConfirmResetModalProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export const ConfirmResetModal: React.FC<ConfirmResetModalProps> = ({ isOpen, onCancel, onConfirm }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Restablecer Preferencias</h2>
                <p className="text-theme-text-secondary mb-6">
                    ¿Estás seguro de que quieres restablecer todas las preferencias a sus valores por defecto? 
                    Esto eliminará permanentemente los preajustes de pincel personalizados y otras configuraciones. 
                    <strong className="text-theme-text-primary block mt-2">Tus plantillas de espacio de trabajo guardadas no se verán afectadas.</strong>
                    Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white">
                        Restablecer
                    </button>
                </div>
            </div>
        </div>
    );
};