import React, { useRef, useCallback, useEffect } from 'react';
import type {
    CanvasItem, SketchObject, Tool, Guide, Point, RulerGuide, PerspectiveGuide, MirrorGuide, OrthogonalGuide,
    CropRect, ViewTransform, PerspectiveControlPoint, TransformState, AffineTransformState, FreeTransformState, GridGuide,
    StrokeMode, StrokeState, Selection, MagicWandSettings, StrokeModifier, BrushSettings
} from '../types';
import { getCanvasPoint, isNearPoint, projectPointOnLine, pointInPolygon, cloneCanvas, distanceToLineSegment, distanceToLine, getLineIntersection, createMagicWandSelection, getPerspectiveBoxPoints, getVisibleBoxEdges } from '../utils/canvasUtils';
import { clearCanvas } from '../utils/canvasUtils';
import { type BaseBrush, type BrushContext } from '../lib/brushes/BaseBrush';

type DragAction =
    | { type: 'none' }
    | { type: 'pan'; startX: number; startY: number; startPan: { x: number; y: number } }
    | { type: 'draw' } // Simplified, state is now in the brush instance
    | { type: 'selection'; tool: 'marquee-rect' | 'lasso'; startPoint: Point; points: Point[] }
    | { type: 'crop'; handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move'; startRect: CropRect, startPoint: Point }
    | { type: 'transform'; handle: string; startState: TransformState, startPoint: Point; center?: Point }
    | { type: 'text-place' };

type GuideDragState =
    | { type: 'ruler', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'mirror', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'perspective', color: 'green' | 'red' | 'blue'; lineId: string; part: 'start' | 'end' }
    | { type: 'perspective-point', part: 'point' }
    | { type: 'perspective-extra', color: 'green' | 'red' | 'blue', id: string }
    | null;

type PerspectiveVPs = { vpGreen: Point | null, vpRed: Point | null, vpBlue: Point | null };

function generateCurvePoints(points: Point[]): Point[] {
    if (points.length < 3) return points;
    const curvePoints: Point[] = [];
    const [p0, p1, p2] = points;
    for (let t = 0; t <= 1; t += 0.01) {
        const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
        const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
        const p0_pressure = p0.pressure ?? 1.0;
        const p1_pressure = p1.pressure ?? p0_pressure + ((p2.pressure ?? 1.0) - p0_pressure) / 2;
        const p2_pressure = p2.pressure ?? 1.0;
        const pressure = (1 - t) ** 2 * p0_pressure + 2 * (1 - t) * t * p1_pressure + t ** 2 * p2_pressure;
        curvePoints.push({ x, y, pressure });
    }
    return curvePoints;
}

function generateArcPoints(points: Point[], totalAngle?: number): Point[] {
    if (points.length < 3) return points;
    const [center, p1, p2] = points;
    const radius = Math.hypot(p1.x - center.x, p1.y - center.y);
    const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
    let angleDiff: number;

    if (totalAngle !== undefined) {
        angleDiff = totalAngle;
    } else {
        // Fallback to original shortest-path logic
        const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
        const twoPi = Math.PI * 2;
        angleDiff = endAngle - startAngle;
        if (angleDiff > Math.PI) angleDiff -= twoPi;
        if (angleDiff < -Math.PI) angleDiff += twoPi;
    }

    const arcPoints: Point[] = [];
    const numSteps = Math.max(10, Math.ceil(Math.abs(angleDiff * radius) / 2));

    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const angle = startAngle + angleDiff * t;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        const pressure = ((p1.pressure ?? 1.0) * (1 - t)) + ((p2.pressure ?? 1.0) * t);
        arcPoints.push({ x, y, pressure });
    }
    return arcPoints;
}


