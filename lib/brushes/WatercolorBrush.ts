import { BaseBrush, BrushContext } from './BaseBrush';
import type { WatercolorSettings, Point, StrokeStyle } from '../../types';

// Position-based deterministic random: produces a stable pseudo-random
// value in [0,1) from (seed, x, y, n). This is intentionally
// independent of call ordering so preview and committed stroke use the
// same randomness for the same positions.
function positionRandom(seed: number, x: number, y: number, n: number) {
        const xi = Math.floor(x * 1000);
        const yi = Math.floor(y * 1000);
        // Combine ints with large primes and the nonce
        let h = (xi * 374761393) ^ (yi * 668265263) ^ (seed + (n | 0) * 2654435761);
        // Avalanche / scramble
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h = (h ^ (h >>> 16)) >>> 0;
        return h / 4294967295;
}

export class WatercolorBrush extends BaseBrush {
    private settings: WatercolorSettings;

    constructor(settings: WatercolorSettings) {
        super();
        this.settings = settings;
    }

    updateSettings(settings: WatercolorSettings) {
        this.settings = settings;
    }
    
    // Use the BaseBrush incremental preview implementation to avoid
    // re-drawing the entire stroke every frame. The randomness is
    // position-based, so incremental drawing will remain deterministic
    // (the value for a given coordinate does not depend on draw order).
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
    // Deterministic per-position RNG helper will be used instead of
    // a sequential RNG so that incremental preview rendering does not
    // change the RNG consumption order and thus the result.
    const { color, size, flow, wetness, opacity, pressureControl } = this.settings;
        const { strokeModifier } = context;

        ctx.globalCompositeOperation = 'source-over';

        if (points.length < 1) return;

        const getRgba = (colorStr: string): [number, number, number] => {
            const tempCtx = document.createElement('canvas').getContext('2d');
            if (tempCtx) {
                tempCtx.fillStyle = colorStr;
                tempCtx.fillRect(0, 0, 1, 1);
                const data = tempCtx.getImageData(0, 0, 1, 1).data;
                return [data[0], data[1], data[2]];
            }
            return [0, 0, 0];
        };
        const [r, g, b] = getRgba(color);

        // Precompute adaptive spacing based on the total stroke length so
        // very long strokes increase spacing globally and avoid huge
        // numbers of dabs which cause UI lag.
        const baseSpacing = Math.max(1, (size * 0.2));
        const maxDabPerPoint = Math.max(1, Math.floor((flow / 100) * 5));
        // Compute total stroke length from full set of points stored on the brush
        let totalLength = 0;
        for (let pi = 1; pi < this.points.length; pi++) {
            const a = this.points[pi - 1];
            const b = this.points[pi];
            totalLength += Math.hypot(b.x - a.x, b.y - a.y);
        }
        const totalEstimatedDabs = Math.ceil(totalLength / baseSpacing) * maxDabPerPoint;
        const MAX_TOTAL_DABS = 6000; // global cap for whole stroke
        let globalAdaptiveSpacing = baseSpacing;
        if (totalEstimatedDabs > MAX_TOTAL_DABS) {
            const scale = Math.sqrt(totalEstimatedDabs / MAX_TOTAL_DABS);
            globalAdaptiveSpacing = baseSpacing * scale;
        }

        const drawDab = (p: Point, pressure: number) => {
            const currentSize = pressureControl.size ? pressure * size : size;
            if (currentSize < 1) return;
            
            const currentFlow = pressureControl.flow ? pressure * (flow / 100) : (flow / 100);
            const dabCount = Math.max(1, Math.floor(currentFlow * 5));

            for (let i = 0; i < dabCount; i++) {
                // Use position-based randomness so result depends only on
                // (seed, point position, index) and not on draw order.
                const jx = (positionRandom(this.strokeSeed, p.x, p.y, i * 4 + 1) - 0.5) * currentSize * 0.4;
                const jy = (positionRandom(this.strokeSeed, p.x, p.y, i * 4 + 2) - 0.5) * currentSize * 0.4;
                const dabX = p.x + jx;
                const dabY = p.y + jy;
                const dabSize = currentSize * (0.8 + positionRandom(this.strokeSeed, p.x, p.y, i * 4 + 3) * 0.4);
                const baseDabOpacity = (wetness / 100) * (0.5 + positionRandom(this.strokeSeed, p.x, p.y, i * 4 + 4) * 0.5);
                const pressureOpacity = pressureControl.opacity ? pressure : 1;
                const dabOpacity = baseDabOpacity * opacity * pressureOpacity;

                const gradient = ctx.createRadialGradient(dabX, dabY, 0, dabX, dabY, dabSize / 2);
                gradient.addColorStop(0, `rgba(${r},${g},${b},${dabOpacity})`);
                gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(dabX, dabY, dabSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        const getDashPattern = (style: StrokeStyle, scale: number) => {
            switch (style) {
                case 'dashed': return [10 * scale, 5 * scale];
                case 'dotted': return [2 * scale, 4 * scale];
                case 'dash-dot': return [10 * scale, 4 * scale, 2 * scale, 4 * scale];
                default: return null;
            }
        }
        const pattern = getDashPattern(strokeModifier.style, strokeModifier.scale);

        if (points.length === 1) {
            if (!pattern) drawDab(points[0], points[0].pressure ?? 1.0);
            return;
        }

        let lastPoint = points[0];
        let patternPos = 0;
        let patternIndex = 0;
        let isDrawingDash = true;

        for (let i = 1; i < points.length; i++) {
            const currentPoint = points[i];
            const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
            const angle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);
            
            const lastPressure = lastPoint.pressure ?? 1.0;
            const currentPressure = currentPoint.pressure ?? 1.0;
            
            // Use the globally computed adaptive spacing to keep total work bounded
            const adaptiveSpacing = globalAdaptiveSpacing;

            for (let d = 0; d < dist; d += adaptiveSpacing) {
                const shouldDraw = !pattern || isDrawingDash;

                if (pattern) {
                    patternPos += adaptiveSpacing;
                    if (patternPos >= pattern[patternIndex]) {
                        patternPos -= pattern[patternIndex];
                        patternIndex = (patternIndex + 1) % pattern.length;
                        isDrawingDash = !isDrawingDash;
                    }
                }

                if (shouldDraw) {
                    const t = dist > 0 ? d / dist : 0;
                    const x = lastPoint.x + Math.cos(angle) * d;
                    const y = lastPoint.y + Math.sin(angle) * d;
                    const interpolatedPressure = lastPressure + (currentPressure - lastPressure) * t;
                    drawDab({ x, y }, interpolatedPressure);
                }
            }
            
            lastPoint = currentPoint;
        }
    }
}