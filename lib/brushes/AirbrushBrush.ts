import { BaseBrush, BrushContext } from './BaseBrush';
import type { AirbrushSettings, Point } from '../../types';

export class AirbrushBrush extends BaseBrush {
    private settings: AirbrushSettings;

    constructor(settings: AirbrushSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: AirbrushSettings) {
        this.settings = settings;
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Airbrush simulates a soft spray, so we can reuse logic similar to a soft eraser,
        // but by applying color instead of erasing.
        ctx.globalCompositeOperation = 'source-over';
        const { size, flow, color } = this.settings;

        if (points.length === 0) return;

        const drawDab = (p: Point) => {
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size / 2);
            const rgb = ctx.strokeStyle; // A bit of a hack to parse color
            ctx.fillStyle = color;
            const r = parseInt(ctx.fillStyle.slice(1,3), 16);
            const g = parseInt(ctx.fillStyle.slice(3,5), 16);
            const b = parseInt(ctx.fillStyle.slice(5,7), 16);
            
            gradient.addColorStop(0, `rgba(${r},${g},${b},${flow})`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        };

        if (points.length === 1) {
            drawDab(points[0]);
            return;
        }

        let lastPoint = points[0];
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
            const angle = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);
            
            const spacing = Math.max(1, size * 0.1); 
            
            for (let d = 0; d < dist; d += spacing) {
                const x = lastPoint.x + Math.cos(angle) * d;
                const y = lastPoint.y + Math.sin(angle) * d;
                drawDab({ x, y });
            }
            lastPoint = point;
        }
    }
}