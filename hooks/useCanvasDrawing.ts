import { useCallback } from 'react';
import type {
    Tool,
    Point,
    BrushSettings,
    EraserSettings,
    MarkerSettings,
    AirbrushSettings,
    FXBrushSettings,
    Guide,
    MirrorGuide,
    StrokeMode
} from '../types';
import { hexToRgb, rgbToHex, projectPointOnLine } from '../utils/canvasUtils';


const drawFxBrushDab = (ctx: CanvasRenderingContext2D, point: Point, settings: FXBrushSettings, pressure: number, strokeAngle?: number) => {
    let currentSize = settings.size;
    let currentOpacity = settings.opacity;

    if (settings.pressureControl.size) {
        currentSize *= pressure;
    }
    if (settings.pressureControl.opacity) {
        currentOpacity *= pressure;
    }

    currentSize *= (1 - (Math.random() * settings.sizeJitter));
    if (currentSize <= 1) return;
    
    const scatterX = (Math.random() - 0.5) * settings.scatter * settings.size * 2;
    const scatterY = (Math.random() - 0.5) * settings.scatter * settings.size * 2;
    
    const x = point.x + scatterX;
    const y = point.y + scatterY;

    let color = settings.color;
    const baseRgb = hexToRgb(settings.color);
    if (baseRgb) {
        let { r, g, b } = baseRgb;
        const brightnessShift = (Math.random() - 0.5) * 2 * settings.brightnessJitter * 128;
        r = Math.max(0, Math.min(255, r + brightnessShift));
        g = Math.max(0, Math.min(255, g + brightnessShift));
        b = Math.max(0, Math.min(255, b + brightnessShift));
        color = rgbToHex(r, g, b);
    }

    ctx.save();
    ctx.translate(x, y);
    
    let baseAngle = settings.angle * Math.PI / 180; // default angle in radians
    if (settings.angleFollowsStroke && strokeAngle !== undefined) {
        baseAngle += strokeAngle;
    }
    const finalAngle = baseAngle + (Math.random() - 0.5) * 2 * settings.angleJitter * Math.PI;
    ctx.rotate(finalAngle);

    ctx.globalAlpha = currentOpacity * settings.flow;
    
    if (settings.tipShape === 'round') {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize / 2);
        const hardness = settings.hardness / 100;
        const baseRgb = hexToRgb(color);
        const transparentColor = baseRgb ? `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0)` : 'rgba(0,0,0,0)';
        
        gradient.addColorStop(0, color);
        gradient.addColorStop(Math.max(0, Math.min(1, hardness)), color);
        gradient.addColorStop(1, transparentColor);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = color;
        if (settings.tipShape === 'square') {
            ctx.fillRect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
        } else if (settings.tipShape === 'line') {
            const thickness = Math.max(1, currentSize / 10);
            ctx.fillRect(-currentSize / 2, -thickness / 2, currentSize, thickness);
        }
    }
    
    ctx.restore();
};

