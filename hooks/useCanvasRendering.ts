import React, { useCallback, useRef } from 'react';
import type {
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
} from '../types';
import { getLineIntersection } from '../utils/canvasUtils';

type PerspectiveVPs = { vpGreen: Point | null, vpRed: Point | null, vpBlue: Point | null };

export function useCanvasRendering({
    mainCanvasRef,
    guideCanvasRef,
    uiCanvasRef,
    objects,
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
    objects: SketchObject[];
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

    const redrawMainCanvas = useCallback(() => {
        const mainCtx = mainCanvasRef.current?.getContext('2d');
        if (!mainCtx) return;

        mainCtx.save();
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
        mainCtx.restore();
        
        mainCtx.save();
        mainCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);

        const itemMap = new Map<string, SketchObject>(objects.map(i => [i.id, i]));
        const isEffectivelyVisible = (item: SketchObject): boolean => {
            if (!item.isVisible) return false;
            if (item.parentId) {
                const parent = itemMap.get(item.parentId);
                if (parent) return isEffectivelyVisible(parent);
            }
            return true;
        };

        objects.forEach(obj => {
            if ((isTransforming && obj.id === activeItemId) || obj.id === livePreviewLayerId) {
                // Hide object being transformed or live-previewed from main canvas
                // It will be drawn on the preview canvas
            } else if (obj.type === 'object' && isEffectivelyVisible(obj) && obj.canvas) {
                mainCtx.globalAlpha = obj.opacity;
                mainCtx.drawImage(obj.canvas, obj.offsetX || 0, obj.offsetY || 0);
            }
        });

        mainCtx.restore();
    }, [objects, viewTransform, activeItemId, isTransforming, livePreviewLayerId]);

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

        if (activeGuide === 'ruler' && rulerGuides) {
            rulerGuides.forEach(guide => {
                guideCtx.strokeStyle = 'cyan';
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                guideCtx.beginPath();
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
                guideCtx.stroke();
                guideCtx.fillStyle = 'cyan';
                // End handles
                guideCtx.beginPath();
                guideCtx.arc(guide.start.x, guide.start.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
                guideCtx.beginPath();
                guideCtx.arc(guide.end.x, guide.end.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
                // Center handle (for moving and copying)
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                guideCtx.beginPath();
                guideCtx.arc(midPoint.x, midPoint.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
            });
        }
        
        if (activeGuide === 'mirror' && mirrorGuides) {
            mirrorGuides.forEach(guide => {
                guideCtx.strokeStyle = 'magenta';
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                guideCtx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);
                guideCtx.beginPath();
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
                guideCtx.stroke();
                guideCtx.setLineDash([]);
                guideCtx.fillStyle = 'magenta';
                // End handles
                guideCtx.beginPath();
                guideCtx.arc(guide.start.x, guide.start.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
                guideCtx.beginPath();
                guideCtx.arc(guide.end.x, guide.end.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
                // Center handle
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                guideCtx.beginPath();
                guideCtx.arc(midPoint.x, midPoint.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
            });
        }

        if (activeGuide === 'perspective' && perspectiveGuide) {
            const { lines, extraGuideLines, guidePoint } = perspectiveGuide;
            const vpGreen = lines.green.length >= 2 ? getLineIntersection(lines.green[0], lines.green[1]) : null;
            const vpRed = lines.red.length >= 2 ? getLineIntersection(lines.red[0], lines.red[1]) : null;
            const vpBlue = lines.blue.length >= 2 ? getLineIntersection(lines.blue[0], lines.blue[1]) : null;
            perspectiveVPs.current = { vpGreen, vpRed, vpBlue };

            guideCtx.lineWidth = 1 / viewTransform.zoom;
            guideCtx.globalAlpha = 0.5;

            // Draw Horizon
            if (vpGreen && vpRed) {
                guideCtx.strokeStyle = 'yellow';
                guideCtx.beginPath();
                const dx = vpRed.x - vpGreen.x;
                const dy = vpRed.y - vpGreen.y;
                guideCtx.moveTo(vpGreen.x - dx * 100, vpGreen.y - dy * 100);
                guideCtx.lineTo(vpRed.x + dx * 100, vpRed.y + dy * 100);
                guideCtx.stroke();
            }
            
            const drawLineFromVp = (vp: Point | null, point: Point, color: string) => {
                if (!vp) return;
                guideCtx.save();
                guideCtx.strokeStyle = color;
                guideCtx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);
                guideCtx.globalAlpha = 0.7;
                
                guideCtx.beginPath();
                const dx = point.x - vp.x;
                const dy = point.y - vp.y;
                const len = Math.hypot(dx, dy);
                if (len === 0) { guideCtx.restore(); return; }
                
                const extensionFactor = 10000;
                guideCtx.moveTo(vp.x - (dx / len) * extensionFactor, vp.y - (dy / len) * extensionFactor);
                guideCtx.lineTo(vp.x + (dx / len) * extensionFactor, vp.y + (dy / len) * extensionFactor);
                guideCtx.stroke();
                guideCtx.restore();
            };

            // Draw main guide lines (dashed)
            drawLineFromVp(vpGreen, guidePoint, 'lime');
            drawLineFromVp(vpRed, guidePoint, 'red');
            drawLineFromVp(vpBlue, guidePoint, 'cyan');

            // Draw extra guide lines (also dashed)
            extraGuideLines.green.forEach(p => drawLineFromVp(vpGreen, p.handle, 'lime'));
            extraGuideLines.red.forEach(p => drawLineFromVp(vpRed, p.handle, 'red'));
            extraGuideLines.blue.forEach(p => drawLineFromVp(vpBlue, p.handle, 'cyan'));
            
            guideCtx.globalAlpha = 1.0;
            const vpRadius = 6 / viewTransform.zoom;

            // Draw VP points on top
            if (vpGreen) {
                guideCtx.fillStyle = 'lime';
                guideCtx.beginPath();
                guideCtx.arc(vpGreen.x, vpGreen.y, vpRadius, 0, 2 * Math.PI);
                guideCtx.fill();
            }
            if (vpRed) {
                guideCtx.fillStyle = 'red';
                guideCtx.beginPath();
                guideCtx.arc(vpRed.x, vpRed.y, vpRadius, 0, 2 * Math.PI);
                guideCtx.fill();
            }
            if (vpBlue) {
                guideCtx.fillStyle = 'cyan';
                guideCtx.beginPath();
                guideCtx.arc(vpBlue.x, vpBlue.y, vpRadius, 0, 2 * Math.PI);
                guideCtx.fill();
            }

            // Draw handles for defining lines
            const allDefiningLines: { lines: PerspectiveGuideLine[], color: string }[] = [
                { lines: lines.green, color: 'lime' },
                { lines: lines.red, color: 'red' },
                { lines: lines.blue, color: 'cyan' },
            ];

            allDefiningLines.forEach(({ lines, color }) => {
                guideCtx.strokeStyle = color;
                guideCtx.fillStyle = color;
                lines.forEach(line => {
                    guideCtx.beginPath();
                    guideCtx.moveTo(line.start.x, line.start.y);
                    guideCtx.lineTo(line.end.x, line.end.y);
                    guideCtx.stroke();
                    guideCtx.beginPath();
                    guideCtx.arc(line.start.x, line.start.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                    guideCtx.beginPath();
                    guideCtx.arc(line.end.x, line.end.y, handleSize, 0, 2 * Math.PI);
                    guideCtx.fill();
                });
            });

            // Draw handles for extra guide lines
            guideCtx.fillStyle = 'lime';
            extraGuideLines.green.forEach(p => {
                guideCtx.beginPath();
                guideCtx.arc(p.handle.x, p.handle.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
            });
            guideCtx.fillStyle = 'red';
            extraGuideLines.red.forEach(p => {
                guideCtx.beginPath();
                guideCtx.arc(p.handle.x, p.handle.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
            });
            guideCtx.fillStyle = 'cyan';
            extraGuideLines.blue.forEach(p => {
                guideCtx.beginPath();
                guideCtx.arc(p.handle.x, p.handle.y, handleSize, 0, 2 * Math.PI);
                guideCtx.fill();
            });

            // Draw main guide point handle
            guideCtx.fillStyle = 'yellow';
            guideCtx.beginPath();
            guideCtx.arc(perspectiveGuide.guidePoint.x, perspectiveGuide.guidePoint.y, handleSize * 1.5, 0, 2 * Math.PI);
            guideCtx.fill();

            // Draw "copy" handles on main guide lines
            guideCtx.strokeStyle = 'yellow';
            guideCtx.lineWidth = 2 / viewTransform.zoom;
            const copyHandleRadius = handleSize * 0.8;

            // Draw for Green and Red VPs (midpoint)
            const drawMidpointCopyHandle = (vp: Point | null, p: Point) => {
                if (!vp) return;
                const midX = (vp.x + p.x) / 2;
                const midY = (vp.y + p.y) / 2;
                guideCtx.beginPath();
                guideCtx.arc(midX, midY, copyHandleRadius, 0, 2 * Math.PI);
                guideCtx.stroke();
            };
            drawMidpointCopyHandle(vpGreen, guidePoint);
            drawMidpointCopyHandle(vpRed, guidePoint);

            // Special handling for Blue VP copy handle (fixed distance from guide point)
            if (vpBlue) {
                const vecX = vpBlue.x - guidePoint.x;
                const vecY = vpBlue.y - guidePoint.y;
                const len = Math.hypot(vecX, vecY);
                if (len > 0) {
                    const distanceFromGuidePoint = 100; // A fixed canvas pixel distance
                    const blueHandleX = guidePoint.x + (vecX / len) * distanceFromGuidePoint;
                    const blueHandleY = guidePoint.y + (vecY / len) * distanceFromGuidePoint;
                    guideCtx.beginPath();
                    guideCtx.arc(blueHandleX, blueHandleY, copyHandleRadius, 0, 2 * Math.PI);
                    guideCtx.stroke();
                }
            }
        }

        if (isOrthogonalVisible && orthogonalGuide) {
            guideCtx.strokeStyle = 'rgba(180, 180, 180, 0.4)';
            guideCtx.lineWidth = 1 / viewTransform.zoom;
            guideCtx.setLineDash([2 / viewTransform.zoom, 4 / viewTransform.zoom]);

            const angleRad = (orthogonalGuide.angle * Math.PI) / 180;
            
            const canvasWidth = guideCtx.canvas.width;
            const canvasHeight = guideCtx.canvas.height;
            
            // Viewport center in world coordinates
            const worldCenterX = (canvasWidth / 2 - viewTransform.pan.x) / viewTransform.zoom;
            const worldCenterY = (canvasHeight / 2 - viewTransform.pan.y) / viewTransform.zoom;

            guideCtx.save();
            
            // Translate to world center and rotate
            guideCtx.translate(worldCenterX, worldCenterY);
            guideCtx.rotate(angleRad);
            
            const spacing = 50; // Grid spacing in world units
            
            const viewportDiagonal = Math.hypot(canvasWidth / viewTransform.zoom, canvasHeight / viewTransform.zoom);
            const halfSize = viewportDiagonal / 2;

            const lineCount = Math.ceil(halfSize / spacing);

            // Draw lines from the center outwards
            guideCtx.beginPath();
            for (let i = 1; i <= lineCount; i++) {
                const offset = i * spacing;
                // horizontal lines
                guideCtx.moveTo(-halfSize, offset);
                guideCtx.lineTo(halfSize, offset);
                guideCtx.moveTo(-halfSize, -offset);
                guideCtx.lineTo(halfSize, -offset);
                // vertical lines
                guideCtx.moveTo(offset, -halfSize);
                guideCtx.lineTo(offset, halfSize);
                guideCtx.moveTo(-offset, -halfSize);
                guideCtx.lineTo(-offset, halfSize);
            }
            // Draw center lines
            guideCtx.moveTo(-halfSize, 0);
            guideCtx.lineTo(halfSize, 0);
            guideCtx.moveTo(0, -halfSize);
            guideCtx.lineTo(0, halfSize);

            guideCtx.stroke();
            guideCtx.restore();
            guideCtx.setLineDash([]);
        }

        if (gridGuide.type !== 'none') {
            const { spacing, majorLineFrequency } = gridGuide;

            if (gridGuide.type === 'cartesian') {
                const startX = Math.floor(worldView.x / spacing) * spacing;
                const startY = Math.floor(worldView.y / spacing) * spacing;

                for (let x = startX; x < worldView.x + worldView.width; x += spacing) {
                    const index = Math.round(x / spacing);
                    if (majorLineFrequency > 0 && Math.abs(index % majorLineFrequency) < 0.001) {
                        guideCtx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
                        guideCtx.lineWidth = 2 / viewTransform.zoom;
                    } else {
                        guideCtx.strokeStyle = 'rgba(0, 150, 255, 0.3)';
                        guideCtx.lineWidth = 1 / viewTransform.zoom;
                    }
                    guideCtx.beginPath();
                    guideCtx.moveTo(x, worldView.y);
                    guideCtx.lineTo(x, worldView.y + worldView.height);
                    guideCtx.stroke();
                }

                for (let y = startY; y < worldView.y + worldView.height; y += spacing) {
                    const index = Math.round(y / spacing);
                    if (majorLineFrequency > 0 && Math.abs(index % majorLineFrequency) < 0.001) {
                        guideCtx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
                        guideCtx.lineWidth = 2 / viewTransform.zoom;
                    } else {
                        guideCtx.strokeStyle = 'rgba(0, 150, 255, 0.3)';
                        guideCtx.lineWidth = 1 / viewTransform.zoom;
                    }
                    guideCtx.beginPath();
                    guideCtx.moveTo(worldView.x, y);
                    guideCtx.lineTo(worldView.x + worldView.width, y);
                    guideCtx.stroke();
                }
            } else if (gridGuide.type === 'isometric') {
                const drawIsoLines = (angleDeg: number) => {
                    const angleRad = angleDeg * Math.PI / 180;
                    const sin = Math.sin(angleRad);
                    const cos = Math.cos(angleRad);

                    const corners = [
                        {x: worldView.x, y: worldView.y},
                        {x: worldView.x + worldView.width, y: worldView.y},
                        {x: worldView.x + worldView.width, y: worldView.y + worldView.height},
                        {x: worldView.x, y: worldView.y + worldView.height},
                    ];

                    const ds = corners.map(p => p.x * sin - p.y * cos);
                    const min_d = Math.min(...ds);
                    const max_d = Math.max(...ds);
                    
                    const k_start = Math.floor(min_d / spacing);
                    const k_end = Math.ceil(max_d / spacing);

                    for(let k = k_start; k <= k_end; k++) {
                        const d = k * spacing;
                        // Line equation: x * sin - y * cos = d
                        const isMajor = majorLineFrequency > 0 && Math.abs(k % majorLineFrequency) < 0.001;
                        guideCtx.strokeStyle = isMajor ? 'rgba(220, 38, 38, 0.4)' : 'rgba(0, 150, 255, 0.3)';
                        guideCtx.lineWidth = (isMajor ? 2 : 1) / viewTransform.zoom;

                        const intersections = [];
                        // Top edge (y = worldView.y)
                        if (Math.abs(sin) > 1e-6) {
                            const x = (d + worldView.y * cos) / sin;
                            if (x >= worldView.x && x <= worldView.x + worldView.width) intersections.push({x, y: worldView.y});
                        }
                        // Bottom edge (y = worldView.y + worldView.height)
                         if (Math.abs(sin) > 1e-6) {
                            const x = (d + (worldView.y + worldView.height) * cos) / sin;
                            if (x >= worldView.x && x <= worldView.x + worldView.width) intersections.push({x, y: worldView.y + worldView.height});
                        }
                        // Left edge (x = worldView.x)
                        if (Math.abs(cos) > 1e-6) {
                            const y = (worldView.x * sin - d) / cos;
                            if (y >= worldView.y && y <= worldView.y + worldView.height) intersections.push({x: worldView.x, y});
                        }
                        // Right edge (x = worldView.x + worldView.width)
                         if (Math.abs(cos) > 1e-6) {
                            const y = ((worldView.x + worldView.width) * sin - d) / cos;
                             if (y >= worldView.y && y <= worldView.y + worldView.height) intersections.push({x: worldView.x + worldView.width, y});
                        }
                        
                        if (intersections.length >= 2) {
                            guideCtx.beginPath();
                            guideCtx.moveTo(intersections[0].x, intersections[0].y);
                            guideCtx.lineTo(intersections[1].x, intersections[1].y);
                            guideCtx.stroke();
                        }
                    }
                };
                
                const isoAngle = gridGuide.isoAngle;
                drawIsoLines(isoAngle);
                drawIsoLines(180 - isoAngle);
                drawIsoLines(90);
            }
        }

        guideCtx.restore();
    }, [viewTransform, activeGuide, gridGuide, isOrthogonalVisible, perspectiveGuide, rulerGuides, mirrorGuides, orthogonalGuide.angle]);

    const redrawUI = useCallback(() => {
        const uiCtx = uiCanvasRef.current?.getContext('2d');
        if (!uiCtx) return;

        uiCtx.save();
        uiCtx.setTransform(1, 0, 0, 1, 0, 0);
        uiCtx.clearRect(0, 0, uiCtx.canvas.width, uiCtx.canvas.height);
        uiCtx.restore();

        uiCtx.save();
        uiCtx.translate(viewTransform.pan.x, viewTransform.pan.y);
        uiCtx.scale(viewTransform.zoom, viewTransform.zoom);

        const handleSize = 8 / viewTransform.zoom;

        if (isCropping && cropRect) {
            const { x, y, width, height } = cropRect;
            uiCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            uiCtx.lineWidth = 1 / viewTransform.zoom;
            
            uiCtx.beginPath();
            uiCtx.rect(x, y, width, height);
            const canvasWidth = uiCtx.canvas.width / viewTransform.zoom;
            const canvasHeight = uiCtx.canvas.height / viewTransform.zoom;
            uiCtx.moveTo(0,0); uiCtx.lineTo(canvasWidth, 0); uiCtx.lineTo(canvasWidth, canvasHeight); uiCtx.lineTo(0, canvasHeight); uiCtx.closePath();

            uiCtx.fill('evenodd');
            uiCtx.strokeRect(x, y, width, height);

            const handles = [
                { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height },
                { x: x + width / 2, y }, { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 }, { x: x + width / 2, y: y + height }
            ];
            uiCtx.fillStyle = '#FFF';
            handles.forEach(h => uiCtx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize));
        }

        if (isTransforming && transformState) {
            uiCtx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            uiCtx.lineWidth = 1 / viewTransform.zoom;
            uiCtx.fillStyle = '#FFF';

            if (transformState.type === 'affine') {
                const { x, y, width, height, rotation } = transformState;
                uiCtx.save();
                uiCtx.translate(x + width / 2, y + height / 2);
                uiCtx.rotate(rotation);
                
                // Bounding box
                uiCtx.strokeRect(-width / 2, -height / 2, width, height);

                // Rotation handle
                const rotationHandleOffset = 25 / viewTransform.zoom;
                uiCtx.beginPath();
                uiCtx.moveTo(0, -height / 2);
                uiCtx.lineTo(0, -height / 2 - rotationHandleOffset);
                uiCtx.stroke();
                
                uiCtx.strokeStyle = 'rgba(0,0,0,0.8)';
                uiCtx.beginPath();
                uiCtx.arc(0, -height / 2 - rotationHandleOffset, handleSize / 1.5, 0, 2 * Math.PI);
                uiCtx.fill();
                uiCtx.stroke();
                
                // Scale handles
                const handles = [
                    {x: -width/2, y: -height/2}, {x: 0, y: -height/2}, {x: width/2, y: -height/2},
                    {x: -width/2, y: 0}, {x: width/2, y: 0},
                    {x: -width/2, y: height/2}, {x: 0, y: height/2}, {x: width/2, y: height/2},
                ];
                handles.forEach(h => {
                    uiCtx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
                    uiCtx.strokeRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
                });

                uiCtx.restore();

            } else if (transformState.type === 'free') {
                const { tl, tr, br, bl } = transformState.corners;
                // Bounding box
                uiCtx.beginPath();
                uiCtx.moveTo(tl.x, tl.y);
                uiCtx.lineTo(tr.x, tr.y);
                uiCtx.lineTo(br.x, br.y);
                uiCtx.lineTo(bl.x, bl.y);
                uiCtx.closePath();
                uiCtx.stroke();
                
                // Corner handles (circles)
                const corners = [tl, tr, br, bl];
                uiCtx.strokeStyle = 'rgba(0,0,0,0.8)';
                corners.forEach(c => {
                    uiCtx.beginPath();
                    uiCtx.arc(c.x, c.y, handleSize / 1.5, 0, 2 * Math.PI);
                    uiCtx.fill();
                    uiCtx.stroke();
                });
            }
        }

        uiCtx.restore();
    }, [isCropping, cropRect, viewTransform, isTransforming, transformState]);

    return {
        redrawMainCanvas,
        redrawGuides,
        redrawUI,
        perspectiveVPs
    }
}