import React from 'react';
// FIX: Import SketchObject for completeness, though not directly used, it's part of CanvasItem.
import type { Tool, LibraryItem, SketchObject, CanvasItem } from '../types';

// FIX: Removed invalid import of DragState from App.tsx and defined DragState locally.
type DragState = { type: 'library-item', id: string };

export function useCanvasModes(
    tool: Tool,
    setTool: (tool: Tool) => void,
    dispatch: React.Dispatch<any>,
    libraryItems: LibraryItem[],
    canvasSize: { width: number, height: number },
    globalScaleFactor: number,
) {
    const onDropOnCanvas = (draggedItem: DragState, activeItemId: string | null, setSelectedItemIds: (ids: string[]) => void) => {
        // FIX: The type of dragged item is 'library-item', not 'library'.
        if (draggedItem.type !== 'library-item') return;

        const libraryItem = libraryItems.find(item => item.id === draggedItem.id);
        // FIX: Add type guard to ensure library item is an image and has a dataUrl before proceeding.
        if (!libraryItem || libraryItem.type !== 'image' || !libraryItem.dataUrl) return;

        const newItemId = `object-${Date.now()}`;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const initialDimensions = { width: 0, height: 0 };

            if (libraryItem.scaleFactor) {
                // Use defined scale factor if available (legacy/metric behavior)
                const scale = globalScaleFactor / libraryItem.scaleFactor;
                initialDimensions.width = img.width * scale;
                initialDimensions.height = img.height * scale;
            } else {
                // Fallback: Scale to ~50% of canvas width or height, whichever is smaller
                const targetWidth = canvasSize.width * 0.5;
                const targetHeight = canvasSize.height * 0.5;
                const scaleX = targetWidth / img.width;
                const scaleY = targetHeight / img.height;
                const scale = Math.min(scaleX, scaleY);

                initialDimensions.width = img.width * scale;
                initialDimensions.height = img.height * scale;
            }

            dispatch({
                type: 'ADD_ITEM',
                payload: {
                    type: 'object',
                    activeItemId,
                    newItemId,
                    imageElement: img,
                    canvasSize,
                    name: libraryItem.name,
                    initialDimensions,
                }
            });
            setSelectedItemIds([newItemId]);
            setTool('transform');
        };
        // FIX: The type guard above ensures dataUrl is available here.
        img.src = libraryItem.dataUrl;
    };

    return {
        onDropOnCanvas,
    };
}