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

    private drawInterpolatedLine(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, state: StrokeState, pattern: number[] | null) {
        const { size } = this.settings;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        const lastPressure = p1.pressure ?? 1.0;
        const currentPressure = p2.pressure ?? 1.0;

        const minWidth = size * Math.min(lastPressure, currentPressure) * 0.5;
        const spacing = Math.max(0.25, minWidth * 0.2);

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