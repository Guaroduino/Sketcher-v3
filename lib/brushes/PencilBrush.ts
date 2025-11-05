import { BaseBrush, BrushContext } from './BaseBrush';
import type { BrushSettings, Point, StrokeStyle } from '../../types';

export class PencilBrush extends BaseBrush {
    private settings: BrushSettings;

    constructor(settings: BrushSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: BrushSettings) {
        this.settings = settings;
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        const { color, lineCap, lineJoin, opacity, size, pressureControl } = this.settings;
        const { strokeModifier } = context;
        ctx.lineCap = lineCap;
        ctx.lineJoin = lineJoin;
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = 'source-over';
        
        if (points.length < 1) return;
        
        ctx.fillStyle = color;

        // Draws a single "dab" of the brush
        const drawDab = (p: Point, pressure: number) => {
            const width = (pressure && pressureControl.size) ? pressure * size : size;
            if (width > 0.5) { // Avoid drawing invisible dabs
                ctx.beginPath();
                ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        
        const getDashPattern = (style: StrokeStyle, scale: number) => {
            switch (style) {
                case 'dashed': return [10 * scale, 5 * scale];
                case 'dotted': return [2 * scale, 4 * scale];
                case 'dash-dot': return [10 * scale, 4 * scale, 2 * scale, 4 * scale];
                default: return null;
            }
        }
        const pattern = getDashPattern(strokeModifier.style, strokeModifier.scale);
        
        if (points.length === 1) {
            if (!pattern) drawDab(points[0], points[0].pressure ?? 1.0);
            return;
        }

        let lastPoint = points[0];
        let patternPos = 0;
        let patternIndex = 0;
        let isDrawingDash = true;


        // To create a continuous line, we connect the points with interpolated dabs
        for (let i = 1; i < points.length; i++) {
            const currentPoint = points[i];
            const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
            const angle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);
            
            const lastPressure = lastPoint.pressure ?? 1.0;
            const currentPressure = currentPoint.pressure ?? 1.0;
            
            // Determine the spacing based on the brush size to avoid gaps
            const minWidth = size * Math.min(lastPressure, currentPressure) * 0.5;
            const spacing = Math.max(0.25, minWidth * 0.2);

            for (let d = 0; d < dist; d += spacing) {
                const shouldDraw = !pattern || isDrawingDash;
                
                if (pattern) {
                    patternPos += spacing;
                    if (patternPos >= pattern[patternIndex]) {
                        patternPos -= pattern[patternIndex];
                        patternIndex = (patternIndex + 1) % pattern.length;
                        isDrawingDash = !isDrawingDash;
                    }
                }

                if (shouldDraw) {
                    const t = dist > 0 ? d / dist : 0;
                    const x = lastPoint.x + Math.cos(angle) * d;
                    const y = lastPoint.y + Math.sin(angle) * d;
                    // Interpolate pressure between points
                    const interpolatedPressure = lastPressure + (currentPressure - lastPressure) * t;
                    drawDab({ x, y }, interpolatedPressure);
                }
            }
            
            lastPoint = currentPoint;
        }
    }
}