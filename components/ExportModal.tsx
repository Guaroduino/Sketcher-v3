import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SketchObject, CropRect } from '../types';
import { getContentBoundingBox } from '../utils/canvasUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawableObjects: SketchObject[];
  canvasSize: { width: number, height: number };
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  drawableObjects,
  canvasSize,
}) => {
  const [includeBackground, setIncludeBackground] = useState(true);
  const [filename, setFilename] = useState('mi-boceto.png');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportMode, setExportMode] = useState<'full' | 'bbox'>('full');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const backgroundObject = drawableObjects.find(o => o.isBackground);
  const isBackgroundVisible = backgroundObject?.isVisible ?? false;
  
  const getCombinedBbox = useCallback((objectsToScan: SketchObject[]): CropRect | null => {
    let combinedBbox: CropRect | null = null;
    objectsToScan.forEach(obj => {
        if (!obj.canvas) return;
        const bbox = getContentBoundingBox(obj.canvas);
        if (bbox) {
            if (!combinedBbox) {
                combinedBbox = { ...bbox };
            } else {
                const newX1 = Math.min(combinedBbox.x, bbox.x);
                const newY1 = Math.min(combinedBbox.y, bbox.y);
                const newX2 = Math.max(combinedBbox.x + combinedBbox.width, bbox.x + bbox.width);
                const newY2 = Math.max(combinedBbox.y + combinedBbox.height, bbox.y + bbox.height);
                combinedBbox = { x: newX1, y: newY1, width: newX2 - newX1, height: newY2 - newY1 };
            }
        }
    });
    return combinedBbox;
  }, []);

  const generateCompositeImage = useCallback(async (includeBg: boolean, mode: 'full' | 'bbox') => {
    if (!previewCanvasRef.current || canvasSize.width === 0) return null;
    const previewCanvas = previewCanvasRef.current;
    
    // Create a temporary canvas with the full composition
    const fullCompositeCanvas = document.createElement('canvas');
    fullCompositeCanvas.width = canvasSize.width;
    fullCompositeCanvas.height = canvasSize.height;
    const fullCtx = fullCompositeCanvas.getContext('2d');
    if (!fullCtx) return null;

    fullCtx.clearRect(0, 0, fullCompositeCanvas.width, fullCompositeCanvas.height);
    
    // 1. Draw background if included and is visible
    if (includeBg && backgroundObject && backgroundObject.canvas && backgroundObject.isVisible) {
        fullCtx.drawImage(backgroundObject.canvas, 0, 0);
    }

    // 2. Draw layers
    const visibleObjects = drawableObjects.filter(item => !item.isBackground && item.isVisible && item.canvas);
    for (const item of [...visibleObjects].reverse()) {
        fullCtx.globalAlpha = item.opacity;
        fullCtx.drawImage(item.canvas, 0, 0);
        fullCtx.globalAlpha = 1.0;
    }
    
    if (mode === 'full') {
        previewCanvas.width = canvasSize.width;
        previewCanvas.height = canvasSize.height;
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx?.drawImage(fullCompositeCanvas, 0, 0);
        return previewCanvas;
    }

    // --- Bbox Mode ---
    const combinedBbox = getCombinedBbox(visibleObjects);

    if (!combinedBbox) { // No content found
        previewCanvas.width = 1;
        previewCanvas.height = 1;
        previewCanvas.getContext('2d')?.clearRect(0, 0, 1, 1);
        return previewCanvas;
    }

    previewCanvas.width = combinedBbox.width;
    previewCanvas.height = combinedBbox.height;
    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return null;

    previewCtx.drawImage(
        fullCompositeCanvas,
        combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height,
        0, 0, combinedBbox.width, combinedBbox.height
    );
    return previewCanvas;

  }, [canvasSize, drawableObjects, backgroundObject, getCombinedBbox]);
  
  useEffect(() => {
    if (isOpen) {
        setIncludeBackground(isBackgroundVisible);
        setExportMode('full'); // Reset to default on open
    }
  }, [isOpen, isBackgroundVisible]);

  // Effect to update preview
  useEffect(() => {
    if (!isOpen) return;
    setIsGenerating(true);
    generateCompositeImage(includeBackground, exportMode).then(canvas => {
      if (canvas) {
        setPreviewUrl(canvas.toDataURL('image/png'));
      }
      setIsGenerating(false);
    });
  }, [isOpen, includeBackground, exportMode, generateCompositeImage]);

  const handleExport = async () => {
    setIsGenerating(true);
    const canvas = await generateCompositeImage(includeBackground, exportMode);
    if (!canvas) {
        alert("Error al generar la imagen.");
        setIsGenerating(false);
        return;
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      } else {
        alert("Error al crear el archivo de imagen.");
      }
      setIsGenerating(false);
    }, 'image/png');
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-2xl flex flex-col space-y-4">
        <h2 className="text-xl font-bold">Exportar Imagen</h2>
        
        {/* Preview Area */}
        <div className="flex-grow p-2 rounded-md flex justify-center items-center min-h-0 bg-[--bg-primary]"
          style={{
            minHeight: '20rem',
            backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        >
          {isGenerating && <p>Generando vista previa...</p>}
          {!isGenerating && previewUrl && (
            <img src={previewUrl} alt="Vista previa de la exportación" className="max-w-full max-h-80 object-contain" />
          )}
          <canvas ref={previewCanvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label htmlFor="filename" className="block text-sm text-[--text-secondary] mb-1">Nombre del Archivo</label>
            <input
              type="text"
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full bg-[--bg-tertiary] text-[--text-primary] text-sm rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm text-[--text-secondary] mb-2">Tamaño de Exportación</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input type="radio" name="exportMode" value="full" checked={exportMode === 'full'} onChange={() => setExportMode('full')} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] focus:ring-[--accent-primary]"/>
                <span className="ml-2 text-sm">Tamaño completo del lienzo</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="exportMode" value="bbox" checked={exportMode === 'bbox'} onChange={() => setExportMode('bbox')} className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] focus:ring-[--accent-primary]"/>
                <span className="ml-2 text-sm">Ajustar a contenido</span>
              </label>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeBackground"
              checked={includeBackground}
              onChange={(e) => setIncludeBackground(e.target.checked)}
              disabled={!isBackgroundVisible}
              className="w-4 h-4 text-[--accent-primary] bg-[--bg-tertiary] border-[--bg-hover] rounded focus:ring-[--accent-primary] disabled:opacity-50"
            />
            <label htmlFor="includeBackground" className={`ml-2 text-sm ${!isBackgroundVisible ? 'text-[--text-secondary] opacity-50' : 'text-[--text-primary]'}`}>
              Incluir fondo
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]" disabled={isGenerating}>
            Cancelar
          </button>
          <button onClick={handleExport} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white disabled:bg-gray-500 disabled:cursor-wait" disabled={isGenerating}>
            {isGenerating ? 'Exportando...' : 'Exportar como PNG'}
          </button>
        </div>
      </div>
    </div>
  );
};