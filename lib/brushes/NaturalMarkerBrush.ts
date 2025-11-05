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
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Placeholder: Currently uses the same logic as the Pencil brush.
        // This can be replaced with a more advanced, texture-based algorithm later.
        (this.pencilEquivalent as any).drawStroke(ctx, points, context);
    }
}