import React, { useCallback, useRef } from 'react';
import type {
    CanvasItem,
    SketchObject,
    ViewTransform,
    Guide,
    RulerGuide,
    MirrorGuide,
    PerspectiveGuide,
    OrthogonalGuide,
    CropRect,
    Point,
    PerspectiveGuideLine,
    TransformState,
    GridGuide,
    Tool,
} from '../types';
import { getLineIntersection } from '../utils/canvasUtils';

type PerspectiveVPs = { vpGreen: Point | null, vpRed: Point | null, vpBlue: Point | null };

export function useCanvasRendering({
    mainCanvasRef,
    guideCanvasRef,
    uiCanvasRef,
    items,
    viewTransform,
    activeItemId,
    activeGuide,
    isOrthogonalVisible,
    rulerGuides,
    mirrorGuides,
    perspectiveGuide,
    orthogonalGuide,
    gridGuide,
    isCropping,
    cropRect,
    isTransforming,
    transformState,
    transformSourceBbox,
    livePreviewLayerId,
}: {
    mainCanvasRef: React.RefObject<HTMLCanvasElement>;
    guideCanvasRef: React.RefObject<HTMLCanvasElement>;
    uiCanvasRef: React.RefObject<HTMLCanvasElement>;
    items: CanvasItem[];
    viewTransform: ViewTransform;
    activeItemId: string | null;
    activeGuide: Guide;
    isOrthogonalVisible: boolean;
    rulerGuides: RulerGuide[];
    mirrorGuides: MirrorGuide[];
    perspectiveGuide: PerspectiveGuide | null;
    orthogonalGuide: OrthogonalGuide;
    gridGuide: GridGuide;
    isCropping: boolean;
    cropRect: CropRect | null;
    isTransforming: boolean;
    transformState: TransformState | null;
    transformSourceBbox: CropRect | null;
    livePreviewLayerId: string | null;
}) {

    const perspectiveVPs = useRef<PerspectiveVPs>({ vpGreen: null, vpRed: null, vpBlue: null });

    const drawGridOnContext = useCallback((ctx: CanvasRenderingContext2D) => {
        if (gridGuide.type === 'none' || gridGuide.spacing <= 0) {
            return;
        }
        
        const worldView = {
            x: -viewTransform.pan.x / viewTransform.zoom,
            y: -viewTransform.pan.y / viewTransform.zoom,
            width: ctx.canvas.width / viewTransform.zoom,
            height: ctx.canvas.height / viewTransform.zoom
        };

        const { spacing, majorLineFrequency, type, isoAngle, majorLineColor: majorLineColorFromProp, minorLineColor: minorLineColorFromProp } = gridGuide;

        ctx.lineWidth = 0.5 / viewTransform.zoom;
        const minorLineColor = minorLineColorFromProp;
        const majorLineColor = majorLineColorFromProp;

        if (type === 'cartesian') {
            const startX = Math.floor(worldView.x / spacing) * spacing;
            const endX = worldView.x + worldView.width;
            const startY = Math.floor(worldView.y / spacing) * spacing;
            const endY = worldView.y + worldView.height;
            
            let i_x = Math.round(startX / spacing);
            for (let x = startX; x <= endX; x += spacing) {
                ctx.strokeStyle = (i_x % majorLineFrequency === 0) ? majorLineColor : minorLineColor;
                ctx.beginPath();
                ctx.moveTo(x, worldView.y);
                ctx.lineTo(x, endY);
                ctx.stroke();
                i_x++;
            }

            let i_y = Math.round(startY / spacing);
            for (let y = startY; y <= endY; y += spacing) {
                ctx.strokeStyle = (i_y % majorLineFrequency === 0) ? majorLineColor : minorLineColor;
                ctx.beginPath();
                ctx.moveTo(worldView.x, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
                i_y++;
            }
        } else if (type === 'isometric') {
            const canvasDiagonal = Math.hypot(worldView.width, worldView.height) * 1.2;
            const center = { x: worldView.x + worldView.width / 2, y: worldView.y + worldView.height / 2 };
            
            const angles = [
                90 * (Math.PI / 180), // Vertical
                (90 - isoAngle) * (Math.PI / 180),
                (90 + isoAngle) * (Math.PI / 180),
            ];

            angles.forEach(angle => {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const perpCos = Math.cos(angle + Math.PI / 2);
                const perpSin = Math.sin(angle + Math.PI / 2);

                const centerProj = center.x * perpCos + center.y * perpSin;
                const startI = Math.floor((centerProj - canvasDiagonal / 2) / spacing);
                const endI = Math.ceil((centerProj + canvasDiagonal / 2) / spacing);

                for (let i = startI; i <= endI; i++) {
                    const offset = i * spacing;
                    const lineCenter = {
                        x: offset * perpCos,
                        y: offset * perpSin
                    };

                    const start = { x: lineCenter.x - canvasDiagonal * cos, y: lineCenter.y - canvasDiagonal * sin };
                    const end = { x: lineCenter.x + canvasDiagonal * cos, y: lineCenter.y + canvasDiagonal * sin };
                    
                    ctx.strokeStyle = (i % majorLineFrequency === 0) ? majorLineColor : minorLineColor;
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.stroke();
                }
            });
        }
    }, [gridGuide, viewTransform]);

    const redrawMainCanvas = useCallback(() => {
        const mainCtx = mainCanvasRef.current?.getContext('2d');
        if (!mainCtx) return;

        mainCtx.save();
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
        mainCtx.restore();
        
        mainCtx.save();
        mainCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
        
        const backgroundObject = items.find(item => item.type === 'object' && item.isBackground);
        const foregroundObjects = items.filter(item => item.type === 'object' && !item.isBackground);

        // 1. Draw background
        if (backgroundObject && backgroundObject.canvas && backgroundObject.isVisible) {
            mainCtx.globalAlpha = backgroundObject.opacity;
            mainCtx.drawImage(backgroundObject.canvas, backgroundObject.offsetX || 0, backgroundObject.offsetY || 0);
        }

        // 2. Draw Grid on top of background
        drawGridOnContext(mainCtx);

        // 3. Draw foreground items
        foregroundObjects.forEach(item => {
            if (!item.isVisible) return;
            
            const isBeingErased = item.id === livePreviewLayerId;

            if ((isTransforming && item.id === activeItemId) || isBeingErased) {
                // This item is being transformed or erased. Skip it here.
            } else if (item.canvas) {
                mainCtx.globalAlpha = item.opacity;
                mainCtx.drawImage(item.canvas, item.offsetX || 0, item.offsetY || 0);
            }
        });
        
        mainCtx.restore();
    }, [items, viewTransform, activeItemId, isTransforming, livePreviewLayerId, drawGridOnContext]);

    const redrawGuides = useCallback(() => {
        const guideCtx = guideCanvasRef.current?.getContext('2d');
        if (!guideCtx) return;

        guideCtx.save();
        guideCtx.setTransform(1, 0, 0, 1, 0, 0);
        guideCtx.clearRect(0, 0, guideCtx.canvas.width, guideCtx.canvas.height);
        guideCtx.restore();

        guideCtx.save();
        guideCtx.translate(viewTransform.pan.x, viewTransform.pan.y);
        guideCtx.scale(viewTransform.zoom, viewTransform.zoom);

        const handleSize = 8 / viewTransform.zoom;
        
        const worldView = {
            x: -viewTransform.pan.x / viewTransform.zoom,
            y: -viewTransform.pan.y / viewTransform.zoom,
            width: guideCtx.canvas.width / viewTransform.zoom,
            height: guideCtx.canvas.height / viewTransform.zoom
        };
        
        // --- Guide Drawing Logic ---

        // Ruler
        if (activeGuide === 'ruler' && rulerGuides) {
            rulerGuides.forEach(guide => {
                guideCtx.strokeStyle = 'cyan';
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                guideCtx.beginPath();
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
                guideCtx.stroke();
                guideCtx.fillStyle = 'cyan';
                // Handles
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                [guide.start, guide.end, midPoint].forEach(p => {
                    guideCtx.beginPath();
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                });
            });
        }

        // Mirror
        if (activeGuide === 'mirror' && mirrorGuides) {
            mirrorGuides.forEach(guide => {
                guideCtx.strokeStyle = 'rgba(139, 0, 255, 0.8)'; // A violet color
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                guideCtx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);
                guideCtx.beginPath();
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
                guideCtx.stroke();
                guideCtx.setLineDash([]);
                
                guideCtx.fillStyle = 'rgba(139, 0, 255, 0.8)';
                // Handles
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                [guide.start, guide.end, midPoint].forEach(p => {
                    guideCtx.beginPath();
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                });
            });
        }

        // Orthogonal
        if (isOrthogonalVisible && orthogonalGuide) {
            const center = {
                x: worldView.x + worldView.width / 2,
                y: worldView.y + worldView.height / 2,
            };
            const length = Math.max(worldView.width, worldView.height) * 1.5;
            
            guideCtx.save();
            guideCtx.translate(center.x, center.y);
            guideCtx.rotate(orthogonalGuide.angle * Math.PI / 180);
            
            guideCtx.strokeStyle = 'rgba(255, 165, 0, 0.7)'; // Orange
            guideCtx.lineWidth = 1 / viewTransform.zoom;
            guideCtx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);

            guideCtx.beginPath();
            guideCtx.moveTo(-length / 2, 0);
            guideCtx.lineTo(length / 2, 0);
            guideCtx.moveTo(0, -length / 2);
            guideCtx.lineTo(0, length / 2);
            guideCtx.stroke();

            guideCtx.restore();
            guideCtx.setLineDash([]);
        }

        // Perspective
        if (activeGuide === 'perspective' && perspectiveGuide) {
            const { lines, guidePoint, extraGuideLines } = perspectiveGuide;
            const lineLength = Math.hypot(worldView.width, worldView.height) * 10;

            const vpGreen = getLineIntersection(lines.green[0], lines.green[1]);
            const vpRed = getLineIntersection(lines.red[0], lines.red[1]);
            const vpBlue = getLineIntersection(lines.blue[0], lines.blue[1]);
            perspectiveVPs.current = { vpGreen, vpRed, vpBlue };

            // --- 1. Draw Horizon Line ---
            if (vpGreen && vpRed) {
                guideCtx.strokeStyle = 'rgba(255, 255, 0, 0.7)'; // Yellow
                guideCtx.lineWidth = 1.5 / viewTransform.zoom;
                guideCtx.setLineDash([8 / viewTransform.zoom, 4 / viewTransform.zoom]);
                guideCtx.beginPath();
                const dx = vpRed.x - vpGreen.x;
                const dy = vpRed.y - vpGreen.y;
                const len = Math.hypot(dx, dy) || 1;
                guideCtx.moveTo(vpGreen.x - dx / len * lineLength, vpGreen.y - dy / len * lineLength);
                guideCtx.lineTo(vpRed.x + dx / len * lineLength, vpRed.y + dy / len * lineLength);
                guideCtx.stroke();
                guideCtx.setLineDash([]);
            }

            // --- 2. Helper function to draw a complete guide set for one color ---
            const drawGuideSet = (color: string, vp: Point | null, mainLines: PerspectiveGuideLine[], extraHandles: Point[]) => {
                const guideColor = color.replace('0.5', '0.4');
                const controlColor = color;
                const handleColor = color;

                // Draw GUIDE lines (from VP to all handles)
                if (vp) {
                    guideCtx.strokeStyle = guideColor;
                    guideCtx.lineWidth = 0.8 / viewTransform.zoom;
                    guideCtx.setLineDash([4 / viewTransform.zoom, 4 / viewTransform.zoom]);
                    const allHandles = [...mainLines.flatMap(l => [l.start, l.end]), ...extraHandles, guidePoint];
                    allHandles.forEach(handle => {
                        guideCtx.beginPath();
                        guideCtx.moveTo(vp.x, vp.y);
                        guideCtx.lineTo(handle.x, handle.y);
                        guideCtx.stroke();
                    });
                    guideCtx.setLineDash([]);
                }

                // Draw CONTROL lines (between main handles)
                guideCtx.strokeStyle = controlColor;
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                mainLines.forEach(line => {
                    guideCtx.beginPath();
                    guideCtx.moveTo(line.start.x, line.start.y);
                    guideCtx.lineTo(line.end.x, line.end.y);
                    guideCtx.stroke();
                });

                // Draw HANDLES
                guideCtx.fillStyle = handleColor;
                const handlesToDraw = [...mainLines.flatMap(l => [l.start, l.end]), ...extraHandles];
                handlesToDraw.forEach(p => {
                    guideCtx.beginPath();
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                });
            };
            
            // --- 3. Draw each color set ---
            drawGuideSet('rgba(0, 255, 0, 0.5)', vpGreen, lines.green, extraGuideLines.green.map(g => g.handle));
            drawGuideSet('rgba(255, 0, 0, 0.5)', vpRed, lines.red, extraGuideLines.red.map(g => g.handle));

            // Special handling for Blue (may be parallel)
            if (vpBlue) {
                drawGuideSet('rgba(0, 0, 255, 0.5)', vpBlue, lines.blue, extraGuideLines.blue.map(g => g.handle));
            } else {
                const blueColor = 'rgba(0, 0, 255, 0.5)';
                const blueGuideColor = 'rgba(0, 0, 255, 0.4)';

                guideCtx.strokeStyle = blueGuideColor;
                guideCtx.lineWidth = 0.8 / viewTransform.zoom;
                guideCtx.setLineDash([4 / viewTransform.zoom, 4 / viewTransform.zoom]);
                if (lines.blue.length > 0) {
                    const refLine = lines.blue[0];
                    const angle = Math.atan2(refLine.end.y - refLine.start.y, refLine.end.x - refLine.start.x);
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const allBluePoints = [...lines.blue.flatMap(l => [l.start, l.end]), ...extraGuideLines.blue.map(g => g.handle), guidePoint];
                    allBluePoints.forEach(p => {
                        guideCtx.beginPath();
                        guideCtx.moveTo(p.x - cos * lineLength, p.y - sin * lineLength);
                        guideCtx.lineTo(p.x + cos * lineLength, p.y + sin * lineLength);
                        guideCtx.stroke();
                    });
                }
                guideCtx.setLineDash([]);
                
                guideCtx.strokeStyle = blueColor;
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                lines.blue.forEach(line => {
                    guideCtx.beginPath();
                    guideCtx.moveTo(line.start.x, line.start.y);
                    guideCtx.lineTo(line.end.x, line.end.y);
                    guideCtx.stroke();
                });
                
                guideCtx.fillStyle = blueColor;
                const allBlueHandles = [...lines.blue.flatMap(l => [l.start, l.end]), ...extraGuideLines.blue.map(g => g.handle)];
                allBlueHandles.forEach(p => {
                    guideCtx.beginPath();
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                });
            }

            // --- 4. Draw main guide point handle on top ---
            guideCtx.fillStyle = 'yellow';
            guideCtx.strokeStyle = 'black';
            guideCtx.lineWidth = 0.5 / viewTransform.zoom;
            guideCtx.beginPath();
            guideCtx.arc(guidePoint.x, guidePoint.y, handleSize * 1.5, 0, 2 * Math.PI);
            guideCtx.fill();
            guideCtx.stroke();
        }

        guideCtx.restore();
    }, [
        viewTransform,
        activeGuide,
        rulerGuides,
        mirrorGuides,
        isOrthogonalVisible,
        orthogonalGuide,
        perspectiveGuide,
    ]);

    const redrawUI = useCallback(() => {
        const uiCtx = uiCanvasRef.current?.getContext('2d');
        if (!uiCtx) return;
    
        uiCtx.save();
        uiCtx.setTransform(1, 0, 0, 1, 0, 0);
        uiCtx.clearRect(0, 0, uiCtx.canvas.width, uiCtx.canvas.height);
        uiCtx.restore();
    
        uiCtx.save();
        uiCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
    
        const handleSize = 8 / viewTransform.zoom;
    
        if (isCropping && cropRect) {
            uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            uiCtx.lineWidth = 1 / viewTransform.zoom;
            uiCtx.setLineDash([4 / viewTransform.zoom, 2 / viewTransform.zoom]);
            uiCtx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
            uiCtx.setLineDash([]);
    
            const { x, y, width, height } = cropRect;
            const handles = [
                { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height },
                { x: x + width / 2, y }, { x: x + width / 2, y: y + height }, { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 },
            ];
            uiCtx.fillStyle = 'white';
            uiCtx.strokeStyle = 'black';
            uiCtx.lineWidth = 1 / viewTransform.zoom;
            handles.forEach(h => {
                uiCtx.beginPath();
                uiCtx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
                uiCtx.fill();
                uiCtx.stroke();
            });
        }
    
        if (isTransforming && transformState) {
            uiCtx.lineWidth = 1 / viewTransform.zoom;
            uiCtx.strokeStyle = '#00BFFF'; // DeepSkyBlue
            uiCtx.fillStyle = 'white';

            const drawHandle = (p: Point, isCircle = false) => {
                uiCtx.strokeStyle = 'black';
                uiCtx.lineWidth = 0.5 / viewTransform.zoom;
                uiCtx.beginPath();
                if (isCircle) {
                    uiCtx.arc(p.x, p.y, handleSize / 2, 0, 2 * Math.PI);
                } else {
                    uiCtx.rect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
                }
                uiCtx.fill();
                uiCtx.stroke();
            };
    
            if (transformState.type === 'affine') {
                const { x, y, width, height, rotation } = transformState;
                const center = { x: x + width / 2, y: y + height / 2 };

                uiCtx.save();
                uiCtx.translate(center.x, center.y);
                uiCtx.rotate(rotation);
                uiCtx.strokeStyle = '#00BFFF';
                uiCtx.lineWidth = 1 / viewTransform.zoom;
                uiCtx.strokeRect(-width / 2, -height / 2, width, height);
                uiCtx.restore();

                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rotate = (p: Point) => ({
                    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
                });
                
                const handles = {
                    tl: rotate({ x, y }), 
                    tr: rotate({ x: x + width, y }),
                    bl: rotate({ x, y: y + height }), 
                    br: rotate({ x: x + width, y: y + height }),
                    t: rotate({ x: x + width / 2, y }), 
                    b: rotate({ x: x + width / 2, y: y + height }),
                    l: rotate({ x, y: y + height / 2 }), 
                    r: rotate({ x: x + width, y: y + height / 2 }),
                };
                Object.values(handles).forEach(p => drawHandle(p));
                
                const rotationHandleBase = rotate({ x: x + width/2, y: y - 25 / viewTransform.zoom });
                const rotationHandleMid = rotate({ x: x + width / 2, y });
                
                uiCtx.strokeStyle = '#00BFFF';
                uiCtx.lineWidth = 1 / viewTransform.zoom;
                uiCtx.beginPath();
                uiCtx.moveTo(rotationHandleBase.x, rotationHandleBase.y);
                uiCtx.lineTo(rotationHandleMid.x, rotationHandleMid.y);
                uiCtx.stroke();
                
                drawHandle(rotationHandleBase, true);

            } else if (transformState.type === 'free') {
                const { tl, tr, br, bl } = transformState.corners;
                
                uiCtx.strokeStyle = '#00BFFF';
                uiCtx.lineWidth = 1 / viewTransform.zoom;
                uiCtx.beginPath();
                uiCtx.moveTo(tl.x, tl.y);
                uiCtx.lineTo(tr.x, tr.y);
                uiCtx.lineTo(br.x, br.y);
                uiCtx.lineTo(bl.x, bl.y);
                uiCtx.closePath();
                uiCtx.stroke();

                [tl, tr, br, bl].forEach(p => drawHandle(p));
            }
        }
    
        uiCtx.restore();
    }, [viewTransform, isCropping, cropRect, isTransforming, transformState]);
    
    return { redrawMainCanvas, redrawGuides, redrawUI, perspectiveVPs };
}