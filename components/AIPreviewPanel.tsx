import React from 'react';

interface AIPreviewPanelProps {
    debugInfo: {
        prompt: string;
        images: { name: string; url: string }[];
    } | null;
}

export const AIPreviewPanel: React.FC<AIPreviewPanelProps> = ({ debugInfo }) => {
    if (!debugInfo) return null;

    return (
        <div className="w-full bg-[--bg-secondary] border-t border-[--bg-tertiary] p-4 mt-4 rounded-b-lg">
            <h4 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Vista Previa de Envío a IA</h4>
            <div className="flex gap-4 overflow-x-auto pb-2">
                {/* Images */}
                <div className="flex gap-2 flex-shrink-0">
                    {debugInfo.images.map((img, index) => (
                        <div key={index} className="flex flex-col items-center">
                            <div className="w-24 h-24 bg-[--bg-tertiary] rounded overflow-hidden mb-1 border border-[--bg-tertiary]">
                                <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                            </div>
                            <span className="text-[10px] text-[--text-secondary] font-mono">{img.name}</span>
                        </div>
                    ))}
                </div>

                {/* Prompt */}
                <div className="flex-grow min-w-[200px] border-l border-[--bg-tertiary] pl-4 flex flex-col">
                    <span className="text-xs font-bold text-[--text-secondary] mb-1">Prompt Enviado:</span>
                    <div className="flex-grow bg-[--bg-primary] p-2 rounded text-xs text-[--text-primary] font-mono overflow-y-auto max-h-24 whitespace-pre-wrap border border-[--bg-tertiary]">
                        {debugInfo.prompt || <span className="italic text-[--text-secondary]">(Prompt vacío)</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
