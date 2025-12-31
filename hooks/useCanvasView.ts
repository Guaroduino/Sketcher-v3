import React, { useState, useCallback, useEffect } from 'react';
import type { CropRect } from '../types';

export type ViewTransform = { zoom: number, pan: { x: number, y: number } };

export const MAX_ZOOM = 3;

export function useCanvasView(
    mainAreaRef: React.RefObject<HTMLDivElement>,
    canvasSize: { width: number, height: number },
    contentRect?: CropRect
) {
    const [viewTransform, setViewTransform] = useState<ViewTransform>({ zoom: window.innerWidth < 640 ? 0.6 : 1, pan: { x: 0, y: 0 } });

    const getMinZoom = useCallback(() => {
        // Return a fixed small value to allow "unlimited" zoom out
        return 0.05;
    }, []);

    useEffect(() => {
        let timeoutId: number;

        const updateSizeAndCenter = () => {
            if (mainAreaRef.current) {
                const viewWidth = mainAreaRef.current.offsetWidth;
                const viewHeight = mainAreaRef.current.offsetHeight;

                setViewTransform(v => {
                    const newPanX = (viewWidth - canvasSize.width * v.zoom) / 2;
                    const newPanY = (viewHeight - canvasSize.height * v.zoom) / 2;
                    return { zoom: v.zoom, pan: { x: newPanX, y: newPanY } };
                });
            }
        };

        const debouncedUpdate = () => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(updateSizeAndCenter, 100);
        };

        window.addEventListener('resize', debouncedUpdate);
        // Initial call
        updateSizeAndCenter();

        return () => {
            window.removeEventListener('resize', debouncedUpdate);
            window.clearTimeout(timeoutId);
        };
    }, [canvasSize.width, canvasSize.height, mainAreaRef]);

    const calculateFitZoom = useCallback(() => {
        if (!mainAreaRef.current || !canvasSize.width || !canvasSize.height) {
            return 1;
        }
        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;
        const padding = 0.9;

        // Use contentRect if available, otherwise fallback to full canvas size
        const targetWidth = contentRect?.width || canvasSize.width;
        const targetHeight = contentRect?.height || canvasSize.height;

        const scaleX = viewWidth / targetWidth;
        const scaleY = viewHeight / targetHeight;
        return Math.min(scaleX, scaleY) * padding;
    }, [mainAreaRef, canvasSize.width, canvasSize.height, contentRect]);

    const handleZoomExtents = useCallback(() => {
        if (!mainAreaRef.current || canvasSize.width === 0) return;

        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;

        const newZoom = calculateFitZoom();

        // If contentRect is available, we center on it. 
        // Otherwise we center on the full canvas.
        const targetX = contentRect ? contentRect.x : 0;
        const targetY = contentRect ? contentRect.y : 0;
        const targetWidth = contentRect ? contentRect.width : canvasSize.width;
        const targetHeight = contentRect ? contentRect.height : canvasSize.height;

        const newPanX = (viewWidth - targetWidth * newZoom) / 2 - targetX * newZoom;
        const newPanY = (viewHeight - targetHeight * newZoom) / 2 - targetY * newZoom;

        setViewTransform({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    }, [canvasSize.width, canvasSize.height, mainAreaRef, calculateFitZoom, contentRect]);

    const handleZoom = useCallback((zoomFactor: number) => {
        if (!mainAreaRef.current) return;

        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;
        const pointerViewX = viewWidth / 2;
        const pointerViewY = viewHeight / 2;

        setViewTransform(currentTransform => {
            const minZoom = getMinZoom();
            let newZoom = Math.max(minZoom, Math.min(currentTransform.zoom * zoomFactor, MAX_ZOOM));

            // Snap to 100% if close
            if (newZoom > 0.95 && newZoom < 1.05) {
                newZoom = 1;
            }
            const pointerCanvasX = (pointerViewX - currentTransform.pan.x) / currentTransform.zoom;
            const pointerCanvasY = (pointerViewY - currentTransform.pan.y) / currentTransform.zoom;
            const newPanX = pointerViewX - pointerCanvasX * newZoom;
            const newPanY = pointerViewY - pointerCanvasY * newZoom;
            return { zoom: newZoom, pan: { x: newPanX, y: newPanY } };
        });
    }, [mainAreaRef, getMinZoom]);

    return {
        viewTransform,
        setViewTransform,
        onZoomExtents: handleZoomExtents,
        onZoomIn: () => handleZoom(1.2),
        onZoomOut: () => handleZoom(1 / 1.2),
        getMinZoom,
    };
}