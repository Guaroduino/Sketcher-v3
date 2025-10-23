import React, { useState, useCallback, useEffect } from 'react';

export type ViewTransform = { zoom: number, pan: { x: number, y: number } };

export const MAX_ZOOM = 3;

export function useCanvasView(
    mainAreaRef: React.RefObject<HTMLDivElement>,
    canvasSize: { width: number, height: number }
) {
    const [viewTransform, setViewTransform] = useState<ViewTransform>({ zoom: 1, pan: { x: 0, y: 0 } });
    
    const getMinZoom = useCallback(() => {
        if (!mainAreaRef.current || !canvasSize.width || !canvasSize.height) {
            return 0.01;
        }
        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;
        const padding = 0.9;
        const scaleX = viewWidth / canvasSize.width;
        const scaleY = viewHeight / canvasSize.height;
        return Math.max(0.01, Math.min(scaleX, scaleY) * padding);
    }, [mainAreaRef, canvasSize.width, canvasSize.height]);
    
    useEffect(() => {
        const updateSizeAndCenter = () => {
          if (mainAreaRef.current) {
            const viewWidth = mainAreaRef.current.offsetWidth;
            const viewHeight = mainAreaRef.current.offsetHeight;
            
            setViewTransform(v => {
                const newPanX = (viewWidth - canvasSize.width * v.zoom) / 2;
                const newPanY = (viewHeight - canvasSize.height * v.zoom) / 2;
                return {...v, pan: {x: newPanX, y: newPanY}};
            });
          }
        };
        window.addEventListener('resize', updateSizeAndCenter);
        updateSizeAndCenter();
        return () => window.removeEventListener('resize', updateSizeAndCenter);
    }, [canvasSize.width, canvasSize.height, mainAreaRef]);

    const handleZoomExtents = useCallback(() => {
        if (!mainAreaRef.current || canvasSize.width === 0) return;

        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;

        const newZoom = getMinZoom();

        const newPanX = (viewWidth - canvasSize.width * newZoom) / 2;
        const newPanY = (viewHeight - canvasSize.height * newZoom) / 2;

        setViewTransform({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    }, [canvasSize.width, canvasSize.height, mainAreaRef, getMinZoom]);

    const handleZoom = useCallback((zoomFactor: number) => {
        if (!mainAreaRef.current) return;

        const viewWidth = mainAreaRef.current.offsetWidth;
        const viewHeight = mainAreaRef.current.offsetHeight;
        const pointerViewX = viewWidth / 2;
        const pointerViewY = viewHeight / 2;

        setViewTransform(currentTransform => {
            const minZoom = getMinZoom();
            const newZoom = Math.max(minZoom, Math.min(currentTransform.zoom * zoomFactor, MAX_ZOOM));
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