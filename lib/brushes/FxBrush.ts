import { BaseBrush, BrushContext } from './BaseBrush';
import type { FXBrushSettings, Point } from '../../types';
import { PencilBrush } from './PencilBrush';

export class FxBrush extends BaseBrush {
    private settings: FXBrushSettings;
    private pencilEquivalent: PencilBrush;

    constructor(settings: FXBrushSettings) {
        super();
        this.settings = settings;
        this.pencilEquivalent = new PencilBrush({
            ...settings,
            lineCap: 'round',
            lineJoin: 'round',
            hasStrokeCaps: true,
            pressureControl: { size: true }
        });
    }

    updateSettings(settings: FXBrushSettings) {
        this.settings = settings;
        this.pencilEquivalent.updateSettings({
            ...settings,
            lineCap: 'round',
            lineJoin: 'round',
            hasStrokeCaps: true,
            pressureControl: { size: true }
        });
    }
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        // Placeholder: Logic for specific FX presets would go here.
        // For now, it behaves like a standard pencil.
        (this.pencilEquivalent as any).drawStroke(ctx, points, context);
    }
}