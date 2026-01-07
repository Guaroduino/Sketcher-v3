import React from 'react';
import { XIcon, CheckIcon, DownloadIcon } from '../icons';

interface AIRequestInspectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (modifiedParts?: { text?: string; inlineData?: { mimeType: string; data: string } }[]) => void;
    payload: {
        model: string;
        parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];
        config?: any;
    } | null;
}

export const AIRequestInspectorModal: React.FC<AIRequestInspectorModalProps> = ({ isOpen, onClose, onConfirm, payload }) => {
    const [parts, setParts] = React.useState<typeof payload.parts>([]);

    React.useEffect(() => {
        if (payload?.parts) {
            setParts(JSON.parse(JSON.stringify(payload.parts))); // Deep copy
        }
    }, [payload]);

    if (!isOpen || !payload) return null;

    const handleTextChange = (index: number, newText: string) => {
        const newParts = [...parts];
        if (newParts[index]) {
            newParts[index] = { ...newParts[index], text: newText };
            setParts(newParts);
        }
    };

    const handleConfirm = () => {
        onConfirm(parts);
    };

    const images = parts.filter(p => p.inlineData);
    const textPartIndices = parts.map((p, i) => p.text ? i : -1).filter(i => i !== -1);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-theme-bg-secondary w-full max-w-4xl max-h-[90vh] rounded-xl flex flex-col shadow-2xl border border-theme-bg-tertiary">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-theme-bg-tertiary bg-theme-bg-primary/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                            <span className="font-mono text-xs font-bold">AI DEBUG</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-theme-text-primary">Inspeccionar Envío</h3>
                            <p className="text-xs text-theme-text-secondary font-mono">Modelo: {payload.model}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-theme-bg-tertiary rounded-lg text-theme-text-tertiary hover:text-white transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">

                    {/* Images Section */}
                    {images.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-theme-text-secondary uppercase mb-3 tracking-wider">Imágenes Adjuntas ({images.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map((img, idx) => (
                                    <div key={idx} className="relative group bg-black/20 rounded-lg overflow-hidden border border-theme-bg-tertiary">
                                        <img
                                            src={`data:${img.inlineData?.mimeType};base64,${img.inlineData?.data}`}
                                            alt={`Input ${idx}`}
                                            className="w-full h-48 object-contain"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[10px] text-gray-300 font-mono flex justify-between">
                                            <span>IMG_{idx + 1}</span>
                                            <span>{Math.round((img.inlineData?.data.length || 0) / 1024)} KB</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Text Prompts Section */}
                    {textPartIndices.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-theme-text-secondary uppercase mb-3 tracking-wider">Prompts de Texto ({textPartIndices.length}) - EDITABLE</h4>
                            <div className="space-y-3">
                                {textPartIndices.map((originalIndex) => (
                                    <div key={originalIndex} className="bg-[#121212] rounded-lg border border-theme-bg-tertiary overflow-hidden ring-1 ring-transparent focus-within:ring-purple-500 transition-all">
                                        <textarea
                                            className="w-full h-64 bg-transparent p-4 font-mono text-sm text-gray-300 resize-y outline-none"
                                            value={parts[originalIndex].text || ''}
                                            onChange={(e) => handleTextChange(originalIndex, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Config Section */}
                    {payload.config && (
                        <div>
                            <h4 className="text-xs font-bold text-theme-text-secondary uppercase mb-3 tracking-wider">Configuración</h4>
                            <div className="bg-[#121212] rounded-lg border border-theme-bg-tertiary overflow-hidden">
                                <textarea
                                    readOnly
                                    className="w-full h-32 bg-transparent p-3 font-mono text-xs text-green-400 resize-y outline-none"
                                    value={JSON.stringify(payload.config, null, 2)}
                                    onClick={(e) => e.currentTarget.select()}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-theme-bg-tertiary bg-theme-bg-primary/50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary transition-colors"
                    >
                        Cancelar Envío
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all hover:scale-105"
                    >
                        <CheckIcon className="w-4 h-4" />
                        Confirmar y Enviar
                    </button>
                </div>
            </div>
        </div>
    );
};
