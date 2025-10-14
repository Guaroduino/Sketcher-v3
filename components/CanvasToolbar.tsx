import React, { useState, useEffect, useRef } from 'react';
import type { Tool, Guide, Point, OrthogonalGuide, TransformState, GridGuide, GridType } from '../types';
import { HandIcon, ZoomInIcon, ZoomOutIcon, CrosshairIcon, UndoIcon, RedoIcon, TrashIcon, CheckIcon, XIcon, ImageSquareIcon, LockIcon, LockOpenIcon, GridIcon, SnapIcon, ExpandIcon, MinimizeIcon, IsometricIcon } from './icons';

interface CanvasToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  onSetActiveGuide: (guide: 'perspective' | 'ruler' | 'mirror') => void;
  onSetGridType: (type: GridType) => void;
  isSnapToGridEnabled: boolean;
  onToggleSnapToGrid: () => void;
  isOrthogonalVisible: boolean;
  onZoomExtents: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isCropping: boolean;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  isTransforming: boolean;
  transformState: TransformState | null;
  onApplyTransform: () => void;
  onCancelTransform: () => void;
  isAspectRatioLocked: boolean;
  onSetAspectRatioLocked: React.Dispatch<React.SetStateAction<boolean>>;
  activeGuide: Guide;
  perspectiveMatchState: { enabled: boolean; points: Point[] } | null;
  onStartPerspectiveMatch: () => void;
  onCancelPerspectiveMatch: () => void;
  orthogonalGuide: OrthogonalGuide | null;
  onSetOrthogonalAngle: (angle: number) => void;
  gridGuide: GridGuide | null;
  onSetGridSpacing: (spacing: number) => void;
  onSetGridMajorLineFrequency: (frequency: number) => void;
  onSetGridIsoAngle: (angle: number) => void;
  areGuidesLocked: boolean;
  onSetAreGuidesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  isPerspectiveStrokeLockEnabled: boolean;
  onSetIsPerspectiveStrokeLockEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  tool,
  setTool,
  onSetActiveGuide,
  onSetGridType,
  isSnapToGridEnabled,
  onToggleSnapToGrid,
  isOrthogonalVisible,
  onZoomExtents,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  onClearAll,
  canUndo,
  canRedo,
  isCropping,
  onApplyCrop,
  onCancelCrop,
  isTransforming,
  transformState,
  onApplyTransform,
  onCancelTransform,
  isAspectRatioLocked,
  onSetAspectRatioLocked,
  activeGuide,
  perspectiveMatchState,
  onStartPerspectiveMatch,
  onCancelPerspectiveMatch,
  orthogonalGuide,
  onSetOrthogonalAngle,
  gridGuide,
  onSetGridSpacing,
  onSetGridMajorLineFrequency,
  onSetGridIsoAngle,
  areGuidesLocked,
  onSetAreGuidesLocked,
  isPerspectiveStrokeLockEnabled,
  onSetIsPerspectiveStrokeLockEnabled,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [customAngle, setCustomAngle] = useState('');
  const [gridSpacing, setGridSpacing] = useState('50');
  const [majorLineFrequency, setMajorLineFrequency] = useState('5');
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const gridButtonRef = useRef<HTMLButtonElement>(null);


  useEffect(() => {
    if (gridGuide) {
        setGridSpacing(String(gridGuide.spacing));
        setMajorLineFrequency(String(gridGuide.majorLineFrequency));
    }
  }, [gridGuide]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            gridSettingsRef.current && !gridSettingsRef.current.contains(event.target as Node) &&
            gridButtonRef.current && !gridButtonRef.current.contains(event.target as Node)
        ) {
            setIsGridSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toolButtonClasses = (t: Tool) =>
    `p-2 rounded-md transition-colors ${
      tool === t ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'
    }`;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[--bg-primary]/80 backdrop-blur-sm rounded-lg p-1 flex items-center gap-1 shadow-lg z-10">
      {/* Main action buttons for crop/transform */}
      {(isCropping || isTransforming) && (
        <>
          <button onClick={isCropping ? onCancelCrop : onCancelTransform} className="p-2 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors" title="Cancelar">
            <XIcon className="w-5 h-5" />
          </button>
          <button onClick={isCropping ? onApplyCrop : onApplyTransform} className="p-2 rounded-md bg-green-600 text-white hover:bg-green-500 transition-colors" title="Aplicar">
            <CheckIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-[--bg-hover] mx-1" />
        </>
      )}

      {/* Transform specific controls */}
      {isTransforming && transformState?.type === 'affine' && (
          <button onClick={() => onSetAspectRatioLocked(p => !p)} className={`p-2 rounded-md transition-colors ${ isAspectRatioLocked ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`} title={isAspectRatioLocked ? "Desbloquear relación de aspecto" : "Bloquear relación de aspecto"}>
              {isAspectRatioLocked ? <LockIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
          </button>
      )}

      {/* Normal view buttons */}
      {!isCropping && !isTransforming && (
        <>
          {/* Tool buttons */}
          <button onClick={() => setTool('pan')} className={toolButtonClasses('pan')} title="Mover (Arrastrar)">
            <HandIcon className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-[--bg-hover] mx-1" />
          
          {/* Zoom buttons */}
          <button onClick={onZoomOut} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Alejar">
            <ZoomOutIcon className="w-5 h-5" />
          </button>
          <button onClick={onZoomIn} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Acercar">
            <ZoomInIcon className="w-5 h-5" />
          </button>
          <button onClick={onZoomExtents} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Ajustar a la vista">
            <CrosshairIcon className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-[--bg-hover] mx-1" />

          {/* History buttons */}
          <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Deshacer">
            <UndoIcon className="w-5 h-5" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Rehacer">
            <RedoIcon className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-[--bg-hover] mx-1" />

          {/* Guide Lock */}
          <button onClick={() => onSetAreGuidesLocked(p => !p)} className={`p-2 rounded-md transition-colors ${areGuidesLocked ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`} title={areGuidesLocked ? "Desbloquear Guías" : "Bloquear Guías"}>
              {areGuidesLocked ? <LockIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
          </button>

          {/* Grid Settings */}
          <div className="relative">
            <button
                ref={gridButtonRef}
                onClick={() => setIsGridSettingsOpen(p => !p)}
                className={`p-2 rounded-md transition-colors ${gridGuide && gridGuide.type !== 'none' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`}
                title="Ajustes de la Retícula"
            >
                <GridIcon className="w-5 h-5" />
            </button>
            {isGridSettingsOpen && gridGuide && (
                <div ref={gridSettingsRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg p-3 space-y-3 z-20">
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => onSetGridType('none')} className={`text-xs p-2 rounded ${gridGuide.type === 'none' ? 'bg-red-500 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Apagado</button>
                        <button onClick={() => onSetGridType('cartesian')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'cartesian' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}><GridIcon className="w-4 h-4" /> Cartesiana</button>
                        <button onClick={() => onSetGridType('isometric')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'isometric' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}><IsometricIcon className="w-4 h-4" /> Isométrica</button>
                    </div>

                    {gridGuide.type !== 'none' && (
                      <>
                        <div className="border-t border-[--bg-tertiary] my-2" />
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-[--text-secondary] flex items-center gap-1"><SnapIcon className="w-4 h-4" />Ajustar a la Retícula</label>
                            <button
                                role="switch"
                                aria-checked={isSnapToGridEnabled}
                                onClick={onToggleSnapToGrid}
                                className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${isSnapToGridEnabled ? 'bg-[--accent-primary]' : 'bg-[--bg-tertiary]'}`}
                            >
                                <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${isSnapToGridEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                            <label htmlFor="grid-spacing" className="text-xs text-[--text-secondary]">Espaciado: {gridSpacing}px</label>
                            <input
                                type="range"
                                id="grid-spacing"
                                min="10" max="200" step="5"
                                value={gridSpacing}
                                onChange={(e) => {
                                    setGridSpacing(e.target.value);
                                    onSetGridSpacing(parseInt(e.target.value));
                                }}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="major-line-freq" className="text-xs text-[--text-secondary]">Línea principal cada: {majorLineFrequency}</label>
                            <input
                                type="range"
                                id="major-line-freq"
                                min="2" max="10" step="1"
                                value={majorLineFrequency}
                                onChange={(e) => {
                                    setMajorLineFrequency(e.target.value);
                                    onSetGridMajorLineFrequency(parseInt(e.target.value));
                                }}
                                className="w-full"
                            />
                        </div>
                        {gridGuide.type === 'isometric' && (
                            <div>
                                <label className="text-xs text-[--text-secondary]">Ángulo</label>
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    <button onClick={() => onSetGridIsoAngle(30)} className={`text-xs p-2 rounded ${gridGuide.isoAngle === 30 ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>30°</button>
                                    <button onClick={() => onSetGridIsoAngle(45)} className={`text-xs p-2 rounded ${gridGuide.isoAngle === 45 ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>45°</button>
                                    <button onClick={() => onSetGridIsoAngle(60)} className={`text-xs p-2 rounded ${gridGuide.isoAngle === 60 ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>60°</button>
                                </div>
                            </div>
                        )}
                      </>
                    )}
                </div>
            )}
          </div>

          {/* Other buttons */}
          <button onClick={onClearAll} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Limpiar Lienzo">
            <TrashIcon className="w-5 h-5" />
          </button>
          <button onClick={onToggleFullscreen} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title={isFullscreen ? "Salir de Pantalla Completa" : "Entrar en Pantalla Completa"}>
            {isFullscreen ? <MinimizeIcon className="w-5 h-5" /> : <ExpandIcon className="w-5 h-5" />}
          </button>
        </>
      )}
    </div>
  );
};
