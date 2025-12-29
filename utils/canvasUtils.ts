import React from 'react';
import type { Point, ViewTransform, CropRect, PerspectiveGuide, CanvasItem, SketchObject } from '../types';

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

export const distanceToLine = (p: Point, v: Point, w: Point): number => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    const projection = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
    return Math.hypot(p.x - projection.x, p.y - projection.y);
};


export const getPerspectiveBoxPoints = (
    p1: Point, // Base Corner 1
    p2: Point, // Base Corner 2 (Opposite on base plane)
    p3: Point | null, // Height Point (optional, for partial construction)
    vps: { vpGreen: Point | null, vpRed: Point | null, vpBlue: Point | null }
): Point[] => {
    // We assume 2-Point or 3-Point perspective.
    // Base is on the Green-Red plane. Height is along Blue.
    // If Blue VP is null (2-point), height lines are vertical (parallel Y).

    const { vpGreen, vpRed, vpBlue } = vps;
    if (!vpGreen || !vpRed) return []; // Need at least 2 VPs for the base

    // 1. Construct Base Rect (4 points) on "Ground"
    // Lines: L1(vpGreen, p1), L2(vpRed, p1) -> These define the "origin" corner lines
    // Lines: L3(vpGreen, p2), L4(vpRed, p2) -> These define the "opposite" corner lines
    // Corners:
    // C1 = p1
    // C2 = Intersection(Line(vpRed, p1), Line(vpGreen, p2))
    // C3 = p2
    // C4 = Intersection(Line(vpGreen, p1), Line(vpRed, p2))

    const c1 = p1;
    const c3 = p2;
    const c2 = getLineIntersection(
        { start: vpRed, end: p1 },
        { start: vpGreen, end: p2 }
    );
    const c4 = getLineIntersection(
        { start: vpGreen, end: p1 },
        { start: vpRed, end: p2 }
    );

    if (!c2 || !c4) return [c1, c3]; // Degenerate base, return what we have

    const basePoints = [c1, c2, c3, c4];
    if (!p3) return basePoints;

    // 2. Construct Top Rect
    // We need to determine the "Height" offset.
    // User clicked p3.
    // We assume p3 defines the height relative to the LAST point clicked (p2 usually, or p1?).
    // Let's assume height is derived from p2 to p3 along the Vertical axis (Blue VP).

    // Vertical Line Constraint:
    // If vpBlue exists: Line(vpBlue, p2)
    // If no vpBlue: Vertical Line passing through p2

    // But p3 might not be on that line exactly.
    // So we project p3 onto the vertical line passing through p2.
    // Let's call the projected point p3_proj. That determines the "height".

    let heightVectorStart = c3; // Using p2 (c3) as the anchor for height
    let topC3: Point | null = null;

    if (vpBlue) {
        // Project p3 onto Line(vpBlue, c3)
        topC3 = projectPointOnLine(p3, vpBlue, c3);
    } else {
        // Vertical line
        topC3 = { x: c3.x, y: p3.y }; // Simple vertical projection
    }

    if (!topC3) return basePoints;

    // Now reconstructing the Top Rect starting from topC3
    // We essentially repeat the intersection logic but "elevated"
    // Wait, simpler way:
    // We have the vertical "rails" from each base corner to VP_Blue (or vertical infinity).
    // topC3 is the corner corresponding to c3.
    // topC1, topC2, topC4 must be found by intersecting these rails with the "Top Plane" grids.
    //
    // Line(vpGreen, topC3) intersects Rail(c2) -> topC2
    // Line(vpRed, topC3) intersects Rail(c4) -> topC4
    // Line(vpRed, topC2) (or vpGreen, topC4) intersects Rail(c1) -> topC1

    const getRail = (baseP: Point) => {
        if (vpBlue) return { start: vpBlue, end: baseP };
        return { start: baseP, end: { x: baseP.x, y: baseP.y - 10000 } }; // Vertical ray up
    };

    const rail1 = getRail(c1);
    const rail2 = getRail(c2);
    // rail3 is passes through topC3 by definition
    const rail4 = getRail(c4);

    const topC2 = getLineIntersection(rail2, { start: vpGreen, end: topC3 });
    const topC4 = getLineIntersection(rail4, { start: vpRed, end: topC3 });

    if (!topC2 || !topC4) return [...basePoints, topC3];

    const topC1 = getLineIntersection(rail1, { start: vpRed, end: topC2 });
    // Verification: could also be intersection(rail1, {start: vpGreen, end: topC4})

    if (!topC1) return [...basePoints, topC3]; // Should rarely happen if valid perspective

    return [c1, c2, c3, c4, topC1, topC2, topC3, topC4];
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

export const cloneCanvasWithContext = (oldCanvas: HTMLCanvasElement): { canvas: HTMLCanvasElement, context: CanvasRenderingContext2D } => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true });
    if (!newCtx) throw new Error("Failed to get 2D context for cloned canvas");
    newCtx.drawImage(oldCanvas, 0, 0);
    return { canvas: newCanvas, context: newCtx };
};

