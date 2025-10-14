import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceTemplate } from '../types';
import { BookmarkIcon, TrashIcon, XIcon } from './icons';

interface WorkspaceTemplatesPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    templates: WorkspaceTemplate[];
    onSave: (name: string) => void;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onResetPreferences: () => void;
}

export const WorkspaceTemplatesPopover: React.FC<WorkspaceTemplatesPopoverProps> = ({
    isOpen,
    onClose,
    templates,
    onSave,
    onLoad,
    onDelete,
    onResetPreferences
}) => {
    const [templateName, setTemplateName] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleSave = () => {
        if (templateName.trim()) {
            onSave(templateName.trim());
            setTemplateName('');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={popoverRef}
            className="absolute top-full right-0 mt-2 w-72 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg z-30 py-2 flex flex-col"
            style={{ maxHeight: 'calc(100vh - 100px)' }}
        >
            <div className="flex justify-between items-center px-3 pb-2 border-b border-[--bg-tertiary]">
                <h3 className="text-sm font-bold uppercase text-[--text-secondary] flex items-center gap-2">
                    <BookmarkIcon className="w-4 h-4" />
                    <span>Plantillas de Espacio de Trabajo</span>
                </h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-[--bg-hover]">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
                {templates.length > 0 ? (
                    templates.map(template => (
                        <div key={template.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-[--bg-tertiary]">
                            <button onClick={() => onLoad(template.id)} className="flex-grow text-left text-sm truncate">
                                {template.name}
                            </button>
                            <button onClick={() => onDelete(template.id)} className="p-1 text-[--text-secondary] opacity-0 group-hover:opacity-100 hover:text-red-500">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-xs text-[--text-secondary] py-4">
                        No hay plantillas guardadas.
                    </div>
                )}
            </div>

            <div className="px-3 pt-2 border-t border-[--bg-tertiary]">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        placeholder="Nombre de la nueva plantilla..."
                        className="flex-grow bg-[--bg-secondary] text-[--text-primary] text-sm rounded-md p-2 border border-[--bg-tertiary] focus:ring-1 focus:ring-[--accent-primary] focus:outline-none"
                    />
                    <button
                        onClick={handleSave}
                        disabled={!templateName.trim()}
                        className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Guardar
                    </button>
                </div>
            </div>

            <div className="px-3 pt-2 mt-2 border-t border-[--bg-tertiary]">
                <button
                    onClick={onResetPreferences}
                    className="w-full text-center px-4 py-2 text-sm text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                >
                    Restablecer todas las preferencias
                </button>
            </div>
        </div>
    );
};