import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Tool, Guide, Point, OrthogonalGuide, TransformState, GridGuide, GridType, ScaleUnit } from '../types';
import { HandIcon, ZoomInIcon, ZoomOutIcon, CrosshairIcon, UndoIcon, RedoIcon, TrashIcon, CheckIcon, XIcon, LockIcon, LockOpenIcon, GridIcon, SnapIcon, IsometricIcon, PasteIcon } from './icons';

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
  onSetIsPerspectiveStrokeLockEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  scaleFactor: number;
  scaleUnit: ScaleUnit;
  onPaste: () => void;
  hasClipboardContent: boolean;
  strokeSmoothing: number;
  setStrokeSmoothing: (value: number) => void;
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
  isAngleSnapEnabled,
  onToggleAngleSnap,
  angleSnapValue,
  onSetAngleSnapValue,
  activeGuide,
  orthogonalGuide,
  onSetOrthogonalAngle,
  gridGuide,
  onSetGridSpacing,
  onSetGridMajorLineFrequency,
  onSetGridIsoAngle,
  onSetGridMajorLineColor,
  onSetGridMinorLineColor,
  areGuidesLocked,
  onSetAreGuidesLocked,
  isPerspectiveStrokeLockEnabled,
  onSetIsPerspectiveStrokeLockEnabled,
  scaleFactor,
  scaleUnit,
  onPaste,
  hasClipboardContent,
  strokeSmoothing,
  setStrokeSmoothing,
}) => {
  const [customAngle, setCustomAngle] = useState('');
  const [gridSpacing, setGridSpacing] = useState('50');
  const [majorLineFrequency, setMajorLineFrequency] = useState('5');
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const gridButtonRef = useRef<HTMLButtonElement>(null);

  const majorLineColors = [
    { name: 'Gris', value: 'rgba(128, 128, 128, 0.6)' },
    { name: 'Rojo', value: 'rgba(239, 68, 68, 0.6)' },
    { name: 'Verde', value: 'rgba(34, 197, 94, 0.6)' },
    { name: 'Azul', value: 'rgba(59, 130, 246, 0.6)' },
    { name: 'Negro', value: 'rgba(0, 0, 0, 0.6)' },
  ];

  const minorLineColors = [
    { name: 'Gris', value: 'rgba(128, 128, 128, 0.3)' },
    { name: 'Rojo', value: 'rgba(239, 68, 68, 0.3)' },
    { name: 'Verde', value: 'rgba(34, 197, 94, 0.3)' },
    { name: 'Azul', value: 'rgba(59, 130, 246, 0.3)' },
    { name: 'Negro', value: 'rgba(0, 0, 0, 0.3)' },
  ];

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

  const gridSpacingDisplay = useMemo(() => {
    if (!gridGuide || !scaleFactor) {
      return `${gridSpacing}px`;
    }

    const spacingInMm = parseInt(gridSpacing) / scaleFactor;
    let displayValue: string;

    switch (scaleUnit) {
      case 'cm':
        displayValue = (spacingInMm / 10).toFixed(1);
        break;
      case 'm':
        displayValue = (spacingInMm / 1000).toFixed(2);
        break;
      case 'mm':
      default:
        displayValue = spacingInMm.toFixed(1);
        break;
    }

    return `${gridSpacing}px (${displayValue}${scaleUnit})`;
  }, [gridSpacing, gridGuide, scaleFactor, scaleUnit]);

  const areAnyGuidesActive = useMemo(() => {
    return activeGuide !== 'none' || isOrthogonalVisible || (gridGuide && gridGuide.type !== 'none');
  }, [activeGuide, isOrthogonalVisible, gridGuide]);

  const toolButtonClasses = (t: Tool) =>
    `p-2 rounded-md transition-colors ${tool === t ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'
    }`;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[--bg-primary]/80 backdrop-blur-sm rounded-lg p-1 flex items-center gap-1 shadow-lg z-10 max-w-[95vw] overflow-x-auto scrollbar-hide">
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
        <>
          <button onClick={() => onSetAspectRatioLocked(p => !p)} className={`p-2 rounded-md transition-colors ${isAspectRatioLocked ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`} title={isAspectRatioLocked ? "Desbloquear relación de aspecto" : "Bloquear relación de aspecto"}>
            {isAspectRatioLocked ? <LockIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
          </button>
          <button onClick={onToggleAngleSnap} className={`p-2 rounded-md transition-colors ${isAngleSnapEnabled ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`} title="Activar anclaje de ángulo">
            <SnapIcon className="w-5 h-5" />
          </button>
          {isAngleSnapEnabled && (
            <>
              <div className="w-px h-6 bg-[--bg-hover] mx-1" />
              {[1, 5, 10, 15].map(val => (
                <button
                  key={val}
                  onClick={() => onSetAngleSnapValue(val as 1 | 5 | 10 | 15)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${angleSnapValue === val ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`}
                  title={`Anclar a ${val}°`}
                >
                  {val}°
                </button>
              ))}
            </>
          )}
        </>
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
          <button onClick={onPaste} disabled={!hasClipboardContent} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Pegar">
            <PasteIcon className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-[--bg-hover] mx-1" />

          {/* Stroke Smoothing Slider */}
          <div className="flex items-center gap-2 group" title={`Suavizado: ${Math.round(strokeSmoothing * 100)}%`}>
            <input
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              value={strokeSmoothing}
              onChange={(e) => setStrokeSmoothing(parseFloat(e.target.value))}
              className="w-24"
            />
          </div>

          <div className="w-px h-6 bg-[--bg-hover] mx-1" />

          {/* Guide Lock */}
          {areAnyGuidesActive && (
            <button onClick={() => onSetAreGuidesLocked(p => !p)} className={`p-2 rounded-md transition-colors ${areGuidesLocked ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`} title={areGuidesLocked ? "Desbloquear Guías" : "Bloquear Guías"}>
              {areGuidesLocked ? <LockIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
            </button>
          )}

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
              <div ref={gridSettingsRef} onClick={(e) => e.stopPropagation()} className="fixed bottom-20 left-1/2 -translate-x-1/2 mb-2 w-72 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg p-3 space-y-3 z-50">
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => onSetGridType('none')} className={`text-xs p-2 rounded ${gridGuide.type === 'none' ? 'bg-red-500 text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}>Apagado</button>
                  <button onClick={() => onSetGridType('cartesian')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'cartesian' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}><GridIcon className="w-4 h-4" /> Cartesiana</button>
                  <button onClick={() => onSetGridType('isometric')} className={`flex items-center justify-center gap-1 text-xs p-2 rounded ${gridGuide.type === 'isometric' ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`}><IsometricIcon className="w-4 h-4" /> Isométrica</button>
                </div>

                {gridGuide.type !== 'none' && (
                  <>
                    <div>
                      <label className="text-xs text-[--text-secondary]">Color de Línea Principal</label>
                      <div className="flex items-center gap-2 mt-1">
                        {majorLineColors.map(color => (
                          <button
                            key={color.name}
                            title={color.name}
                            onClick={() => onSetGridMajorLineColor(color.value)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${gridGuide.majorLineColor === color.value
                              ? 'border-[--accent-primary] ring-2 ring-offset-2 ring-offset-[--bg-primary] ring-[--accent-primary]'
                              : 'border-transparent hover:border-gray-400'
                              }`}
                            style={{ backgroundColor: color.value.replace(/, 0.6\)$/, ', 1)') }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[--text-secondary]">Color de Línea Fina</label>
                      <div className="flex items-center gap-2 mt-1">
                        {minorLineColors.map(color => (
                          <button
                            key={color.name}
                            title={color.name}
                            onClick={() => onSetGridMinorLineColor(color.value)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${gridGuide.minorLineColor === color.value
                              ? 'border-[--accent-primary] ring-2 ring-offset-2 ring-offset-[--bg-primary] ring-[--accent-primary]'
                              : 'border-transparent hover:border-gray-400'
                              }`}
                            style={{ backgroundColor: color.value.replace(/, 0.3\)$/, ', 1)') }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[--bg-tertiary] my-2" />
                    <div>
                      <label htmlFor="grid-spacing" className="text-xs text-[--text-secondary]">
                        Espaciado: {gridSpacingDisplay}
                      </label>
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
                        <label className="text-xs text-[--text-secondary]">Ángulo: 60°</label>
                        {/* The angle is now fixed to 60 degrees as requested */}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onToggleSnapToGrid}
            disabled={!gridGuide || gridGuide.type === 'none'}
            className={`p-2 rounded-md transition-colors ${isSnapToGridEnabled ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'} disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Ajustar a la Retícula"
          >
            <SnapIcon className="w-5 h-5" />
          </button>

          {activeGuide === 'perspective' && (
            <>
              <div className="w-px h-6 bg-[--bg-hover] mx-1" />
              <button
                onClick={() => onSetIsPerspectiveStrokeLockEnabled(p => !p)}
                className={`p-2 rounded-md transition-colors ${isPerspectiveStrokeLockEnabled ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`}
                title={isPerspectiveStrokeLockEnabled ? "Desactivar bloqueo de trazo a perspectiva" : "Activar bloqueo de trazo a perspectiva"}
              >
                <SnapIcon className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Other buttons */}
          <button onClick={onClearAll} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Limpiar Lienzo">
            <TrashIcon className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};