export const getCompositeCanvas = (
    fullResolution: boolean,
    canvasSize: { width: number, height: number },
    getDrawableObjects: () => CanvasItem[],
    backgroundObject?: CanvasItem,
    options: { transparent?: boolean } = {}
): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return null;

    // 1. Fill Background
    if (!options.transparent) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (backgroundObject) {
        // Cast to SketchObject to access potential canvas/opacity
        const bgItem = backgroundObject as unknown as SketchObject;
        if (bgItem.canvas && bgItem.isVisible) {
            context.save();
            context.globalAlpha = bgItem.opacity;
            context.drawImage(bgItem.canvas, bgItem.offsetX || 0, bgItem.offsetY || 0);
            context.restore();
        }
    }

    // 2. Draw Items
    const items = getDrawableObjects();
    items.forEach(item => {
        // Cast to SketchObject to access properties
        const sketchItem = item as unknown as SketchObject;

        if (!sketchItem.isVisible) return;
        if (!sketchItem.canvas) return;

        context.save();
        context.globalAlpha = sketchItem.opacity;

        // Draw the item's backing canvas
        // We assume the backing canvas is already the size of the viewport OR positioned.
        // Looking at SketchObject, it has offsetX/offsetY.
        // Use 0,0 if not present.
        const x = sketchItem.offsetX || 0;
        const y = sketchItem.offsetY || 0;

        context.drawImage(sketchItem.canvas, x, y);

        context.restore();
    });

    return canvas;
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

function colorMatch(r1: number, g1: number, b1: number, a1: number, r2: number, g2: number, b2: number, a2: number, tolerance: number): boolean {
    if (a1 < 128 && a2 < 128) return true; // Both transparent enough
    if (a1 < 128 || a2 < 128) return false; // One is transparent, one is not
    const toleranceSq = (tolerance / 100 * 255) ** 2 * 3;
    const distSq = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
    return distSq <= toleranceSq;
}

export function createMagicWandSelection(imageData: ImageData, startX: number, startY: number, tolerance: number, contiguous: boolean): { path: Path2D, bbox: CropRect } | null {
    const { width, height, data } = imageData;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;

    const startIndex = (startY * width + startX) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    const selectionMask = new Uint8Array(width * height);
    let minX = width, minY = height, maxX = -1, maxY = -1;

    if (contiguous) {
        if (startA < 128) return null; // Don't select transparent areas

        const queue: [number, number][] = [[startX, startY]];
        selectionMask[startY * width + startX] = 1;
        let head = 0;

        while (head < queue.length) {
            const [x, y] = queue[head++];
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);

            const neighbors: [number, number][] = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];

            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIndex = ny * width + nx;
                    if (selectionMask[nIndex] === 0) {
                        const nDataIndex = nIndex * 4;
                        if (colorMatch(startR, startG, startB, startA, data[nDataIndex], data[nDataIndex + 1], data[nDataIndex + 2], data[nDataIndex + 3], tolerance)) {
                            selectionMask[nIndex] = 1;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
        }
    } else { // non-contiguous
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                if (colorMatch(startR, startG, startB, startA, data[index], data[index + 1], data[index + 2], data[index + 3], tolerance)) {
                    selectionMask[y * width + x] = 1;
                    minX = Math.min(minX, x); minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                }
            }
        }
    }

    if (maxX === -1) return null; // Nothing selected

    const path = new Path2D();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (selectionMask[y * width + x] === 1) {
                let startX = x;
                while (x + 1 < width && selectionMask[y * width + (x + 1)] === 1) {
                    x++;
                }
                path.rect(startX, y, x - startX + 1, 1);
            }
        }
    }

    return {
        path,
        bbox: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
}

