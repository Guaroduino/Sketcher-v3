import type { Point, Guide, MirrorGuide, ViewTransform, StrokeModifier } from '../../types';
import { clearCanvas } from '../../utils/canvasUtils';


export interface BrushContext {
    mainCtx: CanvasRenderingContext2D;
    previewCtx: CanvasRenderingContext2D;
    viewTransform: ViewTransform,
    onDrawCommit: (activeItemId: string, beforeCanvas: HTMLCanvasElement) => void;
    activeItemId: string;
    activeGuide: Guide;
    mirrorGuides: MirrorGuide[];
    strokeModifier: StrokeModifier;
}

export abstract class BaseBrush {
    protected points: Point[] = [];
    protected beforeCanvas: HTMLCanvasElement | null = null;
    isDrawing: boolean = false;
    protected strokeSeed: number = 0;
    protected smoothing: number = 0;

    // Abstract method to be implemented by subclasses for their specific drawing logic
    protected abstract drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void;

    // Optional: Implement for incremental rendering (O(1) preview updates)
    protected drawSegment?(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, context: BrushContext): void;

    // Optional: Hook called when a new stroke starts
    protected onStrokeStart?(point: Point, context: BrushContext): void;

    public updateSmoothing(smoothing: number) {
        this.smoothing = smoothing;
    }

    onPointerDown(point: Point, context: BrushContext): void {
        this.strokeSeed = point.x * 1337 + point.y * 31337 + Date.now();
        this.isDrawing = true;
        this.points = [point];

        // Create a snapshot of the canvas *only for the undo history*.
        this.beforeCanvas = document.createElement('canvas');
        this.beforeCanvas.width = context.mainCtx.canvas.width;
        this.beforeCanvas.height = context.mainCtx.canvas.height;
        this.beforeCanvas.getContext('2d')?.drawImage(context.mainCtx.canvas, 0, 0);

        if (this.onStrokeStart) {
            this.onStrokeStart(point, context);
        }
    }

    onPointerMove(point: Point, context: BrushContext): void {
        if (!this.isDrawing) return;

        if (this.smoothing > 0 && this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            const smoothedPoint = {
                x: lastPoint.x + (point.x - lastPoint.x) * (1 - this.smoothing),
                y: lastPoint.y + (point.y - lastPoint.y) * (1 - this.smoothing),
                pressure: point.pressure !== undefined
                    ? (lastPoint.pressure !== undefined ? lastPoint.pressure + (point.pressure - lastPoint.pressure) * (1 - this.smoothing) : point.pressure)
                    : undefined,
            };
            this.points.push(smoothedPoint);
        } else {
            this.points.push(point);
        }

        this.updatePreview(context);
    }

    onPointerUp(context: BrushContext): void {
        if (!this.isDrawing || !this.beforeCanvas) return;
        this.isDrawing = false;

        const finalCtx = context.mainCtx;

        // The main canvas already has the correct previous state.
        // We just need to draw the final, complete stroke onto it.
        this.drawWithMirroring(finalCtx, this.points, context);

        // Commit the change for history (undo/redo), using the snapshot we took at the beginning.
        context.onDrawCommit(context.activeItemId, this.beforeCanvas);

        this.clearPreview(context);
        this.reset();
    }

    onPointerCancel(context: BrushContext | null): void {
        if (context) {
            // If we have context, commit the stroke as if pointer was lifted.
            this.onPointerUp(context);
        } else {
            // If no context, just discard the stroke and reset.
            // This happens when a multi-touch gesture interrupts a stroke.
            if (!this.isDrawing) return;
            this.isDrawing = false;
            // The caller who passes null is responsible for cleaning up the preview.
            this.reset();
        }
    }

    protected updatePreview(context: BrushContext): void {
        const { previewCtx, viewTransform } = context;
        // The preview canvas should ONLY contain the new stroke. It's a transparent layer on top.
        // Incremental rendering optimization
        if (this.drawSegment && this.points.length > 1) {
            const p1 = this.points[this.points.length - 2];
            const p2 = this.points[this.points.length - 1];
            this.drawWithMirroringSegment(previewCtx, p1, p2, context);
        } else {
            // Fallback: Clear and redraw everything (O(N^2))
            this.clearPreview(context);
            previewCtx.save();
            previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
            this.drawWithMirroring(previewCtx, this.points, context);
            previewCtx.restore();
        }
    }

    protected clearPreview(context: BrushContext): void {
        const { previewCtx } = context;
        // Only clear if we are NOT using incremental rendering or if explicitly requested (e.g. end of stroke)
        if (!this.drawSegment || !this.isDrawing) {
            clearCanvas(previewCtx);
        }
    }

    protected reset(): void {
        this.points = [];
        this.beforeCanvas = null;
        this.isDrawing = false;
        this.strokeSeed = 0;
    }

    protected drawWithMirroring(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Each call to drawStroke is wrapped to isolate its state changes (e.g., globalCompositeOperation).
        // This is crucial for both the preview and the final draw.
        ctx.save();
        try {
            this.drawStroke(ctx, points, context);
        } finally {
            ctx.restore();
        }

        const { activeGuide, mirrorGuides } = context;
        if (activeGuide === 'mirror' && mirrorGuides.length > 0) {
            mirrorGuides.forEach(guide => {
                ctx.save();
                try {
                    const [p1, p2] = [guide.start, guide.end];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const angle = Math.atan2(dy, dx);

                    // Apply reflection transformation
                    ctx.translate(p1.x, p1.y);
                    ctx.rotate(angle);
                    ctx.scale(1, -1);
                    ctx.rotate(-angle);
                    ctx.translate(-p1.x, -p1.y);

                    // Draw the mirrored stroke, again isolating its state.
                    this.drawStroke(ctx, points, context);
                } finally {
                    ctx.restore();
                }
            });
        }
    }


    protected drawWithMirroringSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, context: BrushContext): void {
        if (!this.drawSegment) return;

        ctx.save();
        ctx.setTransform(context.viewTransform.zoom, 0, 0, context.viewTransform.zoom, context.viewTransform.pan.x, context.viewTransform.pan.y);
        try {
            this.drawSegment(ctx, p1, p2, context);
        } finally {
            ctx.restore();
        }

        const { activeGuide, mirrorGuides, viewTransform } = context;
        if (activeGuide === 'mirror' && mirrorGuides.length > 0) {
            mirrorGuides.forEach(guide => {
                ctx.save();
                // Apply transform for mirror (needs to handle zoom/pan correction or apply raw matrix?)
                // Since drawSegment expects raw canvas coordinates or transformed? 
                // drawStroke usually draws in "world" coordinates if ctx is transformed.
                // Our ctx above is transformed to world space.
                // Mirror logic usually assumes world space coordinates.
                ctx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);

                try {
                    const [gp1, gp2] = [guide.start, guide.end];
                    const dx = gp2.x - gp1.x;
                    const dy = gp2.y - gp1.y;
                    const angle = Math.atan2(dy, dx);

                    ctx.translate(gp1.x, gp1.y);
                    ctx.rotate(angle);
                    ctx.scale(1, -1);
                    ctx.rotate(-angle);
                    ctx.translate(-gp1.x, -gp1.y);

                    this.drawSegment(ctx, p1, p2, context);
                } finally {
                    ctx.restore();
                }
            });
        }
    }
}