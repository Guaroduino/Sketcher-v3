import React from 'react';
import type { Tool, LibraryItem, SketchObject } from '../types';
import type { DragState } from '../App';

export function useCanvasModes(
    tool: Tool,
    setTool: (tool: Tool) => void,
    dispatch: React.Dispatch<any>,
    libraryItems: LibraryItem[],
    canvasSize: { width: number, height: number }
) {
    const onDropOnCanvas = (draggedItem: DragState, activeItemId: string | null, setSelectedItemIds: (ids: string[]) => void) => {
        if (draggedItem.type !== 'library') return;

        const libraryItem = libraryItems.find(item => item.id === draggedItem.id);
        if (!libraryItem || !libraryItem.dataUrl) return;

        const newItemId = `object-${Date.now()}`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            dispatch({ 
                type: 'ADD_ITEM', 
                payload: { 
                    type: 'object', 
                    activeItemId, 
                    newItemId,
                    imageElement: img,
                    canvasSize,
                    name: libraryItem.name,
                } 
            });
            setSelectedItemIds([newItemId]);
            setTool('transform');
        };
        img.src = libraryItem.dataUrl;
    };

    return {
        onDropOnCanvas,
    };
}
