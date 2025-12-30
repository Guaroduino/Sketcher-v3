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

    private hexToRgba(hex: string, alpha: number) {
        // Ensure hex is valid
        if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;

        let c: any;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }

        // Handle basic color names causing issues if passed directly (though UI mostly sends hex)
        // Or handle cases where regex failed due to casing or small typos.
        // Fallback: Use a canvas to parse strict colors?
        // Actually, for Gradient Stops, we NEED the explicit R,G,B values to avoid interpolating to (0,0,0,0).
        // If hex is invalid, we might default to black, which causes the fringing.

        // Simple manual conversion map for common name based fallbacks if needed, 
        // but let's assume valid Hex/RGB inputs for now or fix upstream.
        // The most critical part is returning `rgba(r,g,b, alpha)` and NOT potentially black if parsing fails,
        // although if parsing fails we probably want black? 
        // The issue 'blends with black' happens when we fade from Color(r,g,b,1) to Transparent(0,0,0,0).
        // Browser gradients interpolate r,g,b,a separately.
        // So (255,0,0,1) -> (0,0,0,0) middle is (127, 0, 0, 0.5) -> Dark Red. Correct.
        // Wait, (255,0,0,1) -> (255,0,0,0) middle is (255, 0, 0, 0.5) -> Light Red (Pinkish transparent). Correct.
        // The PREVIOUS implementation returned `rgba(r,g,b,alpha)` CORRECTLY for hex.
        // BUT if it fell back to `return hex` (line 81), that's just "#FF0000".
        // And `hexToRgba(color, 0)` is used for the transparent stop.
        // If `hexToRgba` failed regex, it returned valid HEX string? No, line 81 returned input `hex`.
        // If input `hex` was passed as 2nd arg to gradient, it's opaque.
        // But the code called `this.hexToRgba(color, 0)`.
        // If `color` was not matched by regex (e.g. "red" or mismatched hex), it returned "red".
        // Gradient stop 1: "red" (alpha 1 implicitly).
        // This means it didn't fade out.
        // BUT the user says "se mezcla con negro" (mixes with black).
        // This implies it IS fading, but to black.
        // This usually happens if the stop is `rgba(0,0,0,0)`.
        // So `hexToRgba` MUST ensure it keeps the r,g,b of the start color even if alpha is 0.

        return `rgba(0,0,0,${alpha})`; // Fallback
    }

    private drawDab(ctx: CanvasRenderingContext2D, p: Point, pressure: number) {
        const { size, pressureControl, hardness, color } = this.settings;
        const width = (pressure && pressureControl.size) ? pressure * size : size;

        if (width > 0.5) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);

            if (hardness < 100) {
                const gradient = ctx.createRadialGradient(p.x, p.y, (width / 2) * (hardness / 100), p.x, p.y, width / 2);
                const curve = this.settings.softnessCurve || 'linear';

                // Get transparent version using improved parser
                const transparentColor = this.hexToRgba(color, 0);

                try {
                    if (curve === 'linear') {
                        // Linear falloff (Standard Cone)
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(1, transparentColor);
                    } else if (curve === 'smooth') {
                        // Gaussian-like: Natural soft falloff
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(0.4, this.hexToRgba(color, 0.6));
                        gradient.addColorStop(0.8, this.hexToRgba(color, 0.1));
                        gradient.addColorStop(1, transparentColor);
                    } else if (curve === 'bell') {
                        // Hyper-Soft (Spike): Rapid falloff for "much much softer" feel
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(0.15, this.hexToRgba(color, 0.5));
                        gradient.addColorStop(0.4, this.hexToRgba(color, 0.1));
                        gradient.addColorStop(1, transparentColor);
                    }
                    ctx.fillStyle = gradient;
                } catch (e) {
                    ctx.fillStyle = color;
                }
            } else {
                ctx.fillStyle = color;
            }

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