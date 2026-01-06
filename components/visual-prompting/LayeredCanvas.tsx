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

    // History
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Interaction State - SEPARATED for Robustness
    const interactionMode = useRef<'none' | 'panning' | 'drawing' | 'region' | 'polygon'>('none');

    // Panning State (Client Coordinates)
    const panLastPos = useRef({ x: 0, y: 0 });

    // Drawing/Region State (Canvas Coordinates)
    const drawLastPos = useRef({ x: 0, y: 0 });
    const regionStartPos = useRef({ x: 0, y: 0 }); // Anchor for rectangle

    // Polygon State
    const [currentPolygonPoints, setCurrentPolygonPoints] = useState<{ x: number, y: number }[]>([]);
    const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);

    // Drawing Region Preview State
    const [drawingRegion, setDrawingRegion] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

    // Spacebar Panning toggle
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    // Initialize Canvas
    useEffect(() => {
        // Clear temp drawing states when tool changes (except polygon to allow tool switching? No, usually clear)
        if (activeTool !== 'polygon') {
            setCurrentPolygonPoints([]);
        }
        if (activeTool !== 'region') {
            setDrawingRegion(null);
        }
        // Reset interaction mode on tool change to prevent stuck states
        interactionMode.current = 'none';
    }, [activeTool]);

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
    const pointerCache = useRef<Map<number, { clientX: number, clientY: number }>>(new Map());
    const gestureBaseRef = useRef<{ dist: number; center: { x: number; y: number }; zoom: number; pan: { x: number; y: number } } | null>(null);

    // Helper to calculate distance between two points
    const getDistance = (p1: { clientX: number, clientY: number }, p2: { clientX: number, clientY: number }) => {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.hypot(dx, dy);
    };

    // Helper to calculate center between two points
    const getCenter = (p1: { clientX: number, clientY: number }, p2: { clientX: number, clientY: number }) => {
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
            setCurrentPolygonPoints([]);
            setDrawingRegion(null);
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

            // 3. Draw Regions
            regions.forEach((r, index) => {
                ctx.save();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2; // Fixed width for guide image
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

                    // Label
                    const firstPoint = r.points[0];
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(firstPoint.x, firstPoint.y - 20, 20, 20);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(r.regionNumber?.toString() || (index + 1).toString(), firstPoint.x + 10, firstPoint.y - 10);
                } else {
                    ctx.fillRect(r.x, r.y, r.width, r.height);
                    ctx.strokeRect(r.x, r.y, r.width, r.height);

                    // Label
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(r.x, r.y - 20, 20, 20);
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
        hasDrawingContent: () => false // Simplified for now
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

    const getCanvasPoint = (e: { clientX: number, clientY: number }) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Stop propagation to prevent underlying canvas interactions if stacked
        e.stopPropagation();

        console.log('[LayeredCanvas] PointerDown. ActiveTool:', activeTool);

        // Capture pointer to ensure we get events outside container
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
            // Ignore if already captured or invalid
        }

        // Track pointer
        pointerCache.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

        // GESTURE (Pinch) Check
        if (pointerCache.current.size === 2) {
            interactionMode.current = 'none'; // Cancel any current single-finger action

            const it = pointerCache.current.values();
            const p1 = it.next().value;
            const p2 = it.next().value;
            const dist = getDistance(p1, p2);
            const center = getCenter(p1, p2);

            gestureBaseRef.current = {
                dist,
                center,
                zoom,
                pan: { ...pan }
            };
            return;
        }

        // Single Pointer Logic
        if (pointerCache.current.size === 1) {
            // Check Panning Trigger (Spacebar OR Middle Click OR Pan Tool)
            const isPanTrigger = activeTool === 'pan' || isSpacePressed || e.button === 1 || (e.pointerType === 'touch' && activeTool === 'pan'); // Strict touch Panning only if Pan tool selected? Or always?
            // Usually touch drag = pan, touch draw = draw.
            // Let's adhere to activeTool.

            if (isPanTrigger) {
                interactionMode.current = 'panning';
                panLastPos.current = { x: e.clientX, y: e.clientY };
                return;
            }

            // Drawing / Interaction Trigger
            const pt = getCanvasPoint(e);

            if (activeTool === 'pen' || activeTool === 'eraser') {
                interactionMode.current = 'drawing';
                drawLastPos.current = pt;

                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) {
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
                    ctx.lineWidth = brushSize;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    if (activeTool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
                    else ctx.globalCompositeOperation = 'source-over';
                    // Draw a dot immediately?
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                }
            } else if (activeTool === 'region') {
                interactionMode.current = 'region';
                regionStartPos.current = pt; // Store start canvas pos
                setDrawingRegion({ start: pt, current: pt });
            } else if (activeTool === 'polygon') {
                interactionMode.current = 'polygon';
                // Add point logic
                if (currentPolygonPoints.length > 2) {
                    const firstPt = currentPolygonPoints[0];
                    const dist = Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y);
                    const closeThreshold = 15 / zoom; // Scale threshold
                    if (dist < closeThreshold) {
                        finishPolygon();
                        return;
                    }
                }
                setCurrentPolygonPoints(prev => [...prev, pt]);
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        // Update cache
        if (pointerCache.current.has(e.pointerId)) {
            pointerCache.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        }

        // Always track cursor for polygon preview
        const pt = getCanvasPoint(e);
        if (activeTool === 'polygon') {
            setCursorPos(pt);
        }

        // Pinch/Zoom Handling
        if (pointerCache.current.size === 2 && gestureBaseRef.current) {
            const it = pointerCache.current.values();
            const p1 = it.next().value;
            const p2 = it.next().value;

            const curDist = getDistance(p1, p2);
            const curCenter = getCenter(p1, p2);
            const { dist: startDist, center: startCenter, zoom: startZoom, pan: startPan } = gestureBaseRef.current;

            const scaleFactor = curDist / (startDist || 1);
            const newZoom = Math.max(0.1, Math.min(10, startZoom * scaleFactor));

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const scX = startCenter.x - rect.left;
                const scY = startCenter.y - rect.top;
                const ccX = curCenter.x - rect.left;
                const ccY = curCenter.y - rect.top;

                const newPanX = ccX - ((scX - startPan.x) / startZoom) * newZoom;
                const newPanY = ccY - ((scY - startPan.y) / startZoom) * newZoom;

                onZoomChange(newZoom);
                onPanChange({ x: newPanX, y: newPanY });
            }
            return;
        }

        // Single Pointer Actions
        if (pointerCache.current.size === 1) {

            if (interactionMode.current === 'panning') {
                const dx = e.clientX - panLastPos.current.x;
                const dy = e.clientY - panLastPos.current.y;
                onPanChange({ x: pan.x + dx, y: pan.y + dy });
                panLastPos.current = { x: e.clientX, y: e.clientY };
            }
            else if (interactionMode.current === 'drawing') {
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) {
                    const pressure = e.pressure !== 0.5 ? e.pressure : 1; // Basic support
                    // Use pt (canvas coords)
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                }
            }
            else if (interactionMode.current === 'region') {
                setDrawingRegion(prev => prev ? { ...prev, current: pt } : null);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) { }

        pointerCache.current.delete(e.pointerId);

        if (pointerCache.current.size < 2) {
            gestureBaseRef.current = null;
        }

        if (pointerCache.current.size === 0) {
            // Finish Action
            if (interactionMode.current === 'drawing') {
                saveHistory();
                const ctx = drawingCanvasRef.current?.getContext('2d');
                if (ctx) ctx.globalCompositeOperation = 'source-over';
            }
            else if (interactionMode.current === 'region') {
                const end = getCanvasPoint(e);
                const start = regionStartPos.current;
                setDrawingRegion(null);

                // Calculate BBox
                const rx = Math.min(end.x, start.x);
                const ry = Math.min(end.y, start.y);
                const w = Math.abs(end.x - start.x);
                const h = Math.abs(end.y - start.y);

                if (w > 5 && h > 5 && onRegionCreated) {
                    onRegionCreated({ type: 'rectangle', x: rx, y: ry, width: w, height: h });
                }
            }

            // NOTE: Polygon does NOT finish on PointerUp, it finishes on closing the loop
            if (interactionMode.current !== 'polygon') {
                interactionMode.current = 'none';
            }
        }
    };

    const finishPolygon = () => {
        if (currentPolygonPoints.length > 2 && onRegionCreated) {
            const points = [...currentPolygonPoints];
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);

            // Bounding Box
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
        }
        setCurrentPolygonPoints([]);
        interactionMode.current = 'none';
    };

    const handleMouseDoubleClick = (e: React.MouseEvent) => {
        if (activeTool === 'polygon') {
            finishPolygon();
        }
    };

    // Keyboard Pan
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                if (e.target === document.body) e.preventDefault();
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const getCursor = () => {
        if (isSpacePressed || activeTool === 'pan') return interactionMode.current === 'panning' ? 'grabbing' : 'grab';
        if (activeTool === 'region') return 'crosshair';
        if (activeTool === 'polygon') return 'crosshair';
        return 'default';
    };

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden select-none"
            style={{ touchAction: 'none', width: '100%', height: '100%', cursor: getCursor() }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(e) => {
                e.preventDefault();
                const zoomSensitivity = 0.001;
                const delta = -e.deltaY * zoomSensitivity;
                const newZoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));

                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    const scaleChange = newZoom / zoom;
                    const newPanX = mx - (mx - pan.x) * scaleChange;
                    const newPanY = my - (my - pan.y) * scaleChange;

                    onZoomChange(newZoom);
                    onPanChange({ x: newPanX, y: newPanY });
                }
            }}
            onDoubleClick={handleMouseDoubleClick}
        >
            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: width,
                    height: height,
                    position: 'absolute',
                    pointerEvents: 'none' // Inner content shouldn't capture pointer
                }}
            >
                {/* 1. Base Image */}
                {baseImage && <img src={baseImage} style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute' }} alt="Base" />}

                {/* 2. Drawing Layer */}
                <canvas
                    ref={drawingCanvasRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', background: 'transparent' }}
                />

                {/* 3. Regions Overlay */}
                <svg width={width} height={height} style={{ position: 'absolute' }}>
                    {regions.map(r => (
                        <g key={r.id}>
                            {r.type === 'polygon' && r.points ? (
                                <>
                                    <polygon
                                        points={r.points.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="rgba(255, 0, 0, 0.1)" stroke="#ff0000" strokeWidth={2 / zoom}
                                    />
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
                    {/* Active Polygon Preview */}
                    {currentPolygonPoints.length > 0 && (
                        <>
                            {currentPolygonPoints.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r={4 / zoom} fill={i === 0 ? "yellow" : "cyan"} stroke="black" strokeWidth={1 / zoom} />
                            ))}
                            <polyline
                                points={currentPolygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none" stroke="cyan" strokeWidth={2 / zoom}
                            />
                            {cursorPos && (
                                <line
                                    x1={currentPolygonPoints[currentPolygonPoints.length - 1].x}
                                    y1={currentPolygonPoints[currentPolygonPoints.length - 1].y}
                                    x2={cursorPos.x}
                                    y2={cursorPos.y}
                                    stroke="cyan"
                                    strokeWidth={2 / zoom}
                                    strokeDasharray={`${5 / zoom},${5 / zoom}`}
                                />
                            )}
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
});

LayeredCanvas.displayName = 'LayeredCanvas';
