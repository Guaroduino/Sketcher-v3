import React, { useRef, useCallback, useEffect } from 'react';
import type {
    SketchObject, Tool, Guide, Point, RulerGuide, PerspectiveGuide, MirrorGuide, OrthogonalGuide,
    CropRect, ViewTransform, PerspectiveControlPoint, TransformState, AffineTransformState, FreeTransformState, GridGuide,
    StrokeMode, StrokeState, BrushSettings, EraserSettings, MarkerSettings, FXBrushSettings
} from '../types';
import { getCanvasPoint, isNearPoint, projectPointOnLine, pointInPolygon, cloneCanvas, generateSpline } from '../utils/canvasUtils';
import { clearCanvas } from '../utils/canvasUtils';

type DragAction =
    | { type: 'none' }
    | { type: 'pan'; startX: number; startY: number; startPan: { x: number; y: number } }
    | { type: 'draw'; points: Point[] }
    | { type: 'crop'; handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move'; startRect: CropRect, startPoint: Point }
    | { type: 'transform'; handle: string; startState: TransformState, startPoint: Point; center?: Point };

type GuideDragState =
    | { type: 'ruler', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'mirror', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'perspective', color: 'green' | 'red' | 'blue'; lineId: string; part: 'start' | 'end' }
    | { type: 'perspective-point', part: 'point' }
    | { type: 'perspective-extra', color: 'green' | 'red' | 'blue', id: string }
    | null;

type PerspectiveVPs = { vpGreen: Point | null, vpRed: Point | null, vpBlue: Point | null };

export function usePointerEvents({
    uiCanvasRef,
    previewCanvasRef,
    viewTransform,
    setViewTransform,
    activeItem,
    tool,
    isDrawingTool,
    onDrawCommit,
    drawStrokeWithMirroring,
    areGuidesLocked,
    activeGuide,
    isOrthogonalVisible,
    rulerGuides,
    setRulerGuides,
    mirrorGuides,
    setMirrorGuides,
    perspectiveGuide,
    setPerspectiveGuide,
    perspectiveVPs,
    orthogonalGuide,
    guideDragState,
    setGuideDragState,
    cropRect,
    setCropRect,
    transformState,
    setTransformState,
    isAspectRatioLocked,
    livePreviewLayerId,
    setLivePreviewLayerId,
    isPerspectiveStrokeLockEnabled,
    isSnapToGridEnabled,
    gridGuide,
    strokeMode,
    strokeState,
    setStrokeState,
    brushSettings,
    eraserSettings,
    markerSettings,
    fxBrushSettings,
}: {
    uiCanvasRef: React.RefObject<HTMLCanvasElement>;
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
    viewTransform: ViewTransform;
    setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
    activeItem: SketchObject | null | undefined;
    tool: Tool;
    isDrawingTool: boolean;
    onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
    drawStrokeWithMirroring: (ctx: CanvasRenderingContext2D, points: Point[]) => void;
    areGuidesLocked: boolean;
    activeGuide: Guide;
    isOrthogonalVisible: boolean;
    rulerGuides: RulerGuide[];
    setRulerGuides: React.Dispatch<React.SetStateAction<RulerGuide[]>>;
    mirrorGuides: MirrorGuide[];
    setMirrorGuides: React.Dispatch<React.SetStateAction<MirrorGuide[]>>;
    perspectiveGuide: PerspectiveGuide | null;
    setPerspectiveGuide: React.Dispatch<React.SetStateAction<PerspectiveGuide | null>>;
    perspectiveVPs: React.MutableRefObject<PerspectiveVPs>;
    orthogonalGuide: OrthogonalGuide;
    guideDragState: GuideDragState;
    setGuideDragState: React.Dispatch<React.SetStateAction<GuideDragState>>;
    cropRect: CropRect | null;
    setCropRect: React.Dispatch<React.SetStateAction<CropRect | null>>;
    transformState: TransformState | null;
    setTransformState: React.Dispatch<React.SetStateAction<TransformState | null>>;
    isAspectRatioLocked: boolean;
    livePreviewLayerId: string | null;
    setLivePreviewLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    isPerspectiveStrokeLockEnabled: boolean;
    isSnapToGridEnabled: boolean;
    gridGuide: GridGuide;
    strokeMode: StrokeMode;
    strokeState: StrokeState | null;
    setStrokeState: React.Dispatch<React.SetStateAction<StrokeState | null>>;
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    markerSettings: MarkerSettings;
    fxBrushSettings: FXBrushSettings;
}) {

    const dragAction = useRef<DragAction>({ type: 'none' });
    const lockedPerspectiveLine = useRef<{ start: Point, end: Point } | null>(null);
    const strokeLockInfo = useRef<{ startPoint: Point; targetVP: Point | null } | null>(null);
    const orthogonalLock = useRef<{ axis: 'x' | 'y', startPoint: Point } | null>(null);
    const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const arcDrawingState = useRef<{ lastAngle: number; totalAngle: number } | null>(null);

    useEffect(() => {
        if (!strokeState) {
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (previewCtx) {
                clearCanvas(previewCtx);
            }
        }
    }, [strokeState, previewCanvasRef]);

    useEffect(() => {
        // Reset arc angle tracking if stroke state is cleared or no longer an arc
        if (!strokeState || strokeState.mode !== 'arc' || strokeState.points.length < 2) {
            arcDrawingState.current = null;
        }
    }, [strokeState]);

    const snapPointToGrid = useCallback((point: Point): Point => {
        if (!isSnapToGridEnabled || gridGuide.type === 'none') {
            return point;
        }
        const { spacing } = gridGuide;

        if (gridGuide.type === 'cartesian') {
            return {
                ...point,
                x: Math.round(point.x / spacing) * spacing,
                y: Math.round(point.y / spacing) * spacing,
            };
        }
        
        if (gridGuide.type === 'isometric') {
            const angle1 = gridGuide.isoAngle * Math.PI / 180;
            const angle2 = (180 - gridGuide.isoAngle) * Math.PI / 180;

            // These are vectors that generate the grid points
            const sin_a1_minus_a2 = Math.sin(angle1 - angle2);
            if (Math.abs(sin_a1_minus_a2) < 1e-6) return point;

            const ux = spacing * Math.cos(angle2) / sin_a1_minus_a2;
            const uy = spacing * Math.sin(angle2) / sin_a1_minus_a2;
            const vx = -spacing * Math.cos(angle1) / sin_a1_minus_a2;
            const vy = -spacing * Math.sin(angle1) / sin_a1_minus_a2;

            // Inverse matrix to find grid coords (i, j)
            const det = ux * vy - vx * uy;
            if (Math.abs(det) < 1e-6) return point;
            const invDet = 1 / det;

            const m11 = vy * invDet;
            const m12 = -vx * invDet;
            const m21 = -uy * invDet;
            const m22 = ux * invDet;
            
            const i_prime = m11 * point.x + m12 * point.y;
            const j_prime = m21 * point.x + m22 * point.y;
            
            const i = Math.round(i_prime);
            const j = Math.round(j_prime);

            // Transform back to world coordinates
            return { ...point, x: i * ux + j * vx, y: i * uy + j * vy };
        }

        return point;
    }, [isSnapToGridEnabled, gridGuide]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current || e.button !== 0) return;
        if (e.pointerType === 'pen' && e.pressure === 0) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        const rawPoint = getCanvasPoint(e, viewTransform, uiCanvasRef.current);
        const point = snapPointToGrid(rawPoint); // Snap all interaction points
        
        strokeLockInfo.current = null; // Reset on every new stroke

        if (isDrawingTool && (strokeMode === 'polyline' || strokeMode === 'curve' || strokeMode === 'arc')) {
            if (strokeState) {
                const newPoints = [...strokeState.points, point];
                
                let shouldCommit = false;
                if (strokeMode === 'curve' && newPoints.length === 3) shouldCommit = true;
                if (strokeMode === 'arc' && newPoints.length === 3) {
                    // Calculate final sweep angle based on accumulated angle from moves
                    if (arcDrawingState.current) {
                        const [center] = strokeState.points;
                        const finalAngle = Math.atan2(point.y - center.y, point.x - center.x);
                        
                        let delta = finalAngle - arcDrawingState.current.lastAngle;
                        if (delta > Math.PI) delta -= 2 * Math.PI;
                        else if (delta < -Math.PI) delta += 2 * Math.PI;

                        const finalTotalAngle = arcDrawingState.current.totalAngle + delta;
                        
                        // Augment the final point with the calculated sweep angle
                        (newPoints[2] as Point & { sweepAngle: number }).sweepAngle = finalTotalAngle;
                    }
                    shouldCommit = true;
                }

                if (shouldCommit) {
                    if (activeItem?.context) {
                        beforeCanvasRef.current = cloneCanvas(activeItem.canvas!);
                        drawStrokeWithMirroring(activeItem.context, newPoints);
                        onDrawCommit(activeItem.id, beforeCanvasRef.current);
                    }
                    setStrokeState(null);
                    const previewCtx = previewCanvasRef.current?.getContext('2d');
                    if (previewCtx) clearCanvas(previewCtx);
                    return;
                }

                setStrokeState({ ...strokeState, points: newPoints });
                return; // Prevent starting a drag action
            }
        }

        if (!areGuidesLocked) {
            const handleThreshold = 15 / viewTransform.zoom;
            if (activeGuide === 'ruler' && rulerGuides) {
                for (const guide of rulerGuides) {
                    const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                    if (isNearPoint(point, midPoint, handleThreshold)) {
                        setGuideDragState({ type: 'ruler', id: guide.id, part: 'line', offset: { x: point.x - midPoint.x, y: point.y - midPoint.y } });
                        return;
                    }
                    if (isNearPoint(point, guide.start, handleThreshold)) {
                        setGuideDragState({ type: 'ruler', id: guide.id, part: 'start', offset: { x: 0, y: 0 } }); return;
                    }
                    if (isNearPoint(point, guide.end, handleThreshold)) {
                        setGuideDragState({ type: 'ruler', id: guide.id, part: 'end', offset: { x: 0, y: 0 } }); return;
                    }
                }
            }
            if (activeGuide === 'mirror' && mirrorGuides) {
                for (const guide of mirrorGuides) {
                    const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                    if (isNearPoint(point, midPoint, handleThreshold)) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'line', offset: { x: point.x - midPoint.x, y: point.y - midPoint.y } });
                        return;
                    }
                    if (isNearPoint(point, guide.start, handleThreshold)) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'start', offset: { x: 0, y: 0 } }); return;
                    }
                    if (isNearPoint(point, guide.end, handleThreshold)) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'end', offset: { x: 0, y: 0 } }); return;
                    }
                }
            }
            if (activeGuide === 'perspective' && perspectiveGuide) {
                if (isNearPoint(point, perspectiveGuide.guidePoint, handleThreshold * 1.5)) {
                    setGuideDragState({ type: 'perspective-point', part: 'point' });
                    return;
                }
                for (const color of ['green', 'red', 'blue'] as const) {
                    for (const line of perspectiveGuide.lines[color]) {
                        if (isNearPoint(point, line.start, handleThreshold)) {
                            setGuideDragState({ type: 'perspective', color, lineId: line.id, part: 'start' }); return;
                        }
                        if (isNearPoint(point, line.end, handleThreshold)) {
                            setGuideDragState({ type: 'perspective', color, lineId: line.id, part: 'end' }); return;
                        }
                    }
                    for (const extra of perspectiveGuide.extraGuideLines[color]) {
                        if (isNearPoint(point, extra.handle, handleThreshold)) {
                            setGuideDragState({ type: 'perspective-extra', color, id: extra.id }); return;
                        }
                    }
                }
                const { vpGreen, vpRed, vpBlue } = perspectiveVPs.current;
                const guidePoint = perspectiveGuide.guidePoint;
                const createExtraGuide = (color: 'green' | 'red' | 'blue') => {
                    const newControlPoint: PerspectiveControlPoint = { id: `${color.charAt(0)}-extra-${Date.now()}`, handle: point };
                    setPerspectiveGuide(g => g ? { ...g, extraGuideLines: { ...g.extraGuideLines, [color]: [...g.extraGuideLines[color], newControlPoint] } } : null);
                };
                if (vpGreen && isNearPoint(point, { x: (vpGreen.x + guidePoint.x) / 2, y: (vpGreen.y + guidePoint.y) / 2 }, handleThreshold)) { createExtraGuide('green'); return; }
                if (vpRed && isNearPoint(point, { x: (vpRed.x + guidePoint.x) / 2, y: (vpRed.y + guidePoint.y) / 2 }, handleThreshold)) { createExtraGuide('red'); return; }
                if (vpBlue) {
                    const vecX = vpBlue.x - guidePoint.x, vecY = vpBlue.y - guidePoint.y, len = Math.hypot(vecX, vecY);
                    if (len > 0) {
                        const blueHandlePos = { x: guidePoint.x + (vecX / len) * 100, y: guidePoint.y + (vecY / len) * 100 };
                        if (isNearPoint(point, blueHandlePos, handleThreshold)) { createExtraGuide('blue'); return; }
                    }
                }
            }
        }

        if (tool === 'pan') {
            dragAction.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPan: viewTransform.pan };
            e.currentTarget.style.cursor = 'grabbing';
            return;
        }

        if (tool === 'crop' && cropRect) {
            const handleThreshold = 15 / viewTransform.zoom;
            const { x, y, width, height } = cropRect;
            const handles = {
                tl: { x, y }, tr: { x: x + width, y }, bl: { x, y: y + height }, br: { x: x + width, y: y + height },
                t: { x: x + width / 2, y }, b: { x: x + width / 2, y: y + height }, l: { x, y: y + height / 2 }, r: { x: x + width, y: y + height / 2 },
            };
            for (const [name, pos] of Object.entries(handles)) {
                if (isNearPoint(point, pos, handleThreshold)) {
                    dragAction.current = { type: 'crop', handle: name as 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r', startRect: cropRect, startPoint: point };
                    return;
                }
            }
            // Check if clicking inside the rect for move
            if (point.x > x && point.x < x + width && point.y > y && point.y < y + height) {
                dragAction.current = { type: 'crop', handle: 'move', startRect: cropRect, startPoint: point };
                return;
            }
        }

        if ((tool === 'transform' || tool === 'free-transform') && transformState) {
            const handleThreshold = 15 / viewTransform.zoom;
            if (transformState.type === 'affine') {
                 const { x, y, width, height, rotation } = transformState;
                 const center = { x: x + width / 2, y: y + height / 2 };
                 const cos = Math.cos(rotation), sin = Math.sin(rotation);
                 const rotate = (p: Point) => ({
                     x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                     y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
                 });
                 const handles = {
                    tl: rotate({ x, y }), tr: rotate({ x: x + width, y }),
                    bl: rotate({ x, y: y + height }), br: rotate({ x: x + width, y: y + height }),
                    t: rotate({ x: x + width / 2, y }), b: rotate({ x: x + width / 2, y: y + height }),
                    l: rotate({ x, y: y + height / 2 }), r: rotate({ x: x + width, y: y + height / 2 }),
                    rotate: rotate({ x: x + width/2, y: y - 25 / viewTransform.zoom })
                 };
                 for (const [name, pos] of Object.entries(handles)) {
                     if (isNearPoint(point, pos, handleThreshold)) {
                         dragAction.current = { type: 'transform', handle: name, startState: transformState, startPoint: point, center };
                         return;
                     }
                 }
                 // Check move
                 if (pointInPolygon(point, [handles.tl, handles.tr, handles.br, handles.bl])) {
                     dragAction.current = { type: 'transform', handle: 'move', startState: transformState, startPoint: point };
                     return;
                 }
            } else if (transformState.type === 'free') {
                 const { corners } = transformState;
                 const handleDefs = { tl: corners.tl, tr: corners.tr, bl: corners.bl, br: corners.br };
                 for (const [name, pos] of Object.entries(handleDefs)) {
                     if (isNearPoint(point, pos, handleThreshold)) {
                          dragAction.current = { type: 'transform', handle: name, startState: transformState, startPoint: point }; 
                          return;
                     }
                 }
                 if (pointInPolygon(point, [corners.tl, corners.tr, corners.br, corners.bl])) {
                     dragAction.current = { type: 'transform', handle: 'move', startState: transformState, startPoint: point }; 
                     return;
                 }
            }
        }
        
        if (isDrawingTool && activeItem) {
            if (activeItem.canvas) {
                beforeCanvasRef.current = cloneCanvas(activeItem.canvas);
            }

            if (strokeMode === 'polyline' || strokeMode === 'curve' || strokeMode === 'arc') {
                setStrokeState({ mode: strokeMode, points: [point] });
                return;
            }

            let finalPoint = rawPoint;
            lockedPerspectiveLine.current = null;
            orthogonalLock.current = null;
            let guideApplied = false;

            if (activeGuide === 'perspective' && perspectiveGuide && !isPerspectiveStrokeLockEnabled) {
                const { vpGreen, vpRed, vpBlue } = perspectiveVPs.current;
                const vps = [vpGreen, vpRed, vpBlue].filter((vp): vp is Point => vp !== null);
                let bestGuideLine: { start: Point; end: Point } | null = null, minDistance = Infinity;
                const checkLine = (p1: Point, p2: Point) => {
                    const projectedPoint = projectPointOnLine(rawPoint, p1, p2);
                    const distance = Math.hypot(rawPoint.x - projectedPoint.x, rawPoint.y - projectedPoint.y);
                    if (distance < minDistance) { minDistance = distance; bestGuideLine = { start: p1, end: p2 }; }
                };
                vps.forEach(vp => checkLine(vp, perspectiveGuide.guidePoint));
                if (vpGreen) perspectiveGuide.extraGuideLines.green.forEach(g => checkLine(vpGreen, g.handle));
                if (vpRed) perspectiveGuide.extraGuideLines.red.forEach(g => checkLine(vpRed, g.handle));
                if (vpBlue) perspectiveGuide.extraGuideLines.blue.forEach(g => checkLine(vpBlue, g.handle));
                if (bestGuideLine && minDistance < (15 / viewTransform.zoom)) {
                    lockedPerspectiveLine.current = bestGuideLine;
                    finalPoint = projectPointOnLine(rawPoint, bestGuideLine.start, bestGuideLine.end);
                    guideApplied = true;
                }
            } else if (activeGuide === 'ruler' && rulerGuides.length > 0) {
                let closestProjectedPoint: Point | null = null, minDistance = Infinity;
                rulerGuides.forEach(guide => {
                    const projected = projectPointOnLine(rawPoint, guide.start, guide.end);
                    const dist = Math.hypot(rawPoint.x - projected.x, rawPoint.y - projected.y);
                    if (dist < minDistance) { minDistance = dist; closestProjectedPoint = projected; }
                });
                if (closestProjectedPoint) {
                    finalPoint = closestProjectedPoint;
                    guideApplied = true;
                }
            }

            if (!guideApplied) {
                finalPoint = snapPointToGrid(rawPoint);
            }
            
            const pressure = e.pointerType === 'pen' ? e.pressure : 1.0;
            const firstPoint = { ...finalPoint, pressure };
            dragAction.current = { type: 'draw', points: [firstPoint] };
            
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (previewCtx) {
                if (tool === 'eraser') {
                    // FIX: Populate preview before hiding main layer to prevent flicker.
                    if (beforeCanvasRef.current) {
                        clearCanvas(previewCtx);
                        previewCtx.save();
                        previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                        previewCtx.drawImage(beforeCanvasRef.current, 0, 0);
                        previewCtx.restore();
                    }
                    setLivePreviewLayerId(activeItem.id);
                }

                // Draw first point/dab
                previewCtx.save();
                previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                if (tool !== 'eraser') {
                    clearCanvas(previewCtx);
                }
                if (strokeMode === 'freehand') {
                    drawStrokeWithMirroring(previewCtx, dragAction.current.points);
                }
                previewCtx.restore();
            }
        }
    }, [tool, viewTransform, activeItem, isDrawingTool, cropRect, activeGuide, rulerGuides, mirrorGuides, perspectiveGuide, areGuidesLocked, setPerspectiveGuide, setRulerGuides, setMirrorGuides, setGuideDragState, perspectiveVPs, transformState, drawStrokeWithMirroring, isPerspectiveStrokeLockEnabled, snapPointToGrid, strokeMode, strokeState, setStrokeState, onDrawCommit, setLivePreviewLayerId]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
        const rawPoint = getCanvasPoint(e, viewTransform, uiCanvasRef.current);

        if (guideDragState) {
            const point = snapPointToGrid(rawPoint);
            if (guideDragState.type === 'ruler') {
                setRulerGuides(guides => guides.map(g => {
                    if (g.id !== guideDragState.id) return g;
                    if (guideDragState.part === 'line') {
                        const newMid = { x: point.x - guideDragState.offset.x, y: point.y - guideDragState.offset.y }, oldMid = { x: (g.start.x + g.end.x) / 2, y: (g.start.y + g.end.y) / 2 }, dx = newMid.x - oldMid.x, dy = newMid.y - oldMid.y;
                        return { ...g, start: { x: g.start.x + dx, y: g.start.y + dy }, end: { x: g.end.x + dx, y: g.end.y + dy } };
                    }
                    return { ...g, [guideDragState.part]: point };
                }));
            }
            if (guideDragState.type === 'mirror') {
                setMirrorGuides(guides => guides.map(g => {
                    if (g.id !== guideDragState.id) return g;
                    if (guideDragState.part === 'line') {
                        const newMid = { x: point.x - guideDragState.offset.x, y: point.y - guideDragState.offset.y }, oldMid = { x: (g.start.x + g.end.x) / 2, y: (g.start.y + g.end.y) / 2 }, dx = newMid.x - oldMid.x, dy = newMid.y - oldMid.y;
                        return { ...g, start: { x: g.start.x + dx, y: g.start.y + dy }, end: { x: g.end.x + dx, y: g.end.y + dy } };
                    }
                    return { ...g, [guideDragState.part]: point };
                }));
            }
            if (guideDragState.type === 'perspective') {
                const { color, lineId, part } = guideDragState;
                setPerspectiveGuide(g => g ? { ...g, lines: { ...g.lines, [color]: g.lines[color].map(line => line.id === lineId ? { ...line, [part]: point } : line) } } : null);
            } else if (guideDragState.type === 'perspective-point') {
                setPerspectiveGuide(g => g ? { ...g, guidePoint: point } : null);
            } else if (guideDragState.type === 'perspective-extra') {
                const { color, id } = guideDragState;
                setPerspectiveGuide(g => g ? { ...g, extraGuideLines: { ...g.extraGuideLines, [color]: g.extraGuideLines[color].map(p => p.id === id ? { ...p, handle: point } : p) } } : null);
            }
            return;
        }
        
        const point = snapPointToGrid(rawPoint);

        if (strokeState) {
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (!previewCtx) return;

            const points = strokeState.points;
            clearCanvas(previewCtx);
            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);

            if (strokeState.mode === 'polyline' || strokeState.mode === 'curve') {
                if (points.length >= 1) {
                    drawStrokeWithMirroring(previewCtx, [...points, point]);
                }
            } else if (strokeState.mode === 'arc') {
                if (points.length === 1) { // Center set, preview radius
                    const center = points[0];
                    previewCtx.strokeStyle = 'rgba(128, 128, 128, 0.8)';
                    previewCtx.lineWidth = 1 / viewTransform.zoom;
                    previewCtx.setLineDash([4 / viewTransform.zoom, 2 / viewTransform.zoom]);
                    previewCtx.beginPath();
                    previewCtx.moveTo(center.x, center.y);
                    previewCtx.lineTo(point.x, point.y);
                    previewCtx.stroke();
                    previewCtx.setLineDash([]);
                } else if (points.length === 2) { // Center & start set, preview arc
                    const [center, start] = points;
                    const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);

                    if (arcDrawingState.current === null) {
                        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                        arcDrawingState.current = {
                            lastAngle: startAngle,
                            totalAngle: 0,
                        };
                    }
                    
                    let delta = currentAngle - arcDrawingState.current.lastAngle;
                    if (delta > Math.PI) {
                        delta -= 2 * Math.PI;
                    } else if (delta < -Math.PI) {
                        delta += 2 * Math.PI;
                    }

                    arcDrawingState.current.totalAngle += delta;
                    arcDrawingState.current.lastAngle = currentAngle;
                    
                    const augmentedEnd = { ...point, sweepAngle: arcDrawingState.current.totalAngle };
                    
                    drawStrokeWithMirroring(previewCtx, [...points, augmentedEnd]);
                }
            }
            previewCtx.restore();
        }
        
        if (dragAction.current.type === 'none') return;

        switch (dragAction.current.type) {
            case 'pan': {
                const { startX, startY, startPan } = dragAction.current;
                setViewTransform(v => ({ ...v, pan: { x: startPan.x + (e.clientX - startX), y: startPan.y + (e.clientY - startY) } }));
                break;
            }
            case 'draw': {
                if (!isDrawingTool || !activeItem) break;
                
                const events: PointerEvent[] = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
                const lastPoint = dragAction.current.points.length > 0 ? dragAction.current.points[dragAction.current.points.length - 1] : null;
                const newPoints: Point[] = [];

                for (const event of events) {
                    const currentRawPoint = getCanvasPoint(event, viewTransform, uiCanvasRef.current!);
                    let finalPoint = currentRawPoint;
                    let guideApplied = false;
                    
                    if (activeGuide === 'perspective' && isPerspectiveStrokeLockEnabled) {
                        // This logic now applies per point, which is less ideal but works.
                        if (strokeLockInfo.current && strokeLockInfo.current.targetVP) {
                            finalPoint = projectPointOnLine(currentRawPoint, strokeLockInfo.current.startPoint, strokeLockInfo.current.targetVP);
                            guideApplied = true;
                        }
                    } else if (lockedPerspectiveLine.current) {
                        finalPoint = projectPointOnLine(currentRawPoint, lockedPerspectiveLine.current.start, lockedPerspectiveLine.current.end);
                        guideApplied = true;
                    } else if (isOrthogonalVisible && orthogonalGuide) {
                        const startPoint = dragAction.current.points[0];
                        if (!orthogonalLock.current && Math.hypot(currentRawPoint.x - startPoint.x, currentRawPoint.y - startPoint.y) > (10 / viewTransform.zoom)) {
                            const angleRad = (orthogonalGuide.angle * Math.PI) / 180, cos = Math.cos(-angleRad), sin = Math.sin(-angleRad), relativeX = currentRawPoint.x - startPoint.x, relativeY = currentRawPoint.y - startPoint.y, unrotatedX = relativeX * cos - relativeY * sin, unrotatedY = relativeX * sin + relativeY * cos;
                            orthogonalLock.current = { axis: Math.abs(unrotatedX) > Math.abs(unrotatedY) ? 'x' : 'y', startPoint };
                        }
                        if (orthogonalLock.current) {
                            const { startPoint: lockStartPoint, axis } = orthogonalLock.current, angleRad = (orthogonalGuide.angle * Math.PI) / 180, cos = Math.cos(-angleRad), sin = Math.sin(-angleRad), relativeX = currentRawPoint.x - lockStartPoint.x, relativeY = currentRawPoint.y - lockStartPoint.y, unrotatedX = relativeX * cos - relativeY * sin, unrotatedY = relativeX * sin + relativeY * cos, snappedUnrotatedX = axis === 'x' ? unrotatedX : 0, snappedUnrotatedY = axis === 'y' ? unrotatedY : 0, cosBack = Math.cos(angleRad), sinBack = Math.sin(angleRad), rotatedX = snappedUnrotatedX * cosBack - snappedUnrotatedY * sinBack, rotatedY = snappedUnrotatedX * sinBack + snappedUnrotatedY * cosBack;
                            finalPoint = { x: lockStartPoint.x + rotatedX, y: lockStartPoint.y + rotatedY };
                            guideApplied = true;
                        }
                    } else if (activeGuide === 'ruler' && rulerGuides.length > 0) {
                        let closestProjectedPoint: Point | null = null, minDistance = Infinity;
                        rulerGuides.forEach(guide => {
                            const projected = projectPointOnLine(currentRawPoint, guide.start, guide.end);
                            const dist = Math.hypot(currentRawPoint.x - projected.x, currentRawPoint.y - projected.y);
                            if (dist < minDistance) { minDistance = dist; closestProjectedPoint = projected; }
                        });
                        if (closestProjectedPoint) {
                            finalPoint = closestProjectedPoint;
                            guideApplied = true;
                        }
                    }

                    if (!guideApplied) {
                        finalPoint = snapPointToGrid(currentRawPoint);
                    }

                    const pressure = event.pointerType === 'pen' ? event.pressure : 1.0;
                    const currentPoint = { ...finalPoint, pressure };
                    newPoints.push(currentPoint);
                }

                if(newPoints.length === 0) break;

                dragAction.current.points.push(...newPoints);

                const previewCtx = previewCanvasRef.current?.getContext('2d');
                if (!previewCtx) break;

                if (tool === 'eraser') {
                    clearCanvas(previewCtx);
                    previewCtx.save();
                    previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                    if (beforeCanvasRef.current) {
                        previewCtx.drawImage(beforeCanvasRef.current, 0, 0);
                    }
                    drawStrokeWithMirroring(previewCtx, dragAction.current.points);
                    previewCtx.restore();

                } else if (strokeMode === 'line') {
                    clearCanvas(previewCtx);
                    previewCtx.save();
                    previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                    drawStrokeWithMirroring(previewCtx, [dragAction.current.points[0], newPoints[newPoints.length-1]]);
                    previewCtx.restore();
                } else if (strokeMode === 'freehand') {
                     previewCtx.save();
                     previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                     const segmentToDraw = lastPoint ? [lastPoint, ...newPoints] : newPoints;
                     drawStrokeWithMirroring(previewCtx, segmentToDraw);
                     previewCtx.restore();
                }
                break;
            }
            case 'crop': {
                const { handle, startRect, startPoint: startDragPoint } = dragAction.current;
                const dx = point.x - startDragPoint.x;
                const dy = point.y - startDragPoint.y;

                let newRect = { ...startRect };

                if (handle.includes('l')) {
                    newRect.x = startRect.x + dx;
                    newRect.width = startRect.width - dx;
                } else if (handle.includes('r')) {
                    newRect.width = startRect.width + dx;
                }

                if (handle.includes('t')) {
                    newRect.y = startRect.y + dy;
                    newRect.height = startRect.height - dy;
                } else if (handle.includes('b')) {
                    newRect.height = startRect.height + dy;
                }
                
                if (handle === 'move') {
                    newRect.x = startRect.x + dx;
                    newRect.y = startRect.y + dy;
                }

                if (newRect.width < 0) {
                    newRect.x = newRect.x + newRect.width;
                    newRect.width = Math.abs(newRect.width);
                }
                if (newRect.height < 0) {
                    newRect.y = newRect.y + newRect.height;
                    newRect.height = Math.abs(newRect.height);
                }

                setCropRect(newRect);
                break;
            }
            case 'transform': {
                const { handle, startState, startPoint } = dragAction.current;
                const dx = point.x - startPoint.x;
                const dy = point.y - startPoint.y;

                if (startState.type === 'affine') {
                    const { center } = dragAction.current;
                    if (handle === 'move') {
                        setTransformState(s => s ? { ...s, x: startState.x + dx, y: startState.y + dy } as AffineTransformState : null);
                    } else if (handle === 'rotate' && center) {
                        const newRotation = Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2;
                        setTransformState(s => s ? { ...s, rotation: newRotation } as AffineTransformState : null);
                    } else if (center) { // Scaling handles - anchored from center
                        // Vector from the center to the dragged point
                        const vec = { x: point.x - center.x, y: point.y - center.y };
            
                        // Un-rotate this vector to be in the transform box's local coordinate space
                        const cos = Math.cos(-startState.rotation);
                        const sin = Math.sin(-startState.rotation);
                        const localVec = {
                            x: vec.x * cos - vec.y * sin,
                            y: vec.x * sin + vec.y * cos,
                        };

                        const startHalfWidth = startState.width / 2;
                        const startHalfHeight = startState.height / 2;

                        // Determine new half-dimensions based on which handle is being dragged
                        let newHalfWidth = startHalfWidth;
                        let newHalfHeight = startHalfHeight;

                        if (handle.includes('l') || handle.includes('r')) {
                             newHalfWidth = Math.abs(localVec.x);
                        }
                        if (handle.includes('t') || handle.includes('b')) {
                            newHalfHeight = Math.abs(localVec.y);
                        }

                        // Handle aspect ratio lock
                        if (isAspectRatioLocked && startState.width > 0 && startState.height > 0) {
                            const aspectRatio = startState.width / startState.height;
                            const isCorner = handle.length === 2; // tl, tr, etc.

                            if (isCorner) {
                                // For corners, maintain aspect ratio based on the largest change
                                if ((newHalfWidth / startHalfWidth) > (newHalfHeight / startHalfHeight)) {
                                    newHalfHeight = newHalfWidth / aspectRatio;
                                } else {
                                    newHalfWidth = newHalfHeight * aspectRatio;
                                }
                            } else if (handle.includes('l') || handle.includes('r')) {
                                newHalfHeight = newHalfWidth / aspectRatio;
                            } else { // t or b
                                newHalfWidth = newHalfHeight * aspectRatio;
                            }
                        }
                        
                        const newWidth = newHalfWidth * 2;
                        const newHeight = newHalfHeight * 2;
            
                        // Recalculate top-left (x, y) based on fixed center and new dimensions
                        const cosR = Math.cos(startState.rotation);
                        const sinR = Math.sin(startState.rotation);
                        
                        const cornerVecX = -newWidth / 2;
                        const cornerVecY = -newHeight / 2;
                        
                        const rotatedCornerVecX = cornerVecX * cosR - cornerVecY * sinR;
                        const rotatedCornerVecY = cornerVecX * sinR + cornerVecY * cosR;
            
                        const newX = center.x + rotatedCornerVecX;
                        const newY = center.y + rotatedCornerVecY;
            
                        setTransformState(s => {
                            if (!s || s.type !== 'affine') return s;
                            return {
                                ...s,
                                x: newX,
                                y: newY,
                                width: newWidth,
                                height: newHeight,
                            } as AffineTransformState;
                        });
                    }
                } else if (startState.type === 'free') {
                    if (handle === 'move') {
                        const newCorners = {
                            tl: { x: startState.corners.tl.x + dx, y: startState.corners.tl.y + dy },
                            tr: { x: startState.corners.tr.x + dx, y: startState.corners.tr.y + dy },
                            bl: { x: startState.corners.bl.x + dx, y: startState.corners.bl.y + dy },
                            br: { x: startState.corners.br.x + dx, y: startState.corners.br.y + dy },
                        };
                        setTransformState({ ...startState, corners: newCorners } as FreeTransformState);
                    } else { // Corner drag
                        setTransformState(s => {
                            if (!s || s.type !== 'free') return null;
                            return { ...s, corners: { ...s.corners, [handle]: point } } as FreeTransformState
                        });
                    }
                }
                break;
            }
        }
    }, [viewTransform, setViewTransform, drawStrokeWithMirroring, guideDragState, setRulerGuides, setMirrorGuides, setPerspectiveGuide, activeGuide, isOrthogonalVisible, rulerGuides, orthogonalGuide, setCropRect, setTransformState, isAspectRatioLocked, activeItem, tool, isDrawingTool, isPerspectiveStrokeLockEnabled, perspectiveVPs, snapPointToGrid, strokeMode, strokeState]);
    
    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        if (guideDragState) {
            setGuideDragState(null);
            return;
        }

        const currentActionType = dragAction.current.type;

        if (currentActionType === 'draw' && activeItem?.context) {
            const pointsToDraw = (strokeMode === 'line')
                ? [dragAction.current.points[0], snapPointToGrid(getCanvasPoint(e, viewTransform, uiCanvasRef.current!))]
                : dragAction.current.points;

            let finalPoints = pointsToDraw;
            
            let smoothness = 0;
            if (tool === 'brush') smoothness = brushSettings.smoothness;
            else if (tool === 'marker') smoothness = markerSettings.smoothness;
            else if (tool === 'fx-brush') smoothness = fxBrushSettings.smoothness;

            if (strokeMode === 'freehand' && smoothness > 0 && pointsToDraw.length > 2) {
                const detail = Math.max(1, Math.floor(smoothness / 10)); // e.g. 1-9
                finalPoints = generateSpline(pointsToDraw, detail);
            }

            if (finalPoints.length > 0) {
                if (beforeCanvasRef.current) {
                    // Restore canvas to its state before the stroke for a clean redraw of the smoothed line
                    if(tool === 'eraser' || (smoothness > 0 && strokeMode === 'freehand')){
                        activeItem.context.clearRect(0, 0, activeItem.canvas!.width, activeItem.canvas!.height);
                        activeItem.context.drawImage(beforeCanvasRef.current, 0, 0);
                    }
                }
                
                drawStrokeWithMirroring(activeItem.context, finalPoints);

                if (beforeCanvasRef.current) {
                    onDrawCommit(activeItem.id, beforeCanvasRef.current);
                }
            }
        }
        
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) {
            clearCanvas(previewCtx);
        }
        
        lockedPerspectiveLine.current = null;
        strokeLockInfo.current = null;
        orthogonalLock.current = null;
        dragAction.current = { type: 'none' };
        beforeCanvasRef.current = null;
        
        if (livePreviewLayerId) {
            setLivePreviewLayerId(null);
        }

    }, [activeItem, drawStrokeWithMirroring, onDrawCommit, guideDragState, setGuideDragState, previewCanvasRef, livePreviewLayerId, setLivePreviewLayerId, strokeMode, viewTransform, uiCanvasRef, snapPointToGrid, tool, brushSettings, markerSettings, fxBrushSettings]);

    const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        onPointerUp(e);
    }, [onPointerUp]);
    
    const onDoubleClick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
        
        if (strokeState && strokeState.mode === 'polyline' && strokeState.points.length >= 2) {
            if (activeItem?.context) {
                beforeCanvasRef.current = cloneCanvas(activeItem.canvas!);
                drawStrokeWithMirroring(activeItem.context, strokeState.points);
                onDrawCommit(activeItem.id, beforeCanvasRef.current);
            }
            setStrokeState(null);
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (previewCtx) {
                clearCanvas(previewCtx);
            }
            return;
        }

        if (areGuidesLocked) return;
        const point = getCanvasPoint(e, viewTransform, uiCanvasRef.current);
        const handleThreshold = 15 / viewTransform.zoom;

        if (activeGuide === 'ruler' && rulerGuides) {
            for (const guide of rulerGuides) {
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                if (isNearPoint(point, midPoint, handleThreshold)) {
                    const newGuide: RulerGuide = { ...guide, id: `ruler-${Date.now()}`, start: { x: guide.start.x + 10, y: guide.start.y + 10 }, end: { x: guide.end.x + 10, y: guide.end.y + 10 }, };
                    setRulerGuides(guides => [...guides, newGuide]); return;
                }
            }
        }

        if (activeGuide === 'mirror' && mirrorGuides) {
            for (const guide of mirrorGuides) {
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                if (isNearPoint(point, midPoint, handleThreshold)) {
                    const newGuide: MirrorGuide = { ...guide, id: `mirror-${Date.now()}`, start: { x: guide.start.x + 10, y: guide.start.y + 10 }, end: { x: guide.end.x + 10, y: guide.end.y + 10 }, };
                    setMirrorGuides(guides => [...guides, newGuide]); return;
                }
            }
        }
    }, [activeGuide, rulerGuides, mirrorGuides, setRulerGuides, setMirrorGuides, viewTransform, areGuidesLocked, strokeState, activeItem, onDrawCommit, setStrokeState, drawStrokeWithMirroring, previewCanvasRef]);
    
    const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const factor = 1.1, zoomFactor = e.deltaY < 0 ? factor : 1 / 1.2, rect = e.currentTarget.getBoundingClientRect(), pointerViewX = e.clientX - rect.left, pointerViewY = e.clientY - rect.top;
        setViewTransform(currentTransform => {
            const newZoom = currentTransform.zoom * zoomFactor, pointerCanvasX = (pointerViewX - currentTransform.pan.x) / currentTransform.zoom, pointerCanvasY = (pointerViewY - currentTransform.pan.y) / currentTransform.zoom, newPanX = pointerViewX - pointerCanvasX * newZoom, newPanY = pointerViewY - pointerCanvasY * newZoom;
            return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
        });
    }, [setViewTransform]);

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick, onWheel };
}