import { BaseBrush, BrushContext } from './BaseBrush';
import type { BrushSettings, Point, StrokeStyle } from '../../types';

interface StrokeState {
    patternPos: number;
    patternIndex: number;
    isDrawingDash: boolean;
}

export class PencilBrush extends BaseBrush {
    private settings: BrushSettings;
    private incrementalState: StrokeState = { patternPos: 0, patternIndex: 0, isDrawingDash: true };

    constructor(settings: BrushSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: BrushSettings) {
        this.settings = settings;
    }

    protected onStrokeStart(point: Point, context: BrushContext): void {
        this.incrementalState = { patternPos: 0, patternIndex: 0, isDrawingDash: true };
    }

    protected drawSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, context: BrushContext): void {
        this.setupContext(ctx);
        const { strokeModifier } = context;
        const pattern = this.getDashPattern(strokeModifier.style, strokeModifier.scale);

        this.drawInterpolatedLine(ctx, p1, p2, this.incrementalState, pattern);
    }

    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        this.setupContext(ctx);

        if (points.length < 1) return;
        const { strokeModifier } = context;
        const pattern = this.getDashPattern(strokeModifier.style, strokeModifier.scale);

        if (points.length === 1) {
            if (!pattern) this.drawDab(ctx, points[0], points[0].pressure ?? 1.0);
            return;
        }

        const state: StrokeState = { patternPos: 0, patternIndex: 0, isDrawingDash: true };
        for (let i = 1; i < points.length; i++) {
            this.drawInterpolatedLine(ctx, points[i - 1], points[i], state, pattern);
        }
    }

    private setupContext(ctx: CanvasRenderingContext2D) {
        const { color, lineCap, lineJoin, opacity } = this.settings;
        ctx.lineCap = lineCap;
        ctx.lineJoin = lineJoin;
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
    }

    private getDashPattern(style: StrokeStyle, scale: number) {
        switch (style) {
            case 'dashed': return [10 * scale, 5 * scale];
            case 'dotted': return [2 * scale, 4 * scale];
            case 'dash-dot': return [10 * scale, 4 * scale, 2 * scale, 4 * scale];
            default: return null;
        }
    }

    private drawDab(ctx: CanvasRenderingContext2D, p: Point, pressure: number) {
        const { size, pressureControl } = this.settings;
        const width = (pressure && pressureControl.size) ? pressure * size : size;
        if (width > 0.5) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

<<<<<<< HEAD
    private drawInterpolatedLine(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, state: StrokeState, pattern: number[] | null) {
        const { size } = this.settings;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        const lastPressure = p1.pressure ?? 1.0;
        const currentPressure = p2.pressure ?? 1.0;

        const minWidth = size * Math.min(lastPressure, currentPressure) * 0.5;
        const spacing = Math.max(0.25, minWidth * 0.2);
=======
        // High-performance rendering: always use a decimated stroked path for multi-point strokes.
        // This avoids per-dab arc/fill calls which are expensive for long strokes and keeps the
        // tool responsive. We keep the single-dab behavior for isolated clicks.
        const MAX_POINTS = 1000;
        const step = Math.max(1, Math.ceil(points.length / MAX_POINTS));

        // If there's a dash/dot pattern, use setLineDash and stroke the decimated path.
        if (pattern) {
            ctx.setLineDash(pattern);
        }

        ctx.strokeStyle = color;
        // Keep configured caps/joins but prefer round for smoother look on single-stroke rendering
        ctx.lineCap = lineCap || 'round';
        ctx.lineJoin = lineJoin || 'round';
        ctx.lineWidth = size;
        ctx.globalAlpha = opacity;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = step; i < points.length; i += step) {
            const p = points[i];
            ctx.lineTo(p.x, p.y);
        }
        // Ensure the last point is included
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        if (pattern) {
            ctx.setLineDash([]);
        }

        return;

        // Fallback: original dab-based rendering for shorter strokes / patterns
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
>>>>>>> 0f3b7194c559580e5d40fa0e0803e62a6ac4e706

        for (let d = 0; d < dist; d += spacing) {
            const shouldDraw = !pattern || state.isDrawingDash;

            if (pattern) {
                state.patternPos += spacing;
                if (state.patternPos >= pattern[state.patternIndex]) {
                    state.patternPos -= pattern[state.patternIndex];
                    state.patternIndex = (state.patternIndex + 1) % pattern.length;
                    state.isDrawingDash = !state.isDrawingDash;
                }
            }

            if (shouldDraw) {
                const t = dist > 0 ? d / dist : 0;
                const x = p1.x + Math.cos(angle) * d;
                const y = p1.y + Math.sin(angle) * d;
                const interpolatedPressure = lastPressure + (currentPressure - lastPressure) * t;
                this.drawDab(ctx, { x, y }, interpolatedPressure);
            }
        }
    }
}