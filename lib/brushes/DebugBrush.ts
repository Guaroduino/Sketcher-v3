import { BaseBrush, BrushContext } from './BaseBrush';
import type { Point } from '../../types';

export class DebugBrush extends BaseBrush {
    constructor() {
        super();
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Debug brush is intentionally a no-op in production so it doesn't paint visible marks.
        // Keep the method here so the brush can be re-enabled later for debugging if needed.
        return;
    }
}