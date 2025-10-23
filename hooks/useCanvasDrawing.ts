import { useCallback } from 'react';
import type {
    Tool,
    Point,
    BrushSettings,
    EraserSettings,
    SolidMarkerSettings,
    NaturalMarkerSettings,
    AirbrushSettings,
    FXBrushSettings,
    Guide,
    MirrorGuide,
    StrokeMode,
    StrokeModifier,
    StrokeStyle
} from '../types';
import { hexToRgb, rgbToHex, projectPointOnLine } from '../utils/canvasUtils';


const drawFxBrushDab = (ctx: CanvasRenderingContext2D, point: Point, settings: FXBrushSettings, pressure: number, strokeMode: StrokeMode, strokeAngle?: number) => {
    let currentSize = settings.size;
    let currentOpacity = settings.opacity;
    const usePressure = strokeMode === 'freehand';

    if (usePressure && settings.pressureControl.size) {
        currentSize *= pressure;
    }
    if (usePressure && settings.pressureControl.opacity) {
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
    if (baseRgb && (settings.hueJitter > 0 || settings.saturationJitter > 0 || settings.brightnessJitter > 0)) {
        // HSL Jitter logic
        let { r, g, b } = baseRgb;
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        h += (Math.random() - 0.5) * 2 * settings.hueJitter;
        if (h > 1) h -= 1; if (h < 0) h += 1;
        s += (Math.random() - 0.5) * 2 * settings.saturationJitter;
        s = Math.max(0, Math.min(1, s));
        l += (Math.random() - 0.5) * 2 * settings.brightnessJitter;
        l = Math.max(0, Math.min(1, l));

        let r1, g1, b1;
        if (s === 0) { r1 = g1 = b1 = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r1 = hue2rgb(p, q, h + 1 / 3);
            g1 = hue2rgb(p, q, h);
            b1 = hue2rgb(p, q, h - 1 / 3);
        }
        color = rgbToHex(r1 * 255, g1 * 255, b1 * 255);
    }
    
    ctx.save();
    ctx.translate(x, y);

    let angle = settings.angle * Math.PI / 180;
    if (settings.angleFollowsStroke && strokeAngle !== undefined) {
        angle = strokeAngle;
    }
    angle += (Math.random() - 0.5) * 2 * Math.PI * settings.angleJitter;
    ctx.rotate(angle);

    const hardness = settings.hardness / 100;
    const gradient = ctx.createRadialGradient(0, 0, currentSize / 2 * hardness, 0, 0, currentSize / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = gradient;
    ctx.globalAlpha = currentOpacity;
    ctx.globalCompositeOperation = settings.blendMode;

    switch (settings.tipShape) {
        case 'square':
            ctx.fillRect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
            break;
        case 'line':
            ctx.fillRect(-currentSize / 2, -currentSize / 10, currentSize, currentSize / 5);
            break;
        case 'round':
        default:
            ctx.beginPath();
            ctx.arc(0, 0, currentSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            break;
    }
    ctx.restore();
};

const getStrokeDash = (style: StrokeStyle, scale: number, lineWidth: number): number[] => {
    const s = scale * lineWidth;
    switch (style) {
        case 'dashed': return [s * 2, s * 1.5];
        case 'dotted': return [s * 0.1, s * 1.5];
        case 'dash-dot': return [s * 2, s * 1.5, s * 0.1, s * 1.5];
        case 'solid':
        default: return [];
    }
}

// Helper functions for interpolating points for dabbing brushes
function interpolatePoints(p1: Point, p2: Point, spacing: number): Point[] {
    const interpolated: Point[] = [];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist < spacing) return [p1, p2];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    
    for (let d = 0; d < dist; d += spacing) {
        interpolated.push({
            x: p1.x + Math.cos(angle) * d,
            y: p1.y + Math.sin(angle) * d,
        });
    }
    interpolated.push(p2);
    return interpolated;
}

function interpolateQuadraticBezier(p0: Point, p1: Point, p2: Point, spacing: number): Point[] {
    const points: Point[] = [];
    const estimatedLength = Math.hypot(p1.x-p0.x, p1.y-p0.y) + Math.hypot(p2.x-p1.x, p2.y-p1.y);
    const numSteps = Math.max(2, Math.ceil(estimatedLength / spacing));
    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
        const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
        points.push({ x, y });
    }
    return points;
}

function interpolateArc(center: Point, radius: number, startAngle: number, endAngle: number, spacing: number): Point[] {
    const points: Point[] = [];
    const totalAngle = endAngle - startAngle;

    if (Math.abs(totalAngle) < 0.001) return [];

    const circumference = Math.abs(totalAngle) * radius;
    const numSteps = Math.max(2, Math.ceil(circumference / spacing));

    for (let i = 0; i <= numSteps; i++) {
        const angle = startAngle + (totalAngle * i / numSteps);
        points.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
        });
    }
    return points;
}

const drawBrushStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: BrushSettings, strokeMode: StrokeMode, strokeModifier: StrokeModifier, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
    ctx.strokeStyle = settings.color;
    ctx.lineCap = settings.lineCap;
    ctx.lineJoin = settings.lineJoin;
    ctx.globalAlpha = settings.opacity;
    ctx.globalCompositeOperation = 'source-over';
    
    if (points.length < 1) return;

    if (strokeMode !== 'freehand') {
        ctx.lineWidth = settings.size;
        ctx.setLineDash(getStrokeDash(strokeModifier.style, strokeModifier.scale, ctx.lineWidth));
        ctx.beginPath();
        
        if (strokeMode !== 'arc' && points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
        }

        switch (strokeMode) {
            case 'line':
                if (points.length > 1) {
                    ctx.lineTo(points[1].x, points[1].y);
                }
                break;
            case 'polyline':
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                break;
            case 'curve':
                if (points.length === 2) {
                    ctx.lineTo(points[1].x, points[1].y);
                } else if (points.length >= 3) {
                    ctx.quadraticCurveTo(points[2].x, points[2].y, points[1].x, points[1].y);
                }
                break;
            case 'arc':
                if (points.length >= 2) {
                    const center = points[0];
                    const start = points[1];
                    const radius = Math.hypot(start.x - center.x, start.y - center.y);
                    if (radius > 0) {
                        if (points.length === 2 && !options) {
                            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                        } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined) {
                            const { arcStartAngle, arcEndAngle } = options;
                            const spacing = 1;
                            const arcPoints = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacing);
                            
                            if (arcPoints.length > 0) {
                                ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
                                for (let i = 1; i < arcPoints.length; i++) {
                                    ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
                                }
                            }
                        }
                    }
                }
                break;
        }

        ctx.stroke();
        ctx.setLineDash([]);
        return;
    }
    
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    let lastWidth = (points[0]?.pressure && settings.pressureControl.size) ? points[0].pressure * settings.size : settings.size;

    for (let i = 1; i < points.length; i++) {
        const p1 = points[i-1];
        const p2 = points[i];
        
        const pressure = p2.pressure ?? 1.0;
        let currentWidth = settings.size;
        if (settings.pressureControl.size && strokeMode === 'freehand') {
            currentWidth = pressure * settings.size;
        }

        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
        
        ctx.lineWidth = (lastWidth + currentWidth) / 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midPoint.x, midPoint.y);

        lastWidth = currentWidth;
    }
};

const drawEraserStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: EraserSettings, strokeMode: StrokeMode, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
    ctx.globalCompositeOperation = 'destination-out';

    const drawDab = (p: Point) => {
        const size = settings.size;
        const hardness = settings.hardness / 100;

        ctx.beginPath();
        if (settings.tipShape === 'round') {
            ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        } else {
            ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
        }

        if (hardness >= 1.0) {
            ctx.fillStyle = `rgba(0,0,0,${settings.opacity})`;
        } else {
            const gradient = ctx.createRadialGradient(p.x, p.y, (size / 2) * hardness, p.x, p.y, size / 2);
            gradient.addColorStop(0, `rgba(0,0,0,${settings.opacity})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
        }
        ctx.fill();
    };

    if (strokeMode !== 'freehand') {
        if (points.length < 1) return;
        
        if (settings.hardness < 100) {
            // Dabbing for soft eraser
            let pointsToDab: Point[] = [];
            const spacing = Math.max(1, settings.size * 0.1);
            if (strokeMode === 'line' && points.length > 1) {
                pointsToDab = interpolatePoints(points[0], points[1], spacing);
            } else if (strokeMode === 'polyline') {
                 for (let i = 0; i < points.length - 1; i++) pointsToDab.push(...interpolatePoints(points[i], points[i+1], spacing));
            } else if (strokeMode === 'curve' && points.length >= 3) {
                pointsToDab = interpolateQuadraticBezier(points[0], points[2], points[1], spacing);
            } else if (strokeMode === 'arc' && points.length >= 2) {
                const [center, start] = points;
                const radius = Math.hypot(start.x - center.x, start.y - center.y);
                if (radius > 0) {
                    if (points.length === 2 && !options) { // Full circle preview
                        pointsToDab = interpolateArc(center, radius, 0, 2 * Math.PI, spacing);
                    } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined) {
                        const { arcStartAngle, arcEndAngle } = options;
                        pointsToDab = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacing);
                    }
                }
            } else if (points.length > 0) {
                pointsToDab.push(points[0]);
            }

            pointsToDab.forEach(drawDab);

        } else {
            // Hard eraser, use stroke
            ctx.strokeStyle = `rgba(0,0,0,${settings.opacity})`;
            ctx.lineWidth = settings.size;
            ctx.lineCap = settings.tipShape === 'round' ? 'round' : 'square';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            if (strokeMode !== 'arc') {
                ctx.moveTo(points[0].x, points[0].y);
            }

            switch (strokeMode) {
                case 'line':
                    if (points.length > 1) ctx.lineTo(points[1].x, points[1].y);
                    break;
                case 'polyline':
                    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                    break;
                case 'curve':
                    if (points.length === 2) ctx.lineTo(points[1].x, points[1].y);
                    else if (points.length >= 3) ctx.quadraticCurveTo(points[2].x, points[2].y, points[1].x, points[1].y);
                    break;
                case 'arc':
                     if (points.length >= 2) {
                        const center = points[0];
                        const start = points[1];
                        const radius = Math.hypot(start.x - center.x, start.y - center.y);
                        if (radius > 0) {
                             if (points.length === 2 && !options) {
                                ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                            } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined) {
                                const { arcStartAngle, arcEndAngle } = options;
                                const spacing = 1;
                                const arcPoints = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacing);
                                if (arcPoints.length > 0) {
                                    ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
                                    for(let i = 1; i < arcPoints.length; i++) {
                                        ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
                                    }
                                }
                            }
                        }
                    }
                    break;
            }
            ctx.stroke();

            if (points.length === 1) {
                drawDab(points[0]);
            }
        }
        return;
    }

    // Freehand logic
    if (!points || points.length === 0) return;

    if (points.length === 1) {
        drawDab(points[0]);
        return;
    }

    if (settings.hardness >= 100) {
        ctx.strokeStyle = `rgba(0,0,0,${settings.opacity})`;
        ctx.lineWidth = settings.size;
        ctx.lineCap = settings.tipShape === 'round' ? 'round' : 'square';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            const midPoint = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 };
            ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, midPoint.x, midPoint.y);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
    } else {
        let lastPoint = points[0];
        drawDab(lastPoint);
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
            const angle = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);
            
            const spacing = Math.max(1, settings.size * 0.1); 
            
            for (let d = spacing; d < dist; d += spacing) {
                const x = lastPoint.x + Math.cos(angle) * d;
                const y = lastPoint.y + Math.sin(angle) * d;
                drawDab({ x, y });
            }
            drawDab(point);
            lastPoint = point;
        }
    }
};

const drawSolidMarkerStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: SolidMarkerSettings, strokeMode: StrokeMode, strokeModifier: StrokeModifier, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
    ctx.strokeStyle = settings.color;
    ctx.lineCap = settings.tipShape === 'line' ? 'butt' : 'square';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = settings.size;
    ctx.globalCompositeOperation = settings.blendMode;

    if (points.length === 0) return;

    if (strokeMode !== 'freehand') {
        ctx.globalAlpha = settings.opacity;
        ctx.setLineDash(getStrokeDash(strokeModifier.style, strokeModifier.scale, ctx.lineWidth));
        ctx.beginPath();
        if (strokeMode !== 'arc') {
            ctx.moveTo(points[0].x, points[0].y);
        }

        switch (strokeMode) {
            case 'line':
                if (points.length > 1) ctx.lineTo(points[1].x, points[1].y);
                break;
            case 'polyline':
                for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                break;
            case 'curve':
                if (points.length === 2) ctx.lineTo(points[1].x, points[1].y);
                else if (points.length >= 3) ctx.quadraticCurveTo(points[2].x, points[2].y, points[1].x, points[1].y);
                break;
            case 'arc':
                if (points.length >= 2) {
                    const center = points[0];
                    const start = points[1];
                    const radius = Math.hypot(start.x - center.x, start.y - center.y);
                    if (radius > 0) {
                        if (points.length === 2 && !options) {
                            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
                        } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined) {
                            const { arcStartAngle, arcEndAngle } = options;
                            const spacing = 1;
                            const arcPoints = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacing);
                            if (arcPoints.length > 0) {
                                ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
                                for(let i = 1; i < arcPoints.length; i++) {
                                    ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
                                }
                            }
                        }
                    }
                }
                break;
        }

        ctx.stroke();
        ctx.setLineDash([]);
        return;
    }
    
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        const pressure = p2.pressure ?? 1.0;
        let currentOpacity = settings.opacity;
        if (settings.pressureControl.opacity && strokeMode === 'freehand') {
            currentOpacity *= pressure;
        }
        ctx.globalAlpha = currentOpacity;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
};

const drawNaturalMarkerDab = (ctx: CanvasRenderingContext2D, point: Point, settings: NaturalMarkerSettings, pressure: number, strokeMode: StrokeMode) => {
    let currentSize = settings.size;
    let currentFlow = settings.flow;
    const usePressure = strokeMode === 'freehand';
    
    if (usePressure && settings.pressureControl.size) {
        currentSize *= pressure;
    }
    if (usePressure && settings.pressureControl.flow) {
        currentFlow *= pressure;
    }
    if (currentSize < 1) return;

    const hardness = settings.hardness / 100;
    const gradient = ctx.createRadialGradient(point.x, point.y, currentSize / 2 * hardness, point.x, point.y, currentSize / 2);
    gradient.addColorStop(0, settings.color);
    gradient.addColorStop(1, `${settings.color}00`);

    ctx.fillStyle = gradient;
    ctx.globalAlpha = currentFlow;
    
    if (settings.tipShape === 'round') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, currentSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillRect(point.x - currentSize / 2, point.y - currentSize / 2, currentSize, currentSize);
    }
};

const drawNaturalMarkerStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: NaturalMarkerSettings, strokeMode: StrokeMode, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
    if (points.length < 1) return;
    ctx.globalCompositeOperation = settings.blendMode;

    if (strokeMode !== 'freehand') {
        const spacing = Math.max(1, settings.size * (settings.spacing / 100));
        let pointsToDab: Point[] = [];

        switch (strokeMode) {
            case 'line':
                if (points.length > 1) pointsToDab = interpolatePoints(points[0], points[1], spacing);
                break;
            case 'polyline':
                for (let i = 0; i < points.length - 1; i++) pointsToDab.push(...interpolatePoints(points[i], points[i+1], spacing));
                break;
            case 'curve':
                 if (points.length >= 3) {
                    pointsToDab = interpolateQuadraticBezier(points[0], points[2], points[1], spacing);
                 }
                break;
            case 'arc':
                 if (points.length >= 2) {
                     const [center, start] = points;
                     const radius = Math.hypot(start.x - center.x, start.y - center.y);
                     if (radius > 0) {
                        if (points.length === 2 && !options) {
                            pointsToDab = interpolateArc(center, radius, 0, 2 * Math.PI, spacing);
                        } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined){
                             const { arcStartAngle, arcEndAngle } = options;
                             pointsToDab = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacing);
                        }
                     }
                 }
                break;
        }

        pointsToDab.forEach(p => drawNaturalMarkerDab(ctx, p, settings, 1.0, strokeMode));
        return;
    }

    let lastPoint = points[0];
    drawNaturalMarkerDab(ctx, lastPoint, settings, lastPoint.pressure ?? 1.0, strokeMode);

    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
        const angle = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);
        
        const spacing = settings.size * (settings.spacing / 100);
        
        for (let d = spacing; d < dist; d += spacing) {
            const x = lastPoint.x + Math.cos(angle) * d;
            const y = lastPoint.y + Math.sin(angle) * d;
            const pressure = (lastPoint.pressure ?? 1) + ((point.pressure ?? 1) - (lastPoint.pressure ?? 1)) * (d / dist);
            drawNaturalMarkerDab(ctx, { x, y }, settings, pressure, strokeMode);
        }
        lastPoint = point;
    }
    drawNaturalMarkerDab(ctx, lastPoint, settings, lastPoint.pressure ?? 1.0, strokeMode);
};

const drawAirbrushStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: AirbrushSettings) => {
    ctx.globalCompositeOperation = settings.blendMode;
    points.forEach(p => {
        const gradient = ctx.createRadialGradient(p.x, p.y, settings.size / 2 * (1 - settings.softness), p.x, p.y, settings.size / 2);
        gradient.addColorStop(0, settings.color);
        gradient.addColorStop(1, `${settings.color}00`);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = settings.density;
        ctx.beginPath();
        ctx.arc(p.x, p.y, settings.size / 2, 0, 2 * Math.PI);
        ctx.fill();
    });
};

const drawFxBrushStroke = (ctx: CanvasRenderingContext2D, points: Point[], settings: FXBrushSettings, strokeMode: StrokeMode, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
    if (points.length < 1) return;
    
    if (strokeMode !== 'freehand') {
        const spacingPx = Math.max(1, settings.size * (settings.spacing / 100));
        let pointsToDab: Point[] = [];
        let angles: (number | undefined)[] = [];

        switch (strokeMode) {
            case 'line':
                if (points.length > 1) {
                    pointsToDab = interpolatePoints(points[0], points[1], spacingPx);
                    const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
                    angles = pointsToDab.map(() => angle);
                }
                break;
            case 'polyline':
                for (let i = 0; i < points.length - 1; i++) {
                    const segmentPoints = interpolatePoints(points[i], points[i+1], spacingPx);
                    const angle = Math.atan2(points[i+1].y - points[i].y, points[i+1].x - points[i].x);
                    pointsToDab.push(...segmentPoints);
                    angles.push(...segmentPoints.map(() => angle));
                }
                break;
            case 'curve':
                 if (points.length >= 3) {
                     pointsToDab = interpolateQuadraticBezier(points[0], points[2], points[1], spacingPx);
                     for (let i = 0; i < pointsToDab.length - 1; i++) {
                        angles.push(Math.atan2(pointsToDab[i+1].y - pointsToDab[i].y, pointsToDab[i+1].x - pointsToDab[i].x));
                     }
                     angles.push(angles[angles.length - 1]);
                 }
                break;
            case 'arc':
                 if (points.length >= 2) {
                     const [center, start] = points;
                     const radius = Math.hypot(start.x - center.x, start.y - center.y);
                     if (radius > 0) {
                        if (points.length === 2 && !options) {
                            pointsToDab = interpolateArc(center, radius, 0, 2 * Math.PI, spacingPx);
                        } else if (options?.arcStartAngle !== undefined && options?.arcEndAngle !== undefined){
                            const { arcStartAngle, arcEndAngle } = options;
                            pointsToDab = interpolateArc(center, radius, arcStartAngle, arcEndAngle, spacingPx);
                        }
                        pointsToDab.forEach(p => {
                            const angleToCenter = Math.atan2(p.y - center.y, p.x - center.x);
                            angles.push(angleToCenter + Math.PI / 2);
                        });
                     }
                 }
                break;
        }

        pointsToDab.forEach((p, i) => drawFxBrushDab(ctx, p, settings, 1.0, strokeMode, angles[i]));
        return;
    }
    
    let lastPoint = points[0];
    const spacingPx = settings.size * (settings.spacing / 100);
    drawFxBrushDab(ctx, lastPoint, settings, lastPoint.pressure ?? 1.0, strokeMode, 0);
    
    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
        const angle = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);

        for (let d = spacingPx; d <= dist; d += spacingPx) {
            const x = lastPoint.x + Math.cos(angle) * d;
            const y = lastPoint.y + Math.sin(angle) * d;
            const pressure = (lastPoint.pressure ?? 1) + ((point.pressure ?? 1) - (lastPoint.pressure ?? 1)) * (d / dist);
            drawFxBrushDab(ctx, { x, y }, settings, pressure, strokeMode, angle);
        }
        lastPoint = point;
    }
};

const drawDebugBrushStroke = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    ctx.fillStyle = 'red';
    points.forEach(p => ctx.fillRect(p.x - 1, p.y - 1, 2, 2));
};

export function useCanvasDrawing({
    tool,
    brushSettings,
    eraserSettings,
    solidMarkerSettings,
    naturalMarkerSettings,
    airbrushSettings,
    fxBrushSettings,
    activeGuide,
    mirrorGuides,
    strokeMode,
    strokeModifier,
}: {
    tool: Tool;
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    solidMarkerSettings: SolidMarkerSettings;
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    activeGuide: Guide;
    mirrorGuides: MirrorGuide[];
    strokeMode: StrokeMode;
    strokeModifier: StrokeModifier;
}) {
    const drawStroke = useCallback((ctx: CanvasRenderingContext2D, points: Point[], currentStrokeMode: StrokeMode, options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
        if (points.length === 0) return;
        switch (tool) {
            case 'brush': drawBrushStroke(ctx, points, brushSettings, currentStrokeMode, strokeModifier, options); break;
            case 'eraser': drawEraserStroke(ctx, points, eraserSettings, currentStrokeMode, options); break;
            case 'solid-marker': drawSolidMarkerStroke(ctx, points, solidMarkerSettings, currentStrokeMode, strokeModifier, options); break;
            case 'natural-marker': drawNaturalMarkerStroke(ctx, points, naturalMarkerSettings, currentStrokeMode, options); break;
            case 'airbrush': drawAirbrushStroke(ctx, points, airbrushSettings); break;
            case 'fx-brush': drawFxBrushStroke(ctx, points, fxBrushSettings, currentStrokeMode, options); break;
            case 'debug-brush': drawDebugBrushStroke(ctx, points); break;
        }
    }, [tool, brushSettings, eraserSettings, solidMarkerSettings, naturalMarkerSettings, airbrushSettings, fxBrushSettings, strokeModifier]);
    
    const drawStrokeWithMirroring = useCallback((ctx: CanvasRenderingContext2D, points: Point[], options?: { arcStartAngle?: number, arcEndAngle?: number }) => {
        const currentStrokeMode = strokeMode;
        
        drawStroke(ctx, points, currentStrokeMode, options);

        if (activeGuide === 'mirror' && mirrorGuides.length > 0) {
            mirrorGuides.forEach(guide => {
                ctx.save();
                const [p1, p2] = [guide.start, guide.end];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const angle = Math.atan2(dy, dx);
                
                ctx.translate(p1.x, p1.y);
                ctx.rotate(angle);
                ctx.scale(1, -1);
                ctx.rotate(-angle);
                ctx.translate(-p1.x, -p1.y);
                
                drawStroke(ctx, points, currentStrokeMode, options);
                ctx.restore();
            });
        }
    }, [drawStroke, activeGuide, mirrorGuides, strokeMode]);

    return { drawStrokeWithMirroring };
}