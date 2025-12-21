
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Region } from '../../services/visualPromptingService';

export interface LayeredCanvasRef {
    getDrawingDataUrl: () => string;
    clearDrawing: () => void;
    undo: () => void;
    redo: () => void;
}

interface LayeredCanvasProps {
    baseImage: string | null;
    width: number;
    height: number;
    activeTool: 'pen' | 'eraser' | 'region' | 'polygon' | 'pan';
    regions: Region[];
    brushSize: number;
    brushColor: string;
    zoom: number;
    pan: { x: number, y: number };
    onPanChange: (newPan: { x: number, y: number }) => void;
    onZoomChange: (newZoom: number) => void;
    onRegionCreated?: (max: { type: 'rectangle' | 'polygon', points?: { x: number, y: number }[], x: number, y: number, width: number, height: number }) => void;
}

export const LayeredCanvas = forwardRef<LayeredCanvasRef, LayeredCanvasProps>(({
    baseImage,
    width,
    height,
    activeTool,
    regions,
    brushSize,
    brushColor,
    zoom,
    pan,
    onPanChange,
    onZoomChange,
    onRegionCreated
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const tempCanvasRef = useRef<HTMLCanvasElement>(null); // For current stroke

    // History
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Interaction State
    const isDrawing = useRef(false);
    const isPanning = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Polygon State
    const [currentPolygonPoints, setCurrentPolygonPoints] = useState<{ x: number, y: number }[]>([]);

    // Initialize Canvas
    useEffect(() => {
        if (drawingCanvasRef.current && width && height) {
            const canvas = drawingCanvasRef.current;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                // Save initial blank state
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    setHistory([ctx.getImageData(0, 0, width, height)]);
                    setHistoryIndex(0);
                }
            }
        }
    }, [width, height]);


    useImperativeHandle(ref, () => ({
        getDrawingDataUrl: () => {
            // We need to render the current polygon if it's not finished? No, usually not.
            return drawingCanvasRef.current?.toDataURL('image/png') || '';
        },
        clearDrawing: () => {
            const ctx = drawingCanvasRef.current?.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, width, height);
                saveHistory();
            }
        },
        undo: () => {
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                restoreHistory(newIndex);
            }
        },
        redo: () => {
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                restoreHistory(newIndex);
            }
        }
    }));

    const saveHistory = () => {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        const data = ctx.getImageData(0, 0, width, height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(data);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const restoreHistory = (index: number) => {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx || !history[index]) return;
        ctx.putImageData(history[index], 0, 0);
    };


    // --- Event Handlers ---

    const getCanvasPoint = (e: React.PointerEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        return { x, y };
    };

    const handePointerDown = (e: React.PointerEvent) => {
        // e.preventDefault(); // Don't prevent default on pointerdown always, can block focus

        // Palm Rejection: If pen tool but touch, ignore (unless we implement sophisticated logic)
        // For now, assume mapped correctly.

        if (activeTool === 'pan' || e.button === 1 || (activeTool !== 'pan' && e.pointerType === 'touch' && !e.isPrimary)) {
            isPanning.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (activeTool === 'pen' || activeTool === 'eraser') {
            isDrawing.current = true;
            const { x, y } = getCanvasPoint(e);
            const ctx = drawingCanvasRef.current?.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
                ctx.lineWidth = brushSize / zoom; // Adjust size by zoom? Or keep constant? Usually constant relative to canvas.
                // Wait, brushSize should typically be relative to Canvas pixels.
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                if (activeTool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
                else ctx.globalCompositeOperation = 'source-over';
            }
        } else if (activeTool === 'region') {
            // Start Region Box
            isDrawing.current = true;
            lastPos.current = getCanvasPoint(e);
        } else if (activeTool === 'polygon') {
            const pt = getCanvasPoint(e);
            // Add point to current polygon
            setCurrentPolygonPoints(prev => [...prev, pt]);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        if (isPanning.current) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            onPanChange({ x: pan.x + dx, y: pan.y + dy });
            lastPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isDrawing.current) {
            const { x, y } = getCanvasPoint(e);

            if (activeTool === 'pen' || activeTool === 'eraser') {
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) {
                    // Pressure sensitivity
                    const pressure = e.pressure !== 0.5 ? e.pressure : 1; // 0.5 is default/mouse
                    ctx.lineWidth = brushSize * pressure;
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    // For smoother lines, use quadratic curves, but simple lineTo is OK for now.
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }
            }
            // Region preview drawing handling can be done here with a temp overlay or state
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isPanning.current) {
            isPanning.current = false;
        }
        if (isDrawing.current) {
            isDrawing.current = false;
            if (activeTool === 'pen' || activeTool === 'eraser') {
                // Close path?
                saveHistory();
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) ctx.globalCompositeOperation = 'source-over'; // Reset
            } else if (activeTool === 'region') {
                // Finish region
                const end = getCanvasPoint(e);
                const start = lastPos.current;
                const w = Math.abs(end.x - start.x);
                const h = Math.abs(end.y - start.y);
                const rx = Math.min(end.x, start.x);
                const ry = Math.min(end.y, start.y);
                if (w > 10 && h > 10 && onRegionCreated) {
                    onRegionCreated({ type: 'rectangle', x: rx, y: ry, width: w, height: h });
                }
            }
        }
    };

    const handleMouseDoubleClick = (e: React.MouseEvent) => {
        if (activeTool === 'polygon' && currentPolygonPoints.length > 2 && onRegionCreated) {
            const points = [...currentPolygonPoints];
            // Calculate BBox
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            onRegionCreated({
                type: 'polygon',
                points,
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            });
            setCurrentPolygonPoints([]);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom logic
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const newZoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));
            onZoomChange(newZoom);
        }
    };

    // --- Rendering ---

    // Create Region Overlay Elements (SVG or HTML)
    // We overlay them on top of the canvas

    const polygonPath = currentPolygonPoints.length > 0
        ? currentPolygonPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (currentPolygonPoints.length > 2 ? '' : '') // Don't close yet
        : '';

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden bg-gray-800 select-none"
            style={{ touchAction: 'none', width: '100%', height: '100%' }}
            onPointerDown={handePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={handleMouseDoubleClick}
        >
            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: width,
                    height: height,
                    position: 'absolute'
                }}
            >
                {/* 1. Base Image Layer */}
                {baseImage && <img src={baseImage} style={{ width, height, position: 'absolute', pointerEvents: 'none' }} alt="Base" />}

                {/* 2. Drawing Layer */}
                <canvas
                    ref={drawingCanvasRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', pointerEvents: 'none' }}
                />

                {/* 3. Regions Overlay */}
                <svg width={width} height={height} style={{ position: 'absolute', pointerEvents: 'none' }}>
                    {regions.map(r => (
                        <g key={r.id}>
                            {r.type === 'polygon' && r.points ? (
                                <>
                                    <polygon
                                        points={r.points.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="rgba(255, 0, 0, 0.1)" stroke="#ff0000" strokeWidth={2 / zoom}
                                    />
                                    {/* Label at first point or bbox top-left */}
                                    <rect x={r.x} y={r.y - (20 / zoom)} width={20 / zoom} height={20 / zoom} fill="#ff0000" />
                                    <text x={r.x + (5 / zoom)} y={r.y - (5 / zoom)} fill="white" fontSize={12 / zoom} fontWeight="bold">{r.regionNumber}</text>
                                </>
                            ) : (
                                <>
                                    <rect x={r.x} y={r.y} width={r.width} height={r.height}
                                        fill="rgba(255, 0, 0, 0.1)" stroke="#ff0000" strokeWidth={2 / zoom} />
                                    <rect x={r.x} y={r.y - (20 / zoom)} width={20 / zoom} height={20 / zoom} fill="#ff0000" />
                                    <text x={r.x + (5 / zoom)} y={r.y - (5 / zoom)} fill="white" fontSize={12 / zoom} fontWeight="bold">{r.regionNumber}</text>
                                </>
                            )}
                        </g>
                    ))}
                    {/* Render Active Polygon under creation */}
                    {currentPolygonPoints.length > 0 && (
                        <>
                            {currentPolygonPoints.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r={3 / zoom} fill="cyan" />
                            ))}
                            <path d={polygonPath} stroke="cyan" strokeWidth={2 / zoom} fill="none" />
                            <text x={currentPolygonPoints[currentPolygonPoints.length - 1].x + 10} y={currentPolygonPoints[currentPolygonPoints.length - 1].y} fill="white" fontSize={12} textShadow="0 0 2px black">Double-click to finish</text>
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
});

LayeredCanvas.displayName = 'LayeredCanvas';
