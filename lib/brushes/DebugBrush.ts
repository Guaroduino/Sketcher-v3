import { BaseBrush, BrushContext } from './BaseBrush';
import type { Point } from '../../types';

export class DebugBrush extends BaseBrush {
    constructor() {
        super();
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        ctx.fillStyle = 'red';
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        points.forEach(p => ctx.fillRect(p.x - 1, p.y - 1, 2, 2));
    }
}