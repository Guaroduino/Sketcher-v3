import React from 'react';
import {
    TrashIcon,
    SquareIcon,
    BrushIcon as PencilIcon,
    EraserIcon,
    HandIcon as CursorClickIcon,
    SparklesIcon,
    UploadIcon,
    XIcon as CloseIcon,
    UndoIcon
} from '../../components/icons';
import { Region } from '../../services/visualPromptingService';

interface VisualPromptingControlsProps {
    regions: Region[];
    onDeleteRegion: (id: string) => void;
    onUpdateRegionPrompt: (id: string, prompt: string) => void;
    onUpdateRegionImage: (id: string, image: string | null) => void;

    // Global Inputs
    generalInstructions: string;
    onGeneralInstructionsChange: (text: string) => void;
    referenceImage: string | null;
    onReferenceImageChange: (image: string | null) => void;

    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    brushColor: string;
    onBrushColorChange: (color: string) => void;

    activeTool: 'pen' | 'eraser' | 'region' | 'polygon' | 'pan';
    onToolChange: (tool: 'pen' | 'eraser' | 'region' | 'polygon' | 'pan') => void;
    onProcessChanges: () => void;
    isGenerating?: boolean;

    // Structured Prompt Editor
    structuredPrompt: string;
    onStructuredPromptChange: (text: string) => void;
    onResetStructuredPrompt: () => void;
    isPromptModified: boolean;
}

