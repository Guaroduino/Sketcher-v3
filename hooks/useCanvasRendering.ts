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
    ScaleUnit,
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
    scaleFactor,
    scaleUnit,
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
    scaleFactor: number;
    scaleUnit: ScaleUnit;
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

        const lineWidth = 0.5 / viewTransform.zoom;
        const minorLineColor = minorLineColorFromProp;
        const majorLineColor = majorLineColorFromProp;

        if (type === 'cartesian') {
            const startX = Math.floor(worldView.x / spacing) * spacing;
            const endX = worldView.x + worldView.width;
            const startY = Math.floor(worldView.y / spacing) * spacing;
            const endY = worldView.y + worldView.height;

            // Batch Minor Lines
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = minorLineColor;

            let i_x = Math.round(startX / spacing);
            for (let x = startX; x <= endX; x += spacing) {
                if (i_x % majorLineFrequency !== 0) {
                    ctx.moveTo(x, worldView.y);
                    ctx.lineTo(x, endY);
                }
                i_x++;
            }

            let i_y = Math.round(startY / spacing);
            for (let y = startY; y <= endY; y += spacing) {
                if (i_y % majorLineFrequency !== 0) {
                    ctx.moveTo(worldView.x, y);
                    ctx.lineTo(endX, y);
                }
                i_y++;
            }
            ctx.stroke();

            // Batch Major Lines
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = majorLineColor;

            i_x = Math.round(startX / spacing);
            for (let x = startX; x <= endX; x += spacing) {
                if (i_x % majorLineFrequency === 0) {
                    ctx.moveTo(x, worldView.y);
                    ctx.lineTo(x, endY);
                }
                i_x++;
            }

            i_y = Math.round(startY / spacing);
            for (let y = startY; y <= endY; y += spacing) {
                if (i_y % majorLineFrequency === 0) {
                    ctx.moveTo(worldView.x, y);
                    ctx.lineTo(endX, y);
                }
                i_y++;
            }
            ctx.stroke();

        } else if (type === 'isometric') {
            const canvasDiagonal = Math.hypot(worldView.width, worldView.height) * 1.2;
            const center = { x: worldView.x + worldView.width / 2, y: worldView.y + worldView.height / 2 };

            const angles = [
                90 * (Math.PI / 180), // Vertical
                (90 - isoAngle) * (Math.PI / 180),
                (90 + isoAngle) * (Math.PI / 180),
            ];

            // Limit grid lines to visible area for performance
            // Simple optimization: only draw lines that intersect the view
            // For now, we keep the existing logic but batch it.

            // Minor Lines Batch
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = minorLineColor;

            angles.forEach(angle => {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const perpCos = Math.cos(angle + Math.PI / 2);
                const perpSin = Math.sin(angle + Math.PI / 2);

                const centerProj = center.x * perpCos + center.y * perpSin;
                const startI = Math.floor((centerProj - canvasDiagonal / 2) / spacing);
                const endI = Math.ceil((centerProj + canvasDiagonal / 2) / spacing);

                for (let i = startI; i <= endI; i++) {
                    if (i % majorLineFrequency !== 0) {
                        const offset = i * spacing;
                        const lineCenter = {
                            x: offset * perpCos,
                            y: offset * perpSin
                        };
                        const start = { x: lineCenter.x - canvasDiagonal * cos, y: lineCenter.y - canvasDiagonal * sin };
                        const end = { x: lineCenter.x + canvasDiagonal * cos, y: lineCenter.y + canvasDiagonal * sin };
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                    }
                }
            });
            ctx.stroke();

            // Major Lines Batch
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = majorLineColor;

            angles.forEach(angle => {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const perpCos = Math.cos(angle + Math.PI / 2);
                const perpSin = Math.sin(angle + Math.PI / 2);

                const centerProj = center.x * perpCos + center.y * perpSin;
                const startI = Math.floor((centerProj - canvasDiagonal / 2) / spacing);
                const endI = Math.ceil((centerProj + canvasDiagonal / 2) / spacing);

                for (let i = startI; i <= endI; i++) {
                    if (i % majorLineFrequency === 0) {
                        const offset = i * spacing;
                        const lineCenter = {
                            x: offset * perpCos,
                            y: offset * perpSin
                        };
                        const start = { x: lineCenter.x - canvasDiagonal * cos, y: lineCenter.y - canvasDiagonal * sin };
                        const end = { x: lineCenter.x + canvasDiagonal * cos, y: lineCenter.y + canvasDiagonal * sin };
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                    }
                }
            });
            ctx.stroke();
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

        const drawItem = (item: SketchObject) => {
            if (!item.canvas) return;

            // Viewport Culling
            const itemX = item.offsetX || 0;
            const itemY = item.offsetY || 0;
            const itemW = item.canvas.width;
            const itemH = item.canvas.height;

            const canvasWidth = mainCtx.canvas.width;
            const canvasHeight = mainCtx.canvas.height;

            // Calculate visible world bounds
            const visibleLeft = -viewTransform.pan.x / viewTransform.zoom;
            const visibleTop = -viewTransform.pan.y / viewTransform.zoom;
            const visibleRight = (canvasWidth - viewTransform.pan.x) / viewTransform.zoom;
            const visibleBottom = (canvasHeight - viewTransform.pan.y) / viewTransform.zoom;

            // Check intersection
            const isVisible = (
                itemX < visibleRight &&
                itemX + itemW > visibleLeft &&
                itemY < visibleBottom &&
                itemY + itemH > visibleTop
            );

            if (!isVisible) return;

            if (item.mipmaps) {
                // Mipmap Logic
                let sourceCanvas = item.canvas;
                let scale = 1;

                if (viewTransform.zoom < 0.25 && item.mipmaps.small) {
                    sourceCanvas = item.mipmaps.small;
                    scale = item.canvas.width / item.mipmaps.small.width;
                } else if (viewTransform.zoom < 0.5 && item.mipmaps.medium) {
                    sourceCanvas = item.mipmaps.medium;
                    scale = item.canvas.width / item.mipmaps.medium.width;
                }

                mainCtx.globalAlpha = item.opacity;
                mainCtx.drawImage(
                    sourceCanvas,
                    itemX,
                    itemY,
                    item.canvas.width,
                    item.canvas.height
                );
            } else {
                mainCtx.globalAlpha = item.opacity;
                mainCtx.drawImage(item.canvas, itemX, itemY);
            }
        };

        // 1. Draw background
        if (backgroundObject && backgroundObject.canvas && backgroundObject.isVisible) {
            drawItem(backgroundObject);
        }

        // 2. Draw Grid on top of background
        drawGridOnContext(mainCtx);

        // 3. Draw foreground items
        foregroundObjects.forEach(item => {
            if (!item.isVisible) return;

            const isBeingErased = item.id === livePreviewLayerId;

            if ((isTransforming && item.id === activeItemId) || isBeingErased) {
                // This item is being transformed or erased. Skip it here.
            } else {
                drawItem(item);
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
            // Batch lines
            guideCtx.strokeStyle = 'cyan';
            guideCtx.lineWidth = 1 / viewTransform.zoom;
            guideCtx.beginPath();
            rulerGuides.forEach(guide => {
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
            });
            guideCtx.stroke();

            // Batch handles
            guideCtx.fillStyle = 'cyan';
            guideCtx.beginPath();
            rulerGuides.forEach(guide => {
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                [guide.start, guide.end, midPoint].forEach(p => {
                    guideCtx.moveTo(p.x + handleSize, p.y);
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                });
            });
            guideCtx.fill();
        }

        // Mirror
        if (activeGuide === 'mirror' && mirrorGuides) {
            // Batch lines
            guideCtx.strokeStyle = 'rgba(139, 0, 255, 0.8)'; // A violet color
            guideCtx.lineWidth = 1 / viewTransform.zoom;
            guideCtx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);
            guideCtx.beginPath();
            mirrorGuides.forEach(guide => {
                guideCtx.moveTo(guide.start.x, guide.start.y);
                guideCtx.lineTo(guide.end.x, guide.end.y);
            });
            guideCtx.stroke();
            guideCtx.setLineDash([]);

            // Batch handles
            guideCtx.fillStyle = 'rgba(139, 0, 255, 0.8)';
            guideCtx.beginPath();
            mirrorGuides.forEach(guide => {
                const midPoint = { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 };
                [guide.start, guide.end, midPoint].forEach(p => {
                    guideCtx.moveTo(p.x + handleSize, p.y);
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                });
            });
            guideCtx.fill();
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
                    guideCtx.beginPath();
                    allHandles.forEach(handle => {
                        guideCtx.moveTo(vp.x, vp.y);
                        guideCtx.lineTo(handle.x, handle.y);
                    });
                    guideCtx.stroke();
                    guideCtx.setLineDash([]);
                }

                // Draw CONTROL lines (between main handles)
                guideCtx.strokeStyle = controlColor;
                guideCtx.lineWidth = 1 / viewTransform.zoom;
                guideCtx.beginPath();
                mainLines.forEach(line => {
                    guideCtx.moveTo(line.start.x, line.start.y);
                    guideCtx.lineTo(line.end.x, line.end.y);
                });
                guideCtx.stroke();

                // Draw HANDLES
                guideCtx.fillStyle = handleColor;
                guideCtx.beginPath();
                const handlesToDraw = [...mainLines.flatMap(l => [l.start, l.end]), ...extraHandles];
                handlesToDraw.forEach(p => {
                    guideCtx.moveTo(p.x + handleSize, p.y);
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                });
                guideCtx.fill();
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
                guideCtx.beginPath();
                lines.blue.forEach(line => {
                    guideCtx.moveTo(line.start.x, line.start.y);
                    guideCtx.lineTo(line.end.x, line.end.y);
                });
                guideCtx.stroke();

                guideCtx.fillStyle = blueColor;
                const allBlueHandles = [...lines.blue.flatMap(l => [l.start, l.end]), ...extraGuideLines.blue.map(g => g.handle)];
                guideCtx.beginPath();
                allBlueHandles.forEach(p => {
                    guideCtx.moveTo(p.x + handleSize, p.y);
                    guideCtx.arc(p.x, p.y, handleSize, 0, 2 * Math.PI);
                });
                guideCtx.fill();
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

        // --- SCALE GUIDE ---
        if (viewTransform.zoom > 0) {
            uiCtx.save();
            uiCtx.setTransform(1, 0, 0, 1, 0, 0); // Screen space

            // Position below the canvas text. 
            // Moved to y=82 to ensure it clears any UI overlays.
            const barScreenX = 20;
            const barScreenY = 82;

            const unitMultipliers: Record<string, number> = { mm: 1, cm: 10, m: 1000 };

            // User insists on showing physical units (mm, cm, m) as selected in settings.
            // If scaleFactor is invalid (0/undefined), we default to 0.1 (1px = 1cm) to match standard grid defaults.
            const validScaleFactor = (scaleFactor && scaleFactor > 0) ? scaleFactor : 0.1;

            // Always respect the user's chosen unit for display
            const validUnits = ['mm', 'cm', 'm'];

            const targetUnit = validUnits.includes(scaleUnit) ? scaleUnit : 'mm';
            const mmPerUnit = unitMultipliers[targetUnit]; // e.g. 10 for cm

            // scaleFactor is (pixels / mm).
            // Units per screen pixel:
            // 1 screenPixel = (1 / (zoom * validScaleFactor * mmPerUnit)) Units.

            const unitsPerScreenPixel = 1 / (viewTransform.zoom * validScaleFactor * mmPerUnit);

            // Target visual length ~100px
            const targetScreenLength = 100;
            const targetUnitLength = targetScreenLength * unitsPerScreenPixel;

            // Nice steps are now unit-agnostic (0.1 means 0.1 of whatever unit we are in)
            const niceSteps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
            let bestStep = niceSteps[0];
            for (const step of niceSteps) {
                if (step > targetUnitLength) break;
                bestStep = step;
            }

            // Calculate screen length
            // screenLength = step / unitsPerScreenPixel
            const finalScreenLength = bestStep / unitsPerScreenPixel;

            // Format Label
            // Avoid floating point nastiness
            const decimals = bestStep < 1 ? (bestStep < 0.01 ? 4 : (bestStep < 0.1 ? 2 : 1)) : (bestStep < 10 ? 1 : 0);
            const label = `${parseFloat(bestStep.toFixed(decimals))}${targetUnit}`;

            uiCtx.lineJoin = 'round';
            uiCtx.lineCap = 'round';

            // Draw Bar Shadow (White Halo for contrast)
            uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            uiCtx.lineWidth = 3;
            uiCtx.beginPath();
            uiCtx.moveTo(barScreenX, barScreenY);
            uiCtx.lineTo(barScreenX, barScreenY - 5);
            uiCtx.moveTo(barScreenX, barScreenY);
            uiCtx.lineTo(barScreenX + finalScreenLength, barScreenY);
            uiCtx.lineTo(barScreenX + finalScreenLength, barScreenY - 5);
            uiCtx.stroke();

            // Draw Bar Main (Black)
            uiCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            uiCtx.lineWidth = 1.5;
            uiCtx.beginPath();
            uiCtx.moveTo(barScreenX, barScreenY);
            uiCtx.lineTo(barScreenX, barScreenY - 5);
            uiCtx.moveTo(barScreenX, barScreenY);
            uiCtx.lineTo(barScreenX + finalScreenLength, barScreenY);
            uiCtx.lineTo(barScreenX + finalScreenLength, barScreenY - 5);
            uiCtx.stroke();

            // Draw Label
            uiCtx.font = 'bold 11px sans-serif';
            uiCtx.textAlign = 'center';
            uiCtx.textBaseline = 'bottom';
            const textX = barScreenX + finalScreenLength / 2;
            const textY = barScreenY - 6;

            // Halo/Shadow for text
            uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            uiCtx.lineWidth = 3;
            uiCtx.strokeText(label, textX, textY);

            // Main Text
            uiCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            uiCtx.fillText(label, textX, textY);

            uiCtx.restore();
        }

        if (isCropping && cropRect) {
            // --- CROP OVERLAY (Dimming) ---
            uiCtx.save();
            uiCtx.setTransform(1, 0, 0, 1, 0, 0); // Screen space for overlay
            uiCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';

            // Convert cropRect to screen space
            const screenX = cropRect.x * viewTransform.zoom + viewTransform.pan.x;
            const screenY = cropRect.y * viewTransform.zoom + viewTransform.pan.y;
            const screenW = cropRect.width * viewTransform.zoom;
            const screenH = cropRect.height * viewTransform.zoom;

            // Draw overlay with hole (even-odd rule)
            uiCtx.beginPath();
            uiCtx.rect(0, 0, uiCtx.canvas.width, uiCtx.canvas.height);
            uiCtx.rect(screenX, screenY, screenW, screenH);
            uiCtx.fill('evenodd');
            uiCtx.restore();

            // --- CROP HANDLES AND OUTLINE ---
            uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            uiCtx.lineWidth = 1.5 / viewTransform.zoom;
            uiCtx.setLineDash([5 / viewTransform.zoom, 3 / viewTransform.zoom]);
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

                const rotationHandleBase = rotate({ x: x + width / 2, y: y - 25 / viewTransform.zoom });
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
    }, [viewTransform, isCropping, cropRect, isTransforming, transformState, scaleFactor, scaleUnit]);

    return { redrawMainCanvas, redrawGuides, redrawUI, perspectiveVPs };
}