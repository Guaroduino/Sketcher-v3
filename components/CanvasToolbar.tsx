import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Tool, Guide, TransformState, GridGuide, GridType, ScaleUnit, StrokeMode, OrthogonalGuide } from '../types';
import { HandIcon, ZoomInIcon, ZoomOutIcon, UndoIcon, RedoIcon, TrashIcon, CheckIcon, XIcon, GridIcon, SnapIcon, IsometricIcon, MaximizeIcon, PerspectiveIcon, UploadIcon, PasteIcon, CubeIcon } from './icons';

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
  isAngleSnapEnabled: boolean;
  onToggleAngleSnap: () => void;
  angleSnapValue: 1 | 5 | 10 | 15;
  onSetAngleSnapValue: (value: 1 | 5 | 10 | 15) => void;
  activeGuide: Guide;
  orthogonalGuide: OrthogonalGuide | null;
  onSetOrthogonalAngle: (angle: number) => void;
  gridGuide: GridGuide | null;
  onSetGridSpacing: (spacing: number) => void;
  onSetGridMajorLineFrequency: (frequency: number) => void;
  onSetGridIsoAngle: (angle: number) => void;
  onSetGridMajorLineColor: (color: string) => void;
  onSetGridMinorLineColor: (color: string) => void;
  areGuidesLocked: boolean;
  onSetAreGuidesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  isPerspectiveStrokeLockEnabled: boolean;
  onSetIsPerspectiveStrokeLockEnabled: (value: React.SetStateAction<boolean>) => void;
  onResetPerspective: () => void;
  scaleFactor: number;
  scaleUnit: ScaleUnit;
  onPaste: () => void;
  onImport?: () => void;
  hasClipboardContent: boolean;
  strokeSmoothing: number;
  setStrokeSmoothing: (value: number) => void;
  strokeMode: StrokeMode;
  isSolidBox: boolean;
  setIsSolidBox: (v: boolean) => void;
  zoomLevel: number;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = React.memo(({
  tool, setTool, onSetActiveGuide, onSetGridType, isSnapToGridEnabled, onToggleSnapToGrid, onZoomExtents, onZoomIn, onZoomOut, onUndo, onRedo, onClearAll, canUndo, canRedo, isCropping, onApplyCrop, onCancelCrop, isTransforming, onApplyTransform, onCancelTransform, onSetAreGuidesLocked,
  onResetPerspective,
  scaleFactor,
  scaleUnit,
  onPaste,
  onImport,
  hasClipboardContent,
  gridGuide, onSetGridSpacing,
  activeGuide, isPerspectiveStrokeLockEnabled, onSetIsPerspectiveStrokeLockEnabled,
  strokeMode, isSolidBox, setIsSolidBox, zoomLevel,
  isAngleSnapEnabled, onToggleAngleSnap, angleSnapValue
}) => {
  const [gridSpacing, setGridSpacing] = useState('50');
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const gridButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (gridGuide) {
      setGridSpacing(String(gridGuide.spacing));
    }
  }, [gridGuide]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gridSettingsRef.current && !gridSettingsRef.current.contains(event.target as Node) && gridButtonRef.current && !gridButtonRef.current.contains(event.target as Node)) {
        setIsGridSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toolButtonClasses = (t: Tool) => `p-2 rounded-md transition-colors ${tool === t ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary text-theme-text-primary hover:bg-theme-bg-hover'}`;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[95vw]">

      {/* Grid Settings Menu */}
      {isGridSettingsOpen && gridGuide && (
        <div ref={gridSettingsRef} onClick={(e) => e.stopPropagation()} className="mb-2 w-72 bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-lg p-3 space-y-3 z-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text-primary">Configuración de Cuadrícula</h3>
            <button onClick={() => setIsGridSettingsOpen(false)}><XIcon className="w-4 h-4 text-theme-text-tertiary" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onSetGridType('none')} className={`text-xs p-2 rounded ${gridGuide.type === 'none' ? 'bg-red-500 text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}>Apagado</button>
            <button onClick={() => onSetGridType('cartesian')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'cartesian' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}><GridIcon className="w-4 h-4" /> Cartesiana</button>
            <button onClick={() => onSetGridType('isometric')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'isometric' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-hover'}`}><IsometricIcon className="w-4 h-4" /> Isométrica</button>
          </div>
          <div className="border-t border-theme-bg-tertiary my-2" />
          <div className="space-y-1">
            <label className="text-xs text-theme-text-secondary">Espaciado ({scaleUnit})</label>
            <input type="range" min="10" max="200" step="5" value={gridSpacing} onChange={(e) => { setGridSpacing(e.target.value); onSetGridSpacing(parseInt(e.target.value)); }} className="w-full" />
          </div>
        </div>
      )}

      {/* Main Toolbar Container */}
      <div className="bg-theme-bg-primary/95 backdrop-blur-md rounded-xl p-1.5 flex items-center gap-2 shadow-2xl border border-theme-bg-tertiary overflow-x-auto scrollbar-hide max-w-full">

        {/* === Buttons === */}
        {(isCropping || isTransforming) ? (
          <>
            {isTransforming && (
              <>
                <button
                  onClick={onToggleAngleSnap}
                  className={`p-2 rounded-md transition-colors ${isAngleSnapEnabled ? 'bg-theme-accent-primary text-white' : 'text-theme-text-secondary hover:bg-theme-bg-hover'}`}
                  title={`Ajuste de Ángulo (${angleSnapValue}°)`}
                >
                  <SnapIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={onToggleSnapToGrid}
                  className={`p-2 rounded-md transition-colors ${isSnapToGridEnabled ? 'bg-theme-accent-primary text-white' : 'text-theme-text-secondary hover:bg-theme-bg-hover'}`}
                  title="Ajustar a Cuadrícula"
                  disabled={!gridGuide || gridGuide.type === 'none'}
                >
                  <GridIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary mx-1" />
              </>
            )}
            <button onClick={isCropping ? onCancelCrop : onCancelTransform} className="p-2 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors" title="Cancelar">
              <XIcon className="w-5 h-5" />
            </button>
            <button onClick={isCropping ? onApplyCrop : onApplyTransform} className="p-2 rounded-md bg-green-600 text-white hover:bg-green-500 transition-colors" title="Aplicar">
              <CheckIcon className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            {/* 1. Undo / Redo / Paste */}
            <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover disabled:opacity-30" title="Deshacer"><UndoIcon className="w-5 h-5" /></button>
            <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover disabled:opacity-30" title="Rehacer"><RedoIcon className="w-5 h-5" /></button>
            {hasClipboardContent && (
              <button onClick={onPaste} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover" title="Pegar">
                <PasteIcon className="w-5 h-5" />
              </button>
            )}
            <div className="w-px h-6 bg-theme-bg-tertiary" />

            {/* 2. Zoom */}
            <button onClick={onZoomIn} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover" title="Acercar"><ZoomInIcon className="w-5 h-5" /></button>
            <div className="px-2 text-xs font-mono font-bold text-theme-text-secondary select-none min-w-[3rem] text-center" title="Nivel de Zoom">{Math.round(zoomLevel * 100)}%</div>
            <button onClick={onZoomOut} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover" title="Alejar"><ZoomOutIcon className="w-5 h-5" /></button>
            <div className="w-px h-6 bg-theme-bg-tertiary" />

            {/* 3. Navigation (Pan & Extents) */}
            <button onClick={() => setTool('pan')} className={toolButtonClasses('pan')} title="Mover">
              <HandIcon className="w-5 h-5" />
            </button>
            <button onClick={onZoomExtents} className="p-2 rounded-md text-theme-text-secondary hover:bg-theme-bg-hover" title="Ajustar a Pantalla"><MaximizeIcon className="w-5 h-5" /></button>
            <div className="w-px h-6 bg-theme-bg-tertiary" />

            {/* 4. Grid & Snap */}
            <div className="relative">
              <button ref={gridButtonRef} onClick={() => setIsGridSettingsOpen(p => !p)} className={`p-2 rounded-md transition-colors ${gridGuide && gridGuide.type !== 'none' ? 'text-theme-accent-primary' : 'text-theme-text-secondary hover:bg-theme-bg-hover'}`} title="Configuración de Cuadrícula">
                <GridIcon className="w-5 h-5" />
              </button>
            </div>
            <button onClick={onToggleSnapToGrid} disabled={!gridGuide || gridGuide.type === 'none'} className={`p-2 rounded-md transition-colors ${isSnapToGridEnabled ? 'bg-theme-accent-primary text-white' : 'text-theme-text-secondary hover:bg-theme-bg-hover'}`} title="Ajustar a Cuadrícula">
              <SnapIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSetIsPerspectiveStrokeLockEnabled(p => !p)}
              disabled={activeGuide !== 'perspective'}
              className={`p-2 rounded-md transition-colors ${isPerspectiveStrokeLockEnabled ? 'bg-theme-accent-primary text-white' : 'text-theme-text-secondary hover:bg-theme-bg-hover'} disabled:opacity-30`}
              title="Ajustar a Perspectiva"
            >
              <PerspectiveIcon className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-theme-bg-tertiary" />

            {/* 3D Box Toggle - Only visible when in Parallelepiped mode */}
            {strokeMode === 'parallelepiped' && (
              <>
                <button
                  onClick={() => setIsSolidBox(!isSolidBox)}
                  className={`p-2 rounded-md transition-colors ${isSolidBox ? 'bg-theme-accent-primary text-white' : 'text-theme-text-secondary hover:bg-theme-bg-hover'}`}
                  title={isSolidBox ? "Mostrar líneas traseras" : "Ocultar líneas traseras"}
                >
                  <CubeIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-theme-bg-tertiary" />
              </>
            )}

            {/* 5. Clear & Import */}
            <div className="flex items-center gap-1">
              <button onClick={onImport} className="p-2 rounded-md text-theme-accent-primary hover:bg-theme-bg-hover" title="Importar Imagen/Fondo"><UploadIcon className="w-5 h-5" /></button>
              <button onClick={onClearAll} className="p-2 rounded-md text-theme-text-secondary hover:text-red-500 hover:bg-theme-bg-hover" title="Limpiar Todo"><TrashIcon className="w-5 h-5" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