export const VisualPromptingControls: React.FC<VisualPromptingControlsProps> = ({
    regions,
    onDeleteRegion,
    onUpdateRegionPrompt,
    onUpdateRegionImage,
    generalInstructions,
    onGeneralInstructionsChange,
    referenceImage,
    onReferenceImageChange,
    brushSize,
    onBrushSizeChange,
    brushColor,
    onBrushColorChange,
    activeTool,
    onToolChange,
    onProcessChanges,
    isGenerating = false,
    structuredPrompt,
    onStructuredPromptChange,
    onResetStructuredPrompt,
    isPromptModified
}) => {
    return (
        <div className="flex flex-col h-full bg-theme-bg-secondary border-r border-theme-bg-tertiary">
            {/* Header & Tools */}
            <div className="p-4 border-b border-theme-bg-tertiary space-y-4">
                <div>
                    <h2 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-1">Herramientas</h2>
                    <div className="text-[10px] text-theme-text-secondary">Selecciona una herramienta para editar.</div>
                </div>

                {/* Tools Grid */}
                <div className="flex bg-theme-bg-primary p-1 rounded-lg gap-1 border border-theme-bg-tertiary">
                    <ToolButton
                        active={activeTool === 'pan'}
                        onClick={() => onToolChange('pan')}
                        icon={<CursorClickIcon className="w-4 h-4" />}
                        title="Mover (Pan)"
                    />
                    <ToolButton
                        active={activeTool === 'pen'}
                        onClick={() => onToolChange('pen')}
                        icon={<PencilIcon className="w-4 h-4" />}
                        title="Lápiz"
                    />
                    <ToolButton
                        active={activeTool === 'eraser'}
                        onClick={() => onToolChange('eraser')}
                        icon={<EraserIcon className="w-4 h-4" />}
                        title="Borrador"
                    />
                    <div className="w-px bg-theme-bg-tertiary mx-1"></div>
                    <ToolButton
                        active={activeTool === 'region'}
                        onClick={() => onToolChange('region')}
                        icon={<SquareIcon className="w-4 h-4" />}
                        title="Rectángulo"
                    />
                    <ToolButton
                        active={activeTool === 'polygon'}
                        onClick={() => onToolChange('polygon')}
                        icon={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a2 2 0 110 4h-1a1 1 0 00-1 1v3a2 2 0 11-4 0v-1a1 1 0 00-1-1H7a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3z" />
                            </svg>
                        }
                        title="Polígono"
                    />
                </div>
            </div>

            {/* Global Instructions & Ref Image */}
            <div className="px-4 py-2 border-b border-theme-bg-tertiary space-y-3">
                {/* General Instructions */}
                <div>
                    <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1 block">Instrucciones Generales</label>
                    <textarea
                        value={generalInstructions}
                        onChange={(e) => onGeneralInstructionsChange(e.target.value)}
                        placeholder="Ej: Estilo realista, iluminación suave..."
                        className="w-full h-16 bg-theme-bg-primary text-xs text-theme-text-primary p-2 rounded border border-theme-bg-tertiary focus:border-theme-accent-primary outline-none resize-none placeholder:text-theme-text-tertiary"
                    />
                </div>

                {/* Global Reference Image */}
                <div>
                    <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1 flex justify-between">
                        Ref. Visual Global
                        {referenceImage && <button onClick={() => onReferenceImageChange(null)} className="text-red-400 hover:text-red-300">Borrar</button>}
                    </label>

                    {referenceImage ? (
                        <div className="relative h-24 w-full rounded border border-theme-bg-tertiary overflow-hidden group">
                            <img src={referenceImage} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-full h-16 bg-theme-bg-primary border border-dashed border-theme-bg-tertiary rounded hover:border-theme-text-secondary cursor-pointer transition-colors">
                            <UploadIcon className="w-5 h-5 text-theme-text-secondary mb-1" />
                            <span className="text-[9px] text-theme-text-tertiary">Subir imagen de estilo</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => onReferenceImageChange(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </label>
                    )}
                </div>
            </div>

            {/* Contextual Settings (Brush) */}
            {activeTool === 'pen' && (
                <div className="p-4 border-b border-theme-bg-tertiary bg-theme-bg-tertiary/50">
                    <h3 className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider mb-3">Ajustes de Lápiz</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] text-theme-text-secondary mb-1">
                                <span>Tamaño</span>
                                <span>{brushSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="1" max="50"
                                value={brushSize}
                                onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
                                className="w-full h-1 bg-theme-bg-hover rounded-lg appearance-none cursor-pointer accent-theme-accent-primary"
                            />
                        </div>
                        <div>
                            <div className="text-[10px] text-theme-text-secondary mb-1">Color</div>
                            <div className="flex gap-2">
                                {['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => onBrushColorChange(c)}
                                        className={`w-6 h-6 rounded-full border-2 ${brushColor === c ? 'border-theme-text-primary scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Regions List */}
            <div className="flex-grow overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">Regiones Activas</label>
                    <span className="bg-theme-bg-tertiary text-xs px-1.5 rounded text-theme-text-secondary">{regions.length}</span>
                </div>

                <div className="space-y-3">
                    {regions.length === 0 ? (
                        <div className="text-center py-8 opacity-30 text-xs text-theme-text-primary">
                            <SquareIcon className="w-8 h-8 mx-auto mb-2" />
                            No hay regiones definidas.
                            <br />Usa la herramienta Región en la barra lateral.
                        </div>
                    ) : (
                        regions.map(region => (
                            <div key={region.id} className="bg-theme-bg-primary rounded p-2 border border-theme-bg-tertiary group hover:border-theme-bg-hover transition-colors">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">R{region.regionNumber}</span>
                                        <span className="text-[10px] text-theme-text-secondary uppercase">{region.type === 'polygon' ? 'Polígono' : 'Rectángulo'}</span>
                                    </div>
                                    <button
                                        onClick={() => onDeleteRegion(region.id)}
                                        className="text-theme-text-secondary hover:text-red-400 p-1 rounded transition-colors"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>

                                <textarea
                                    value={region.prompt}
                                    onChange={(e) => onUpdateRegionPrompt(region.id, e.target.value)}
                                    placeholder="¿Qué debe haber aquí?"
                                    className="w-full bg-theme-bg-secondary text-xs text-theme-text-primary p-2 rounded border border-transparent focus:border-theme-accent-primary outline-none resize-none h-16 placeholder:text-theme-text-tertiary mb-2"
                                />

                                {/* Region Reference Image Upload */}
                                <div className="flex items-center gap-2">
                                    {region.referenceImage ? (
                                        <div className="relative group/img">
                                            <img src={region.referenceImage} alt="Ref" className="w-10 h-10 object-cover rounded border border-theme-bg-tertiary" />
                                            <button
                                                onClick={() => onUpdateRegionImage(region.id, null)}
                                                className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center w-10 h-10 bg-theme-bg-secondary border border-dashed border-theme-bg-tertiary rounded hover:border-theme-text-secondary cursor-pointer transition-colors" title="Subir imagen de referencia">
                                            <svg className="w-4 h-4 text-theme-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            onUpdateRegionImage(region.id, reader.result as string);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                    <span className="text-[10px] text-theme-text-secondary italic">
                                        {region.referenceImage ? "Imagen cargada" : "Añadir ref visual (opcional)"}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* AI Structured Prompt Editor (Advanced) */}
            <div className="p-4 border-t border-theme-bg-tertiary bg-theme-bg-secondary space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-theme-accent-primary uppercase tracking-wider">Prompt Estructurado (AI)</label>
                    {isPromptModified && (
                        <button
                            onClick={onResetStructuredPrompt}
                            className="text-[9px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                        >
                            <UndoIcon className="w-2.5 h-2.5" />
                            Reset Auto
                        </button>
                    )}
                </div>
                <div className="relative group/prompt">
                    <textarea
                        value={structuredPrompt}
                        onChange={(e) => onStructuredPromptChange(e.target.value)}
                        placeholder="El prompt estructurado se generará aquí..."
                        className={`w-full h-40 bg-theme-bg-primary text-[10px] font-mono p-2 rounded border transition-colors outline-none resize-none leading-relaxed ${isPromptModified ? 'border-theme-accent-primary/50 text-theme-accent-primary' : 'border-theme-bg-tertiary text-theme-text-secondary'}`}
                    />
                    {!isPromptModified && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover/prompt:opacity-100 transition-opacity pointer-events-none">
                            <span className="bg-theme-bg-tertiary text-[8px] px-1 py-0.5 rounded border border-theme-bg-hover text-theme-text-secondary">Auto-Generado</span>
                        </div>
                    )}
                </div>
                <p className="text-[8px] text-theme-text-tertiary italic leading-tight">
                    {isPromptModified
                        ? "Has editado manualmente el prompt. Se usará exactamente este texto."
                        : "Este es el objeto que se envía a Gemini. Haz clic para personalizar."}
                </p>
            </div>

            {/* Footer Action Button */}
            <div className="p-4 border-t border-theme-bg-tertiary bg-theme-bg-secondary">
                <button
                    onClick={onProcessChanges}
                    disabled={isGenerating}
                    className="w-full py-3 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                    {isGenerating ? "Procesando..." : (
                        <>
                            <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            Hacer Cambios
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, title: string }> = ({ active, onClick, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        className={`flex-1 aspect-square rounded flex items-center justify-center transition-all ${active
            ? 'bg-theme-accent-primary text-white shadow-md'
            : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text-primary'
            }`}
    >
        {icon}
    </button>
);
