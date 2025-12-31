import React, { useRef, useEffect, useState, useLayoutEffect, useReducer, useImperativeHandle } from 'react';
// FIX: Corrected relative import paths for modules outside the components directory.
import type {
    CanvasItem,
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
    // FIX: Changed SolidMarkerSettings to SimpleMarkerSettings to match type definitions.
    SimpleMarkerSettings,
    NaturalMarkerSettings,
    AirbrushSettings,
    FXBrushSettings,
    ViewTransform,
    GridGuide,
    StrokeMode,
    StrokeState,
    StrokeModifier,
    Selection,
    MagicWandSettings,
    TextSettings,
    AdvancedMarkerSettings,
    WatercolorSettings,
    ScaleUnit,
} from '../types';
// FIX: Corrected relative import paths for hooks.
import { useBrushManager } from '../hooks/useBrushManager';
import { useCanvasRendering } from '../hooks/useCanvasRendering';
import { usePointerEvents } from '../hooks/usePointerEvents';
// FIX: Corrected relative import path for canvasUtils.
import { getCssMatrix3d, clearCanvas } from '../utils/canvasUtils';
// FIX: Corrected relative import path for SelectionToolbar component.
import { SelectionToolbar } from './SelectionToolbar';

interface CanvasContainerProps {
    items: CanvasItem[];
    activeItemId: string | null;
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    // FIX: Changed solidMarkerSettings to simpleMarkerSettings to match type definitions.
    simpleMarkerSettings: SimpleMarkerSettings;
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    // FIX: Added advancedMarkerSettings to props to support the new tool.
    advancedMarkerSettings: AdvancedMarkerSettings;
    // FIX: Add watercolor settings to props
    watercolorSettings: WatercolorSettings;
    magicWandSettings: MagicWandSettings;
    textSettings: TextSettings;
    tool: Tool;
    setTool: (tool: Tool) => void;
    onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
    onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
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
    isAngleSnapEnabled: boolean;
    angleSnapValue: 1 | 5 | 10 | 15;
    areGuidesLocked: boolean;
    isPerspectiveStrokeLockEnabled: boolean;
    setIsPerspectiveStrokeLockEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    strokeMode: StrokeMode;
    strokeState: StrokeState | null;
    setStrokeState: React.Dispatch<React.SetStateAction<StrokeState | null>>;
    selection: Selection | null;
    setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
    onCutSelection: () => void;
    onCopySelection: () => void;
    onDeleteSelection: () => void;
    onDeselect: () => void;
    getMinZoom: () => number;
    MAX_ZOOM: number;
    onAddItem: (type: 'group' | 'object') => string;
    textEditState: { position: Point; value: string; activeItemId: string; } | null;
    setTextEditState: React.Dispatch<React.SetStateAction<{ position: Point; value: string; activeItemId: string; } | null>>;
    onCommitText: (textState: { position: Point; value: string; activeItemId: string; }) => void;
    // FIX: Add missing strokeSmoothing and strokeModifier props to fix type errors.
    strokeSmoothing: number;
    strokeModifier: StrokeModifier;
    isPalmRejectionEnabled: boolean;
    scaleFactor: number;

    scaleUnit: ScaleUnit;
    isSolidBox: boolean;
    isPressureSensitivityEnabled: boolean;
}

type GuideDragState =
    | { type: 'ruler', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'mirror', id: string, part: 'start' | 'end' | 'line', offset: Point }
    | { type: 'perspective', color: 'green' | 'red' | 'blue'; lineId: string; part: 'start' | 'end' }
    | { type: 'perspective-point', part: 'point' }
    | { type: 'perspective-extra', color: 'green' | 'red' | 'blue', id: string }
    | null;


export interface CanvasHandle {
    getCanvas: () => HTMLCanvasElement | null;
}

interface CanvasContainerPropsWithRef extends CanvasContainerProps {
    handleRef?: React.Ref<CanvasHandle>;
}

