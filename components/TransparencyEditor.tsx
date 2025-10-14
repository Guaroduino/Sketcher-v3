
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { LibraryItem, RgbColor, Point } from '../types';
import { ZoomInIcon, ZoomOutIcon, HandIcon, CrosshairIcon, BrushIcon, EraserIcon, UndoIcon } from './icons';

interface TransparencyEditorProps {
  item: LibraryItem & { originalDataUrl: string };
  onCancel: () => void;
  onApply: (newImageDataUrl: string, colors: RgbColor[]) => void;
}

type EditorTool = 'picker' | 'pan' | 'eraser' | 'restorer';
type PreviewBg = 'checker' | 'green' | 'blue';

export const TransparencyEditor: React.FC<TransparencyEditorProps> = ({ item, onCancel, onApply }) => {
  const [transparentColors, setTransparentColors] = useState<RgbColor[]>([]);
  const [tolerance, setTolerance] = useState<number>(20);
  const [brushSize, setBrushSize] = useState<number>(40);
  
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [viewTransform, setViewTransform] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const panState = useRef({ isPanning: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });
  const drawState = useRef({ isDrawing: false, lastPoint: null as Point | null });
  
  const [activeTool, setActiveTool] = useState<EditorTool>('picker');
  const [previewBg, setPreviewBg] = useState<PreviewBg>('checker');

  const historyRef = useRef<{ stack: ImageData[], index: number }>({ stack: [], index: -1 });
  const [canUndo, setCanUndo] = useState(false);
  const isInitialized = useRef(false);

  const sourceDataUrl = item.originalDataUrl;

  const updatePreview = useCallback(() => {
    const previewCtx = previewCanvasRef.current?.getContext('2d');
    const sourceCanvas = sourceCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCtx || !sourceCanvas || !maskCanvas) return;

    previewCtx.save();
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCtx.canvas.width, previewCtx.canvas.height);
    
    previewCtx.drawImage(sourceCanvas, 0, 0);
    
    previewCtx.globalCompositeOperation = 'destination-in';
    previewCtx.drawImage(maskCanvas, 0, 0);
    
    previewCtx.restore();
  }, []);

  const saveMaskState = useCallback(() => {
    const maskCtx = maskCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const { stack, index } = historyRef.current;
    const imageData = maskCtx.getImageData(0, 0, maskCtx.canvas.width, maskCtx.canvas.height);

    const newStack = stack.slice(0, index + 1);
    newStack.push(imageData);

    if (newStack.length > 30) {
        newStack.shift();
    }
    
    historyRef.current.stack = newStack;
    historyRef.current.index = newStack.length - 1;
    
    setCanUndo(historyRef.current.index > 0);
  }, []);

  const handleUndo = () => {
    const { stack, index } = historyRef.current;
    if (index <= 0) return;

    const newIndex = index - 1;
    const imageData = stack[newIndex];
    
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    if (maskCtx) {
        maskCtx.putImageData(imageData, 0, 0);
        updatePreview();
    }
    
    historyRef.current.index = newIndex;
    setCanUndo(newIndex > 0);
  };

  // Effect to initialize canvases
  useEffect(() => {
    if (!sourceDataUrl) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      
      sourceCanvasRef.current = document.createElement('canvas');
      sourceCanvasRef.current.width = width;
      sourceCanvasRef.current.height = height;
      const sourceCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
      sourceCtx?.drawImage(image, 0, 0);
      
      maskCanvasRef.current = document.createElement('canvas');
      maskCanvasRef.current.width = width;
      maskCanvasRef.current.height = height;
      
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        previewCanvas.width = width;
        previewCanvas.height = height;
        
        // Zoom to extents logic
        const container = previewCanvas.parentElement;
        if (container) {
          const viewWidth = container.offsetWidth;
          const viewHeight = container.offsetHeight;
          const padding = 0.9;
          
          if (width > 0 && height > 0) {
            const scaleX = viewWidth / width;
            const scaleY = viewHeight / height;
            const newZoom = Math.min(scaleX, scaleY) * padding;
            const newPanX = (viewWidth - width * newZoom) / 2;
            const newPanY = (viewHeight - height * newZoom) / 2;
            setViewTransform({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
          }
        }
      }
      
      isInitialized.current = true;
      historyRef.current = { stack: [], index: -1 };
      setCanUndo(false);
      setTransparentColors(item.transparentColors || []);
    };
    image.src = sourceDataUrl;

    return () => {
        isInitialized.current = false;
        // Reset zoom when closing
        setViewTransform({ zoom: 1, pan: { x: 0, y: 0 } });
    }
  }, [sourceDataUrl, item.transparentColors]);

  // Effect to re-process mask from colors/tolerance and save history
  useEffect(() => {
    if (!isInitialized.current) return;
    
    const sourceCtx = sourceCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    const maskCtx = maskCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx || !maskCtx) return;

    const { width, height } = sourceCtx.canvas;
    
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, width, height);

    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const maskImageData = maskCtx.getImageData(0, 0, width, height);
    const maskData = maskImageData.data;
    const toleranceSq = tolerance * tolerance;

    for (let i = 0; i < data.length; i += 4) {
         if (data[i + 3] === 0) {
            maskData[i+3] = 0;
            continue;
         }
         const r = data[i], g = data[i+1], b = data[i+2];
         for (const color of transparentColors) {
             const distSq = (r - color.r)**2 + (g - color.g)**2 + (b - color.b)**2;
             if (distSq <= toleranceSq) {
                 maskData[i+3] = 0;
                 break;
             }
         }
    }
    maskCtx.putImageData(maskImageData, 0, 0);
    
    saveMaskState();
    updatePreview();

  }, [transparentColors, tolerance, updatePreview, saveMaskState]);

  const getPointOnCanvas = useCallback((e: { clientX: number, clientY: number }): Point | null => {
    const container = previewCanvasRef.current?.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();

    const viewX = e.clientX - rect.left;
    const viewY = e.clientY - rect.top;

    const canvasX = (viewX - viewTransform.pan.x) / viewTransform.zoom;
    const canvasY = (viewY - viewTransform.pan.y) / viewTransform.zoom;
    
    return { x: canvasX, y: canvasY };
  }, [viewTransform.pan, viewTransform.zoom]);

  const handleColorPick = (point: Point) => {
    const sourceCtx = sourceCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) return;

    const pixel = sourceCtx.getImageData(point.x, point.y, 1, 1).data;
    if (pixel[3] === 0) return;
    
    const newColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
    if (!transparentColors.some(c => c.r === newColor.r && c.g === newColor.g && c.b === newColor.b)) {
        setTransparentColors(prev => [...prev, newColor]);
    }
  };

  const drawOnMask = (p1: Point, p2: Point, tool: 'eraser' | 'restorer') => {
      const maskCtx = maskCanvasRef.current?.getContext('2d');
      if (!maskCtx) return;

      maskCtx.save();
      maskCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      maskCtx.strokeStyle = 'white';
      maskCtx.fillStyle = 'white';
      maskCtx.lineWidth = brushSize;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      
      if (p1.x === p2.x && p1.y === p2.y) {
        maskCtx.beginPath();
        maskCtx.arc(p1.x, p1.y, brushSize / 2, 0, Math.PI * 2);
        maskCtx.fill();
      } else {
        maskCtx.beginPath();
        maskCtx.moveTo(p1.x, p1.y);
        maskCtx.lineTo(p2.x, p2.y);
        maskCtx.stroke();
      }
      maskCtx.restore();
      updatePreview();
  };

  const handleApply = () => {
    if (!previewCanvasRef.current) return;
    onApply(previewCanvasRef.current.toDataURL(), transparentColors);
  };
  
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // This is the key fix, mirroring the main canvas's pointer handling.
    // Some browsers fire a pointerdown event with pressure 0 when a stylus hovers,
    // which we need to ignore to prevent unintentionally starting a stroke.
    if (e.pointerType === 'pen' && e.pressure === 0) return;

    const point = getPointOnCanvas(e);
    if (!point) return;

    if (activeTool === 'pan') {
        panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, startPan: viewTransform.pan };
        return;
    }
    
    if (activeTool === 'picker') {
        handleColorPick(point);
    }
    
    if (activeTool === 'eraser' || activeTool === 'restorer') {
        saveMaskState();
        drawState.current = { isDrawing: true, lastPoint: point };
        drawOnMask(point, point, activeTool);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panState.current.isPanning) {
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        setViewTransform(prev => ({ ...prev, pan: { x: panState.current.startPan.x + dx, y: panState.current.startPan.y + dy } }));
        return;
    }
    
    if (drawState.current.isDrawing && (activeTool === 'eraser' || activeTool === 'restorer')) {
        const events: PointerEvent[] = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
        
        for (const event of events) {
            const point = getPointOnCanvas(event);
            if (!point) continue;

            if (drawState.current.lastPoint) {
                drawOnMask(drawState.current.lastPoint, point, activeTool);
            }
            drawState.current.lastPoint = point;
        }
    }
  };

  const handlePointerUp = () => {
    panState.current.isPanning = false;
    drawState.current = { isDrawing: false, lastPoint: null };
  };
  
  const zoomBy = (factor: number, clientX?: number, clientY?: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const pointerViewX = clientX ? clientX - rect.left : rect.width / 2;
    const pointerViewY = clientY ? clientY - rect.top : rect.height / 2;
    
    setViewTransform(current => {
      const newZoom = current.zoom * factor;
      const pointerCanvasX = (pointerViewX - current.pan.x) / current.zoom;
      const pointerCanvasY = (pointerViewY - current.pan.y) / current.zoom;
      const newPanX = pointerViewX - pointerCanvasX * newZoom;
      const newPanY = pointerViewY - pointerCanvasY * newZoom;
      return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
  };
  
  const canvasStyle: React.CSSProperties = {
    transform: `translate(${viewTransform.pan.x}px, ${viewTransform.pan.y}px) scale(${viewTransform.zoom})`,
    transformOrigin: 'top left',
    willChange: 'transform',
    imageRendering: 'pixelated',
  };
  
  const bgClasses = {
    checker: "bg-[--bg-primary] [background-image:linear-gradient(45deg,#808080_25%,transparent_25%),linear-gradient(-45deg,#808080_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#808080_75%),linear-gradient(-45deg,transparent_75%,#808080_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]",
    green: "bg-green-500",
    blue: "bg-blue-500",
  };

  const containerCursor = activeTool === 'pan' ? (panState.current.isPanning ? 'grabbing' : 'grab') : 'crosshair';

  const toolButtonClasses = (toolName: EditorTool) => `p-2 rounded-md transition-colors ${activeTool === toolName ? 'bg-[--accent-hover] text-white' : 'bg-[--bg-tertiary] hover:bg-[--bg-hover]'}`;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4 flex-shrink-0">Editor de Transparencia</h2>
        
        <div 
          className={`relative flex-grow rounded-md flex justify-center items-center min-h-0 overflow-hidden ${bgClasses[previewBg]}`}
          style={{ cursor: containerCursor }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <canvas ref={previewCanvasRef} className="absolute top-0 left-0" style={canvasStyle} />
        </div>
        
        <div className="flex-shrink-0 pt-4 space-y-4">
          <div className="bg-[--bg-primary] p-2 rounded-lg flex items-center flex-wrap gap-6 text-xs">
            {/* Herramientas */}
            <div className="flex items-center gap-2">
                <button onClick={() => setActiveTool('picker')} className={toolButtonClasses('picker')} title="Cuentagotas"><CrosshairIcon className="w-5 h-5" /></button>
                <button onClick={() => setActiveTool('pan')} className={toolButtonClasses('pan')} title="Mover"><HandIcon className="w-5 h-5" /></button>
                <button onClick={() => setActiveTool('eraser')} className={toolButtonClasses('eraser')} title="Goma"><EraserIcon className="w-5 h-5" /></button>
                <button onClick={() => setActiveTool('restorer')} className={toolButtonClasses('restorer')} title="Restaurador"><BrushIcon className="w-5 h-5" /></button>
            </div>

            {/* Zoom & Undo */}
            <div className="flex items-center gap-2">
                <button onClick={() => zoomBy(1.2)} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
                <button onClick={() => zoomBy(1 / 1.2)} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
                <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Deshacer"><UndoIcon className="w-5 h-5" /></button>
            </div>

            {/* Fondo */}
            <div className="flex items-center gap-2">
                <span className="font-bold text-[--text-secondary]">Fondo:</span>
                <button onClick={() => setPreviewBg('checker')} className={`w-6 h-6 rounded border-2 ${previewBg === 'checker' ? 'border-[--accent-primary]' : 'border-transparent'} bg-white [background-image:linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%)] [background-size:10px_10px]`}></button>
                <button onClick={() => setPreviewBg('green')} className={`w-6 h-6 rounded border-2 ${previewBg === 'green' ? 'border-white' : 'border-transparent'} bg-green-500`}></button>
                <button onClick={() => setPreviewBg('blue')} className={`w-6 h-6 rounded border-2 ${previewBg === 'blue' ? 'border-white' : 'border-transparent'} bg-blue-500`}></button>
            </div>
            
            {/* Sensibilidad / Tamaño */}
            <div className="flex items-center gap-2 w-48">
              {['eraser', 'restorer'].includes(activeTool) ? (
                <>
                  <label htmlFor="brushSize" className="font-bold text-[--text-secondary] flex-shrink-0">Tamaño: {brushSize}</label>
                  <input type="range" id="brushSize" min="1" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full" />
                </>
              ) : (
                <>
                  <label htmlFor="tolerance" className="font-bold text-[--text-secondary] flex-shrink-0">Sensibilidad: {tolerance}</label>
                  <input type="range" id="tolerance" min="0" max="100" value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value, 10))} className="w-full" />
                </>
              )}
            </div>

             {/* Colores */}
             <div className="flex items-center gap-2">
                <span className="font-bold text-[--text-secondary]">Colores Transparentes:</span>
                 <div className="flex flex-wrap gap-1 bg-[--bg-tertiary] p-1 rounded-md">
                    {transparentColors.map((color, index) => (
                        <div key={index}
                            onClick={() => setTransparentColors(prev => prev.filter((_, i) => i !== index))}
                            className="w-6 h-6 rounded-md border-2 border-gray-500 cursor-pointer relative group"
                            style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                            title={`RGB(${color.r}, ${color.g}, ${color.b}) - Click para eliminar`}
                        >
                            <div className="absolute inset-0 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-75 transition-opacity text-lg">&times;</div>
                        </div>
                    ))}
                    {transparentColors.length === 0 && <div className="w-6 h-6 rounded-md bg-transparent" />}
                </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4 pt-6 flex-shrink-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cancelar</button>
          <button onClick={handleApply} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white">Aplicar Cambios</button>
        </div>
      </div>
    </div>
  );
};
