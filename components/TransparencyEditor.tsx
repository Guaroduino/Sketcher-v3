import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { LibraryImage, RgbColor, Point, ScaleUnit } from '../types';
import { ZoomInIcon, ZoomOutIcon, HandIcon, CrosshairIcon, UndoIcon, XIcon, EraserIcon, RedoIcon, RefreshCwIcon, HistoryIcon } from './icons';
import { getCanvasPoint, hexToRgb, rgbToHex } from '../utils/canvasUtils';

interface TransparencyEditorProps {
    item: (LibraryImage & { originalDataUrl: string }) | null;
    onApply: (newImageDataUrl: string, colors: RgbColor[], scaleFactor: number, tolerance: number, scaleUnit: ScaleUnit) => void;
    onCancel: () => void;
}

type Tool = 'picker' | 'eraser' | 'pan';
type HistoryState = { colors: RgbColor[]; eraserMaskData: ImageData | null };

export const TransparencyEditor: React.FC<TransparencyEditorProps> = ({ item, onApply, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const originalCanvasRef = useRef<HTMLCanvasElement>(null);
    const colorMaskCanvasRef = useRef<HTMLCanvasElement>(null);
    const eraserMaskCanvasRef = useRef<HTMLCanvasElement>(null);
    const transparentCanvasRef = useRef<HTMLCanvasElement>(null);

    const [activeTool, setActiveTool] = useState<Tool>('picker');
    const [viewTransform, setViewTransform] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const [tolerance, setTolerance] = useState(30);
    const [eraserSettings, setEraserSettings] = useState({ size: 50 });
    const [scaleFactor, setScaleFactor] = useState(5); // Always in px/mm
    const [scaleUnit, setScaleUnit] = useState<ScaleUnit>('mm');
    const [scaleInputValue, setScaleInputValue] = useState('5');
    const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const dragState = useRef<{ isPanning: boolean; isErasing: boolean; lastPoint: Point | null; }>({ isPanning: false, isErasing: false, lastPoint: null });

    const currentHistoryState = useMemo(() => history[historyIndex], [history, historyIndex]);
    const currentColors = useMemo(() => currentHistoryState?.colors ?? [], [currentHistoryState]);
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    const unitMultipliers = useMemo(() => ({ mm: 1, cm: 10, m: 1000 }), []);

    const recordChange = useCallback((newState: HistoryState) => {
        const newHistory = history.slice(0, historyIndex + 1);
        setHistory([...newHistory, newState]);
        setHistoryIndex(newHistory.length);
    }, [history, historyIndex]);

    useEffect(() => {
        if (item) {
            const initialScaleFactor = item.scaleFactor || 5;
            const initialScaleUnit = item.scaleUnit || 'mm';
            setScaleFactor(initialScaleFactor);
            setScaleUnit(initialScaleUnit);
            setScaleInputValue(String(Number((initialScaleFactor * unitMultipliers[initialScaleUnit]).toFixed(2))));
            setTolerance(item.tolerance !== undefined ? item.tolerance : 30);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                setImageElement(img);
            };
            img.src = item.originalDataUrl;
        } else {
            setImageElement(null);
            setHistory([]);
            setHistoryIndex(-1);
            setViewTransform({ zoom: 1, pan: { x: 0, y: 0 } });
        }
    }, [item, unitMultipliers]);

    const redraw = useCallback(() => {
        if (!transparentCanvasRef.current || !previewCanvasRef.current) return;

        const transparentCanvas = transparentCanvasRef.current;
        const previewCanvas = previewCanvasRef.current;
        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) return;

        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.save();
        previewCtx.translate(viewTransform.pan.x, viewTransform.pan.y);
        previewCtx.scale(viewTransform.zoom, viewTransform.zoom);

        if (transparentCanvas.width > 0) {
            previewCtx.imageSmoothingEnabled = viewTransform.zoom < 3;
            previewCtx.drawImage(transparentCanvas, 0, 0);
        }

        previewCtx.restore();

        // --- Draw Scale Bar ---
        previewCtx.save();
        const barScreenY = previewCanvas.height - 30;
        const barScreenX = 20;

        const targetScreenLength = 100;
        const mmPerScreenPixel = 1 / (scaleFactor * viewTransform.zoom);
        const targetMmLength = targetScreenLength * mmPerScreenPixel;

        const niceMmSteps = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
        let bestStepMm = niceMmSteps[0];
        for (const step of niceMmSteps) {
            if (step > targetMmLength) {
                break;
            }
            bestStepMm = step;
        }

        const finalScreenLength = bestStepMm * scaleFactor * viewTransform.zoom;

        let label = `${bestStepMm}mm`;
        if (bestStepMm >= 1000) {
            label = `${bestStepMm / 1000}m`;
        } else if (bestStepMm >= 10) {
            label = `${bestStepMm / 10}cm`;
        }

        // Background for readability
        previewCtx.font = '12px sans-serif';
        const textMetrics = previewCtx.measureText(label);
        const textWidth = textMetrics.width;
        const bgWidth = Math.max(finalScreenLength, textWidth) + 16;
        const bgX = barScreenX - 8;
        const bgY = barScreenY - 18;
        previewCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        previewCtx.fillRect(bgX, bgY, bgWidth, 24);

        // Bar
        previewCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        previewCtx.lineWidth = 1.5;
        previewCtx.beginPath();
        previewCtx.moveTo(barScreenX, barScreenY - 5);
        previewCtx.lineTo(barScreenX, barScreenY);
        previewCtx.lineTo(barScreenX + finalScreenLength, barScreenY);
        previewCtx.lineTo(barScreenX + finalScreenLength, barScreenY - 5);
        previewCtx.stroke();

        // Label
        previewCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        previewCtx.textAlign = 'center';
        previewCtx.fillText(label, barScreenX + finalScreenLength / 2, barScreenY - 8);

        previewCtx.restore();

    }, [viewTransform, scaleFactor]);

    const composeTransparentImage = useCallback(() => {
        const originalCanvas = originalCanvasRef.current;
        const colorMaskCanvas = colorMaskCanvasRef.current;
        const eraserMaskCanvas = eraserMaskCanvasRef.current;
        const transparentCanvas = transparentCanvasRef.current;
        if (!originalCanvas || !colorMaskCanvas || !eraserMaskCanvas || !transparentCanvas) return;
        const transparentCtx = transparentCanvas.getContext('2d');
        if (!transparentCtx) return;

        transparentCtx.clearRect(0, 0, transparentCanvas.width, transparentCanvas.height);
        transparentCtx.drawImage(originalCanvas, 0, 0);
        transparentCtx.globalCompositeOperation = 'destination-in';
        transparentCtx.drawImage(colorMaskCanvas, 0, 0);
        transparentCtx.globalCompositeOperation = 'destination-out';
        transparentCtx.drawImage(eraserMaskCanvas, 0, 0);
        transparentCtx.globalCompositeOperation = 'source-over';

        redraw();
    }, [redraw]);

    // This single effect now handles updating ALL masks and composing the final image.
    // This fixes the race condition between color mask and eraser mask updates.
    useEffect(() => {
        if (!currentHistoryState || !imageElement) return;

        const originalCtx = originalCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        const colorMaskCtx = colorMaskCanvasRef.current?.getContext('2d');
        const eraserCtx = eraserMaskCanvasRef.current?.getContext('2d');

        if (!originalCtx || !colorMaskCtx || !eraserCtx) return;

        const { width, height } = imageElement;
        const { colors, eraserMaskData } = currentHistoryState;

        // 1. Update eraser mask canvas from history
        if (eraserMaskData) {
            eraserCtx.putImageData(eraserMaskData, 0, 0);
        } else {
            eraserCtx.clearRect(0, 0, width, height);
        }

        // 2. Update color mask canvas from history
        const originalData = originalCtx.getImageData(0, 0, width, height).data;
        const maskImageData = colorMaskCtx.createImageData(width, height);
        const maskData = maskImageData.data;
        const toleranceSq = (tolerance / 100 * 255) ** 2 * 3;

        for (let i = 0; i < originalData.length; i += 4) {
            let isTransparent = false;
            if (colors.length > 0) {
                const r = originalData[i];
                const g = originalData[i + 1];
                const b = originalData[i + 2];

                for (const color of colors) {
                    const distSq = (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2;
                    if (distSq <= toleranceSq) {
                        isTransparent = true;
                        break;
                    }
                }
            }
            maskData[i] = 255; maskData[i + 1] = 255; maskData[i + 2] = 255;
            maskData[i + 3] = isTransparent ? 0 : 255;
        }
        colorMaskCtx.putImageData(maskImageData, 0, 0);

        // 3. Compose the final image now that both masks are up-to-date
        composeTransparentImage();

    }, [currentHistoryState, tolerance, imageElement, composeTransparentImage]);


    useEffect(() => {
        if (!imageElement || !originalCanvasRef.current || !eraserMaskCanvasRef.current || !transparentCanvasRef.current) return;

        const { width, height } = imageElement;
        [originalCanvasRef.current, eraserMaskCanvasRef.current, transparentCanvasRef.current, colorMaskCanvasRef.current].forEach(canvas => {
            if (canvas) {
                canvas.width = width;
                canvas.height = height;
            }
        });

        originalCanvasRef.current.getContext('2d')?.drawImage(imageElement, 0, 0);

        const eraserCtx = eraserMaskCanvasRef.current.getContext('2d');
        if (!eraserCtx) return;
        eraserCtx.clearRect(0, 0, width, height);
        const initialEraserMaskData = eraserCtx.getImageData(0, 0, width, height);

        setHistory([{
            colors: item?.transparentColors || [],
            eraserMaskData: initialEraserMaskData
        }]);
        setHistoryIndex(0);

    }, [imageElement, item]);


    useEffect(() => {
        if (imageElement && containerRef.current && historyIndex === 0) { // Only center on initial load
            const viewWidth = containerRef.current.offsetWidth;
            const viewHeight = containerRef.current.offsetHeight;
            const padding = 0.9;
            const scaleX = viewWidth / imageElement.width;
            const scaleY = viewHeight / imageElement.height;
            const newZoom = Math.min(scaleX, scaleY) * padding;
            const newPanX = (viewWidth - imageElement.width * newZoom) / 2;
            const newPanY = (viewHeight - imageElement.height * newZoom) / 2;
            setViewTransform({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
        }
    }, [imageElement, historyIndex]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (containerRef.current && previewCanvasRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                previewCanvasRef.current.width = width;
                previewCanvasRef.current.height = height;
                redraw();
            }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [redraw]);

    useEffect(redraw, [redraw]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // FIX: The original check (e.button !== 0) prevented middle-click panning. 
        // This is updated to allow both left-click (0) and middle-click (1) to proceed.
        if (e.button !== 0 && e.button !== 1) return;
        if (!currentHistoryState) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const point = getCanvasPoint(e.nativeEvent, viewTransform, previewCanvasRef.current!);
        dragState.current.lastPoint = point;

        if (activeTool === 'pan' || e.button === 1) {
            dragState.current.isPanning = true;
        } else if (activeTool === 'picker' && originalCanvasRef.current) {
            const ctx = originalCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx && point.x >= 0 && point.x < originalCanvasRef.current.width && point.y >= 0 && point.y < originalCanvasRef.current.height) {
                const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
                const newColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
                if (!currentColors.some(c => c.r === newColor.r && c.g === newColor.g && c.b === newColor.b)) {
                    recordChange({
                        colors: [...currentColors, newColor],
                        eraserMaskData: currentHistoryState.eraserMaskData,
                    });
                }
            }
        } else if (activeTool === 'eraser' && eraserMaskCanvasRef.current) {
            dragState.current.isErasing = true;
            const eraserMaskCtx = eraserMaskCanvasRef.current.getContext('2d');
            if (eraserMaskCtx) {
                eraserMaskCtx.fillStyle = 'black';
                eraserMaskCtx.beginPath();
                eraserMaskCtx.arc(point.x, point.y, eraserSettings.size / 2, 0, Math.PI * 2);
                eraserMaskCtx.fill();
                composeTransparentImage();
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const point = getCanvasPoint(e.nativeEvent, viewTransform, previewCanvasRef.current!);
        const { isPanning, isErasing, lastPoint } = dragState.current;

        if (isPanning) {
            setViewTransform(v => ({ ...v, pan: { x: v.pan.x + e.movementX, y: v.pan.y + e.movementY } }));
        } else if (isErasing && lastPoint && eraserMaskCanvasRef.current) {
            const eraserMaskCtx = eraserMaskCanvasRef.current.getContext('2d');
            if (eraserMaskCtx) {
                eraserMaskCtx.fillStyle = 'black';
                eraserMaskCtx.strokeStyle = 'black';
                eraserMaskCtx.lineWidth = eraserSettings.size;
                eraserMaskCtx.lineCap = 'round';
                eraserMaskCtx.lineJoin = 'round';
                eraserMaskCtx.beginPath();
                eraserMaskCtx.moveTo(lastPoint.x, lastPoint.y);
                eraserMaskCtx.lineTo(point.x, point.y);
                eraserMaskCtx.stroke();
                composeTransparentImage();
            }
        }
        dragState.current.lastPoint = point;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (dragState.current.isErasing) {
            const eraserCtx = eraserMaskCanvasRef.current?.getContext('2d');
            if (eraserCtx && currentHistoryState) {
                const newEraserData = eraserCtx.getImageData(0, 0, eraserCtx.canvas.width, eraserCtx.canvas.height);
                recordChange({
                    colors: currentColors,
                    eraserMaskData: newEraserData,
                });
            }
        }
        dragState.current = { isPanning: false, isErasing: false, lastPoint: null };
    };

    const handleApply = () => {
        if (transparentCanvasRef.current) {
            onApply(transparentCanvasRef.current.toDataURL(), currentColors, scaleFactor, tolerance, scaleUnit);
        }
    };

    const handleUndo = () => canUndo && setHistoryIndex(i => i - 1);
    const handleRedo = () => canRedo && setHistoryIndex(i => i + 1);
    const handleReset = () => (history.length > 0) && setHistoryIndex(0);

    const handleFullReset = () => {
        // This is a destructive action that clears history to a fully opaque state.
        if (!imageElement || !eraserMaskCanvasRef.current) return;

        const eraserCtx = eraserMaskCanvasRef.current.getContext('2d');
        if (!eraserCtx) return;

        const { width, height } = imageElement;
        eraserCtx.clearRect(0, 0, width, height);
        const initialEraserMaskData = eraserCtx.getImageData(0, 0, width, height);

        setHistory([{
            colors: [], // No transparent colors
            eraserMaskData: initialEraserMaskData
        }]);
        setHistoryIndex(0);
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUnit = e.target.value as ScaleUnit;
        const currentPxPerMm = scaleFactor;
        setScaleUnit(newUnit);
        setScaleInputValue(String(Number((currentPxPerMm * unitMultipliers[newUnit]).toFixed(2))));
    };

    const handleScaleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setScaleInputValue(value);
        const numericValue = parseFloat(value);
        if (!isNaN(numericValue) && numericValue > 0) {
            setScaleFactor(numericValue / unitMultipliers[scaleUnit]);
        }
    };

    if (!item) return null;

    const toolButtonClasses = (tool: Tool) => `p-2 rounded-md transition-colors ${activeTool === tool ? 'bg-[--accent-primary] text-white' : 'bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]'}`;

    return (
        <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4">
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-[--bg-tertiary]">
                    <h2 className="text-lg font-bold">Editar Transparencia: {item.name}</h2>
                    <div className="flex items-center gap-4">
                        <button onClick={handleApply} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white font-semibold">Aplicar</button>
                        <button onClick={onCancel} className="p-2 rounded-full hover:bg-[--bg-tertiary]"><XIcon className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex-grow flex min-h-0">
                    <div className="w-64 flex-shrink-0 bg-[--bg-primary] p-4 flex flex-col gap-4 border-r border-[--bg-tertiary] overflow-y-auto">
                        <div>
                            <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Herramientas</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => setActiveTool('picker')} className={toolButtonClasses('picker')} title="Cuentagotas"><CrosshairIcon className="w-5 h-5" /></button>
                                <button onClick={() => setActiveTool('eraser')} className={toolButtonClasses('eraser')} title="Borrador"><EraserIcon className="w-5 h-5" /></button>
                                <button onClick={() => setActiveTool('pan')} className={toolButtonClasses('pan')} title="Mover"><HandIcon className="w-5 h-5" /></button>
                                <button onClick={() => setViewTransform(v => ({ ...v, zoom: v.zoom * 1.2 }))} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Acercar"><ZoomInIcon className="w-5 h-5" /></button>
                                <button onClick={() => setViewTransform(v => ({ ...v, zoom: v.zoom / 1.2 }))} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Alejar"><ZoomOutIcon className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Historial</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Deshacer"><UndoIcon className="w-5 h-5" /></button>
                                <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Rehacer"><RedoIcon className="w-5 h-5" /></button>
                                <button onClick={handleReset} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Volver al inicio de sesión"><HistoryIcon className="w-5 h-5" /></button>
                            </div>
                            <button onClick={handleFullReset} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors text-xs font-bold uppercase" title="Eliminar toda transparencia y cambios">
                                <RefreshCwIcon className="w-4 h-4" />
                                Restaurar Original
                            </button>
                        </div>

                        {activeTool === 'eraser' && (
                            <div>
                                <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Ajustes del Borrador</h3>
                                <div>
                                    <label htmlFor="eraser-size" className="text-xs text-[--text-secondary]">Tamaño: {eraserSettings.size}</label>
                                    <input
                                        type="range" id="eraser-size" min="1" max="200" step="1"
                                        value={eraserSettings.size}
                                        onChange={(e) => setEraserSettings(s => ({ ...s, size: parseInt(e.target.value, 10) }))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Selección de Color</h3>
                            <div>
                                <label htmlFor="tolerance" className="text-xs text-[--text-secondary]">Tolerancia: {tolerance}</label>
                                <input
                                    type="range" id="tolerance" min="0" max="100" step="1"
                                    value={tolerance}
                                    onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-bold uppercase text-[--text-secondary]">Colores Transparentes</h3>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                                {currentColors.map((color, index) => (
                                    <div key={index} className="flex items-center justify-between p-1 rounded bg-[--bg-tertiary]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: rgbToHex(color.r, color.g, color.b) }} />
                                            <span className="text-xs font-mono">{rgbToHex(color.r, color.g, color.b)}</span>
                                        </div>
                                        <button onClick={() => {
                                            if (!currentHistoryState) return;
                                            const newColors = currentColors.filter((_, i) => i !== index);
                                            recordChange({
                                                colors: newColors,
                                                eraserMaskData: currentHistoryState.eraserMaskData,
                                            });
                                        }} className="p-1 rounded-full text-xs text-gray-400 hover:bg-red-500 hover:text-white">✕</button>
                                    </div>
                                ))}
                                {currentColors.length === 0 && <p className="text-xs text-center text-[--text-secondary] py-2">Usa el cuentagotas para añadir colores.</p>}
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-[--bg-tertiary]">
                            <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-2">Propiedades</h3>
                            <div>
                                <label className="text-xs text-[--text-secondary]">Factor de Escala</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm">1</span>
                                    <select
                                        value={scaleUnit}
                                        onChange={handleUnitChange}
                                        className="bg-[--bg-tertiary] text-sm rounded-md p-1 border border-[--bg-hover]"
                                    >
                                        <option value="mm">mm</option>
                                        <option value="cm">cm</option>
                                        <option value="m">m</option>
                                    </select>
                                    <span className="text-sm">=</span>
                                    <input
                                        type="number"
                                        value={scaleInputValue}
                                        onChange={handleScaleInputChange}
                                        className="w-20 bg-[--bg-secondary] text-sm rounded-md p-1 border border-[--bg-tertiary]"
                                    />
                                    <span className="text-sm">px</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        ref={containerRef}
                        className="flex-grow bg-gray-500"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{
                            cursor: activeTool === 'pan' ? (dragState.current.isPanning ? 'grabbing' : 'grab') : 'crosshair',
                            backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                        }}
                    >
                        <canvas ref={previewCanvasRef} className="w-full h-full" />
                        <canvas ref={originalCanvasRef} className="hidden" />
                        <canvas ref={colorMaskCanvasRef} className="hidden" />
                        <canvas ref={eraserMaskCanvasRef} className="hidden" />
                        <canvas ref={transparentCanvasRef} className="hidden" />
                    </div>
                </div>
            </div>
        </div>
    );
};