export function usePointerEvents({
    items,
    uiCanvasRef,
    previewCanvasRef,
    viewTransform,
    setViewTransform,
    activeItem,
    tool,
    brushSettings,
    isDrawingTool,
    isSelectionTool,
    onDrawCommit,
    onSelectItem,
    getBrushForTool,
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
    isAngleSnapEnabled,
    angleSnapValue,
    livePreviewLayerId,
    setLivePreviewLayerId,
    isPerspectiveStrokeLockEnabled,
    isSnapToGridEnabled,
    gridGuide,
    strokeMode,
    strokeState,
    setStrokeState,
    magicWandSettings,
    selection,
    setSelection,
    onUpdateItem,
    forceRender,
    getMinZoom,
    MAX_ZOOM,
    onAddItem,
    textEditState,
    setTextEditState,
    onCommitText,
    strokeSmoothing,
    strokeModifier,
    setDebugPointers,
    isPalmRejectionEnabled,
    isSolidBox,
    fillColor,
}: {
    items: CanvasItem[];
    uiCanvasRef: React.RefObject<HTMLCanvasElement>;
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
    viewTransform: ViewTransform;
    setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
    activeItem: CanvasItem | null | undefined;
    tool: Tool;
    brushSettings: BrushSettings;
    isDrawingTool: boolean;
    isSelectionTool: boolean;
    onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
    onSelectItem: (id: string | null) => void;
    getBrushForTool: (tool: Tool) => BaseBrush | null;
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
    isAngleSnapEnabled: boolean;
    angleSnapValue: 1 | 5 | 10 | 15;
    livePreviewLayerId: string | null;
    setLivePreviewLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    isPerspectiveStrokeLockEnabled: boolean;
    isSnapToGridEnabled: boolean;
    gridGuide: GridGuide;
    strokeMode: StrokeMode;
    strokeState: StrokeState | null;
    setStrokeState: React.Dispatch<React.SetStateAction<StrokeState | null>>;
    magicWandSettings: MagicWandSettings;
    selection: Selection | null;
    setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
    onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
    forceRender: () => void;
    getMinZoom: () => number;
    MAX_ZOOM: number;
    onAddItem: (type: 'group' | 'object') => string;
    textEditState: { position: Point; value: string; activeItemId: string; } | null;
    setTextEditState: React.Dispatch<React.SetStateAction<{ position: Point; value: string; activeItemId: string; } | null>>;
    onCommitText: (textState: { position: Point; value: string; activeItemId: string; }) => void;
    strokeSmoothing: number;
    strokeModifier: StrokeModifier;
    setDebugPointers: React.Dispatch<React.SetStateAction<Map<number, { x: number, y: number }>>>;
    isPalmRejectionEnabled: boolean;
    isSolidBox: boolean;
    fillColor: string;
}) {
    const canvasRectRef = useRef<DOMRect | null>(null);

    const dragAction = useRef<DragAction>({ type: 'none' });
    const activeBrushRef = useRef<BaseBrush | null>(null);
    const strokeLockInfo = useRef<{ startPoint: Point; targetVP: Point | null; locked: boolean } | null>(null);
    const orthogonalLock = useRef<{ axis: 'x' | 'y', startPoint: Point } | null>(null);
    const arcDrawingState = useRef<{ lastAngle: number; totalAngle: number } | null>(null);
    const activePointers = useRef(new Map<number, { x: number; y: number }>());
    const lastGestureState = useRef<{ distance: number; midpoint: Point } | null>(null);
    const wasInGestureRef = useRef(false);
    // Base gesture state captured when a two-finger gesture starts. Contains the
    // initial distance, midpoint, zoom and pan so we can compute incremental
    // zoom and pan updates relative to the gesture start.
    const gestureBaseRef = useRef<{ distance: number; midpoint: Point; zoom: number; pan: { x: number; y: number } } | null>(null);
    const longPressTimerRef = useRef<number | null>(null);

    // Throttle debug ptrs update to avoid excessive re-renders
    const lastDebugUpdateRef = useRef(0);

    // Cache the rect on mount and resize
    useEffect(() => {
        const updateRect = () => {
            if (uiCanvasRef.current) {
                canvasRectRef.current = uiCanvasRef.current.getBoundingClientRect();
            }
        };
        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, { capture: true, passive: true });
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, { capture: true });
        };
    }, [uiCanvasRef]);

    // Optimized getCanvasPoint using cached rect if available
    const getPoint = useCallback((e: PointerEvent | React.PointerEvent, vt: ViewTransform) => {
        if (!canvasRectRef.current && uiCanvasRef.current) {
            canvasRectRef.current = uiCanvasRef.current.getBoundingClientRect();
        }
        if (!canvasRectRef.current) return { x: 0, y: 0 };

        const rect = canvasRectRef.current;
        const clientX = 'clientX' in e ? e.clientX : (e as any).changedTouches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in e ? e.clientY : (e as any).changedTouches?.[0]?.clientY ?? 0;

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            x: (x - vt.pan.x) / vt.zoom,
            y: (y - vt.pan.y) / vt.zoom,
        };
    }, []);

    const setDragAction = (action: DragAction) => {
        dragAction.current = action;
        forceRender();
    };

    useEffect(() => {
        if (!strokeState) {
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (previewCtx) {
                clearCanvas(previewCtx);
            }
        }
    }, [strokeState, previewCanvasRef]);

    useEffect(() => {
        // Reset arc drawing state if tool or mode changes
        arcDrawingState.current = null;
    }, [tool, strokeMode]);

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
            const s = spacing;
            const { x, y } = point;

            const angle_rad = -30 * (Math.PI / 180);
            const cos_a = Math.cos(angle_rad);
            const sin_a = Math.sin(angle_rad);
            const x_rot = x * cos_a - y * sin_a;
            const y_rot = x * sin_a + y * cos_a;

            const L = s * 2 / Math.sqrt(3);

            const q_f = (x_rot * (Math.sqrt(3) / 3) - y_rot / 3) / (L / Math.sqrt(3));
            const r_f = (y_rot * 2 / 3) / (L / Math.sqrt(3));

            const s_f = -q_f - r_f;

            let q_r = Math.round(q_f);
            let r_r = Math.round(r_f);
            let s_r = Math.round(s_f);

            const dq = Math.abs(q_r - q_f);
            const dr = Math.abs(r_r - r_f);
            const ds = Math.abs(s_r - s_f);

            if (dq > dr && dq > ds) {
                q_r = -r_r - s_r;
            } else if (dr > ds) {
                r_r = -q_r - s_r;
            }

            const snapped_x_rot = L * (q_r + r_r / 2);
            const snapped_y_rot = L * (r_r * Math.sqrt(3) / 2);

            const final_angle_rad = 30 * (Math.PI / 180);
            const cos_fa = Math.cos(final_angle_rad);
            const sin_fa = Math.sin(final_angle_rad);

            const snapped_x = snapped_x_rot * cos_fa - snapped_y_rot * sin_fa;
            const snapped_y = snapped_x_rot * sin_fa + snapped_y_rot * cos_fa;

            return { ...point, x: snapped_x, y: snapped_y };
        }

        return point;
    }, [isSnapToGridEnabled, gridGuide]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
        // Update rect ensuring it's fresh for the gesture start
        canvasRectRef.current = uiCanvasRef.current.getBoundingClientRect();

        if (e.button !== 0 && e.pointerType === 'mouse' && e.button !== 1) return;
        if (e.pointerType === 'pen' && e.pressure === 0) return;

        // Palm Rejection: If enabled, only allow pen input for interaction/drawing
        if (isPalmRejectionEnabled && e.pointerType !== 'pen') {
            // Still allow multi-touch gestures (zoom/pan) to accumulate in activePointers
            // But we must NOT start a drawing or single-pointer action
            // Optimization: If it's a single touch and we are rejecting it, we can perhaps return early for drawing checks?
            // Actually, we need to track it for potential gestures.
        } else {
            // For non-rejected inputs (pen or touch when disabled)
        }

        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        setDebugPointers(new Map(activePointers.current));

        // Palm Rejection Logic for actions
        const isRejectedPointer = isPalmRejectionEnabled && e.pointerType !== 'pen';

        // If it's a rejected pointer, we ONLY care if it contributes to a multi-touch gesture.
        // We should skip all drawing/manipulation logic if it's the *only* pointer or if we are just starting.

        if (activePointers.current.size < 2 && isRejectedPointer) {
            // Single touch with palm rejection on -> DO NOTHING (waiting for potential second finger)
            return;
        }

        if (activePointers.current.size >= 2) {
            wasInGestureRef.current = true;
            if (activeBrushRef.current?.isDrawing) {
                activeBrushRef.current.onPointerCancel(null);
                activeBrushRef.current = null;
                // Manually clear preview for freehand drawing interruption
                const previewCtx = previewCanvasRef.current?.getContext('2d');
                if (previewCtx) {
                    clearCanvas(previewCtx);
                }
            }
            setStrokeState(null);
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            lastGestureState.current = null;

            if (activePointers.current.size === 2) {
                // FIX: Explicitly type `pointers` to resolve type inference issue with Map values.
                const pointers: { x: number, y: number }[] = Array.from(activePointers.current.values());
                const p1 = pointers[0];
                const p2 = pointers[1];
                const midpoint = {
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2,
                };
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.hypot(dx, dy);
                // Capture base gesture state so subsequent moves can compute
                // scale relative to the initial distance and keep the zoom
                // centered on the initial midpoint.
                gestureBaseRef.current = { distance, midpoint, zoom: viewTransform.zoom, pan: viewTransform.pan };
                setDragAction({
                    type: 'pan',
                    startX: midpoint.x,
                    startY: midpoint.y,
                    startPan: viewTransform.pan,
                });
            } else {
                setDragAction({ type: 'none' });
            }
            return;
        }

        const point = getPoint(e, viewTransform) as Point;
        let snappedPoint = snapPointToGrid(point);

        // Ruler Constraint
        if (activeGuide === 'ruler' && rulerGuides.length > 0) {
            const guide = rulerGuides[0]; // Assume first ruler is active for now, or find closest?
            // Project snappedPoint onto the line defined by guide.start and guide.end
            const A = guide.start;
            const B = guide.end;
            const P = snappedPoint;
            const AB = { x: B.x - A.x, y: B.y - A.y };
            const AP = { x: P.x - A.x, y: P.y - A.y };
            const ab2 = AB.x * AB.x + AB.y * AB.y;
            if (ab2 > 0) {
                const t = (AP.x * AB.x + AP.y * AB.y) / ab2;
                snappedPoint = { x: A.x + AB.x * t, y: A.y + AB.y * t };
            }
        }

        const isPressureSensitive = strokeMode === 'freehand';
        const pressure = (isPressureSensitive && e.pointerType === 'pen') ? e.pressure : 1.0;
        const snappedPointWithPressure = { ...snappedPoint, pressure };

        strokeLockInfo.current = null;
        orthogonalLock.current = null;

        if (!areGuidesLocked) {
            const threshold = 10 / viewTransform.zoom;

            if (activeGuide === 'ruler') {
                for (const guide of rulerGuides) {
                    if (isNearPoint(point, guide.start, threshold)) {
                        setGuideDragState({ type: 'ruler', id: guide.id, part: 'start', offset: { x: 0, y: 0 } });
                        return;
                    }
                    if (isNearPoint(point, guide.end, threshold)) {
                        setGuideDragState({ type: 'ruler', id: guide.id, part: 'end', offset: { x: 0, y: 0 } });
                        return;
                    }

                }
            }
            if (activeGuide === 'mirror') {
                for (const guide of mirrorGuides) {
                    if (isNearPoint(point, guide.start, threshold)) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'start', offset: { x: 0, y: 0 } });
                        return;
                    }
                    if (isNearPoint(point, guide.end, threshold)) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'end', offset: { x: 0, y: 0 } });
                        return;
                    }
                    if (distanceToLineSegment(point, guide.start, guide.end) < threshold) {
                        setGuideDragState({ type: 'mirror', id: guide.id, part: 'line', offset: { x: guide.start.x - point.x, y: guide.start.y - point.y } });
                        return;
                    }
                }
            }
            if (activeGuide === 'perspective' && perspectiveGuide) {
                const { lines, guidePoint, extraGuideLines } = perspectiveGuide;
                if (isNearPoint(point, guidePoint, threshold * 1.5)) {
                    setGuideDragState({ type: 'perspective-point', part: 'point' });
                    return;
                }
                for (const color of ['green', 'red', 'blue'] as const) {
                    for (const line of lines[color]) {
                        if (isNearPoint(point, line.start, threshold)) {
                            setGuideDragState({ type: 'perspective', color, lineId: line.id, part: 'start' });
                            return;
                        }
                        if (isNearPoint(point, line.end, threshold)) {
                            setGuideDragState({ type: 'perspective', color, lineId: line.id, part: 'end' });
                            return;
                        }
                    }
                    for (const extra of extraGuideLines[color]) {
                        if (isNearPoint(point, extra.handle, threshold)) {
                            setGuideDragState({ type: 'perspective-extra', color, id: extra.id });
                            return;
                        }
                    }
                }
            }
        }

        if (tool === 'crop' && cropRect) {
            const getCropHandles = (rect: CropRect) => ({
                tl: { x: rect.x, y: rect.y }, tr: { x: rect.x + rect.width, y: rect.y }, bl: { x: rect.x, y: rect.y + rect.height }, br: { x: rect.x + rect.width, y: rect.y + rect.height },
                t: { x: rect.x + rect.width / 2, y: rect.y }, b: { x: rect.x + rect.width / 2, y: rect.y + rect.height }, l: { x: rect.x, y: rect.y + rect.height / 2 }, r: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
            });
            const handles = getCropHandles(cropRect);
            const threshold = 10 / viewTransform.zoom;
            for (const [handle, pos] of Object.entries(handles)) {
                if (pos && isNearPoint(point, pos as Point, threshold)) {
                    setDragAction({ type: 'crop', handle: handle as any, startRect: cropRect, startPoint: point });
                    return;
                }
            }
            if (point.x > cropRect.x && point.x < cropRect.x + cropRect.width && point.y > cropRect.y && point.y < cropRect.y + cropRect.height) {
                setDragAction({ type: 'crop', handle: 'move', startRect: cropRect, startPoint: point });
                return;
            }
        }

        if ((tool === 'transform' || tool === 'free-transform') && transformState) {
            const threshold = 10 / viewTransform.zoom;
            if (transformState.type === 'affine') {
                const { x, y, width, height, rotation } = transformState;
                const center = { x: x + width / 2, y: y + height / 2 };
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rotate = (p: Point) => ({
                    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
                });

                const handles = {
                    tl: rotate({ x, y }), tr: rotate({ x: x + width, y }), bl: rotate({ x, y: y + height }), br: rotate({ x: x + width, y: y + height }),
                    t: rotate({ x: x + width / 2, y }), b: rotate({ x: x + width / 2, y: y + height }), l: rotate({ x, y: y + height / 2 }), r: rotate({ x: x + width, y: y + height / 2 }),
                    rotate: rotate({ x: x + width / 2, y: y - 25 / viewTransform.zoom }),
                };

                for (const [handle, pos] of Object.entries(handles)) {
                    if (pos && isNearPoint(point, pos as Point, threshold)) {
                        setDragAction({ type: 'transform', handle, startState: transformState, startPoint: point, center });
                        return;
                    }
                }
            } else if (transformState.type === 'free') {
                const handles = transformState.corners;
                for (const [handle, pos] of Object.entries(handles)) {
                    if (pos && isNearPoint(point, pos as Point, threshold)) {
                        setDragAction({ type: 'transform', handle, startState: transformState, startPoint: point });
                        return;
                    }
                }
            }
            if (transformState.type === 'free' && pointInPolygon(point, Object.values(transformState.corners))) {
                setDragAction({ type: 'transform', handle: 'move', startState: transformState, startPoint: point });
                return;
            }
            if (transformState.type === 'affine') {
                const localPoint = { x: point.x - (transformState.x + transformState.width / 2), y: point.y - (transformState.y + transformState.height / 2) };
                const rotatedPoint = { x: localPoint.x * Math.cos(-transformState.rotation) - localPoint.y * Math.sin(-transformState.rotation), y: localPoint.x * Math.sin(-transformState.rotation) + localPoint.y * Math.cos(-transformState.rotation) };
                if (Math.abs(rotatedPoint.x) < transformState.width / 2 && Math.abs(rotatedPoint.y) < transformState.height / 2) {
                    setDragAction({ type: 'transform', handle: 'move', startState: transformState, startPoint: point });
                    return;
                }
            }
        }

        if (tool === 'text') {
            if (textEditState) onCommitText(textEditState);
            setDragAction({ type: 'text-place' });
            return;
        }

        if (isSelectionTool) {
            setSelection(null);
            if (tool === 'marquee-rect' || tool === 'lasso') {
                setDragAction({ type: 'selection', tool, startPoint: snappedPoint, points: [snappedPoint] });
                return;
            } else if (tool === 'magic-wand') {
                if (activeItem && activeItem.type === 'object' && (activeItem as SketchObject).canvas) {
                    const canvas = (activeItem as SketchObject).canvas!;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) return;

                    try {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const startX = Math.floor(snappedPoint.x);
                        const startY = Math.floor(snappedPoint.y);

                        const selectionData = createMagicWandSelection(imageData, startX, startY, magicWandSettings.tolerance, magicWandSettings.contiguous);

                        if (selectionData) {
                            setSelection({
                                path: selectionData.path,
                                boundingBox: selectionData.bbox,
                                sourceItemId: activeItem.id,
                            });
                        }
                    } catch (e) {
                        console.error("Could not get image data for magic wand.", e);
                        alert("Error: Could not perform magic wand selection. The canvas may be tainted by cross-origin content.");
                    }
                }
                return;
            }
        }

        if (isDrawingTool && ['line'].includes(strokeMode)) {
            setDragAction({ type: 'draw' });
            if (!strokeState) {
                setStrokeState({ mode: strokeMode, points: [snappedPointWithPressure] });
            }
            return;
        }

        if (isDrawingTool && ['polyline', 'curve', 'arc', 'parallelepiped', 'rectangle', 'circle', 'rotated-rectangle'].includes(strokeMode)) {
            if (strokeMode === 'polyline') {
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = window.setTimeout(() => {
                    if (activeItem && activeItem.type === 'object' && strokeState && strokeState.points.length > 1) {
                        const beforeCanvas = cloneCanvas((activeItem as SketchObject).canvas!);
                        const mainCtx = (activeItem as SketchObject).context!;
                        const brush = getBrushForTool(tool);
                        if (brush) {
                            const brushContext: BrushContext = { mainCtx, previewCtx: previewCanvasRef.current!.getContext('2d')!, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };
                            (brush as any).drawWithMirroring(mainCtx, strokeState.points, brushContext);
                            onDrawCommit(activeItem.id, beforeCanvas);
                        }
                    }
                    setStrokeState(null);
                    longPressTimerRef.current = null;
                }, 700);
            }

            if (!strokeState) {
                setStrokeState({ mode: strokeMode, points: [snappedPointWithPressure] });
                if (strokeMode === 'arc') {
                    arcDrawingState.current = null;
                }
            } else {
                const newPoints = [...strokeState.points, snappedPointWithPressure];

                let isClosed = false;
                if (strokeMode === 'polyline' && newPoints.length > 2) {
                    const startPoint = newPoints[0];
                    const endPoint = newPoints[newPoints.length - 1];
                    const dist = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
                    if (dist < 10 / viewTransform.zoom) {
                        isClosed = true;
                        // Snap last point to start point to close the loop perfectly
                        newPoints[newPoints.length - 1] = { ...startPoint, pressure: endPoint.pressure };
                    }
                }

                setStrokeState({ ...strokeState, points: newPoints });

                let strokeComplete = false;
                if (strokeMode === 'curve' && newPoints.length === 3) strokeComplete = true;
                if (strokeMode === 'arc' && newPoints.length === 3) strokeComplete = true;
                if (strokeMode === 'parallelepiped' && newPoints.length === 3) strokeComplete = true;
                if (strokeMode === 'rectangle' && newPoints.length === 2) strokeComplete = true;
                if (strokeMode === 'circle' && newPoints.length === 2) strokeComplete = true;
                if (strokeMode === 'rotated-rectangle' && newPoints.length === 3) strokeComplete = true;
                if (isClosed) strokeComplete = true;

                if (strokeComplete && activeItem?.type === 'object') {
                    const beforeCanvas = cloneCanvas(activeItem.canvas!);
                    const mainCtx = activeItem.context!;
                    const brush = getBrushForTool(tool);
                    if (brush) {
                        const brushContext: BrushContext = { mainCtx, previewCtx: previewCanvasRef.current!.getContext('2d')!, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };

                        // Handle Fill for Shapes
                        if (fillColor && fillColor !== 'transparent') {
                            mainCtx.save();
                            mainCtx.fillStyle = fillColor;

                            if (strokeMode === 'polyline' && isClosed) {
                                mainCtx.beginPath();
                                mainCtx.moveTo(newPoints[0].x, newPoints[0].y);
                                for (let i = 1; i < newPoints.length; i++) mainCtx.lineTo(newPoints[i].x, newPoints[i].y);
                                mainCtx.closePath();
                                mainCtx.fill();
                            } else if (strokeMode === 'rectangle' && newPoints.length === 2) {
                                const width = newPoints[1].x - newPoints[0].x;
                                const height = newPoints[1].y - newPoints[0].y;
                                mainCtx.fillRect(newPoints[0].x, newPoints[0].y, width, height);
                            } else if (strokeMode === 'circle' && newPoints.length === 2) {
                                const radius = Math.hypot(newPoints[1].x - newPoints[0].x, newPoints[1].y - newPoints[0].y);
                                mainCtx.beginPath();
                                mainCtx.arc(newPoints[0].x, newPoints[0].y, radius, 0, 2 * Math.PI);
                                mainCtx.fill();
                            } else if (strokeMode === 'rotated-rectangle' && newPoints.length === 3) {
                                const p1 = newPoints[0];
                                const p2 = newPoints[1];
                                const p3 = newPoints[2];
                                // Calculate 4th point
                                // Vector p1->p2
                                const dx = p2.x - p1.x;
                                const dy = p2.y - p1.y;
                                // Vector p2->p3 (projected perpendicular to p1->p2 ?)
                                // User expects 3 points: Base Start, Base End, Extrusion Height.
                                // Logic:
                                // Base = p1->p2.
                                // Height = Distance from p3 to line(p1,p2).
                                // OR: p3 simply defines the opposite side.
                                // Standard 3-point rect:
                                // 1. Click p1
                                // 2. Click p2 (defines angle and width)
                                // 3. Drag/Click p3 (defines height, perpendicular to p1-p2)

                                // Proper math:
                                // Vector U = p2 - p1 (Unit vector u)
                                // Vector V = p3 - p2
                                // Height = V dot Normal(U) ?
                                // Easier: Project p3 onto the line perpendicular to p1-p2.

                                const len = Math.hypot(dx, dy);
                                if (len > 0) {
                                    const ux = dx / len;
                                    const uy = dy / len;
                                    const nx = -uy;
                                    const ny = ux;

                                    // Vector p2->p3
                                    const v23x = p3.x - p2.x;
                                    const v23y = p3.y - p2.y;

                                    // Project v23 onto normal
                                    const dist = v23x * nx + v23y * ny;

                                    // p3_projected (p4) = p1 + (dist * normal)
                                    // p3_actual (adjusted) = p2 + (dist * normal)
                                    const p3_final = { x: p2.x + nx * dist, y: p2.y + ny * dist };
                                    const p4_final = { x: p1.x + nx * dist, y: p1.y + ny * dist };

                                    mainCtx.beginPath();
                                    mainCtx.moveTo(p1.x, p1.y);
                                    mainCtx.lineTo(p2.x, p2.y);
                                    mainCtx.lineTo(p3_final.x, p3_final.y);
                                    mainCtx.lineTo(p4_final.x, p4_final.y);
                                    mainCtx.closePath();
                                    mainCtx.fill();
                                }
                            }

                            mainCtx.restore();
                        }

                        if (strokeMode === 'parallelepiped') {
                            const vps = perspectiveVPs.current;
                            if (vps.vpGreen && vps.vpRed) {

                                const corners = getPerspectiveBoxPoints(newPoints[0], newPoints[1], newPoints[2], vps);
                                if (corners.length === 8) {

                                    // Fill Box Faces if fillColor is set
                                    if (fillColor && fillColor !== 'transparent') {
                                        mainCtx.save();
                                        mainCtx.fillStyle = fillColor;
                                        const faces = [
                                            [0, 1, 2, 3], // Base
                                            [4, 5, 6, 7], // Top
                                            [0, 4, 7, 3], // Side 1
                                            [1, 5, 4, 0], // Side 2
                                            [2, 6, 5, 1], // Side 3
                                            [3, 7, 6, 2]  // Side 4
                                        ];
                                        // Simple painter's alg (draw all) - not perfect but okay for opaque solids often
                                        faces.forEach(faceIndices => {
                                            mainCtx.beginPath();
                                            mainCtx.moveTo(corners[faceIndices[0]].x, corners[faceIndices[0]].y);
                                            for (let k = 1; k < 4; k++) mainCtx.lineTo(corners[faceIndices[k]].x, corners[faceIndices[k]].y);
                                            mainCtx.closePath();
                                            mainCtx.fill();
                                        });
                                        mainCtx.restore();
                                    }

                                    let edges: Point[][] = [];

                                    if (isSolidBox) {
                                        // Use hidden line removal logic
                                        // Import getVisibleBoxEdges if not already there (it is)
                                        // We need to ensure getVisibleBoxEdges is available or imported.
                                        // Assuming getVisibleBoxEdges is imported from utils/canvasUtils
                                        const visibleEdges = getVisibleBoxEdges(corners);
                                        // format visibleEdges as simple pairs? getVisibleBoxEdges returns pairs
                                        edges = visibleEdges;
                                    } else {
                                        // Default Wireframe
                                        const edgeIndices = [
                                            [0, 1], [1, 2], [2, 3], [3, 0], // Base
                                            [4, 5], [5, 6], [6, 7], [7, 4], // Top
                                            [0, 4], [1, 5], [2, 6], [3, 7]  // Vertical
                                        ];
                                        edges = edgeIndices.map(([i, j]) => [corners[i], corners[j]]);
                                    }

                                    edges.forEach((edgePoints) => {
                                        (brush as any).drawWithMirroring(mainCtx, edgePoints, brushContext);
                                    });
                                }
                            }
                        } else {
                            let pointsToDraw = newPoints;
                            if (strokeMode === 'curve') pointsToDraw = generateCurvePoints(newPoints);
                            if (strokeMode === 'arc') {
                                pointsToDraw = generateArcPoints(newPoints, arcDrawingState.current?.totalAngle);
                            }
                            if (strokeMode === 'rectangle' && newPoints.length === 2) {
                                const p1 = newPoints[0];
                                const p2 = newPoints[1];
                                pointsToDraw = [p1, { x: p2.x, y: p1.y, pressure: p1.pressure }, p2, { x: p1.x, y: p2.y, pressure: p2.pressure }, p1];
                            }
                            if (strokeMode === 'circle' && newPoints.length === 2) {
                                const center = newPoints[0];
                                const radius = Math.hypot(newPoints[1].x - center.x, newPoints[1].y - center.y);
                                pointsToDraw = [];
                                const steps = Math.max(30, Math.ceil(radius));
                                for (let i = 0; i <= steps; i++) {
                                    const theta = (i / steps) * 2 * Math.PI;
                                    pointsToDraw.push({
                                        x: center.x + radius * Math.cos(theta),
                                        y: center.y + radius * Math.sin(theta),
                                        pressure: newPoints[1].pressure
                                    });
                                }
                            }
                            if (strokeMode === 'rotated-rectangle' && newPoints.length === 3) {
                                const p1 = newPoints[0];
                                const p2 = newPoints[1];
                                const p3 = newPoints[2];
                                const dx = p2.x - p1.x;
                                const dy = p2.y - p1.y;
                                const len = Math.hypot(dx, dy);
                                if (len > 0) {
                                    const ux = dx / len;
                                    const uy = dy / len;
                                    const nx = -uy;
                                    const ny = ux;
                                    const v23x = p3.x - p2.x;
                                    const v23y = p3.y - p2.y;
                                    const dist = v23x * nx + v23y * ny;
                                    const p3_final = { x: p2.x + nx * dist, y: p2.y + ny * dist, pressure: p3.pressure };
                                    const p4_final = { x: p1.x + nx * dist, y: p1.y + ny * dist, pressure: p3.pressure };
                                    pointsToDraw = [p1, p2, p3_final, p4_final, p1];
                                }
                            }

                            (brush as any).drawWithMirroring(mainCtx, pointsToDraw, brushContext);
                        }

                        onDrawCommit(activeItem.id, beforeCanvas);
                    }
                    setStrokeState(null);
                }
            }
            return;
        }

        if (tool === 'pan' || (e.button === 1 && e.pointerType === 'mouse')) {
            setDragAction({ type: 'pan', startX: e.clientX, startY: e.clientY, startPan: viewTransform.pan });
            e.currentTarget.style.cursor = 'grabbing';
            return;
        }

        if (isDrawingTool && activeItem && activeItem.type === 'object' && strokeMode === 'freehand') {
            if (tool === 'eraser') {
                setLivePreviewLayerId(activeItem.id);
            }
            const brush = getBrushForTool(tool);
            if (!brush) return;

            brush.updateSmoothing(strokeSmoothing);
            activeBrushRef.current = brush;
            setDragAction({ type: 'draw' });

            orthogonalLock.current = { axis: 'x', startPoint: snappedPoint };
            if (isPerspectiveStrokeLockEnabled && activeGuide === 'perspective') {
                strokeLockInfo.current = { startPoint: snappedPoint, targetVP: null, locked: false };
            }

            const mainCtx = (activeItem as SketchObject).context;
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (mainCtx && previewCtx) {
                const brushContext: BrushContext = { mainCtx, previewCtx, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };
                brush.onPointerDown(snappedPointWithPressure, brushContext);
            }
        }
    }, [tool, viewTransform, activeItem, isDrawingTool, isSelectionTool, magicWandSettings, setSelection, cropRect, activeGuide, rulerGuides, mirrorGuides, perspectiveGuide, areGuidesLocked, setPerspectiveGuide, setRulerGuides, setMirrorGuides, setGuideDragState, perspectiveVPs, transformState, isPerspectiveStrokeLockEnabled, snapPointToGrid, strokeMode, strokeState, setStrokeState, onDrawCommit, onAddItem, setTextEditState, textEditState, onCommitText, getBrushForTool, strokeSmoothing, strokeModifier, setDebugPointers, isPalmRejectionEnabled, isSolidBox, fillColor]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;

        // Use coalesced events (if available) to update pointer positions for
        // improved responsiveness on high-frequency input (touch/pen).
        const nativeEv = (e.nativeEvent as any);
        const coalescedForPointer: any[] = nativeEv.getCoalescedEvents ? nativeEv.getCoalescedEvents() : [nativeEv];
        for (const ev of coalescedForPointer) {
            if (activePointers.current.has(ev.pointerId)) {
                activePointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            }
        }

        const now = Date.now();
        if (now - lastDebugUpdateRef.current > 16) { // ~60fps Limit
            setDebugPointers(new Map(activePointers.current));
            lastDebugUpdateRef.current = now;
        }

        if (activePointers.current.size >= 2) {
            // Use two-finger gesture: combine pinch (zoom) and two-finger pan.
            const pointers: { x: number, y: number }[] = Array.from(activePointers.current.values());
            if (pointers.length < 2) return;
            const [p1, p2] = pointers;
            const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.hypot(dx, dy);

            // Initialize gesture base if it's the first move
            if (!gestureBaseRef.current) {
                gestureBaseRef.current = { distance, midpoint, zoom: viewTransform.zoom, pan: viewTransform.pan };
            }

            const base = gestureBaseRef.current;
            // Compute scale from initial gesture distance
            const scale = base.distance > 0 ? (distance / base.distance) : 1;
            let newZoom = base.zoom * scale;
            const minZoom = getMinZoom ? getMinZoom() : 0.1;
            if (newZoom < minZoom) newZoom = minZoom;
            if (newZoom > MAX_ZOOM) newZoom = MAX_ZOOM;

            // Keep the world point under the gesture midpoint stable while zooming and panning.
            // Formula: newPan = newMidpoint - ((baseMidpoint - basePan) * (newZoom / baseZoom))
            const r = base.zoom > 0 ? (newZoom / base.zoom) : 1;
            const newPanX = midpoint.x - ((base.midpoint.x - base.pan.x) * r);
            const newPanY = midpoint.y - ((base.midpoint.y - base.pan.y) * r);

            setViewTransform(v => ({ ...v, zoom: newZoom, pan: { x: newPanX, y: newPanY } }));

            // Keep dragAction as 'pan' so pointerup logic can reset it; update wasInGesture
            wasInGestureRef.current = true;
            return;
        }

        // Reuse coalesced events for drawing; this returns an array of
        // low-level PointerEvent objects for higher fidelity input.
        const events = nativeEv.getCoalescedEvents ? nativeEv.getCoalescedEvents() : [nativeEv];
        const lastEvent = events[events.length - 1];
        const currentAction = dragAction.current;

        // Handle drawing (which needs all points) separately and first.
        if (currentAction.type === 'draw' && activeBrushRef.current) {
            const mainCtx = (activeItem as SketchObject)?.context;
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (mainCtx && previewCtx && activeItem) {
                const brushContext: BrushContext = { mainCtx, previewCtx, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };
                for (const event of events) {
                    const point = getPoint(event, viewTransform) as Point;

                    let pointToDraw = point;
                    let didSnapToGuideForPoint = false;

                    if (isOrthogonalVisible && orthogonalLock.current) {
                        const { startPoint } = orthogonalLock.current;
                        const dx = Math.abs(point.x - startPoint.x);
                        const dy = Math.abs(point.y - startPoint.y);

                        if (dx > 5 || dy > 5) {
                            if (dx > dy) orthogonalLock.current.axis = 'x';
                            else orthogonalLock.current.axis = 'y';
                        }

                        if (orthogonalLock.current.axis === 'x') pointToDraw = { ...point, y: startPoint.y };
                        else pointToDraw = { ...point, x: startPoint.x };
                        didSnapToGuideForPoint = true;

                    } else if (activeGuide === 'ruler' && rulerGuides.length > 0) {
                        const guide = rulerGuides[0]; // Assume first ruler is active
                        const A = guide.start;
                        const B = guide.end;
                        const P = point; // Use raw point before grid snap
                        const AB = { x: B.x - A.x, y: B.y - A.y };
                        const AP = { x: P.x - A.x, y: P.y - A.y };
                        const ab2 = AB.x * AB.x + AB.y * AB.y;
                        if (ab2 > 0) {
                            const t = (AP.x * AB.x + AP.y * AB.y) / ab2;
                            pointToDraw = { x: A.x + AB.x * t, y: A.y + AB.y * t };
                        }
                        didSnapToGuideForPoint = true;
                    } else if (isPerspectiveStrokeLockEnabled && activeGuide === 'perspective' && strokeLockInfo.current) {
                        const info = strokeLockInfo.current;

                        // If not locked yet, try to determine the best VP based on stroke direction
                        if (!info.locked && perspectiveVPs.current) {
                            const dist = Math.hypot(point.x - info.startPoint.x, point.y - info.startPoint.y);
                            const threshold = 10 / viewTransform.zoom; // Lock after some movement

                            if (dist * viewTransform.zoom > 5) { // Minimum movement (5px) to guess direction
                                const { vpGreen, vpRed, vpBlue } = perspectiveVPs.current;
                                const vps = [vpGreen, vpRed, vpBlue].filter(Boolean) as Point[];

                                let bestVP: Point | null = null;
                                let minDistToLine = Infinity;

                                vps.forEach(vp => {
                                    // Distance from current point to the line (startPoint -> VP)
                                    // We use distanceToLine (infinite) to allow snapping when moving AWAY from VP
                                    const d = distanceToLine(point, info.startPoint, vp);
                                    if (d < minDistToLine) {
                                        minDistToLine = d;
                                        bestVP = vp;
                                    }
                                });

                                info.targetVP = bestVP; // Update best guess

                                if (dist > threshold) {
                                    info.locked = true; // Lock it if we moved enough
                                }
                            }
                        }

                        if (info.targetVP) {
                            pointToDraw = projectPointOnLine(point, info.startPoint, info.targetVP);
                            didSnapToGuideForPoint = true;
                        }
                    }

                    if (!didSnapToGuideForPoint) {
                        pointToDraw = snapPointToGrid(point);
                    }

                    const isPressureSensitive = strokeMode === 'freehand';
                    const pressure = (isPressureSensitive && event.pointerType === 'pen') ? event.pressure : 1.0;
                    const newPoint = { ...pointToDraw, pressure };

                    activeBrushRef.current.onPointerMove(newPoint, brushContext);
                }
            }
            return;
        }

        // All other actions use the last event's position
        // All other actions use the last event's position
        const rawPoint = getPoint(lastEvent, viewTransform) as Point;
        let finalPoint = rawPoint;
        let didSnapToGuide = false;

        if (guideDragState) {
            if (guideDragState.type === 'ruler') {
                setRulerGuides(guides => guides.map(g => {
                    if (g.id === guideDragState.id) {
                        const newGuide = { ...g };
                        if (guideDragState.part === 'start') newGuide.start = rawPoint;
                        else if (guideDragState.part === 'end') newGuide.end = rawPoint;
                        else if (guideDragState.part === 'line') {
                            const originalDx = g.end.x - g.start.x;
                            const originalDy = g.end.y - g.start.y;
                            newGuide.start.x = rawPoint.x + guideDragState.offset.x;
                            newGuide.start.y = rawPoint.y + guideDragState.offset.y;
                            newGuide.end.x = newGuide.start.x + originalDx;
                            newGuide.end.y = newGuide.start.y + originalDy;
                        }
                        return newGuide;
                    }
                    return g;
                }));
            } else if (guideDragState.type === 'mirror') {
                setMirrorGuides(guides => guides.map(g => {
                    if (g.id === guideDragState.id) {
                        const newGuide = { ...g };
                        if (guideDragState.part === 'start') newGuide.start = rawPoint;
                        else if (guideDragState.part === 'end') newGuide.end = rawPoint;
                        else if (guideDragState.part === 'line') {
                            const originalDx = g.end.x - g.start.x;
                            const originalDy = g.end.y - g.start.y;
                            newGuide.start.x = rawPoint.x + guideDragState.offset.x;
                            newGuide.start.y = rawPoint.y + guideDragState.offset.y;
                            newGuide.end.x = newGuide.start.x + originalDx;
                            newGuide.end.y = newGuide.start.y + originalDy;
                        }
                        return newGuide;
                    }
                    return g;
                }));
            } else if (guideDragState.type === 'perspective' || guideDragState.type === 'perspective-point' || guideDragState.type === 'perspective-extra') {
                setPerspectiveGuide(g => {
                    if (!g) return null;
                    const newGuide = JSON.parse(JSON.stringify(g)) as PerspectiveGuide;
                    if (guideDragState.type === 'perspective-point') {
                        newGuide.guidePoint = rawPoint;
                    } else if (guideDragState.type === 'perspective-extra') {
                        const handle = newGuide.extraGuideLines[guideDragState.color].find(h => h.id === guideDragState.id);
                        if (handle) handle.handle = rawPoint;
                    } else if (guideDragState.type === 'perspective') {
                        const line = newGuide.lines[guideDragState.color].find(l => l.id === guideDragState.lineId);
                        if (line) line[guideDragState.part] = rawPoint;
                    }
                    return newGuide;
                });
            }
            return;
        }

        finalPoint = snapPointToGrid(rawPoint);

        if (strokeState) {
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (!previewCtx) return;

            const pressure = (lastEvent.pointerType === 'pen') ? lastEvent.pressure : 1.0;
            const currentPointWithPressure = { ...finalPoint, pressure };

            clearCanvas(previewCtx);
            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);

            const brush = getBrushForTool(tool);
            if (brush && activeItem) {
                const brushContext: BrushContext = { mainCtx: (activeItem as SketchObject).context!, previewCtx, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };

                let pointsToDraw: Point[];
                if (strokeState.mode === 'line') {
                    pointsToDraw = [strokeState.points[0], currentPointWithPressure];
                } else {
                    pointsToDraw = [...strokeState.points, currentPointWithPressure];
                }

                if (strokeState.mode === 'curve' && pointsToDraw.length >= 2) {
                    if (pointsToDraw.length === 3) {
                        pointsToDraw = generateCurvePoints(pointsToDraw);
                    }
                } else if (strokeState.mode === 'arc' && pointsToDraw.length >= 2) {
                    const [center, p1] = pointsToDraw;
                    const radius = Math.hypot(p1.x - center.x, p1.y - center.y);

                    previewCtx.strokeStyle = 'rgba(0,0,0,0.4)';
                    previewCtx.lineWidth = 1 / viewTransform.zoom;
                    previewCtx.setLineDash([4 / viewTransform.zoom, 2 / viewTransform.zoom]);
                    previewCtx.beginPath();
                    previewCtx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                    previewCtx.stroke();
                    previewCtx.setLineDash([]);

                    if (pointsToDraw.length === 3) {
                        const p2 = pointsToDraw[2];
                        const currentAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

                        if (!arcDrawingState.current) {
                            arcDrawingState.current = { lastAngle: currentAngle, totalAngle: 0 };
                        } else {
                            let deltaAngle = currentAngle - arcDrawingState.current.lastAngle;
                            if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                            if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

                            arcDrawingState.current.totalAngle += deltaAngle;
                            arcDrawingState.current.lastAngle = currentAngle;
                        }
                        pointsToDraw = generateArcPoints(pointsToDraw, arcDrawingState.current.totalAngle);
                    } else {
                        pointsToDraw = [p1, finalPoint];
                    }
                }

                if (strokeState.mode === 'parallelepiped') {
                    // Preview logic for Box
                    const vps = perspectiveVPs.current;
                    if (vps.vpGreen && vps.vpRed) {
                        const p1 = strokeState.points[0];
                        const p2 = strokeState.points.length > 1 ? strokeState.points[1] : currentPointWithPressure;
                        const p3 = strokeState.points.length > 1 ? currentPointWithPressure : null; // Only use p3 if we have p2 locked

                        const corners = getPerspectiveBoxPoints(p1, p2, p3, vps);

                        // Draw wireframe
                        previewCtx.lineWidth = 1 / viewTransform.zoom;
                        previewCtx.strokeStyle = 'black'; // Default to black for preview
                        previewCtx.beginPath();

                        const drawLine = (i: number, j: number) => {
                            if (corners[i] && corners[j]) {
                                previewCtx.moveTo(corners[i].x, corners[i].y);
                                previewCtx.lineTo(corners[j].x, corners[j].y);
                            }
                        };

                        if (corners.length >= 4) {
                            drawLine(0, 1); drawLine(1, 2); drawLine(2, 3); drawLine(3, 0);
                        }
                        if (corners.length === 8) {
                            drawLine(4, 5); drawLine(5, 6); drawLine(6, 7); drawLine(7, 4);
                            drawLine(0, 4); drawLine(1, 5); drawLine(2, 6); drawLine(3, 7);
                        }
                        previewCtx.stroke();
                    }
                } else if (strokeMode === 'rotated-rectangle') {
                    if (pointsToDraw.length >= 2) {
                        const p1 = pointsToDraw[0];
                        const p2 = pointsToDraw[1];

                        previewCtx.lineWidth = (activeBrushRef.current?.getSize ? (activeBrushRef.current as any).getSize() : 2) / viewTransform.zoom;
                        const brushColor = brushSettings?.color || 'black';
                        previewCtx.strokeStyle = brushColor;

                        // Draw Base Line
                        previewCtx.beginPath();
                        previewCtx.moveTo(p1.x, p1.y);
                        previewCtx.lineTo(p2.x, p2.y);
                        previewCtx.stroke();

                        if (pointsToDraw.length === 3) {
                            const p3 = pointsToDraw[2];
                            // Calculate rect
                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const len = Math.hypot(dx, dy);
                            if (len > 0) {
                                const ux = dx / len;
                                const uy = dy / len;
                                const nx = -uy;
                                const ny = ux;
                                const v23x = p3.x - p2.x;
                                const v23y = p3.y - p2.y;
                                const dist = v23x * nx + v23y * ny;
                                const p3_final = { x: p2.x + nx * dist, y: p2.y + ny * dist };
                                const p4_final = { x: p1.x + nx * dist, y: p1.y + ny * dist };

                                if (fillColor && fillColor !== 'transparent') {
                                    previewCtx.fillStyle = fillColor;
                                    previewCtx.beginPath();
                                    previewCtx.moveTo(p1.x, p1.y);
                                    previewCtx.lineTo(p2.x, p2.y);
                                    previewCtx.lineTo(p3_final.x, p3_final.y);
                                    previewCtx.lineTo(p4_final.x, p4_final.y);
                                    previewCtx.closePath();
                                    previewCtx.fill();
                                }

                                // Preview Wireframe
                                previewCtx.beginPath();
                                previewCtx.moveTo(p1.x, p1.y);
                                previewCtx.lineTo(p2.x, p2.y);
                                previewCtx.lineTo(p3_final.x, p3_final.y);
                                previewCtx.lineTo(p4_final.x, p4_final.y);
                                previewCtx.closePath();
                                previewCtx.stroke();
                            }
                        }
                    }
                } else if (strokeState.mode === 'rectangle') {
                    const width = currentPointWithPressure.x - strokeState.points[0].x;
                    const height = currentPointWithPressure.y - strokeState.points[0].y;

                    if (fillColor && fillColor !== 'transparent') {
                        previewCtx.fillStyle = fillColor;
                        previewCtx.fillRect(strokeState.points[0].x, strokeState.points[0].y, width, height);
                    }

                    // Need to check if brush has size?
                    const brushSize = activeBrushRef.current?.getSize ? (activeBrushRef.current as any).getSize() : 2;
                    previewCtx.lineWidth = brushSize / viewTransform.zoom;

                    (brush as any).drawWithMirroring(previewCtx, [
                        strokeState.points[0],
                        { x: currentPointWithPressure.x, y: strokeState.points[0].y, pressure: strokeState.points[0].pressure },
                        currentPointWithPressure,
                        { x: strokeState.points[0].x, y: currentPointWithPressure.y, pressure: currentPointWithPressure.pressure },
                        strokeState.points[0]
                    ], brushContext);

                } else if (strokeState.mode === 'circle') {
                    const [center] = strokeState.points;
                    const radius = Math.hypot(currentPointWithPressure.x - center.x, currentPointWithPressure.y - center.y);

                    if (fillColor && fillColor !== 'transparent') {
                        previewCtx.fillStyle = fillColor;
                        previewCtx.beginPath();
                        previewCtx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                        previewCtx.fill();
                    }
                    // Fix: Generate circle points
                    const circlePoints: Point[] = [];
                    const steps = Math.max(40, Math.ceil(radius));
                    for (let i = 0; i <= steps; i++) {
                        const theta = (i / steps) * 2 * Math.PI;
                        circlePoints.push({
                            x: center.x + radius * Math.cos(theta),
                            y: center.y + radius * Math.sin(theta),
                            pressure: currentPointWithPressure.pressure
                        });
                    }
                    (brush as any).drawWithMirroring(previewCtx, circlePoints, brushContext);
                } else {
                    // Fallback for line/polyline
                    (brush as any).drawWithMirroring(previewCtx, pointsToDraw, brushContext);
                }
            }
            previewCtx.restore();
            return;
        }


        if (currentAction.type === 'pan') {
            setViewTransform(v => ({ ...v, pan: { x: v.pan.x + lastEvent.movementX, y: v.pan.y + lastEvent.movementY } }));
        }
        if (currentAction.type === 'selection') {
            let newPoints: Point[];
            if (currentAction.tool === 'lasso') {
                newPoints = [...currentAction.points];
                for (const event of events) {
                    const point = getCanvasPoint(event, viewTransform, uiCanvasRef.current!) as Point;
                    newPoints.push(snapPointToGrid(point));
                }
            } else { // marquee-rect uses only the last point for preview
                newPoints = [...currentAction.points, finalPoint];
            }
            setDragAction({ ...currentAction, points: newPoints });

            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (!previewCtx) return;

            clearCanvas(previewCtx);
            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
            previewCtx.lineWidth = 1 / viewTransform.zoom;
            previewCtx.strokeStyle = 'black';
            previewCtx.setLineDash([4 / viewTransform.zoom, 4 / viewTransform.zoom]);

            previewCtx.beginPath();
            if (currentAction.tool === 'marquee-rect') {
                const { startPoint } = currentAction;
                previewCtx.rect(startPoint.x, startPoint.y, finalPoint.x - startPoint.x, finalPoint.y - startPoint.y);
            } else { // lasso
                previewCtx.moveTo(newPoints[0].x, newPoints[0].y);
                for (let i = 1; i < newPoints.length; i++) {
                    previewCtx.lineTo(newPoints[i].x, newPoints[i].y);
                }
            }
            previewCtx.stroke();

            previewCtx.restore();
            return;
        }
        if (currentAction.type === 'crop') {
        }
        if (currentAction.type === 'transform' && transformState) {
            const pointToUse = rawPoint;
            if (currentAction.startState.type === 'affine') {
                const { startState, startPoint, handle } = currentAction;
                const center = (currentAction as { center?: Point }).center;
                let dx = pointToUse.x - startPoint.x;
                let dy = pointToUse.y - startPoint.y;

                if (handle === 'rotate' && center) {
                    const angle1 = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
                    const angle2 = Math.atan2(pointToUse.y - center.y, pointToUse.x - center.x);
                    let newRotation = startState.rotation + (angle2 - angle1);
                    if (isAngleSnapEnabled) {
                        const snapRad = (angleSnapValue * Math.PI) / 180;
                        newRotation = Math.round(newRotation / snapRad) * snapRad;
                    }
                    setTransformState({ ...startState, rotation: newRotation });
                } else if (handle === 'move') {
                    setTransformState({ ...startState, x: startState.x + dx, y: startState.y + dy });
                } else {
                    const { rotation } = startState;
                    const invCos = Math.cos(-rotation);
                    const invSin = Math.sin(-rotation);
                    const local_dx = dx * invCos - dy * invSin;
                    const local_dy = dx * invSin + dy * invCos;
                    let newWidth = startState.width;
                    let newHeight = startState.height;
                    if (handle.includes('r')) newWidth += local_dx;
                    if (handle.includes('l')) newWidth -= local_dx;
                    if (handle.includes('b')) newHeight += local_dy;
                    if (handle.includes('t')) newHeight -= local_dy;
                    if (isAspectRatioLocked && (newWidth !== startState.width || newHeight !== startState.height)) {
                        const aspectRatio = startState.width / startState.height;
                        const widthChanged = Math.abs(newWidth - startState.width) > Math.abs(newHeight - startState.height);
                        if (widthChanged) newHeight = newWidth / aspectRatio;
                        else newWidth = newHeight * aspectRatio;
                    }
                    let newX = startState.x;
                    let newY = startState.y;
                    const widthChange = newWidth - startState.width;
                    const heightChange = newHeight - startState.height;
                    const cos = Math.cos(rotation);
                    const sin = Math.sin(rotation);
                    let deltaX = 0, deltaY = 0;
                    if (handle.includes('l')) deltaX += widthChange;
                    if (handle.includes('t')) deltaY += heightChange;
                    const rotatedDeltaX = (deltaX * cos - deltaY * sin) / 2;
                    const rotatedDeltaY = (deltaX * sin + deltaY * cos) / 2;
                    newX -= rotatedDeltaX;
                    newY -= rotatedDeltaY;
                    setTransformState({ ...startState, x: newX, y: newY, width: newWidth, height: newHeight });
                }
            } else if (currentAction.startState.type === 'free') {
                const { handle, startState, startPoint } = currentAction;
                if (startState.type !== 'free') return;
                const dx = pointToUse.x - startPoint.x;
                const dy = pointToUse.y - startPoint.y;

                if (handle === 'move') {
                    setTransformState({
                        ...startState,
                        corners: {
                            tl: { x: startState.corners.tl.x + dx, y: startState.corners.tl.y + dy },
                            tr: { x: startState.corners.tr.x + dx, y: startState.corners.tr.y + dy },
                            bl: { x: startState.corners.bl.x + dx, y: startState.corners.bl.y + dy },
                            br: { x: startState.corners.br.x + dx, y: startState.corners.br.y + dy },
                        }
                    });
                } else if (handle in startState.corners) {
                    const newCorners = { ...startState.corners };
                    (newCorners as any)[handle] = pointToUse;
                    setTransformState({
                        ...startState,
                        corners: newCorners
                    });
                }
            }
        }
    }, [
        viewTransform, setViewTransform, activeItem, tool, strokeState, setStrokeState, guideDragState,
        setGuideDragState, setRulerGuides, setMirrorGuides, setPerspectiveGuide,
        setCropRect, setTransformState, snapPointToGrid, getMinZoom, MAX_ZOOM,
        isAspectRatioLocked, isAngleSnapEnabled, angleSnapValue, isDrawingTool, activeGuide,
        rulerGuides, isOrthogonalVisible, isPerspectiveStrokeLockEnabled, perspectiveVPs, onDrawCommit, mirrorGuides,
        strokeModifier, getBrushForTool, setDebugPointers
    ]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const pointerCountBeforeUp = activePointers.current.size;
        activePointers.current.delete(e.pointerId);
        setDebugPointers(new Map(activePointers.current));

        if (activePointers.current.size === 0) {
            wasInGestureRef.current = false;
        }

        if (pointerCountBeforeUp > 1) {
            if (activePointers.current.size < 2) {
                lastGestureState.current = null;
                gestureBaseRef.current = null;
                setDragAction({ type: 'none' });
            }
            return;
        }

        if (wasInGestureRef.current) {
            return;
        }

        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (activeBrushRef.current?.isDrawing) {
            const mainCtx = (activeItem as SketchObject)?.context;
            const previewCtx = previewCanvasRef.current?.getContext('2d');

            if (mainCtx && previewCtx && activeItem) {
                const brushContext: BrushContext = { mainCtx, previewCtx, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };
                activeBrushRef.current.onPointerUp(brushContext);
            }
            activeBrushRef.current = null;
        }

        if (tool === 'eraser') {
            setLivePreviewLayerId(null);
        }

        if (dragAction.current.type === 'draw' && strokeState && ['line', 'rectangle', 'circle'].includes(strokeState.mode) && strokeState.points.length > 0 && activeItem?.type === 'object') {
            const beforeCanvas = cloneCanvas(activeItem.canvas!);
            const mainCtx = activeItem.context!;
            const brush = getBrushForTool(tool);

            const finalPoint = snapPointToGrid(getCanvasPoint(e.nativeEvent, viewTransform, uiCanvasRef.current!) as Point);
            const pressure = (e.pointerType === 'pen') ? e.pressure : 1.0;
            const finalPointWithPressure = { ...finalPoint, pressure };
            const finalPoints = [...strokeState.points, finalPointWithPressure];

            if (brush && finalPoints.length > 1) {
                const brushContext: BrushContext = { mainCtx, previewCtx: previewCanvasRef.current!.getContext('2d')!, viewTransform, onDrawCommit, activeItemId: activeItem.id, activeGuide, mirrorGuides, strokeModifier };

                // Handle Fill for Rectangle and Circle
                if ((strokeState.mode === 'rectangle' || strokeState.mode === 'circle') && fillColor && fillColor !== 'transparent') {
                    mainCtx.save();

                    // Handle Mirroring for Fill?
                    // drawWithMirroring handles it for stroke. We should manually mirror the fill if needed.
                    // A bit complex. For now, let's just support basic fill without mirror or check how BaseBrush handles mirror.
                    // BaseBrush loops over mirrorGuides. We should replicate that or expose a helper.
                    // Or, just implement a basic fill for now.

                    const drawFill = (ctx: CanvasRenderingContext2D) => {
                        ctx.fillStyle = fillColor;
                        ctx.beginPath();
                        if (strokeState.mode === 'rectangle') {
                            const width = finalPoints[1].x - finalPoints[0].x;
                            const height = finalPoints[1].y - finalPoints[0].y;
                            ctx.rect(finalPoints[0].x, finalPoints[0].y, width, height);
                        } else if (strokeState.mode === 'circle') {
                            const center = finalPoints[0];
                            const radius = Math.hypot(finalPoints[1].x - center.x, finalPoints[1].y - center.y);
                            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                        }
                        ctx.fill();
                    };

                    drawFill(mainCtx);

                    if (activeGuide === 'mirror' && mirrorGuides.length > 0) {
                        mirrorGuides.forEach(guide => {
                            mainCtx.save();
                            const [p1, p2] = [guide.start, guide.end];
                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const angle = Math.atan2(dy, dx);
                            mainCtx.translate(p1.x, p1.y);
                            mainCtx.rotate(angle);
                            mainCtx.scale(1, -1);
                            mainCtx.rotate(-angle);
                            mainCtx.translate(-p1.x, -p1.y);
                            drawFill(mainCtx);
                            mainCtx.restore();
                        });
                    }

                    mainCtx.restore();
                }

                (brush as any).drawWithMirroring(mainCtx, finalPoints, brushContext);
                onDrawCommit(activeItem.id, beforeCanvas);
            }
            setStrokeState(null);
        }

        if (dragAction.current.type === 'selection' && activeItem) {
            const { tool, points, startPoint } = dragAction.current;

            if (points.length > 1) {
                let path: Path2D;
                let boundingBox: CropRect;

                if (tool === 'marquee-rect') {
                    const endPoint = points[points.length - 1];
                    const x = Math.min(startPoint.x, endPoint.x);
                    const y = Math.min(startPoint.y, endPoint.y);
                    const width = Math.abs(startPoint.x - endPoint.x);
                    const height = Math.abs(startPoint.y - endPoint.y);

                    path = new Path2D();
                    path.rect(x, y, width, height);
                    boundingBox = { x, y, width, height };
                } else { // lasso
                    path = new Path2D();
                    path.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        path.lineTo(points[i].x, points[i].y);
                    }
                    path.closePath();

                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    points.forEach(p => {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    });
                    boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                }

                setSelection({ path, boundingBox, sourceItemId: activeItem.id });
            }
        }

        if (dragAction.current.type === 'text-place') {
            const snappedPoint = snapPointToGrid(getCanvasPoint(e.nativeEvent, viewTransform, uiCanvasRef.current!) as Point);
            setTextEditState({ position: snappedPoint, value: '', activeItemId: activeItem?.id || '' });
        }

        if (tool === 'pan' || (e.button === 1 && e.pointerType === 'mouse')) {
            e.currentTarget.style.cursor = 'grab';
        }

        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx && !strokeState) {
            clearCanvas(previewCtx);
        }

        setDragAction({ type: 'none' });
        setGuideDragState(null);

    }, [
        viewTransform, uiCanvasRef, activeItem, onDrawCommit, onSelectItem, tool, setGuideDragState,
        isDrawingTool, strokeState, setStrokeState, snapPointToGrid, setSelection, setTextEditState, onCommitText,
        strokeModifier, mirrorGuides, activeGuide, setLivePreviewLayerId, getBrushForTool, setDebugPointers
    ]);

    const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        onPointerUp(e);
    }, [onPointerUp]);

    const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
        const zoomFactor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
        const rect = uiCanvasRef.current.getBoundingClientRect();
        const pointerViewX = e.clientX - rect.left;
        const pointerViewY = e.clientY - rect.top;

        setViewTransform(currentTransform => {
            const minZoom = getMinZoom();
            const newZoom = Math.max(minZoom, Math.min(currentTransform.zoom * zoomFactor, MAX_ZOOM));
            const pointerCanvasX = (pointerViewX - currentTransform.pan.x) / currentTransform.zoom;
            const pointerCanvasY = (pointerViewY - currentTransform.pan.y) / currentTransform.zoom;
            const newPanX = pointerViewX - pointerCanvasX * newZoom;
            const newPanY = pointerViewY - pointerCanvasY * newZoom;
            return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
        });
    }, [setViewTransform, getMinZoom, MAX_ZOOM]);

    const onDoubleClick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (tool === 'select') {
            const point = getCanvasPoint(e.nativeEvent, viewTransform, uiCanvasRef.current!) as Point;
            let foundItem = false;
            [...items].reverse().forEach(item => {
                if (foundItem || item.type !== 'object' || !item.isVisible || !item.canvas) return;
                const ctx = item.context;
                if (ctx && ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data[3] > 0) {
                    onSelectItem(item.id);
                    foundItem = true;
                }
            });
            if (!foundItem) {
                onSelectItem(null);
            }
        }
    }, [isDrawingTool, strokeMode, strokeState, setStrokeState, onDrawCommit, activeItem, onSelectItem, items, tool, viewTransform, getBrushForTool, activeGuide, mirrorGuides, strokeModifier]);

    return {
        dragActionRef: dragAction,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onWheel,
        onDoubleClick,
    };
}