export const CanvasContainerComponent: React.FC<CanvasContainerPropsWithRef> = (props) => {
    const {
        handleRef,
        items, activeItemId, tool, viewTransform, setViewTransform,
        onDrawCommit, onSelectItem, onUpdateItem,
        activeGuide, isOrthogonalVisible, rulerGuides, setRulerGuides, mirrorGuides, setMirrorGuides,
        perspectiveGuide, setPerspectiveGuide, orthogonalGuide, gridGuide, areGuidesLocked,
        isCropping, cropRect, setCropRect, isTransforming, transformState, setTransformState, transformSourceBbox, isAspectRatioLocked,
        isAngleSnapEnabled, angleSnapValue,
        isPerspectiveStrokeLockEnabled,
        setIsPerspectiveStrokeLockEnabled,
        isSnapToGridEnabled,
        strokeMode, strokeState, setStrokeState,
        selection, setSelection,
        onCutSelection,
        onCopySelection,
        onDeleteSelection,
        onDeselect,
        getMinZoom,
        MAX_ZOOM,
        onAddItem,
        textSettings,
        textEditState,
        setTextEditState,
        onCommitText,
        // FIX: Destructure missing strokeSmoothing and strokeModifier props.
        strokeSmoothing,
        strokeModifier,
        isPalmRejectionEnabled,
        scaleFactor,
        scaleUnit,
        isSolidBox,
        isPressureSensitivityEnabled,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCursorCanvasRef = useRef<HTMLCanvasElement>(null);
    const uiCanvasRef = useRef<HTMLCanvasElement>(null);
    const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
    const guideCanvasRef = useRef<HTMLCanvasElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(handleRef, () => ({
        getCanvas: () => mainCanvasRef.current
    }));

    const [renderTrigger, forceRender] = useReducer(c => c + 1, 0);
    const [pointerPosition, setPointerPosition] = useState<Point | null>(null);
    const isDrawingRef = useRef(false);
    const [guideDragState, setGuideDragState] = useState<GuideDragState>(null);
    const [transformPreviewDataUrl, setTransformPreviewDataUrl] = useState<string | null>(null);
    const [livePreviewLayerId, setLivePreviewLayerId] = useState<string | null>(null);
    // Debug pointers state removed for performance
    // const [debugPointers, setDebugPointers] = useState<Map<number, { x: number, y: number }>>(new Map());

    const activeItem = items.find(i => i.id === activeItemId);
    const isDrawingTool = ['brush', 'eraser', 'simple-marker', 'natural-marker', 'airbrush', 'fx-brush', 'debug-brush', 'advanced-marker', 'watercolor'].includes(tool);
    const isSelectionTool = ['marquee-rect', 'lasso', 'magic-wand'].includes(tool);

    const { getBrushForTool } = useBrushManager({
        brushSettings: props.brushSettings,
        eraserSettings: props.eraserSettings,
        simpleMarkerSettings: props.simpleMarkerSettings,
        naturalMarkerSettings: props.naturalMarkerSettings,
        airbrushSettings: props.airbrushSettings,
        fxBrushSettings: props.fxBrushSettings,
        advancedMarkerSettings: props.advancedMarkerSettings,
        watercolorSettings: props.watercolorSettings,
    });

    const {
        redrawMainCanvas,
        redrawGuides,
        redrawUI,
        perspectiveVPs
        // @ts-ignore
    } = useCanvasRendering({
        mainCanvasRef, guideCanvasRef, uiCanvasRef, items, viewTransform, isTransforming,
        activeItemId, activeGuide,
        isOrthogonalVisible,
        rulerGuides, mirrorGuides, perspectiveGuide, orthogonalGuide,
        gridGuide,
        isCropping, cropRect, transformState, transformSourceBbox,
        livePreviewLayerId,
        scaleFactor,
        scaleUnit,
    });

    const { dragActionRef, ...basePointerHandlers } = usePointerEvents({
        items,
        uiCanvasRef, previewCanvasRef, viewTransform, setViewTransform, activeItem, tool, isDrawingTool, isSelectionTool,
        onDrawCommit, onSelectItem, onUpdateItem,
        getBrushForTool, areGuidesLocked, activeGuide,
        isOrthogonalVisible,
        rulerGuides,
        setRulerGuides, mirrorGuides, setMirrorGuides, perspectiveGuide, setPerspectiveGuide,
        perspectiveVPs, orthogonalGuide, guideDragState, setGuideDragState, cropRect,
        setCropRect,
        transformState, setTransformState, isAspectRatioLocked,
        isAngleSnapEnabled, angleSnapValue,
        livePreviewLayerId,
        setLivePreviewLayerId,
        isPerspectiveStrokeLockEnabled,
        isSnapToGridEnabled,
        gridGuide,
        strokeMode,
        strokeState,
        setStrokeState,
        magicWandSettings: props.magicWandSettings,
        selection, setSelection,
        forceRender,
        getMinZoom,
        MAX_ZOOM,
        onAddItem,
        textEditState,
        setTextEditState,
        onCommitText,
        strokeSmoothing,
        strokeModifier,
        // setDebugPointers, // OPTIMIZATION: Removed
        isPalmRejectionEnabled,
        isSolidBox,
        isPressureSensitivityEnabled,
        brushSettings: props.brushSettings,
        fillColor: tool === 'brush' ? props.brushSettings.fillColor :
            tool === 'simple-marker' ? props.simpleMarkerSettings.fillColor :
                tool === 'advanced-marker' ? props.advancedMarkerSettings.fillColor :
                    tool === 'natural-marker' ? props.naturalMarkerSettings.fillColor :
                        tool === 'airbrush' ? props.airbrushSettings.fillColor :
                            tool === 'watercolor' ? props.watercolorSettings.fillColor :
                                tool === 'fx-brush' ? props.fxBrushSettings.fillColor : 'transparent',
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
        if (isTransforming && transformState && 'pendingImage' in transformState && transformState.pendingImage) {
            setTransformPreviewDataUrl(transformState.pendingImage.src);
        } else if (isTransforming && activeItem?.type === 'object' && activeItem?.canvas && transformSourceBbox) {
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
    }, [isTransforming, activeItem, transformSourceBbox, transformState]);

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

        // Note: debug pointer rendering removed to avoid drawing red debug circles on the cursor canvas.

        // Only draw the brush cursor if there's no multi-touch gesture happening
        if (isDrawingTool && pointerPosition && (!isDrawingRef.current || tool === 'eraser')) {
            let size = 0;
            switch (tool) {
                case 'brush': size = props.brushSettings.size; break;
                case 'eraser': size = props.eraserSettings.size; break;
                // FIX: Replaced 'solid-marker' with 'simple-marker' and added other tools.
                case 'simple-marker': size = props.simpleMarkerSettings.size; break;
                case 'natural-marker': size = props.naturalMarkerSettings.size; break;
                case 'airbrush': size = props.airbrushSettings.size; break;
                case 'fx-brush': size = props.fxBrushSettings.size; break;
                case 'debug-brush': size = 2; break;
                case 'advanced-marker': size = props.advancedMarkerSettings.size; break;
                case 'watercolor': size = props.watercolorSettings.size; break;
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

                // FIX: Replaced 'solid-marker' with 'simple-marker'.
                // Draw a square cursor only when the eraser tip is square or the simple-marker tip is square.
                const shapeToDraw = (tool === 'eraser' && props.eraserSettings.tipShape === 'square') || (tool === 'simple-marker' && props.simpleMarkerSettings.tipShape === 'square') ? 'square' : 'circle';
                drawOutline(shapeToDraw);
            }
        }
    }, [isDrawingTool, tool, pointerPosition, viewTransform.zoom, props.brushSettings, props.eraserSettings, props.simpleMarkerSettings, props.naturalMarkerSettings, props.airbrushSettings, props.fxBrushSettings, props.advancedMarkerSettings, props.watercolorSettings, isDrawingRef.current]);

    useEffect(() => {
        const selectionCtx = selectionCanvasRef.current?.getContext('2d');
        if (!selection || !selectionCtx || selection.sourceItemId !== activeItemId) {
            if (selectionCtx) clearCanvas(selectionCtx);
            return;
        }

        let animationFrameId: number;
        let offset = 0;

        const animate = () => {
            offset = (offset + 0.5) % 8;

            clearCanvas(selectionCtx);

            selectionCtx.save();
            selectionCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);

            selectionCtx.lineWidth = 1 / viewTransform.zoom;
            selectionCtx.strokeStyle = 'white';
            selectionCtx.setLineDash([4 / viewTransform.zoom, 4 / viewTransform.zoom]);
            selectionCtx.lineDashOffset = -offset;
            selectionCtx.stroke(selection.path);

            selectionCtx.strokeStyle = 'black';
            selectionCtx.lineDashOffset = 4 - offset;
            selectionCtx.stroke(selection.path);

            selectionCtx.restore();

            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (selectionCtx) clearCanvas(selectionCtx);
        };
    }, [selection, viewTransform, activeItemId]);

    useLayoutEffect(() => {
        redrawMainCanvas();
        redrawGuides();
        redrawUI();
    }, [redrawMainCanvas, redrawGuides, redrawUI, isTransforming, transformState, activeItem, transformSourceBbox, viewTransform, renderTrigger, livePreviewLayerId, isCropping, cropRect]);

    useEffect(() => {
        const container = containerRef.current;
        const canvases = [mainCanvasRef.current, previewCanvasRef.current, previewCursorCanvasRef.current, uiCanvasRef.current, guideCanvasRef.current, selectionCanvasRef.current];
        if (!container || canvases.some(c => !c)) return;

        let timeoutId: number;

        const resizeObserver = new ResizeObserver(entries => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
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
            }, 100);
        });

        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
            window.clearTimeout(timeoutId);
        };
    }, [redrawMainCanvas, redrawGuides, redrawUI]);

    useEffect(() => {
        if (textEditState && textAreaRef.current) {
            textAreaRef.current.focus();
            textAreaRef.current.value = textEditState.value;
        }
    }, [textEditState]);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
            textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
        }
    }, [textEditState?.value]);

    let transformPreviewStyle: React.CSSProperties = { display: 'none' };
    if (isTransforming && transformState && transformSourceBbox && transformPreviewDataUrl) {

        if (transformState.type === 'affine') {
            const { x, y, width, height, rotation } = transformState;
            const scaleX = width / transformSourceBbox.width;
            const scaleY = height / transformSourceBbox.height;
            const finalTransform = `
                matrix(${viewTransform.zoom}, 0, 0, ${viewTransform.zoom}, ${viewTransform.pan.x}, ${viewTransform.pan.y})
                translate(${x + width / 2}px, ${y + height / 2}px)
                rotate(${rotation}rad)
                scale(${scaleX}, ${scaleY})
                translate(-${transformSourceBbox.width / 2}px, -${transformSourceBbox.height / 2}px)
             `;

            transformPreviewStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                height: `${transformSourceBbox.height}px`,
                willChange: 'transform',
                imageRendering: 'pixelated',
                transformOrigin: 'top left',
                transform: finalTransform,
                maxWidth: 'none',
                maxHeight: 'none',
            };
        } else if (transformState.type === 'free') {
            const { corners } = transformState;
            const { width, height } = transformSourceBbox;

            const srcPoints = [
                { x: 0, y: 0 }, { x: width, y: 0 },
                { x: width, y: height }, { x: 0, y: height },
            ];

            const dstPoints = [corners.tl, corners.tr, corners.br, corners.bl].map(p => ({
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
                maxWidth: 'none',
                maxHeight: 'none',
            };
        }
    }

    const getCursorStyle = () => {
        if (tool === 'text') return 'text';
        if (isDrawingTool) return 'none';
        if (isSelectionTool) return 'crosshair';
        if (tool === 'pan') return isDrawingRef.current ? 'grabbing' : 'grab';
        return 'default';
    };

    const handleTextCommit = () => {
        if (textEditState) {
            onCommitText(textEditState);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (textEditState) {
            setTextEditState({ ...textEditState, value: e.target.value });
        }
    };

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setTextEditState(null);
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextCommit();
        }
    };

    let textEditorStyle: React.CSSProperties = { display: 'none' };
    if (textEditState) {
        const { position } = textEditState;
        const viewX = position.x * viewTransform.zoom + viewTransform.pan.x;
        const viewY = position.y * viewTransform.zoom + viewTransform.pan.y;

        textEditorStyle = {
            position: 'absolute',
            left: `${viewX}px`,
            top: `${viewY}px`,
            transform: textSettings.textAlign === 'center' ? 'translateX(-50%)' : textSettings.textAlign === 'right' ? 'translateX(-100%)' : 'none',
            display: 'block',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px dashed rgba(255, 255, 255, 0.8)',
            borderRadius: '2px',
            padding: '0',
            margin: '0',
            resize: 'none',
            overflow: 'hidden',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            fontFamily: textSettings.fontFamily,
            fontSize: `${textSettings.fontSize * viewTransform.zoom}px`,
            lineHeight: 1.2,
            color: textSettings.color,
            textAlign: textSettings.textAlign,
            fontWeight: textSettings.fontWeight,
            minWidth: `${10 * viewTransform.zoom}px`,
            minHeight: `${textSettings.fontSize * 1.2 * viewTransform.zoom}px`,
            height: 'auto',
        };
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative bg-theme-bg-tertiary"
            style={{ cursor: getCursorStyle(), touchAction: 'none' }}
            {...pointerHandlers}
            onContextMenu={e => e.preventDefault()}
        >
            <canvas ref={mainCanvasRef} className="absolute inset-0" />
            <canvas ref={guideCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={previewCanvasRef} className="absolute inset-0 pointer-events-none" />

            {transformPreviewDataUrl && (
                <img
                    src={transformPreviewDataUrl}
                    alt="Transform preview"
                    className="pointer-events-none"
                    style={transformPreviewStyle}
                />
            )}

            <canvas ref={uiCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={selectionCanvasRef} className="absolute inset-0 pointer-events-none" />
            <canvas ref={previewCursorCanvasRef} className="absolute inset-0 pointer-events-none" />

            {textEditState && (
                <textarea
                    ref={textAreaRef}
                    style={textEditorStyle}
                    defaultValue={textEditState.value}
                    onChange={handleTextChange}
                    onBlur={handleTextCommit}
                    onKeyDown={handleTextKeyDown}
                    onPointerDown={e => e.stopPropagation()}
                />
            )}

            {selection && activeItemId === selection.sourceItemId && (
                <SelectionToolbar
                    selection={selection}
                    viewTransform={viewTransform}
                    onCut={onCutSelection}
                    onCopy={onCopySelection}
                    onDelete={onDeleteSelection}
                    onDeselect={onDeselect}
                />
            )}
        </div>
    );
};

export const CanvasContainer = React.memo(CanvasContainerComponent);
