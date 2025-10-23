import React from 'react';
import type { Point, ViewTransform, CropRect } from '../types';

export const getCanvasPoint = (e: PointerEvent | React.PointerEvent<HTMLDivElement>, viewTransform: ViewTransform, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
        x: (x - viewTransform.pan.x) / viewTransform.zoom,
        y: (y - viewTransform.pan.y) / viewTransform.zoom,
    };
};

export const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (c: number) => `0${Math.round(c).toString(16)}`.slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const projectPointOnLine = (point: Point, lineStart: Point, lineEnd: Point): Point => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) return lineStart;
    const lenSq = dx * dx + dy * dy;
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return { x: projX, y: projY };
};

export const getLineIntersection = (line1: { start: Point; end: Point }, line2: { start: Point; end: Point }): Point | null => {
    const { start: p1, end: p2 } = line1;
    const { start: p3, end: p4 } = line2;

    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (den === 0) return null; // Parallel or collinear

    const t_num = (p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x);
    const t = t_num / den;
    
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
    };
};

export const isNearPoint = (p1: Point, p2: Point, threshold: number): boolean => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) < threshold;
};

export const distanceToLineSegment = (p: Point, v: Point, w: Point): number => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
    return Math.hypot(p.x - projection.x, p.y - projection.y);
};

export const getContentBoundingBox = (canvas: HTMLCanvasElement, tolerance: number = 1): CropRect | null => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha >= tolerance) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (maxX === -1) { // Empty canvas
            return null;
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    } catch (e) {
        console.error("Could not get canvas image data, it may be tainted.", e);
        return { x: 0, y: 0, width: canvas.width, height: canvas.height };
    }
};

export const getCanvasContext = (canvasRef: React.RefObject<HTMLCanvasElement> | HTMLCanvasElement | null): CanvasRenderingContext2D | null => {
    if (!canvasRef) {
        return null;
    }
    let canvas: HTMLCanvasElement | null;
    if ('current' in canvasRef) {
        canvas = canvasRef.current;
    } else {
        canvas = canvasRef;
    }
    return canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
}

export const clearCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
};

// Helper to solve system of linear equations Ax = b
function solve(A: number[][], b: number[]): number[] | null {
    const n = A.length;
    for (let i = 0; i < n; i++) {
        let max_row = i;
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(A[j][i]) > Math.abs(A[max_row][i])) {
                max_row = j;
            }
        }

        [A[i], A[max_row]] = [A[max_row], A[i]];
        [b[i], b[max_row]] = [b[max_row], b[i]];
        
        if (Math.abs(A[i][i]) <= 1e-10) return null;

        for (let j = i + 1; j < n; j++) {
            const factor = A[j][i] / A[i][i];
            b[j] -= factor * b[i];
            for (let k = i; k < n; k++) {
                A[j][k] -= factor * A[i][k];
            }
        }
    }

    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += A[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / A[i][i];
    }
    return x;
}

// Computes the 3x3 homography matrix for a perspective transform.
export function getHomographyMatrix(srcPoints: Point[], dstPoints: Point[]): number[] | null {
    if (srcPoints.length !== 4 || dstPoints.length !== 4) {
        return null;
    }
    const A: number[][] = [];
    for (let i = 0; i < 4; i++) {
        const { x: x1, y: y1 } = srcPoints[i];
        const { x: x2, y: y2 } = dstPoints[i];
        A.push([x1, y1, 1, 0, 0, 0, -x2 * x1, -x2 * y1]);
        A.push([0, 0, 0, x1, y1, 1, -y2 * x1, -y2 * y1]);
    }

    const b: number[] = [];
    for (const { x, y } of dstPoints) {
        b.push(x, y);
    }
    
    const h = solve(A, b);
    if (!h) return null;

    // The result h is [h0, h1, h2, h3, h4, h5, h6, h7]. The last element h8 is 1.
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}


// Computes the CSS `matrix3d` transform for a perspective distortion.
export const getCssMatrix3d = (srcPoints: Point[], dstPoints: Point[]): string => {
    const defaultMatrix = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)';
    const h = getHomographyMatrix(srcPoints, dstPoints);
    if (!h) return defaultMatrix;

    const H = [
        [h[0], h[1], h[2]],
        [h[3], h[4], h[5]],
        [h[6], h[7], 1]
    ];
    
    // Transpose for CSS matrix3d
    const M = [
        H[0][0], H[1][0], 0, H[2][0],
        H[0][1], H[1][1], 0, H[2][1],
        0, 0, 1, 0,
        H[0][2], H[1][2], 0, 1
    ];

    return `matrix3d(${M.join(', ')})`;
}

export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
};

export const cloneCanvas = (oldCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true });
    if (newCtx) {
        newCtx.drawImage(oldCanvas, 0, 0);
    }
    return newCanvas;
};

export const createNewCanvas = (width: number, height: number): { canvas: HTMLCanvasElement, context: CanvasRenderingContext2D } => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error("Failed to get 2D context");
    return { canvas, context };
}

export const createThumbnail = (sourceCanvas: HTMLCanvasElement, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            return reject(new Error('Could not create thumbnail context'));
        }

        const aspect = sourceCanvas.width / sourceCanvas.height;
        let thumbWidth = maxWidth;
        let thumbHeight = thumbWidth / aspect;

        if (thumbHeight > maxHeight) {
            thumbHeight = maxHeight;
            thumbWidth = thumbHeight * aspect;
        }
        
        tempCanvas.width = thumbWidth;
        tempCanvas.height = thumbHeight;

        tempCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, thumbWidth, thumbHeight);

        tempCanvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas toBlob returned null'));
            }
        }, 'image/png', 0.9);
    });
};