const drawEraserDab = (ctx: CanvasRenderingContext2D, point: Point, settings: EraserSettings) => {
    const { size, opacity, hardness, tipShape } = settings;
    if (size <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = opacity;

    const x = point.x;
    const y = point.y;

    if (tipShape === 'round') {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
        const hardnessRatio = hardness / 100;

        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(Math.max(0, Math.min(1, hardnessRatio)), 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    } else { // square
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    ctx.restore();
};


export function useCanvasDrawing({
    tool,
    brushSettings,
    eraserSettings,
    markerSettings,
    airbrushSettings,
    fxBrushSettings,
    activeGuide,
    mirrorGuides,
    strokeMode,
}: {
    tool: Tool;
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    markerSettings: MarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    activeGuide: Guide;
    mirrorGuides: MirrorGuide[];
    strokeMode: StrokeMode;
}) {

    const drawPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
        if (points.length === 0) return;

        if (strokeMode === 'curve' && points.length === 3) {
            const [start, end, mid] = points;
            const cp = { x: 2 * mid.x - 0.5 * start.x - 0.5 * end.x, y: 2 * mid.y - 0.5 * start.y - 0.5 * end.y };
        
            const rasterizedPoints: Point[] = [];
            const len = Math.hypot(mid.x - start.x, mid.y - start.y) + Math.hypot(end.x - mid.x, end.y - mid.y);
            const steps = Math.max(50, Math.floor(len / 2));
        
            const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
            const p_start = start.pressure ?? 1.0;
            const p_mid = mid.pressure ?? 1.0;
            const p_end = end.pressure ?? 1.0;
        
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const t_inv = 1 - t;
                const x = t_inv * t_inv * start.x + 2 * t_inv * t * cp.x + t * t * end.x;
                const y = t_inv * t_inv * start.y + 2 * t_inv * t * cp.y + t * t * end.y;
                
                let pressure: number;
                if (t < 0.5) {
                    pressure = lerp(p_start, p_mid, t * 2);
                } else {
                    pressure = lerp(p_mid, p_end, (t - 0.5) * 2);
                }
                rasterizedPoints.push({ x, y, pressure });
            }
            points = rasterizedPoints;
        } else if (strokeMode === 'arc' && points.length === 3) {
            const [center, start, end] = points;
            const rasterizedPoints: Point[] = [];
            const radius = Math.hypot(start.x - center.x, start.y - center.y);

            if (radius > 0) {
                const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
                
                // Check for augmented sweepAngle property, passed from pointer events hook
                const sweepAngle = (end as Point & { sweepAngle?: number }).sweepAngle;

                let deltaAngle: number;
                if (sweepAngle !== undefined) {
                    // Use the sweep angle passed from the event handler which tracks user movement
                    deltaAngle = sweepAngle;
                } else {
                    // Fallback to old logic (shortest path) if no sweep angle is provided
                    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
                    deltaAngle = endAngle - startAngle;
                    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                }

                const arcLength = radius * Math.abs(deltaAngle);
                const steps = Math.max(2, Math.ceil(arcLength / 1.5)); // step length ~1.5px

                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const angle = startAngle + t * deltaAngle;

                    const x = center.x + radius * Math.cos(angle);
                    const y = center.y + radius * Math.sin(angle);

                    const p_start = start.pressure ?? 1.0;
                    const p_end = end.pressure ?? 1.0;
                    const pressure = p_start + t * (p_end - p_start);

                    rasterizedPoints.push({ x, y, pressure });
                }
            }
            points = rasterizedPoints;
        }
        
        ctx.save();
    
        if (tool === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = brushSettings.color;
            ctx.globalAlpha = brushSettings.opacity;
            ctx.lineCap = brushSettings.lineCap;
            ctx.lineJoin = 'round';

            const pressureEnabled = brushSettings.pressureControl.size && strokeMode === 'freehand';

            if (points.length === 1) {
                const p = points[0];
                const pressure = p.pressure ?? 1.0;
                const size = pressureEnabled ? brushSettings.size * pressure : brushSettings.size;
                if (size > 0) {
                    ctx.fillStyle = brushSettings.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                for (let i = 1; i < points.length; i++) {
                    const p1 = points[i - 1];
                    const p2 = points[i];
                    const pressure = p2.pressure ?? 1.0;
                    
                    const size = pressureEnabled ? brushSettings.size * pressure : brushSettings.size;
                    
                    ctx.lineWidth = Math.max(0.5, size);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        } else if (tool === 'eraser') {
            const spacing = Math.max(1, eraserSettings.size * 0.1); // Use smaller spacing for smoother erasing

            if (points.length === 1) {
                 drawEraserDab(ctx, points[0], eraserSettings);
            } else {
                for (let i = 0; i < points.length - 1; i++) {
                    const startPoint = points[i];
                    const endPoint = points[i+1];
        
                    const dist = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
                    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
                    for (let j = 0; j < dist; j += spacing) {
                        const p = {
                            x: startPoint.x + Math.cos(angle) * j,
                            y: startPoint.y + Math.sin(angle) * j,
                        };
                        drawEraserDab(ctx, p, eraserSettings);
                    }
                    // Also draw the last point to ensure stroke completeness
                    if (i === points.length - 2) {
                        drawEraserDab(ctx, endPoint, eraserSettings);
                    }
                }
            }
        } else if (tool === 'marker') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = markerSettings.color;
            ctx.lineWidth = markerSettings.size;
            
            if (markerSettings.tipShape === 'square') {
                ctx.lineCap = 'square';
                ctx.lineJoin = 'miter';
            } else { // 'line'
                ctx.lineCap = 'butt';
                ctx.lineJoin = 'miter';
            }

            const pressureEnabled = markerSettings.pressureControl.opacity && strokeMode === 'freehand';
            
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                const pressure = p2.pressure ?? 1.0;
                
                const opacity = pressureEnabled ? markerSettings.opacity * pressure : markerSettings.opacity;
                ctx.globalAlpha = opacity;
    
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        } else if (tool === 'airbrush') {
            ctx.globalCompositeOperation = 'source-over';
    
            const drawAirbrushDab = (point: Point) => {
                const { size, softness, color, density } = airbrushSettings;
                if (size <= 0) return;
        
                const x = point.x;
                const y = point.y;
                const radius = size / 2;
        
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                const hardness = 1 - Math.max(0, Math.min(1, softness));
                
                const baseRgb = hexToRgb(color);
                const transparentColor = baseRgb ? `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0)` : 'rgba(0,0,0,0)';
                
                gradient.addColorStop(0, color);
                gradient.addColorStop(Math.max(0, Math.min(1, hardness)), color);
                gradient.addColorStop(1, transparentColor);
                
                ctx.fillStyle = gradient;
                ctx.globalAlpha = density;
        
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            };
        
            const spacing = Math.max(1, airbrushSettings.size * 0.15);
        
            if (points.length === 1) {
                 drawAirbrushDab(points[0]);
            } else {
                for (let i = 0; i < points.length - 1; i++) {
                    const startPoint = points[i];
                    const endPoint = points[i+1];
        
                    const dist = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
                    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
                    for (let j = 0; j < dist; j += spacing) {
                        const p = {
                            x: startPoint.x + Math.cos(angle) * j,
                            y: startPoint.y + Math.sin(angle) * j,
                        };
                        drawAirbrushDab(p);
                    }
                    if (i === points.length - 2) {
                        drawAirbrushDab(endPoint);
                    }
                }
            }
        } else if (tool === 'fx-brush') {
            ctx.globalCompositeOperation = fxBrushSettings.blendMode;
            const spacing = Math.max(1, fxBrushSettings.size * (fxBrushSettings.spacing / 100));
            const pressureEnabled = strokeMode === 'freehand';

            if (points.length === 1) {
                 const pressure = pressureEnabled ? (points[0].pressure ?? 1.0) : 1.0;
                 drawFxBrushDab(ctx, points[0], fxBrushSettings, pressure);
            } else {
                for (let i = 0; i < points.length - 1; i++) {
                    const startPoint = points[i];
                    const endPoint = points[i+1];
        
                    const dist = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
                    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
                    const startPressure = pressureEnabled ? (startPoint.pressure ?? 1.0) : 1.0;
                    const endPressure = pressureEnabled ? (endPoint.pressure ?? 1.0) : 1.0;

                    for (let j = 0; j < dist; j += spacing) {
                        const t = dist === 0 ? 0 : j / dist;
                        const p = {
                            x: startPoint.x + Math.cos(angle) * j,
                            y: startPoint.y + Math.sin(angle) * j,
                        };
                        const interpolatedPressure = startPressure + (endPressure - startPressure) * t;
                        drawFxBrushDab(ctx, p, fxBrushSettings, interpolatedPressure, angle);
                    }
                }
            }
        }
    
        ctx.restore();
    }, [tool, brushSettings, eraserSettings, markerSettings, airbrushSettings, fxBrushSettings, strokeMode]);

    const drawStrokeWithMirroring = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
        // Draw original path
        drawPath(ctx, points);

        // Draw mirrored path(s) if applicable
        if (activeGuide === 'mirror' && mirrorGuides.length > 0) {
            mirrorGuides.forEach(guide => {
                const { start, end } = guide;
                const reflectedPoints = points.map(p => {
                    const proj = projectPointOnLine(p, start, end);
                    return {
                        ...p, // Carry over pressure and other point data
                        x: proj.x * 2 - p.x,
                        y: proj.y * 2 - p.y
                    };
                });
                drawPath(ctx, reflectedPoints);
            });
        }
    }, [drawPath, activeGuide, mirrorGuides]);

    return { drawStrokeWithMirroring };
}