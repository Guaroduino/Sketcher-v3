import { BaseBrush, BrushContext } from './BaseBrush';
import type { NaturalMarkerSettings, Point } from '../../types';
import { PencilBrush } from './PencilBrush'; // Using Pencil logic as a placeholder

export class NaturalMarkerBrush extends BaseBrush {
    private settings: NaturalMarkerSettings;
    private pencilEquivalent: PencilBrush;

    constructor(settings: NaturalMarkerSettings) {
        super();
        this.settings = settings;
        this.pencilEquivalent = new PencilBrush({
            ...settings,
            lineCap: 'round',
            lineJoin: 'round',
            hasStrokeCaps: true,
        });
    }

    updateSettings(settings: NaturalMarkerSettings) {
        this.settings = settings;
        this.pencilEquivalent.updateSettings({
            ...settings,
            lineCap: 'round',
            lineJoin: 'round',
            hasStrokeCaps: true,
        });
    }
    
    // Override preview updating to draw the full stroke on the preview canvas.
    // The BaseBrush draws incremental segments which can cause a "bead"/dotted
    // appearance for brushes that depend on continuous rendering. Drawing the
    // whole stroke each frame ensures the preview exactly matches the final
    // committed stroke.
    protected updatePreview(context: BrushContext): void {
        const { previewCtx, viewTransform } = context;
        if (!previewCtx) return;

        // Clear and draw the entire stroke so preview matches committed result
        this.clearPreview(context);

        previewCtx.save();
        previewCtx.setTransform(viewTransform.zoom, 0, 0, viewTransform.zoom, viewTransform.pan.x, viewTransform.pan.y);
        // Draw the full set of points (not just incremental) so there are no gaps
        this.drawWithMirroring(previewCtx, this.points, context);
        previewCtx.restore();

        this.lastPreviewPointCount = this.points.length;
    }
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Placeholder: Currently uses the same logic as the Pencil brush.
        // This can be replaced with a more advanced, texture-based algorithm later.
        (this.pencilEquivalent as any).drawStroke(ctx, points, context);
    }
}