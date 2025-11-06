import { BaseBrush, BrushContext } from './BaseBrush';
import type { SimpleMarkerSettings, Point, StrokeStyle } from '../../types';

export class SimpleMarkerBrush extends BaseBrush {
    private settings: SimpleMarkerSettings;

    constructor(settings: SimpleMarkerSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: SimpleMarkerSettings) {
        this.settings = settings;
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        const { color, tipShape, size, blendMode, opacity, pressureControl } = this.settings;
        const { strokeModifier } = context;

    ctx.strokeStyle = color;
    // Map logical tip shapes to canvas line cap / join values.
    ctx.lineCap = tipShape === 'line' ? 'butt' : (tipShape === 'circle' ? 'round' : 'square');
    ctx.lineJoin = tipShape === 'circle' ? 'round' : 'miter';
        ctx.lineWidth = size;
        ctx.globalCompositeOperation = blendMode;

        if (points.length < 2) return;

        const getDashPattern = (style: StrokeStyle, scale: number) => {
            if (style === 'solid') return null;
            const s = (val: number) => val * scale * Math.max(1, size / 5);
            switch (style) {
                case 'dashed': return [s(10), s(5)];
                case 'dotted': return [s(1), s(4)];
                case 'dash-dot': return [s(10), s(4), s(2), s(4)];
                default: return null;
            }
        }
        const pattern = getDashPattern(strokeModifier.style, strokeModifier.scale);
        
        if (pattern) {
            ctx.setLineDash(pattern);
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Original logic for solid lines to support pressure opacity
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                
                const pressure = p2.pressure ?? 1.0;
                let currentOpacity = opacity;
                if (pressureControl.opacity) {
                    currentOpacity *= pressure;
                }
                ctx.globalAlpha = currentOpacity;
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }
}