




import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import type { 
    SketchObject, 
    Tool, 
    Guide, 
    Point, 
    RulerGuide, 
    PerspectiveGuide, 
    MirrorGuide, 
    OrthogonalGuide,
    CropRect,
    TransformState,
    BrushSettings,
    EraserSettings,
    MarkerSettings,
    AirbrushSettings,
    FXBrushSettings,
    ViewTransform,
    GridGuide,
    StrokeMode,
    StrokeState
} from '../types';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing';
import { useCanvasRendering } from '../hooks/useCanvasRendering';
import { usePointerEvents } from '../hooks/usePointerEvents';
import { getCssMatrix3d } from '../utils/canvasUtils';

interface CanvasContainerProps {
  objects: SketchObject[];
  activeItemId: string | null;
  brushSettings: BrushSettings;
  eraserSettings: EraserSettings;
  markerSettings: MarkerSettings;
  airbrushSettings: AirbrushSettings;
  fxBrushSettings: FXBrushSettings;
  tool: Tool;
  setTool: (tool: Tool) => void;
  onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
  onUpdateItem: (id: string, updates: Partial<SketchObject>) => void;
  viewTransform: ViewTransform;
  setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
  activeGuide: Guide;
  isSnapToGridEnabled: boolean;
  isOrthogonalVisible: boolean;
  rulerGuides: RulerGuide[];
  setRulerGuides: React.Dispatch<React.SetStateAction<RulerGuide[]>>;
  mirrorGuides: MirrorGuide[];
  setMirrorGuides: React.Dispatch<React.SetStateAction<MirrorGuide[]>>;
  perspectiveGuide: PerspectiveGuide | null;
  setPerspectiveGuide: React.Dispatch<React.SetStateAction<PerspectiveGuide | null>>;
  perspectiveMatchState: { enabled: boolean; points: Point[] } | null;
  onAddPerspectivePoint: (point: Point) => void;
  orthogonalGuide: OrthogonalGuide;
  gridGuide: GridGuide;
  onSelectItem: (id: string | null) => void;
  isCropping: boolean;
  cropRect: CropRect | null;
  setCropRect: React.Dispatch<React.SetStateAction<CropRect | null>>;
  isTransforming: boolean;
  transformState: TransformState | null;
  setTransformState: React.Dispatch<React.SetStateAction<TransformState | null>>;
  transformSourceBbox: CropRect | null;
  isAspectRatioLocked: boolean;
  areGuidesLocked: boolean;
  isPerspectiveStrokeLockEnabled: boolean;
  setIsPerspectiveStrokeLockEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  strokeMode: StrokeMode;
  strokeState: StrokeState | null;
  setStrokeState: React.Dispatch<React.SetStateAction<StrokeState | null>>;
}

type GuideDragState =
    | { type: 'ruler', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'mirror', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'perspective', color: 'green' | 'red' | 'blue'; lineId: string; part: 'start' | 'end' }
    | { type: 'perspective-point', part: 'point' }
    | { type: 'perspective-extra', color: 'green' | 'red' | 'blue', id: string }
    | null;


