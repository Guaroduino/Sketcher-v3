
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Region } from '../../services/visualPromptingService';

export interface LayeredCanvasRef {
    getDrawingDataUrl: () => string;
    loadDrawingDataUrl: (url: string) => Promise<void>;
    clearDrawing: () => void;
    undo: () => void;
    redo: () => void;
    getVisualGuideSnapshot: () => Promise<string>;
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

    // Drawing Region State (Preview)
    const [drawingRegion, setDrawingRegion] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

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

    // Multi-touch State
    const pointerCache = useRef<Map<number, React.PointerEvent>>(new Map());
    const gestureBaseRef = useRef<{ dist: number; center: { x: number; y: number }; zoom: number; pan: { x: number; y: number } } | null>(null);

    // Helper to calculate distance between two points
    const getDistance = (p1: React.PointerEvent, p2: React.PointerEvent) => {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.hypot(dx, dy);
    };

    // Helper to calculate center of two points
    const getCenter = (p1: React.PointerEvent, p2: React.PointerEvent) => {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2
        };
    };

    useImperativeHandle(ref, () => ({
        getDrawingDataUrl: () => {
            return drawingCanvasRef.current?.toDataURL('image/png') || '';
        },
        loadDrawingDataUrl: async (url: string) => {
            if (!drawingCanvasRef.current) return;
            const canvas = drawingCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const img = new Image();
            img.src = url;
            await new Promise<void>((resolve) => {
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    saveHistory();
                    resolve();
                };
                img.onerror = () => resolve();
            });
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
        },
        getVisualGuideSnapshot: async () => {
            // WYSIWYG Snapshot Generation
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';

            // 1. Draw Base Image
            if (baseImage) {
                const img = new Image();
                img.src = baseImage;
                await new Promise<void>((resolve) => {
                    if (img.complete) resolve();
                    else img.onload = () => resolve();
                });
                ctx.drawImage(img, 0, 0, width, height);
            }

            // 2. Draw Drawings
            if (drawingCanvasRef.current) {
                ctx.drawImage(drawingCanvasRef.current, 0, 0);
            }

            // 3. Draw Regions (Simulate SVG Overlay)
            regions.forEach((r, index) => {
                ctx.save();

                // Style matching SVG
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2; // Fixed width for guide image (not zoom dependent)
                ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';

                if (r.type === 'polygon' && r.points) {
                    ctx.beginPath();
                    r.points.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Label Background
                    const firstPoint = r.points[0];
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(firstPoint.x, firstPoint.y - 20, 20, 20);

                    // Label Text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(r.regionNumber?.toString() || (index + 1).toString(), firstPoint.x + 10, firstPoint.y - 10);

                } else {
                    // Rectangle
                    ctx.fillRect(r.x, r.y, r.width, r.height);
                    ctx.strokeRect(r.x, r.y, r.width, r.height);

                    // Label Background
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(r.x, r.y - 20, 20, 20);

                    // Label Text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(r.regionNumber?.toString() || (index + 1).toString(), r.x + 10, r.y - 10);
                }
                ctx.restore();
            });

            return canvas.toDataURL('image/jpeg', 0.9);
        },
        hasDrawingContent: () => {
            const ctx = drawingCanvasRef.current?.getContext('2d');
            if (!ctx) return false;
            try {
                const w = ctx.canvas.width;
                const h = ctx.canvas.height;
                // Optimization: if canvas is huge, maybe sample? But detailed check is safer.
                const idata = ctx.getImageData(0, 0, w, h);
                const data = idata.data;
                // Check alpha channel of every pixel
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) return true;
                }
                return false;
            } catch (e) {
                console.error("Error checking canvas content:", e);
                return false;
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

    const getCanvasPoint = (e: React.PointerEvent | { clientX: number, clientY: number }) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    };

    const handePointerDown = (e: React.PointerEvent) => {
        // Track pointer
        pointerCache.current.set(e.pointerId, e);

        if (pointerCache.current.size === 2) {
            // Start Pinch/Pan Gesture
            const it = pointerCache.current.values();
            const p1 = it.next().value;
            const p2 = it.next().value;
            const dist = getDistance(p1, p2);
            const center = getCenter(p1, p2); // relative client coordinates

            // Store initial state for absolute calculation
            gestureBaseRef.current = {
                dist,
                center,
                zoom, // current zoom
                pan: { ...pan } // current pan
            };

            isPanning.current = false;
            isDrawing.current = false;
            return;
        }

        if (activeTool === 'pan' || isSpacePressed || e.button === 1 || (activeTool !== 'pan' && e.pointerType === 'touch' && !e.isPrimary)) {
            isPanning.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Only draw if 1 pointer and not panning
        if (pointerCache.current.size === 1) {
            if (activeTool === 'pen' || activeTool === 'eraser') {
                isDrawing.current = true;
                const { x, y } = getCanvasPoint(e);
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
                    ctx.lineWidth = brushSize;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    if (activeTool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
                    else ctx.globalCompositeOperation = 'source-over';
                }
            } else if (activeTool === 'region') {
                isDrawing.current = true;
                const pt = getCanvasPoint(e);
                lastPos.current = pt;
                setDrawingRegion({ start: pt, current: pt });
            } else if (activeTool === 'polygon') {
                const pt = getCanvasPoint(e);
                setCurrentPolygonPoints(prev => [...prev, pt]);
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        // Update pointer in cache
        if (pointerCache.current.has(e.pointerId)) {
            pointerCache.current.set(e.pointerId, e);
        }

        // Multi-touch Pinch/Pan
        if (pointerCache.current.size === 2 && gestureBaseRef.current) {
            const it = pointerCache.current.values();
            const p1 = it.next().value;
            const p2 = it.next().value;

            // Current state
            const curDist = getDistance(p1, p2);
            const curCenter = getCenter(p1, p2);

            const { dist: startDist, center: startCenter, zoom: startZoom, pan: startPan } = gestureBaseRef.current;

            // 1. Calculate new Zoom
            // Avoid division by zero or negative zoom
            const scaleFactor = curDist / (startDist || 1);
            const newZoom = Math.max(0.1, Math.min(10, startZoom * scaleFactor));

            // 2. Calculate new Pan
            // Logic: The point on the canvas that WAS under 'startCenter' (relative to startPan/startZoom)
            // MUST now be under 'curCenter' (relative to newPan/newZoom).
            // CanvasPoint = (startCenter_rel - startPan) / startZoom
            // curCenter_rel = CanvasPoint * newZoom + newPan

            // We need center relative to the container for these calculations.
            // getCenter returns client coordinates.
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();

                const scX = startCenter.x - rect.left;
                const scY = startCenter.y - rect.top;

                const ccX = curCenter.x - rect.left;
                const ccY = curCenter.y - rect.top;

                // Absolute Pan Calculation
                // P_canvas_x = (scX - startPan.x) / startZoom;
                // P_canvas_y = (scY - startPan.y) / startZoom;

                // newPan.x = ccX - P_canvas_x * newZoom;
                // newPan.y = ccY - P_canvas_y * newZoom;

                // Optimization:
                const newPanX = ccX - ((scX - startPan.x) / startZoom) * newZoom;
                const newPanY = ccY - ((scY - startPan.y) / startZoom) * newZoom;

                onZoomChange(newZoom);
                onPanChange({ x: newPanX, y: newPanY });
            }
            return;
        }

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
                    const pressure = e.pressure !== 0.5 ? e.pressure : 1;
                    ctx.lineWidth = brushSize * pressure;
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }
            } else if (activeTool === 'region') {
                setDrawingRegion(prev => prev ? { ...prev, current: { x, y } } : null);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        pointerCache.current.delete(e.pointerId);

        if (pointerCache.current.size < 2) {
            gestureBaseRef.current = null;
        }

        if (isPanning.current && pointerCache.current.size === 0) {
            isPanning.current = false;
        }

        if (isDrawing.current && pointerCache.current.size === 0) {
            isDrawing.current = false;
            if (activeTool === 'pen' || activeTool === 'eraser') {
                saveHistory();
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) ctx.globalCompositeOperation = 'source-over';
            } else if (activeTool === 'region') {
                const end = getCanvasPoint(e);
                const start = lastPos.current;
                setDrawingRegion(null);

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
        // ... (existing implementation)
        if (activeTool === 'polygon' && currentPolygonPoints.length > 2 && onRegionCreated) {
            // ... logic from existing
            const points = [...currentPolygonPoints];
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
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // Zoom towards mouse
            const scaleChange = newZoom / zoom;
            const newPanX = mx - (mx - pan.x) * scaleChange;
            const newPanY = my - (my - pan.y) * scaleChange;

            onZoomChange(newZoom);
            onPanChange({ x: newPanX, y: newPanY });
        }
    };

    // --- Rendering ---

    // Create Region Overlay Elements (SVG or HTML)
    // We overlay them on top of the canvas

    const polygonPath = currentPolygonPoints.length > 0
        ? currentPolygonPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (currentPolygonPoints.length > 2 ? '' : '') // Don't close yet
        : '';

    // Keyboard Handlers for Space-Pan
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                // Prevent scrolling if focused
                if (e.target === document.body) e.preventDefault();
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                // If we were panning via space, stop panning on release? 
                // Usually we stop panning on pointer up. 
                // If user releases space WHILE dragging, behavior varies. 
                // For safety, we keep isPanning.current true until pointer up.
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const getCursor = () => {
        if (isSpacePressed || activeTool === 'pan') return isPanning.current ? 'grabbing' : 'grab';
        if (activeTool === 'region') return 'crosshair';
        if (activeTool === 'polygon') return 'crosshair';
        return 'default';
    };

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden select-none"
            style={{ touchAction: 'none', width: '100%', height: '100%', cursor: getCursor() }}
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
                {baseImage && <img src={baseImage} style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', pointerEvents: 'none' }} alt="Base" />}

                {/* 2. Drawing Layer */}
                <canvas
                    ref={drawingCanvasRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', pointerEvents: 'none', background: 'transparent' }}
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
                    {/* Active Region Preview */}
                    {drawingRegion && (
                        <rect
                            x={Math.min(drawingRegion.start.x, drawingRegion.current.x)}
                            y={Math.min(drawingRegion.start.y, drawingRegion.current.y)}
                            width={Math.abs(drawingRegion.current.x - drawingRegion.start.x)}
                            height={Math.abs(drawingRegion.current.y - drawingRegion.start.y)}
                            fill="rgba(255, 0, 0, 0.2)"
                            stroke="#ff0000"
                            strokeWidth={2 / zoom}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                        />
                    )}
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