export const getVisibleBoxEdges = (corners: Point[]): Point[][] => {
    if (corners.length !== 8) return [];

    const getSignedArea = (indices: number[]) => {
        let sum = 0;
        for (let i = 0; i < indices.length; i++) {
            const p1 = corners[indices[i]];
            const p2 = corners[indices[(i + 1) % indices.length]];
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        return sum;
    };

    // Faces defined to have Outward Normals (assuming "standard" construction)
    // 0: Bottom (0, 3, 2, 1)
    // 1: Top    (4, 5, 6, 7)
    // 2: Front  (0, 1, 5, 4)
    // 3: Right  (1, 2, 6, 5)
    // 4: Back   (2, 3, 7, 6)
    // 5: Left   (3, 0, 4, 7)
    const candidateFaces = [
        [0, 3, 2, 1],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7]
    ];

    // In Y-down (screen), visible faces (CCW in 3D?) usually map to Negative or Positive Signed Area depending on winding.
    // Heuristic: We usually see 3 faces (convex corner).
    // Let's find the sign that gives us <= 3 faces (but > 0 faces).

    // Opposite pairs: (0,1), (2,4), (3,5)
    // A valid convex visibility set cannot contain both members of an opposite pair.
    const isValidSet = (indicesList: number[][]) => {
        const faceIndices = indicesList.map(list => candidateFaces.indexOf(list));
        const has0 = faceIndices.includes(0);
        const has1 = faceIndices.includes(1);
        const has2 = faceIndices.includes(2);
        const has3 = faceIndices.includes(3);
        const has4 = faceIndices.includes(4);
        const has5 = faceIndices.includes(5);

        if (has0 && has1) return false;
        if (has2 && has4) return false;
        if (has3 && has5) return false;
        return true;
    };

    let visibleIndices: number[][] = [];

    // Try Negative Area (Standard CW projected visibility usually)
    const negFaces = candidateFaces.filter(indices => getSignedArea(indices) < 0);
    const posFaces = candidateFaces.filter(indices => getSignedArea(indices) > 0);

    const negValid = negFaces.length > 0 && negFaces.length <= 3 && isValidSet(negFaces);
    const posValid = posFaces.length > 0 && posFaces.length <= 3 && isValidSet(posFaces);

    const getSetArea = (faces: number[][]) => faces.reduce((sum, indices) => sum + Math.abs(getSignedArea(indices)), 0);

    if (negValid && !posValid) {
        visibleIndices = negFaces;
    } else if (posValid && !negValid) {
        visibleIndices = posFaces;
    } else if (negValid && posValid) {
        // Both valid. Use Perspective Heuristic:
        // The single largest projected face is always the "Front" face (closest to camera).
        // Find the face with the absolute maximum area among ALL candidate faces.

        let maxFaceArea = -1;
        let bestFaceIndex = -1;

        // Helper to calculate area
        const getArea = (indices: number[]) => Math.abs(getSignedArea(indices));

        candidateFaces.forEach((faceIndices, index) => {
            const area = getArea(faceIndices);
            if (area > maxFaceArea) {
                maxFaceArea = area;
                bestFaceIndex = index;
            }
        });

        // Determine which set contains the best face (by index in candidateFaces)
        // negFaces is a list of index-arrays. We need to check if the specific indices of bestFace are in it.
        // Actually, bestFaceIndex is the index in `candidateFaces`.
        // negFaces contains arrays from candidateFaces.

        const bestFaceIndices = candidateFaces[bestFaceIndex];
        const isBestInNeg = negFaces.includes(bestFaceIndices);

        visibleIndices = isBestInNeg ? negFaces : posFaces;
    } else {
        // Fallback
        if (negFaces.length > 0 && negFaces.length <= 3) visibleIndices = negFaces;
        else if (posFaces.length > 0 && posFaces.length <= 3) visibleIndices = posFaces;
        else visibleIndices = negFaces;
    }

    const edges: Point[][] = [];
    const edgeSet = new Set<string>();

    visibleIndices.forEach(indices => {
        for (let i = 0; i < indices.length; i++) {
            const i1 = indices[i];
            const i2 = indices[(i + 1) % indices.length];
            // Sort indices for unique edge key
            const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
            // For hidden line removal, we only draw edges that belong to AT LEAST ONE visible face.
            // We draw them once.
            if (!edgeSet.has(key)) {
                edgeSet.add(key);
                edges.push([corners[i1], corners[i2]]);
            }
        }
    });


    return edges;
};

export const generateMipmaps = (canvas: HTMLCanvasElement): { small?: HTMLCanvasElement, medium?: HTMLCanvasElement } => {
    const mipmaps: { small?: HTMLCanvasElement, medium?: HTMLCanvasElement } = {};
    const { width, height } = canvas;

    // Only generate mipmaps for somewhat large images to save memory
    if (width > 1024 || height > 1024) {
        // Medium: 50% scale
        const mediumCanvas = document.createElement('canvas');
        mediumCanvas.width = Math.floor(width * 0.5);
        mediumCanvas.height = Math.floor(height * 0.5);
        const mediumCtx = mediumCanvas.getContext('2d');
        if (mediumCtx) {
            mediumCtx.drawImage(canvas, 0, 0, mediumCanvas.width, mediumCanvas.height);
            mipmaps.medium = mediumCanvas;
        }

        // Small: 25% scale (if very large)
        if (width > 2048 || height > 2048) {
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = Math.floor(width * 0.25);
            smallCanvas.height = Math.floor(height * 0.25);
            const smallCtx = smallCanvas.getContext('2d');
            if (smallCtx) {
                smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                mipmaps.small = smallCanvas;
            }
        }
    }

    return mipmaps;
};

export const cropCanvas = (source: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
        ctx.drawImage(
            source,
            rect.x, rect.y, rect.width, rect.height,
            0, 0, rect.width, rect.height
        );
    }
    return canvas;
};