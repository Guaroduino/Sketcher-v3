import React, { useRef, useCallback, useEffect } from 'react';
import type {
    CanvasItem, SketchObject, Tool, Guide, Point, RulerGuide, PerspectiveGuide, MirrorGuide, OrthogonalGuide,
    CropRect, ViewTransform, PerspectiveControlPoint, TransformState, AffineTransformState, FreeTransformState, GridGuide,
    StrokeMode, StrokeState, BrushSettings, EraserSettings, SolidMarkerSettings, NaturalMarkerSettings, AirbrushSettings, FXBrushSettings,
    Selection, MagicWandSettings
} from '../types';
import { getCanvasPoint, isNearPoint, projectPointOnLine, pointInPolygon, cloneCanvas } from '../utils/canvasUtils';
import { clearCanvas } from '../utils/canvasUtils';

type DragAction =
    | { type: 'none' }
    | { type: 'pan'; startX: number; startY: number; startPan: { x: number; y: number } }
    | { type: 'draw'; points: Point[] }
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

export function usePointerEvents({
    items,
    uiCanvasRef,
    previewCanvasRef,
    viewTransform,
    setViewTransform,
    activeItem,
    tool,
    isDrawingTool,
    isSelectionTool,
    onDrawCommit,
    onSelectItem,
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
    brushSettings,
    eraserSettings,
    solidMarkerSettings,
    naturalMarkerSettings,
    airbrushSettings,
    fxBrushSettings,
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
}: {
    items: CanvasItem[];
    uiCanvasRef: React.RefObject<HTMLCanvasElement>;
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
    viewTransform: ViewTransform;
    setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
    activeItem: CanvasItem | null | undefined;
    tool: Tool;
    isDrawingTool: boolean;
    isSelectionTool: boolean;
    onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
    onSelectItem: (id: string | null) => void;
    drawStrokeWithMirroring: (ctx: CanvasRenderingContext2D, points: Point[], options?: { arcStartAngle?: number, arcEndAngle?: number }) => void;
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
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    solidMarkerSettings: SolidMarkerSettings;
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
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
}) {

    const dragAction = useRef<DragAction>({ type: 'none' });
    const lockedPerspectiveLine = useRef<{ start: Point, end: Point } | null>(null);
    const strokeLockInfo = useRef<{ startPoint: Point; targetVP: Point | null } | null>(null);
    const orthogonalLock = useRef<{ axis: 'x' | 'y', startPoint: Point } | null>(null);
    const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const arcDrawingState = useRef<{ lastAngle: number; totalAngle: number } | null>(null);
    const activePointers = useRef(new Map<number, { x: number; y: number }>());
    const lastGestureState = useRef<{ distance: number; midpoint: Point } | null>(null);
    const wasInGestureRef = useRef(false);

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
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (e.pointerType === 'pen' && e.pressure === 0) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        if (activePointers.current.size === 2) {
            wasInGestureRef.current = true; // Set flag that we entered a multi-touch gesture
            // If a drawing stroke is in progress, the browser will likely fire a `pointercancel`
            // event for that drawing pointer. We preserve the `dragAction` so that when `onPointerUp`
            // (called by `onPointerCancel`) is executed, it can commit the stroke that has been
            // drawn so far. This prevents strokes from disappearing on multi-touch interruptions (e.g. palm rejection).
            if (dragAction.current.type !== 'draw') {
                setDragAction({ type: 'none' });
                setStrokeState(null);
            }
    
            const pointers: {x: number, y: number}[] = Array.from(activePointers.current.values());
            if (pointers.length < 2) return;
    
            const p1 = pointers[0];
            const p2 = pointers[1];
            
            const rect = uiCanvasRef.current!.getBoundingClientRect();
            const p1View = { x: p1.x - rect.left, y: p1.y - rect.top };
            const p2View = { x: p2.x - rect.left, y: p2.y - rect.top };
    
            lastGestureState.current = {
                distance: Math.hypot(p1View.x - p2View.x, p1View.y - p2View.y),
                midpoint: { x: (p1View.x + p2View.x) / 2, y: (p1View.y + p2View.y) / 2 },
            };
            return;
        }

        if (activePointers.current.size > 1) {
            return;
        }

        const rawPoint = getCanvasPoint(e, viewTransform, uiCanvasRef.current!);
        const point = snapPointToGrid(rawPoint);
        
        if (tool === 'text') {
            if (textEditState) {
                onCommitText(textEditState);
            }
            setDragAction({ type: 'text-place' });
            return;
        }

        strokeLockInfo.current = null;

        if (isSelectionTool) {
            setSelection(null);
            if (tool === 'marquee-rect' || tool === 'lasso') {
                setDragAction({ type: 'selection', tool, startPoint: point, points: [point] });
                return;
            } else if (tool === 'magic-wand') {
                if (!activeItem || activeItem.type !== 'object' || !activeItem.canvas) return;
                const canvas = activeItem.canvas;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;
        
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const { data, width, height } = imageData;
                    const startX = Math.floor(point.x);
                    const startY = Math.floor(point.y);
            
                    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
            
                    const startIndex = (startY * width + startX) * 4;
                    const startColor = { r: data[startIndex], g: data[startIndex + 1], b: data[startIndex + 2], a: data[startIndex + 3] };
                    
                    if (startColor.a === 0) { setSelection(null); return; }
            
                    const { tolerance, contiguous } = magicWandSettings;
                    const toleranceSq = (tolerance / 100 * 255) ** 2 * 3;
            
                    const selected = new Uint8Array(width * height);
                    const q: [number, number][] = [[startX, startY]];
                    const visited = new Uint8Array(width * height);
                    visited[startY * width + startX] = 1;
                    
                    let minX = startX, maxX = startX, minY = startY, maxY = startY;

                    const checkPixel = (x: number, y: number) => {
                        const index = (y * width + x) * 4;
                        const pColor = { r: data[index], g: data[index+1], b: data[index+2], a: data[index+3] };
                        if (pColor.a > 0) {
                            const distSq = (startColor.r - pColor.r) ** 2 + (startColor.g - pColor.g) ** 2 + (startColor.b - pColor.b) ** 2;
                            return distSq <= toleranceSq;
                        }
                        return false;
                    };
            
                    if (contiguous) {
                        while (q.length > 0) {
                            const [x, y] = q.shift()!;
                            selected[y * width + x] = 1;
                            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                
                            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                            for (const [nx, ny] of neighbors) {
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
                                    visited[ny * width + nx] = 1;
                                    if (checkPixel(nx, ny)) {
                                        q.push([nx, ny]);
                                    }
                                }
                            }
                        }
                    } else {
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                if (checkPixel(x, y)) {
                                    selected[y * width + x] = 1;
                                    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                                }
                            }
                        }
                    }
                    
                    const path = new Path2D();
                    for (let y = minY; y <= maxY; y++) {
                        for (let x = minX; x <= maxX; x++) {
                            if (selected[y * width + x]) {
                                let endX = x;
                                while(endX + 1 <= maxX && selected[y * width + endX + 1]) {
                                    endX++;
                                }
                                path.rect(x, y, endX - x + 1, 1);
                                x = endX;
                            }
                        }
                    }
                    
                    const boundingBox = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
                    
                    setSelection({ path, boundingBox, sourceItemId: activeItem.id });
                } catch (e) {
                    console.error("Failed to perform magic wand selection", e);
                    setSelection(null);
                }
                return;
            }
        }

        if (isDrawingTool && (strokeMode === 'polyline' || strokeMode === 'curve' || strokeMode === 'arc')) {
            if (strokeState) {
                const newPoints = [...strokeState.points, point];

                if (strokeMode === 'arc' && newPoints.length === 2) {
                    const [center, start] = newPoints;
                    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                    arcDrawingState.current = {
                        lastAngle: startAngle,
                        totalAngle: startAngle,
                    };
                }
                
                let shouldCommit = false;
                if (strokeMode === 'curve' && newPoints.length === 3) {
                    shouldCommit = true;
                }
                if (strokeMode === 'arc' && newPoints.length === 3) {
                    shouldCommit = true;
                }

                if (shouldCommit) {
                    if (activeItem?.type === 'object' && activeItem?.context) {
                        beforeCanvasRef.current = cloneCanvas(activeItem.canvas!);

                        let options: { arcStartAngle?: number, arcEndAngle?: number } | undefined = undefined;
                        if (strokeMode === 'arc' && arcDrawingState.current) {
                            const [center, start] = newPoints;
                            const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                            options = { arcStartAngle: startAngle, arcEndAngle: arcDrawingState.current.totalAngle };
                            drawStrokeWithMirroring(activeItem.context, [center, start], options);
                        } else {
                            drawStrokeWithMirroring(activeItem.context, newPoints);
                        }

                        onDrawCommit(activeItem.id, beforeCanvasRef.current);
                    }
                    setStrokeState(null);
                    const previewCtx = previewCanvasRef.current?.getContext('2d');
                    if (previewCtx) clearCanvas(previewCtx);
                    return;
                }

                setStrokeState({ ...strokeState, points: newPoints });
                return;
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

        if (tool === 'pan' || (e.button === 1 && e.pointerType === 'mouse')) {
            setDragAction({ type: 'pan', startX: e.clientX, startY: e.clientY, startPan: viewTransform.pan });
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
                    setDragAction({ type: 'crop', handle: name as 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r', startRect: cropRect, startPoint: point });
                    return;
                }
            }
            if (point.x > x && point.x < x + width && point.y > y && point.y < y + height) {
                setDragAction({ type: 'crop', handle: 'move', startRect: cropRect, startPoint: point });
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
                         setDragAction({ type: 'transform', handle: name, startState: transformState, startPoint: point, center });
                         return;
                     }
                 }
                 if (pointInPolygon(point, [handles.tl, handles.tr, handles.br, handles.bl])) {
                     setDragAction({ type: 'transform', handle: 'move', startState: transformState, startPoint: point });
                     return;
                 }
            } else if (transformState.type === 'free') {
                 const { corners } = transformState;
                 const handleDefs = { tl: corners.tl, tr: corners.tr, bl: corners.bl, br: corners.br };
                 for (const [name, pos] of Object.entries(handleDefs)) {
                     if (isNearPoint(point, pos, handleThreshold)) {
                          setDragAction({ type: 'transform', handle: name, startState: transformState, startPoint: point }); 
                          return;
                     }
                 }
                 if (pointInPolygon(point, [corners.tl, corners.tr, corners.br, corners.bl])) {
                     setDragAction({ type: 'transform', handle: 'move', startState: transformState, startPoint: point }); 
                     return;
                 }
            }
        }
        
        if (isDrawingTool && activeItem && activeItem.type === 'object') {
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

            if (activeGuide === 'perspective' && perspectiveGuide) {
                if (isPerspectiveStrokeLockEnabled) {
                    const { vpGreen, vpRed, vpBlue } = perspectiveVPs.current;
                    const vps = [vpGreen, vpRed, vpBlue].filter((vp): vp is Point => vp !== null);
                    if (vps.length > 0) {
                        let closestVP: Point = vps[0];
                        let minDistance = Math.hypot(rawPoint.x - vps[0].x, rawPoint.y - vps[0].y);
                        for (let i = 1; i < vps.length; i++) {
                            const distance = Math.hypot(rawPoint.x - vps[i].x, rawPoint.y - vps[i].y);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestVP = vps[i];
                            }
                        }
                        strokeLockInfo.current = { startPoint: rawPoint, targetVP: closestVP };
                        guideApplied = true;
                    }
                } else {
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
                }
            }

            if (!guideApplied && activeGuide === 'ruler' && rulerGuides.length > 0) {
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
            setDragAction({ type: 'draw', points: [firstPoint] });
            
            const previewCtx = previewCanvasRef.current?.getContext('2d');
            if (previewCtx) {
                clearCanvas(previewCtx);
                if (tool === 'eraser') {
                    setLivePreviewLayerId(activeItem.id);
                }

                previewCtx.save();
                previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
                if (strokeMode === 'freehand') {
                    drawStrokeWithMirroring(previewCtx, [firstPoint]);
                }
                previewCtx.restore();
            }
        }
    }, [tool, viewTransform, activeItem, isDrawingTool, isSelectionTool, magicWandSettings, setSelection, cropRect, activeGuide, rulerGuides, mirrorGuides, perspectiveGuide, areGuidesLocked, setPerspectiveGuide, setRulerGuides, setMirrorGuides, setGuideDragState, perspectiveVPs, transformState, drawStrokeWithMirroring, isPerspectiveStrokeLockEnabled, snapPointToGrid, strokeMode, strokeState, setStrokeState, onDrawCommit, setLivePreviewLayerId, onAddItem, setTextEditState, textEditState, onCommitText]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
    
        if (activePointers.current.has(e.pointerId)) {
            activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
    
        if (activePointers.current.size === 2) {
            if (!lastGestureState.current) {
                const pointers: { x: number; y: number }[] = Array.from(activePointers.current.values());
                if (pointers.length < 2) return;
                const [p1, p2] = pointers;
                const rect = uiCanvasRef.current!.getBoundingClientRect();
                const p1View = { x: p1.x - rect.left, y: p1.y - rect.top };
                const p2View = { x: p2.x - rect.left, y: p2.y - rect.top };
                lastGestureState.current = {
                    distance: Math.hypot(p1View.x - p2View.x, p1View.y - p2View.y),
                    midpoint: { x: (p1View.x + p2View.x) / 2, y: (p1View.y + p2View.y) / 2 },
                };
                return;
            }
    
            const pointers: { x: number; y: number }[] = Array.from(activePointers.current.values());
            if (pointers.length < 2) return;
            const [p1, p2] = pointers;
            const rect = uiCanvasRef.current!.getBoundingClientRect();
            const p1View = { x: p1.x - rect.left, y: p1.y - rect.top };
            const p2View = { x: p2.x - rect.left, y: p2.y - rect.top };
            const newMidpoint = { x: (p1View.x + p2View.x) / 2, y: (p1View.y + p2View.y) / 2 };
            const newDistance = Math.hypot(p1View.x - p2View.x, p1View.y - p2View.y);
            const zoomFactor = (lastGestureState.current.distance > 1e-6) ? newDistance / lastGestureState.current.distance : 1.0;
    
            setViewTransform(currentTransform => {
                if (!lastGestureState.current) return currentTransform;
                const { zoom, pan } = currentTransform;
                const minZoom = getMinZoom();
                const newZoom = Math.max(minZoom, Math.min(zoom * zoomFactor, MAX_ZOOM));
                const midpointCanvasX = (lastGestureState.current.midpoint.x - pan.x) / zoom;
                const midpointCanvasY = (lastGestureState.current.midpoint.y - pan.y) / zoom;
                const newPanX = newMidpoint.x - midpointCanvasX * newZoom;
                const newPanY = newMidpoint.y - midpointCanvasY * newZoom;
                return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
            });
    
            lastGestureState.current = { distance: newDistance, midpoint: newMidpoint };
            return;
        }
    
        const rawPoint = getCanvasPoint(e, viewTransform, uiCanvasRef.current!);
        const isDragging = dragAction.current.type !== 'none';
        
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (!previewCtx) return;
        clearCanvas(previewCtx);
    
        if (strokeState) {
            const point = snapPointToGrid(rawPoint);
            const previewPoints = [...strokeState.points, point];
            let options: { arcStartAngle?: number, arcEndAngle?: number } | undefined = undefined;

            if (strokeState.mode === 'arc' && strokeState.points.length === 2 && arcDrawingState.current) {
                const [center] = strokeState.points;
                const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
                
                let delta = currentAngle - arcDrawingState.current.lastAngle;
                // Handle angle wrapping
                if (delta > Math.PI) delta -= 2 * Math.PI;
                else if (delta < -Math.PI) delta += 2 * Math.PI;
                
                arcDrawingState.current.totalAngle += delta;
                arcDrawingState.current.lastAngle = currentAngle;
                
                const startAngle = Math.atan2(strokeState.points[1].y - center.y, strokeState.points[1].x - center.x);
                options = { arcStartAngle: startAngle, arcEndAngle: arcDrawingState.current.totalAngle };
            }
    
            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
            
            drawStrokeWithMirroring(previewCtx, previewPoints, options);
            
            if (strokeState.mode === 'arc' && strokeState.points.length >= 1) {
                previewCtx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
                previewCtx.lineWidth = 1 / viewTransform.zoom;
                previewCtx.setLineDash([2 / viewTransform.zoom, 2 / viewTransform.zoom]);
                
                const center = strokeState.points[0];

                previewCtx.beginPath();
                previewCtx.moveTo(center.x, center.y);
                previewCtx.lineTo(point.x, point.y);
                previewCtx.stroke();

                if (strokeState.points.length > 1) {
                    const start = strokeState.points[1];
                    const radius = Math.hypot(start.x-center.x, start.y-center.y);
                    previewCtx.beginPath();
                    previewCtx.arc(center.x, center.y, radius, 0, 2*Math.PI);
                    previewCtx.stroke();
                }
                previewCtx.setLineDash([]);
            }
            
            previewCtx.restore();
            return;
        }
    
        if (isDragging || guideDragState) {
            const point = snapPointToGrid(rawPoint);
            
            if (guideDragState) {
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

            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
            
            switch (dragAction.current.type) {
                case 'crop': {
                    if (!cropRect) break;
                    const { handle, startRect, startPoint: dragStartPoint } = dragAction.current;
                    const dx = point.x - dragStartPoint.x;
                    const dy = point.y - dragStartPoint.y;
                    
                    let { x, y, width, height } = startRect;

                    if (handle === 'move') {
                        setCropRect({ ...startRect, x: x + dx, y: y + dy });
                    } else {
                        if (handle.includes('r')) width += dx;
                        if (handle.includes('l')) { width -= dx; x += dx; }
                        if (handle.includes('b')) height += dy;
                        if (handle.includes('t')) { height -= dy; y += dy; }
                        
                        if (width < 1) width = 1;
                        if (height < 1) height = 1;

                        setCropRect({ x, y, width, height });
                    }
                    break;
                }
                case 'transform': {
                    const { handle, startState, startPoint: dragStartPoint, center } = dragAction.current;
                    
                    if (startState.type === 'affine') {
                        let { x, y, width, height, rotation } = startState;
                        const dx = point.x - dragStartPoint.x;
                        const dy = point.y - dragStartPoint.y;

                        if (handle === 'move') {
                            setTransformState({ ...startState, x: x + dx, y: y + dy });
                        } else if (handle === 'rotate' && center) {
                            const startAngle = Math.atan2(dragStartPoint.y - center.y, dragStartPoint.x - center.x);
                            const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
                            const newRotation = startState.rotation + (currentAngle - startAngle);
                            
                            let finalRotation = newRotation;
                            if (isAngleSnapEnabled) {
                                const snapAngleRad = angleSnapValue * (Math.PI / 180);
                                finalRotation = Math.round(newRotation / snapAngleRad) * snapAngleRad;
                            }

                            setTransformState({ ...startState, rotation: finalRotation });
                        } else { 
                            const cos = Math.cos(-rotation);
                            const sin = Math.sin(-rotation);

                            const worldDelta = { x: point.x - dragStartPoint.x, y: point.y - dragStartPoint.y };

                            const localDelta = {
                                x: worldDelta.x * cos - worldDelta.y * sin,
                                y: worldDelta.x * sin + worldDelta.y * cos,
                            };

                            let newWidth = width;
                            let newHeight = height;
                            
                            if (handle.includes('r')) newWidth += localDelta.x;
                            if (handle.includes('l')) newWidth -= localDelta.x;
                            if (handle.includes('b')) newHeight += localDelta.y;
                            if (handle.includes('t')) newHeight -= localDelta.y;

                            if (isAspectRatioLocked && (newWidth !== width || newHeight !== height)) {
                                const aspect = width / height;
                                if (handle.length === 2) {
                                    const newRatio = Math.abs(newWidth / newHeight);
                                    if (newRatio > aspect) {
                                        newHeight = Math.sign(newHeight) * Math.abs(newWidth / aspect);
                                    } else {
                                        newWidth = Math.sign(newWidth) * Math.abs(newHeight * aspect);
                                    }
                                } else if (handle.includes('l') || handle.includes('r')) {
                                    newHeight = Math.sign(newHeight) * Math.abs(newWidth / aspect);
                                } else {
                                    newWidth = Math.sign(newWidth) * Math.abs(newHeight * aspect);
                                }
                            }
                            
                            if (newWidth < 1) newWidth = 1;
                            if (newHeight < 1) newHeight = 1;
                            
                            const dw = newWidth - width;
                            const dh = newHeight - height;

                            let cxDelta = 0;
                            let cyDelta = 0;
                            if (handle.includes('l')) cxDelta -= dw / 2;
                            if (handle.includes('r')) cxDelta += dw / 2;
                            if (handle.includes('t')) cyDelta -= dh / 2;
                            if (handle.includes('b')) cyDelta += dh / 2;
                            
                            const cosR = Math.cos(rotation);
                            const sinR = Math.sin(rotation);
                            const worldCxDelta = cxDelta * cosR - cyDelta * sinR;
                            const worldCyDelta = cxDelta * sinR + cyDelta * cosR;
                            
                            const newCenterX = center.x + worldCxDelta;
                            const newCenterY = center.y + worldCyDelta;

                            setTransformState({
                                ...startState,
                                x: newCenterX - newWidth / 2,
                                y: newCenterY - newHeight / 2,
                                width: newWidth,
                                height: newHeight,
                            });
                        }
                    } else if (startState.type === 'free') {
                        const dx = point.x - dragStartPoint.x;
                        const dy = point.y - dragStartPoint.y;
                        const newCorners = { ...startState.corners };
                        if (handle === 'move') {
                            Object.keys(newCorners).forEach(key => {
                                const cornerKey = key as keyof typeof newCorners;
                                newCorners[cornerKey] = {
                                    x: startState.corners[cornerKey].x + dx,
                                    y: startState.corners[cornerKey].y + dy
                                };
                            });
                        } else if (handle in newCorners) {
                            const cornerKey = handle as keyof typeof newCorners;
                            newCorners[cornerKey] = point;
                        }
                        setTransformState({ ...startState, corners: newCorners });
                    }
                    break;
                }
                case 'selection': {
                    const { tool: selectionTool, startPoint } = dragAction.current;
                    dragAction.current.points.push(point);
                    
                    previewCtx.strokeStyle = 'rgba(0,0,0,0.7)';
                    previewCtx.lineWidth = 1 / viewTransform.zoom;
                    previewCtx.setLineDash([4 / viewTransform.zoom, 2 / viewTransform.zoom]);
                    
                    if (selectionTool === 'marquee-rect') {
                        previewCtx.strokeRect(startPoint.x, startPoint.y, point.x - startPoint.x, point.y - startPoint.y);
                    } else {
                        previewCtx.beginPath();
                        previewCtx.moveTo(dragAction.current.points[0].x, dragAction.current.points[0].y);
                        for (let i = 1; i < dragAction.current.points.length; i++) {
                            previewCtx.lineTo(dragAction.current.points[i].x, dragAction.current.points[i].y);
                        }
                        previewCtx.stroke();
                    }
                    
                    break;
                }
                case 'pan': {
                    const { startX, startY, startPan } = dragAction.current;
                    setViewTransform(v => ({ ...v, pan: { x: startPan.x + (e.clientX - startX), y: startPan.y + (e.clientY - startY) } }));
                    break;
                }
                case 'draw': {
                    const events: PointerEvent[] = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
                    const newPoints: Point[] = [];

                    for (const event of events) {
                        const currentRawPoint = getCanvasPoint(event, viewTransform, uiCanvasRef.current!);
                        let finalPoint = currentRawPoint;
                        let guideApplied = false;
                        
                        if (activeGuide === 'perspective' && isPerspectiveStrokeLockEnabled) {
                            if (strokeLockInfo.current && strokeLockInfo.current.targetVP) { finalPoint = projectPointOnLine(currentRawPoint, strokeLockInfo.current.startPoint, strokeLockInfo.current.targetVP); guideApplied = true; }
                        } else if (lockedPerspectiveLine.current) {
                            finalPoint = projectPointOnLine(currentRawPoint, lockedPerspectiveLine.current.start, lockedPerspectiveLine.current.end); guideApplied = true;
                        } else if (isOrthogonalVisible && orthogonalGuide) {
                            const startPoint = dragAction.current.points[0];
                            if (!orthogonalLock.current && Math.hypot(currentRawPoint.x - startPoint.x, currentRawPoint.y - startPoint.y) > (10 / viewTransform.zoom)) { const angleRad = (orthogonalGuide.angle * Math.PI) / 180, cos = Math.cos(-angleRad), sin = Math.sin(-angleRad), relativeX = currentRawPoint.x - startPoint.x, relativeY = currentRawPoint.y - startPoint.y, unrotatedX = relativeX * cos - relativeY * sin, unrotatedY = relativeX * sin + relativeY * cos; orthogonalLock.current = { axis: Math.abs(unrotatedX) > Math.abs(unrotatedY) ? 'x' : 'y', startPoint }; }
                            if (orthogonalLock.current) { const { startPoint: lockStartPoint, axis } = orthogonalLock.current, angleRad = (orthogonalGuide.angle * Math.PI) / 180, cos = Math.cos(-angleRad), sin = Math.sin(-angleRad), relativeX = currentRawPoint.x - lockStartPoint.x, relativeY = currentRawPoint.y - lockStartPoint.y, unrotatedX = relativeX * cos - relativeY * sin, unrotatedY = relativeX * sin + relativeY * cos, snappedUnrotatedX = axis === 'x' ? unrotatedX : 0, snappedUnrotatedY = axis === 'y' ? unrotatedY : 0, cosBack = Math.cos(angleRad), sinBack = Math.sin(angleRad), rotatedX = snappedUnrotatedX * cosBack - snappedUnrotatedY * sinBack, rotatedY = snappedUnrotatedX * sinBack + snappedUnrotatedY * cosBack; finalPoint = { x: lockStartPoint.x + rotatedX, y: lockStartPoint.y + rotatedY }; guideApplied = true; }
                        } else if (activeGuide === 'ruler' && rulerGuides.length > 0) {
                            let closestProjectedPoint: Point | null = null, minDistance = Infinity;
                            rulerGuides.forEach(guide => { const projected = projectPointOnLine(rawPoint, guide.start, guide.end); const dist = Math.hypot(rawPoint.x - projected.x, rawPoint.y - projected.y); if (dist < minDistance) { minDistance = dist; closestProjectedPoint = projected; } });
                            if (closestProjectedPoint) { finalPoint = closestProjectedPoint; guideApplied = true; }
                        }

                        if (!guideApplied) { finalPoint = snapPointToGrid(currentRawPoint); }
                        const pressure = event.pointerType === 'pen' ? event.pressure : 1.0;
                        newPoints.push({ ...finalPoint, pressure });
                    }

                    if(newPoints.length === 0) break;
                    
                    dragAction.current.points.push(...newPoints);

                    if (tool === 'eraser' && beforeCanvasRef.current) {
                        previewCtx.drawImage(beforeCanvasRef.current, 0, 0);
                    }
                    
                    if (strokeMode === 'line') {
                        const allPoints = dragAction.current.points;
                        drawStrokeWithMirroring(previewCtx, [allPoints[0], allPoints[allPoints.length - 1]]);
                    } else if (strokeMode === 'freehand' || strokeMode === 'polyline') {
                        drawStrokeWithMirroring(previewCtx, dragAction.current.points);
                    }
                    
                    break;
                }
            }
            previewCtx.restore();
        }
    }, [viewTransform, setViewTransform, guideDragState, setRulerGuides, setMirrorGuides, setPerspectiveGuide, strokeState, snapPointToGrid, previewCanvasRef, isDrawingTool, activeItem, strokeMode, drawStrokeWithMirroring, activeGuide, isPerspectiveStrokeLockEnabled, perspectiveVPs, lockedPerspectiveLine, isOrthogonalVisible, orthogonalGuide, rulerGuides, getMinZoom, MAX_ZOOM, cropRect, setCropRect, transformState, setTransformState, isAspectRatioLocked, isAngleSnapEnabled, angleSnapValue]);
    
    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const wasGesture = wasInGestureRef.current;

        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        activePointers.current.delete(e.pointerId);

        if (activePointers.current.size < 2) {
            lastGestureState.current = null;
        }

        if (activePointers.current.size === 0) {
            wasInGestureRef.current = false; // Reset gesture flag only when all pointers are up
        }

        if (dragAction.current.type === 'pan') {
            e.currentTarget.style.cursor = 'grab';
        }

        if (guideDragState) {
            setGuideDragState(null);
            setDragAction({ type: 'none' });
            return;
        }

        const currentAction = dragAction.current;
        const currentActionType = currentAction.type;

        if (currentActionType === 'text-place') {
            const point = getCanvasPoint(e, viewTransform, uiCanvasRef.current!);
            
            // Unconditionally create a new object for the text.
            const newObjectId = onAddItem('object');
            
            if (newObjectId) {
                // If there was a text box open before, commit it.
                if (textEditState) {
                    onCommitText(textEditState);
                }
                // Open the new text box on the newly created object.
                setTextEditState({
                    position: point,
                    value: '',
                    activeItemId: newObjectId,
                });
            }
            setDragAction({ type: 'none' });
            return;
        }

        if (currentActionType === 'selection' && activeItem) {
            const { tool: selectionTool, startPoint, points } = currentAction;
            const endPoint = getCanvasPoint(e, viewTransform, uiCanvasRef.current!);
            
            const path = new Path2D();
            let boundingBox: CropRect;

            if (selectionTool === 'marquee-rect') {
                const x = Math.min(startPoint.x, endPoint.x);
                const y = Math.min(startPoint.y, endPoint.y);
                const width = Math.abs(startPoint.x - endPoint.x);
                const height = Math.abs(startPoint.y - endPoint.y);
                path.rect(x, y, width, height);
                boundingBox = { x, y, width, height };
            } else { 
                if (points.length > 2) {
                    path.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        path.lineTo(points[i].x, points[i].y);
                    }
                    path.closePath();
                    
                    const minX = Math.min(...points.map(p => p.x));
                    const maxX = Math.max(...points.map(p => p.x));
                    const minY = Math.min(...points.map(p => p.y));
                    const maxY = Math.max(...points.map(p => p.y));
                    boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                } else {
                    boundingBox = { x: startPoint.x, y: startPoint.y, width: 0, height: 0 };
                }
            }

            if (boundingBox.width > 0 || boundingBox.height > 0) {
                setSelection({ path, boundingBox, sourceItemId: activeItem.id });
            }
        }

        if (currentActionType === 'draw' && activeItem?.type === 'object' && activeItem.context) {
            const pointsToDraw = (strokeMode === 'line')
                ? [currentAction.points[0], snapPointToGrid(getCanvasPoint(e, viewTransform, uiCanvasRef.current!))]
                : currentAction.points;

            if (pointsToDraw.length > 0) {
                drawStrokeWithMirroring(activeItem.context, pointsToDraw);
            }
            
            if (beforeCanvasRef.current) {
                onDrawCommit(activeItem.id, beforeCanvasRef.current);
            }
        }
        
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) {
            clearCanvas(previewCtx);
        }
        
        lockedPerspectiveLine.current = null;
        strokeLockInfo.current = null;
        orthogonalLock.current = null;
        
        if (
            currentActionType === 'none' &&
            !guideDragState &&
            activePointers.current.size === 0 &&
            tool === 'select' && // Restrict object selection to the 'select' tool.
            !wasGesture
        ) {
            const point = getCanvasPoint(e, viewTransform, uiCanvasRef.current!);
            
            // Iterate from top to bottom (reverse order of rendering) to find the clicked item.
            const clickedItem = [...items].reverse().find(item => {
                if (item.type !== 'object' || !item.canvas || !item.isVisible || item.isBackground) {
                    return false;
                }

                const ctx = item.canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return false;

                // Check for non-transparent pixel at the clicked point.
                try {
                    if (point.x >= 0 && point.x < item.canvas.width && point.y >= 0 && point.y < item.canvas.height) {
                        const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
                        return pixel[3] > 10; // Use a small tolerance for alpha.
                    }
                } catch (err) {
                    console.error("Could not get pixel data for selection:", err);
                    return false;
                }
                return false;
            });

            onSelectItem(clickedItem ? clickedItem.id : null);
        }

        setDragAction({ type: 'none' });
        beforeCanvasRef.current = null;
        
        if (livePreviewLayerId) {
            setLivePreviewLayerId(null);
        }

    }, [activeItem, drawStrokeWithMirroring, onDrawCommit, guideDragState, setGuideDragState, previewCanvasRef, livePreviewLayerId, setLivePreviewLayerId, strokeMode, viewTransform, uiCanvasRef, snapPointToGrid, setSelection, onAddItem, textEditState, onCommitText, setTextEditState, onSelectItem, tool, items]);

    const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        activePointers.current.delete(e.pointerId);

        if (activePointers.current.size < 2) {
            lastGestureState.current = null;
        }
        
        onPointerUp(e);
    }, [onPointerUp]);
    
    const onDoubleClick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uiCanvasRef.current) return;
        
        if (strokeState && strokeState.mode === 'polyline' && strokeState.points.length >= 2) {
            if (activeItem?.type === 'object' && activeItem.context) {
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
            const minZoom = getMinZoom();
            const newZoom = Math.max(minZoom, Math.min(currentTransform.zoom * zoomFactor, MAX_ZOOM));
            const pointerCanvasX = (pointerViewX - currentTransform.pan.x) / currentTransform.zoom;
            const pointerCanvasY = (pointerViewY - currentTransform.pan.y) / currentTransform.zoom;
            const newPanX = pointerViewX - pointerCanvasX * newZoom;
            const newPanY = pointerViewY - pointerCanvasY * newZoom;
            return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
        });
    }, [setViewTransform, getMinZoom, MAX_ZOOM]);

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick, onWheel, dragActionRef: dragAction };
}