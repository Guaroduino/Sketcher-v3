import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SketchObject } from '../types';
import { getContentBoundingBox } from '../utils/canvasUtils';
import { UploadIcon } from './icons';

interface SingleObjectExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SketchObject | null;
  canvasSize: { width: number, height: number };
  onSaveToLibrary: (imageDataUrl: string, name: string) => void;
}

type ExportMode = 'full' | 'bbox';

export const SingleObjectExportModal: React.FC<SingleObjectExportModalProps> = ({
  isOpen,
  onClose,
  item,
  canvasSize,
  onSaveToLibrary,
}) => {
  const [exportMode, setExportMode] = useState<ExportMode>('full');
  const [filename, setFilename] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (item?.name) {
      setFilename(item.name.endsWith('.png') ? item.name : `${item.name}.png`);
    } else {
      setFilename('objeto.png');
    }
  }, [item]);

  const generateItemImage = useCallback(async (mode: ExportMode) => {
    if (!item || !item.canvas || !previewCanvasRef.current) return null;

    const sourceCanvas = item.canvas;
    const previewCanvas = previewCanvasRef.current;
    
    if (mode === 'full') {
        previewCanvas.width = canvasSize.width;
        previewCanvas.height = canvasSize.height;
        const ctx = previewCanvas.getContext('2d');
        if (!ctx) return null;
        
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.globalAlpha = item.opacity;
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
        
    } else { // 'bbox' mode
        const bbox = getContentBoundingBox(sourceCanvas);
        if (!bbox) {
            previewCanvas.width = 1;
            previewCanvas.height = 1;
            const ctx = previewCanvas.getContext('2d');
            ctx?.clearRect(0,0,1,1);
        } else {
            previewCanvas.width = bbox.width;
            previewCanvas.height = bbox.height;
            const ctx = previewCanvas.getContext('2d');
            if (!ctx) return null;

            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.globalAlpha = item.opacity;
            ctx.drawImage(
                sourceCanvas,
                bbox.x, bbox.y, bbox.width, bbox.height,
                0, 0, bbox.width, bbox.height
            );
            ctx.globalAlpha = 1.0;
        }
    }
    return previewCanvas;

  }, [item, canvasSize]);
  
  useEffect(() => {
    if (!isOpen || !item) return;
    setIsGenerating(true);
    generateItemImage(exportMode).then(canvas => {
      if (canvas) {
        setPreviewUrl(canvas.toDataURL('image/png'));
      }
      setIsGenerating(false);
    });
  }, [isOpen, item, exportMode, generateItemImage]);

  const handleExport = async () => {
    setIsGenerating(true);
    const canvas = await generateItemImage(exportMode);
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
  
  const handleSaveToLibrary = async () => {
    setIsGenerating(true);
    const canvas = await generateItemImage(exportMode);
    if (!canvas) {
        alert("Error al generar la imagen.");
        setIsGenerating(false);
        return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    onSaveToLibrary(dataUrl, filename);
    setIsGenerating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-2xl flex flex-col space-y-4">
        <h2 className="text-xl font-bold">Exportar Objeto: "{item?.name}"</h2>
        
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
        </div>

        <div className="flex justify-end space-x-4 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]" disabled={isGenerating}>
            Cancelar
          </button>
          <button onClick={handleSaveToLibrary} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-500 disabled:cursor-wait flex items-center gap-2" disabled={isGenerating}>
            <UploadIcon className="w-4 h-4" />
            {isGenerating ? 'Guardando...' : 'Guardar en Librería'}
          </button>
          <button onClick={handleExport} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white disabled:bg-gray-500 disabled:cursor-wait" disabled={isGenerating}>
            {isGenerating ? 'Exportando...' : 'Exportar como PNG'}
          </button>
        </div>
      </div>
    </div>
  );
};