export const CanvasContainer: React.FC<CanvasContainerProps> = (props) => {
    const {
        objects, activeItemId, tool, viewTransform, setViewTransform, 
        onDrawCommit,
        activeGuide, isOrthogonalVisible, rulerGuides, setRulerGuides, mirrorGuides, setMirrorGuides,
        perspectiveGuide, setPerspectiveGuide, orthogonalGuide, gridGuide, areGuidesLocked,
        isCropping, cropRect, setCropRect, isTransforming, transformState, setTransformState, transformSourceBbox, isAspectRatioLocked,
        isPerspectiveStrokeLockEnabled,
        setIsPerspectiveStrokeLockEnabled,
        isSnapToGridEnabled,
        strokeMode, strokeState, setStrokeState,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCursorCanvasRef = useRef<HTMLCanvasElement>(null);
    const uiCanvasRef = useRef<HTMLCanvasElement>(null);
    const guideCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const [pointerPosition, setPointerPosition] = useState<Point | null>(null);
    const isDrawingRef = useRef(false);
    const [guideDragState, setGuideDragState] = useState<GuideDragState>(null);
    const [transformPreviewDataUrl, setTransformPreviewDataUrl] = useState<string | null>(null);
    const [livePreviewLayerId, setLivePreviewLayerId] = useState<string | null>(null);

    const activeItem = objects.find(i => i.id === activeItemId);
    const isDrawingTool = ['brush', 'eraser', 'marker', 'airbrush', 'fx-brush', 'debug-brush'].includes(tool);

    const { drawStrokeWithMirroring } = useCanvasDrawing({
        tool,
        brushSettings: props.brushSettings,
        eraserSettings: props.eraserSettings,
        markerSettings: props.markerSettings,
        airbrushSettings: props.airbrushSettings,
        fxBrushSettings: props.fxBrushSettings,
        activeGuide,
        mirrorGuides,
        strokeMode,
    });

    const { 
        redrawMainCanvas, 
        redrawGuides, 
        redrawUI, 
        perspectiveVPs 
    } = useCanvasRendering({
        mainCanvasRef, guideCanvasRef, uiCanvasRef, objects, viewTransform, isTransforming,
        activeItemId, activeGuide, 
        isOrthogonalVisible, 
        rulerGuides, mirrorGuides, perspectiveGuide, orthogonalGuide,
        gridGuide,
        isCropping, cropRect, transformState, transformSourceBbox, 
        livePreviewLayerId
    });

    const basePointerHandlers = usePointerEvents({
        uiCanvasRef, previewCanvasRef, viewTransform, setViewTransform, activeItem, tool, isDrawingTool,
        onDrawCommit, drawStrokeWithMirroring, areGuidesLocked, activeGuide, 
        isOrthogonalVisible, 
        rulerGuides,
        setRulerGuides, mirrorGuides, setMirrorGuides, perspectiveGuide, setPerspectiveGuide,
        perspectiveVPs, orthogonalGuide, guideDragState, setGuideDragState, cropRect,
        setCropRect, 
        transformState, setTransformState, isAspectRatioLocked,
        livePreviewLayerId, setLivePreviewLayerId,
        isPerspectiveStrokeLockEnabled,
        isSnapToGridEnabled,
        gridGuide,
        strokeMode,
        strokeState,
        setStrokeState,
        brushSettings: props.brushSettings,
        eraserSettings: props.eraserSettings,
        markerSettings: props.markerSettings,
        fxBrushSettings: props.fxBrushSettings,
    });
    
    const pointerHandlers = {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            isDrawingRef.current = true;
            basePointerHandlers.onPointerDown(e);
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
            isDrawingRef.current = false;
            basePointerHandlers.onPointerUp(e);
        },
        onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
            isDrawingRef.current = false;
            basePointerHandlers.onPointerCancel(e);
        },
        onPointerMove: basePointerHandlers.onPointerMove,
        onDoubleClick: basePointerHandlers.onDoubleClick,
        onWheel: basePointerHandlers.onWheel,
    };

    useEffect(() => {
        if (isTransforming && activeItem?.canvas && transformSourceBbox) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = transformSourceBbox.width;
            tempCanvas.height = transformSourceBbox.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.drawImage(
                    activeItem.canvas,
                    transformSourceBbox.x,
                    transformSourceBbox.y,
                    transformSourceBbox.width,
                    transformSourceBbox.height,
                    0, 0,
                    transformSourceBbox.width,
                    transformSourceBbox.height
                );
                setTransformPreviewDataUrl(tempCanvas.toDataURL());
            }
        } else {
            setTransformPreviewDataUrl(null);
        }
    }, [isTransforming, activeItem, transformSourceBbox]);

    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            if (!uiCanvasRef.current) return;
            const pointOnUi = { x: e.clientX - uiCanvasRef.current.getBoundingClientRect().left, y: e.clientY - uiCanvasRef.current.getBoundingClientRect().top };
            setPointerPosition(pointOnUi);
        };
        const handleLeave = () => {
            setPointerPosition(null);
            isDrawingRef.current = false;
        };
        const container = containerRef.current;
        container?.addEventListener('pointermove', handleMove);
        container?.addEventListener('pointerleave', handleLeave);
        return () => {
            container?.removeEventListener('pointermove', handleMove);
            container?.removeEventListener('pointerleave', handleLeave);
        };
    }, []);

    useEffect(() => {
        const cursorCtx = previewCursorCanvasRef.current?.getContext('2d');
        if (!cursorCtx) return;

        cursorCtx.clearRect(0, 0, cursorCtx.canvas.width, cursorCtx.canvas.height);

        if (isDrawingTool && pointerPosition && (!isDrawingRef.current || tool === 'eraser')) {
            let size = 0;
            switch (tool) {
                case 'brush': size = props.brushSettings.size; break;
                case 'eraser': size = props.eraserSettings.size; break;
                case 'marker': size = props.markerSettings.size; break;
                case 'airbrush': size = props.airbrushSettings.size; break;
                case 'fx-brush': size = props.fxBrushSettings.size; break;
                case 'debug-brush': size = 2; break;
            }

            if (size > 0) {
                const scaledSize = size * viewTransform.zoom;
                
                const drawOutline = (shape: 'circle' | 'square') => {
                    cursorCtx.lineWidth = 1;
                    cursorCtx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                    cursorCtx.setLineDash([]);
                    cursorCtx.beginPath();
                    if (shape === 'circle') {
                        cursorCtx.arc(pointerPosition.x, pointerPosition.y, scaledSize / 2, 0, 2 * Math.PI);
                    } else {
                        cursorCtx.rect(pointerPosition.x - scaledSize / 2, pointerPosition.y - scaledSize / 2, scaledSize, scaledSize);
                    }
                    cursorCtx.stroke();
                    
                    cursorCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                    cursorCtx.setLineDash([2, 2]);
                    cursorCtx.beginPath();
                     if (shape === 'circle') {
                        cursorCtx.arc(pointerPosition.x, pointerPosition.y, scaledSize / 2, 0, 2 * Math.PI);
                    } else {
                        cursorCtx.rect(pointerPosition.x - scaledSize / 2, pointerPosition.y - scaledSize / 2, scaledSize, scaledSize);
                    }
                    cursorCtx.stroke();
                    cursorCtx.setLineDash([]);
                };

                const shapeToDraw = (tool === 'eraser' && props.eraserSettings.tipShape === 'square') ? 'square' : 'circle';
                drawOutline(shapeToDraw);
            }
        }
    }, [isDrawingTool, tool, pointerPosition, viewTransform.zoom, props.brushSettings, props.eraserSettings, props.markerSettings, props.airbrushSettings, props.fxBrushSettings, isDrawingRef.current]);

    useLayoutEffect(() => {
        redrawMainCanvas();
        redrawGuides();
        redrawUI();
    }, [redrawMainCanvas, redrawGuides, redrawUI, isTransforming, transformState, activeItem, transformSourceBbox, viewTransform]);
    
    useEffect(() => {
        const container = containerRef.current;
        const canvases = [mainCanvasRef.current, previewCanvasRef.current, previewCursorCanvasRef.current, uiCanvasRef.current, guideCanvasRef.current];
        if (!container || canvases.some(c => !c)) return;

        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            canvases.forEach(canvas => {
                if (canvas) {
                    canvas.width = width;
                    canvas.height = height;
                }
            });
            redrawMainCanvas();
            redrawGuides();
            redrawUI();
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [redrawMainCanvas, redrawGuides, redrawUI]);
    
    let transformPreviewStyle: React.CSSProperties = { display: 'none' };
    if (isTransforming && transformState && transformSourceBbox && transformPreviewDataUrl) {
        
        if (transformState.type === 'affine') {
             const { x, y, width, height, rotation } = transformState;
             const scaleX = width / transformSourceBbox.width;
             const scaleY = height / transformSourceBbox.height;
             const finalTransform = `
                matrix(${viewTransform.zoom}, 0, 0, ${viewTransform.zoom}, ${viewTransform.pan.x}, ${viewTransform.pan.y})
                translate(${x + width/2}px, ${y + height/2}px)
                rotate(${rotation}rad)
                scale(${scaleX}, ${scaleY})
                translate(-${transformSourceBbox.width/2}px, -${transformSourceBbox.height/2}px)
             `;
             
            transformPreviewStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${transformSourceBbox.width}px`,
                height: `${transformSourceBbox.height}px`,
                willChange: 'transform',
                imageRendering: 'pixelated',
                transformOrigin: 'top left',
                transform: finalTransform,
            };
        } else if (transformState.type === 'free') {
            const { corners } = transformState;
            const { width, height } = transformSourceBbox;

            const srcPoints = [
                { x: 0, y: 0 }, { x: width, y: 0 },
                { x: width, y: height }, { x: 0, y: height },
            ];
            
            const dstPoints = [ corners.tl, corners.tr, corners.br, corners.bl ].map(p => ({
                x: p.x * viewTransform.zoom + viewTransform.pan.x,
                y: p.y * viewTransform.zoom + viewTransform.pan.y,
            }));
            
            const finalTransform = getCssMatrix3d(srcPoints, dstPoints);

            transformPreviewStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${width}px`,
                height: `${height}px`,
                willChange: 'transform',
                imageRendering: 'pixelated',
                transformOrigin: 'top left',
                transform: finalTransform,
            };
        }
    }

    const getCursorStyle = () => {
        if (isDrawingTool) return 'none';
        if (tool === 'pan') return isDrawingRef.current ? 'grabbing' : 'grab';
        return 'crosshair';
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative bg-[--bg-tertiary]"
            style={{ cursor: getCursorStyle(), touchAction: 'none' }}
            {...pointerHandlers}
            onContextMenu={e => e.preventDefault()}
        >
            <canvas ref={mainCanvasRef} className="absolute inset-0" />
            
            <canvas ref={previewCanvasRef} className="absolute inset-0 pointer-events-none" />
            
            <img
                src={transformPreviewDataUrl || ''}
                alt="Transform preview"
                className="pointer-events-none"
                style={transformPreviewStyle}
            />

            <canvas ref={uiCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={guideCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={previewCursorCanvasRef} className="absolute inset-0 pointer-events-none" />
        </div>
    );
};