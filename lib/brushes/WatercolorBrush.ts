import { BaseBrush, BrushContext } from './BaseBrush';
import type { WatercolorSettings, Point, StrokeStyle } from '../../types';

// Mulberry32, a simple pseudo-random number generator.
function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
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
    
    protected drawStroke(ctx: CanvasRenderingContext2D, points: Point[], context: BrushContext): void {
        const random = mulberry32(this.strokeSeed);
        const { color, size, flow, wetness, pressureControl } = this.settings;
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

        const drawDab = (p: Point, pressure: number) => {
            const currentSize = pressureControl.size ? pressure * size : size;
            if (currentSize < 1) return;
            
            const currentFlow = pressureControl.flow ? pressure * (flow / 100) : (flow / 100);
            
            const dabCount = Math.max(1, Math.floor(currentFlow * 5));

            for(let i = 0; i < dabCount; i++) {
                const jitterX = (random() - 0.5) * currentSize * 0.4;
                const jitterY = (random() - 0.5) * currentSize * 0.4;
                const dabX = p.x + jitterX;
                const dabY = p.y + jitterY;
                const dabSize = currentSize * (0.8 + random() * 0.4);
                const dabOpacity = (wetness / 100) * (0.5 + random() * 0.5);

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
            
            const dabSpacing = Math.max(1, (size * 0.2));

            for (let d = 0; d < dist; d += dabSpacing) {
                const shouldDraw = !pattern || isDrawingDash;

                if (pattern) {
                    patternPos += dabSpacing;
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