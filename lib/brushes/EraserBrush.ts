import { BaseBrush, BrushContext } from './BaseBrush';
import type { EraserSettings, Point } from '../../types';

export class EraserBrush extends BaseBrush {
    private settings: EraserSettings;

    constructor(settings: EraserSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: EraserSettings) {
        this.settings = settings;
    }

    protected updatePreview(context: BrushContext): void {
        const { previewCtx, mainCtx, viewTransform } = context;
        
        // 1. Clear the entire preview canvas (in screen space)
        this.clearPreview(context);
    
        // 2. Set the transform for the preview to match the main view
        previewCtx.save();
        previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
    
        // 3. Draw the active layer's current content, transformed into the view
        previewCtx.drawImage(mainCtx.canvas, 0, 0);
    
        // 4. Draw the erase stroke on top of this, which will erase it
        this.drawWithMirroring(previewCtx, this.points, context);
    
        // 5. Restore context
        previewCtx.restore();
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        ctx.globalCompositeOperation = 'destination-out';
        const { size, hardness, tipShape, opacity } = this.settings;

        if (points.length === 0) return;

        // Function to draw a single "dab" of the eraser
        const drawDab = (p: Point) => {
            ctx.beginPath();
            if (tipShape === 'round') {
                ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
            } else {
                ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
            }

            // Hard eraser uses a solid fill
            if (hardness >= 100) {
                ctx.fillStyle = `rgba(0,0,0,${opacity})`;
            } else { // Soft eraser uses a radial gradient for feathered edges
                const gradient = ctx.createRadialGradient(p.x, p.y, (size / 2) * (hardness / 100), p.x, p.y, size / 2);
                gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
            }
            ctx.fill();
        };

        if (points.length === 1) {
            drawDab(points[0]);
            return;
        }

        // For a continuous stroke, connect points with interpolated dabs
        let lastPoint = points[0];
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
            const angle = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);
            
            // Adjust spacing based on size to ensure a smooth line
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