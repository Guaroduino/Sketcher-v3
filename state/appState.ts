import type { AppState, SketchObject, ItemType, CropRect, TransformState, Point, WorkspaceTemplate, QuickAccessSettings } from '../types';
import { getHomographyMatrix, createNewCanvas } from '../utils/canvasUtils';
import { cloneCanvas } from '../utils/canvasUtils';

const MAX_HISTORY_SIZE = 50;

function drawWarpedImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLCanvasElement,
    dstQuad: { tl: Point; tr: Point; br: Point; bl: Point }
) {
    const srcImagePoints = [
        { x: 0, y: 0 },
        { x: image.width, y: 0 },
        { x: image.width, y: image.height },
        { x: 0, y: image.height }
    ];
    const dstPoints = [dstQuad.tl, dstQuad.tr, dstQuad.br, dstQuad.bl];

    // Get the matrix that maps destination points back to source points (inverse mapping)
    const h = getHomographyMatrix(dstPoints, srcImagePoints);
    if (!h) {
        console.error("Could not compute homography matrix for warping.");
        // Fallback to a simple, un-transformed draw at the top-left corner
        ctx.drawImage(image, dstQuad.tl.x, dstQuad.tl.y);
        return;
    }

    const minX = Math.floor(Math.min(dstQuad.tl.x, dstQuad.tr.x, dstQuad.br.x, dstQuad.bl.x));
    const minY = Math.floor(Math.min(dstQuad.tl.y, dstQuad.tr.y, dstQuad.br.y, dstQuad.bl.y));
    const maxX = Math.ceil(Math.max(dstQuad.tl.x, dstQuad.tr.x, dstQuad.br.x, dstQuad.bl.x));
    const maxY = Math.ceil(Math.max(dstQuad.tl.y, dstQuad.tr.y, dstQuad.br.y, dstQuad.bl.y));

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;

    if (bboxWidth <= 0 || bboxHeight <= 0) return;

    const sourceCtx = image.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) return;

    const sourceImageData = sourceCtx.getImageData(0, 0, image.width, image.height);
    const destImageData = ctx.createImageData(bboxWidth, bboxHeight);

    const srcData = sourceImageData.data;
    const destData = destImageData.data;
    const srcWidth = sourceImageData.width;
    const srcHeight = sourceImageData.height;

    for (let y = 0; y < bboxHeight; y++) {
        for (let x = 0; x < bboxWidth; x++) {
            const destX = minX + x;
            const destY = minY + y;

            // Apply inverse homography to find corresponding source pixel
            const w = h[6] * destX + h[7] * destY + h[8];
            const srcX = (h[0] * destX + h[1] * destY + h[2]) / w;
            const srcY = (h[3] * destX + h[4] * destY + h[5]) / w;

            // Perform bilinear interpolation if the source pixel is within bounds
            if (srcX >= 0 && srcX < srcWidth - 1 && srcY >= 0 && srcY < srcHeight - 1) {
                const x_floor = Math.floor(srcX);
                const y_floor = Math.floor(srcY);
                const x_frac = srcX - x_floor;
                const y_frac = srcY - y_floor;

                const idx_tl = (y_floor * srcWidth + x_floor) * 4;
                const idx_tr = (y_floor * srcWidth + (x_floor + 1)) * 4;
                const idx_bl = ((y_floor + 1) * srcWidth + x_floor) * 4;
                const idx_br = ((y_floor + 1) * srcWidth + (x_floor + 1)) * 4;

                const destIndex = (y * bboxWidth + x) * 4;

                for (let i = 0; i < 4; i++) { // R, G, B, A channels
                    const c_tl = srcData[idx_tl + i];
                    const c_tr = srcData[idx_tr + i];
                    const c_bl = srcData[idx_bl + i];
                    const c_br = srcData[idx_br + i];

                    const c_top = c_tl + (c_tr - c_tl) * x_frac;
                    const c_bottom = c_bl + (c_br - c_bl) * x_frac;
                    const final_c = c_top + (c_bottom - c_top) * y_frac;
                    
                    destData[destIndex + i] = final_c;
                }
            }
        }
    }
    ctx.putImageData(destImageData, minX, minY);
}


export const initialState: AppState = {
    objects: [
        {
            id: 'background',
            name: 'Background',
            type: 'object',
            isVisible: true,
            opacity: 1,
            parentId: null,
            isBackground: true,
            color: '#FFFFFF'
        },
        {
            id: `object-${Date.now()}`,
            name: 'Objeto 1',
            type: 'object',
            isVisible: true,
            opacity: 1,
            parentId: null,
        }
    ],
    canvasSize: { width: 0, height: 0 },
};

export type Action =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SNAPSHOT' }
  | { type: 'INITIALIZE_CANVASES'; payload: { width: number, height: number } }
  | { type: 'ADD_ITEM'; payload: { type: ItemType, activeItemId: string | null, canvasSize: { width: number, height: number }, newItemId?: string, imageElement?: HTMLImageElement, name?: string } }
  | { type: 'DELETE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_ITEM'; payload: { id: string, updates: Partial<SketchObject> } }
  | { type: 'MOVE_ITEM'; payload: { draggedId: string; targetId: string; position: 'top' | 'bottom' | 'middle' } }
  | { type: 'MERGE_ITEMS'; payload: { sourceId: string, targetId: string } }
  // FIX: Allow image property in UPDATE_BACKGROUND payload to handle AI-generated background replacements.
  | { type: 'UPDATE_BACKGROUND'; payload: { color?: string, image?: HTMLImageElement } }
  | { type: 'SET_CANVAS_FROM_IMAGE', payload: { image: HTMLImageElement } }
  | { type: 'REMOVE_BACKGROUND_IMAGE' }
  | { type: 'CLEAR_CANVAS' }
  | { type: 'CROP_CANVAS'; payload: { cropRect: CropRect } }
  | { type: 'COPY_ITEM'; payload: { id: string } }
  | { type: 'APPLY_TRANSFORM'; payload: { id: string, transform: TransformState, sourceBbox: CropRect } }
  | { type: 'RESIZE_CANVAS'; payload: { width: number, height: number } }
  | { type: 'LOAD_PROJECT_STATE'; payload: { newState: AppState } }
  | { type: 'COMMIT_DRAWING'; payload: { activeItemId: string; beforeCanvas: HTMLCanvasElement } };


function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'INITIALIZE_CANVASES': {
            const { width, height } = action.payload;
            const newObjects = state.objects.map(obj => {
                if (!obj.canvas) {
                    const { canvas, context } = createNewCanvas(width, height);
                    if (obj.isBackground) {
                        context.fillStyle = obj.color || '#FFFFFF';
                        context.fillRect(0, 0, width, height);
                    }
                    return { ...obj, canvas, context };
                }
                return obj;
            });
            return { ...state, objects: newObjects, canvasSize: { width, height } };
        }
        case 'ADD_ITEM': {
            const { type, activeItemId, canvasSize, newItemId, imageElement, name } = action.payload;
            const activeItem = activeItemId ? state.objects.find(i => i.id === activeItemId) : null;
            let parentId: string | null = null;
            if (activeItem) {
                parentId = activeItem.type === 'group' ? activeItem.id : activeItem.parentId;
            }

            const newObject: SketchObject = {
                id: newItemId ?? `${type}-${Date.now()}`,
                name: name ?? (type === 'group' ? `Carpeta ${state.objects.filter(i => i.type === 'group').length + 1}` : `Objeto ${state.objects.filter(i => i.type === 'object' && !i.isBackground).length + 1}`),
                type: type,
                isVisible: true,
                opacity: 1,
                parentId: parentId,
            };

            if (type === 'object') {
                const { canvas, context } = createNewCanvas(canvasSize.width, canvasSize.height);
                newObject.canvas = canvas;
                newObject.context = context;

                if (imageElement) {
                    context.drawImage(imageElement, 0, 0);
                }
            }
            
            const newItems = [...state.objects, newObject];
            return { ...state, objects: newItems };
        }
        case 'DELETE_ITEM': {
            const { id } = action.payload;
            const itemsToDelete = new Set<string>([id]);
            const findChildren = (parentId: string) => {
                state.objects.forEach(item => {
                    if(item.parentId === parentId) {
                        itemsToDelete.add(item.id);
                        if(item.type === 'group') {
                            findChildren(item.id);
                        }
                    }
                });
            };
            const itemToDelete = state.objects.find(i => i.id === id);
            if(itemToDelete && itemToDelete.type === 'group') {
                findChildren(id);
            }
            const newItems = state.objects.filter(i => !itemsToDelete.has(i.id));
            return { ...state, objects: newItems };
        }
        case 'UPDATE_ITEM': {
            const { id, updates } = action.payload;
            const newItems = state.objects.map(item => (item.id === id ? { ...item, ...updates } : item));
            return { ...state, objects: newItems };
        }
        case 'MOVE_ITEM': {
            const { draggedId, targetId, position } = action.payload;
            if (draggedId === targetId) return state;

            const isDescendant = (potentialParentId: string, potentialChildId: string): boolean => {
                const child = state.objects.find(item => item.id === potentialChildId);
                if (!child || !child.parentId) return false;
                if (child.parentId === potentialParentId) return true;
                return isDescendant(potentialParentId, child.parentId);
            };

            if (isDescendant(draggedId, targetId)) return state;
            
            const draggedItem = state.objects.find(item => item.id === draggedId);
            const targetItem = state.objects.find(item => item.id === targetId);
            if (!draggedItem || !targetItem) return state;

            const itemsWithoutDragged = state.objects.filter(item => item.id !== draggedId);
            
            let newParentId: string | null;
            let targetIndex: number;

            if (position === 'middle' && targetItem.type === 'group') {
                newParentId = targetItem.id;
                const childrenOfTarget = itemsWithoutDragged.filter(item => item.parentId === targetItem.id);
                if (childrenOfTarget.length > 0) {
                    const lastChild = childrenOfTarget[childrenOfTarget.length - 1];
                    targetIndex = itemsWithoutDragged.findIndex(item => item.id === lastChild.id) + 1;
                } else {
                    targetIndex = itemsWithoutDragged.findIndex(item => item.id === targetId) + 1;
                }
            } else {
                newParentId = targetItem.parentId;
                const originalTargetIndex = itemsWithoutDragged.findIndex(item => item.id === targetId);
                targetIndex = position === 'top' ? originalTargetIndex : originalTargetIndex + 1;
            }

            const updatedDraggedItem = { ...draggedItem, parentId: newParentId };
            
            const newItems = [...itemsWithoutDragged];
            newItems.splice(targetIndex, 0, updatedDraggedItem);

            return { ...state, objects: newItems };
        }
        case 'COPY_ITEM': {
            const { id } = action.payload;
            const itemIndex = state.objects.findIndex(i => i.id === id);
            if (itemIndex === -1) return state;

            const originalItem = state.objects[itemIndex];
            if (originalItem.isBackground) return state;

            const newItem: SketchObject = {
                ...originalItem,
                id: `${originalItem.type}-${Date.now()}`,
                name: `Copia de ${originalItem.name}`,
            };

            if (originalItem.canvas) {
                const { canvas, context } = createNewCanvas(originalItem.canvas.width, originalItem.canvas.height);
                context.drawImage(originalItem.canvas, 0, 0);
                newItem.canvas = canvas;
                newItem.context = context;
            }

            const newItems = [...state.objects];
            newItems.splice(itemIndex + 1, 0, newItem);

            return { ...state, objects: newItems };
        }
        case 'MERGE_ITEMS': {
            const { sourceId, targetId } = action.payload;
            const sourceItem = state.objects.find(i => i.id === sourceId);
            const targetItem = state.objects.find(i => i.id === targetId);

            if (sourceItem?.canvas && targetItem?.context) {
                targetItem.context.drawImage(sourceItem.canvas, 0, 0);
            }
            
            const newItems = state.objects.filter(i => i.id !== sourceId);
            return { ...state, objects: newItems };
        }
        case 'UPDATE_BACKGROUND': {
            // FIX: Handle both color and image updates for the background layer.
            const { color, image } = action.payload;
            const newObjects = state.objects.map(o => {
                if (o.isBackground && o.context) {
                    const updatedObject = { ...o };
                    if (color) {
                        updatedObject.color = color;
                        updatedObject.context.fillStyle = color;
                        updatedObject.context.fillRect(0, 0, o.context.canvas.width, o.context.canvas.height);
                        if (updatedObject.backgroundImage) {
                            updatedObject.context.drawImage(updatedObject.backgroundImage, 0, 0);
                        }
                    }
                    if (image) {
                        updatedObject.backgroundImage = image;
                        updatedObject.context.clearRect(0, 0, o.context.canvas.width, o.context.canvas.height);
                        updatedObject.context.drawImage(image, 0, 0, o.context.canvas.width, o.context.canvas.height);
                    }
                    return updatedObject;
                }
                return o;
            });
            return { ...state, objects: newObjects };
        }
        case 'SET_CANVAS_FROM_IMAGE': {
            const { image } = action.payload;
            const newCanvasSize = { width: image.width, height: image.height };

            const newObjects = state.objects.map(item => {
                const oldCanvas = item.canvas;
                const { canvas: newCanvas, context: newCtx } = createNewCanvas(newCanvasSize.width, newCanvasSize.height);

                if (item.isBackground) {
                    newCtx.drawImage(image, 0, 0);
                    // Reset background color to avoid confusion
                    return { ...item, canvas: newCanvas, context: newCtx, color: '#FFFFFF', backgroundImage: image };
                }
                
                if (oldCanvas) {
                    // Preserve existing content for other layers
                    newCtx.drawImage(oldCanvas, 0, 0);
                }

                return { ...item, canvas: newCanvas, context: newCtx };
            });

            return { ...state, objects: newObjects, canvasSize: newCanvasSize };
        }
        case 'REMOVE_BACKGROUND_IMAGE': {
            const newObjects = state.objects.map(o => {
                if (o.isBackground && o.context) {
                    o.context.fillStyle = o.color || '#FFFFFF';
                    o.context.fillRect(0, 0, o.context.canvas.width, o.context.canvas.height);
                    const { backgroundImage, ...rest } = o;
                    return { ...rest, color: o.color || '#FFFFFF' };
                }
                return o;
            });
            return { ...state, objects: newObjects };
        }
        case 'CLEAR_CANVAS': {
             const newInitialState = { ...initialState };
             if (state.canvasSize.width > 0) {
                 newInitialState.objects.forEach(obj => {
                     const { canvas, context } = createNewCanvas(state.canvasSize.width, state.canvasSize.height);
                     obj.canvas = canvas;
                     obj.context = context;
                     if (obj.isBackground) {
                         context.fillStyle = obj.color!;
                         context.fillRect(0,0, canvas.width, canvas.height);
                     }
                 });
                 newInitialState.canvasSize = state.canvasSize;
             }
             return newInitialState;
        }
        case 'CROP_CANVAS': {
            const { cropRect } = action.payload;
            const newCanvasSize = { width: Math.round(cropRect.width), height: Math.round(cropRect.height) };

            const newObjects = state.objects.map(item => {
                if (item.canvas) {
                    const { canvas: newCanvas, context: newCtx } = createNewCanvas(newCanvasSize.width, newCanvasSize.height);
                    newCtx.drawImage(
                        item.canvas,
                        cropRect.x, cropRect.y, cropRect.width, cropRect.height, // Source rect
                        0, 0, newCanvasSize.width, newCanvasSize.height           // Destination rect
                    );
                    return { ...item, canvas: newCanvas, context: newCtx };
                }
                return item;
            });
            
            return { ...state, objects: newObjects, canvasSize: newCanvasSize };
        }
        case 'RESIZE_CANVAS': {
            const { width, height } = action.payload;
            const newCanvasSize = { width: Math.round(width), height: Math.round(height) };

            const newObjects = state.objects.map(item => {
                if (item.canvas) {
                    const { canvas: newCanvas, context: newCtx } = createNewCanvas(newCanvasSize.width, newCanvasSize.height);
                    
                    if (item.isBackground) {
                         if (item.backgroundImage) {
                            newCtx.fillStyle = item.color || '#FFFFFF';
                            newCtx.fillRect(0, 0, newCanvasSize.width, newCanvasSize.height);
                            // Simple stretch for now
                            newCtx.drawImage(item.backgroundImage, 0, 0, newCanvasSize.width, newCanvasSize.height);
                        } else {
                            newCtx.fillStyle = item.color || '#FFFFFF';
                            newCtx.fillRect(0, 0, newCanvasSize.width, newCanvasSize.height);
                        }
                    } else {
                        // Center old content on new canvas
                        const dx = (newCanvasSize.width - item.canvas.width) / 2;
                        const dy = (newCanvasSize.height - item.canvas.height) / 2;
                        newCtx.drawImage(item.canvas, dx, dy);
                    }
                    return { ...item, canvas: newCanvas, context: newCtx };
                }
                return item;
            });
            return { ...state, objects: newObjects, canvasSize: newCanvasSize };
        }
        case 'APPLY_TRANSFORM': {
            const { id, transform, sourceBbox } = action.payload;
            const itemIndex = state.objects.findIndex(i => i.id === id);
            if (itemIndex === -1) return state;

            const item = state.objects[itemIndex];
            if (!item.canvas || !item.context) return state;

            // Create a temporary canvas containing only the content being transformed
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceBbox.width;
            tempCanvas.height = sourceBbox.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            if (!tempCtx) return state;

            tempCtx.drawImage(
                item.canvas,
                sourceBbox.x, sourceBbox.y, sourceBbox.width, sourceBbox.height,
                0, 0, sourceBbox.width, sourceBbox.height
            );

            // Create a new canvas that's a copy of the original
            const { canvas: newCanvas, context: newCtx } = createNewCanvas(item.canvas.width, item.canvas.height);
            newCtx.drawImage(item.canvas, 0, 0);

            // Erase the old content that is being replaced
            newCtx.save();
            newCtx.globalCompositeOperation = 'destination-out';
            newCtx.fillRect(sourceBbox.x, sourceBbox.y, sourceBbox.width, sourceBbox.height);
            newCtx.restore();

            // Draw the transformed content onto the new canvas
            if (transform.type === 'free') {
                const { corners } = transform;
                drawWarpedImage(newCtx, tempCanvas, corners);
            } else if (transform.type === 'affine') {
                newCtx.save();
                newCtx.translate(transform.x + transform.width / 2, transform.y + transform.height / 2);
                newCtx.rotate(transform.rotation);
                newCtx.scale(transform.width / sourceBbox.width, transform.height / sourceBbox.height);
                newCtx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
                newCtx.restore();
            }

            const updatedItem = { ...item, canvas: newCanvas, context: newCtx };
            
            const newObjects = [...state.objects];
            newObjects[itemIndex] = updatedItem;
            
            return { ...state, objects: newObjects };
        }
        case 'SNAPSHOT':
        case 'COMMIT_DRAWING': {
            // These actions are handled by the historyReducer, not the appReducer.
            // They don't change the state directly but are used as signals for history management.
            return { ...state };
        }
        default:
            return state;
    }
}

export interface HistoryState {
    past: AppState[];
    present: AppState;
    future: AppState[];
}

export const initialHistoryState: HistoryState = {
    past: [],
    present: initialState,
    future: [],
};


export function historyReducer(state: HistoryState, action: Action): HistoryState {
    const { past, present, future } = state;
    
    if (action.type === 'UNDO') {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        return {
            past: newPast,
            present: previous,
            future: [present, ...future],
        };
    }

    if (action.type === 'REDO') {
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return {
            past: [...past, present],
            present: next,
            future: newFuture,
        };
    }

    if (action.type === 'LOAD_PROJECT_STATE') {
        return {
            past: [],
            present: action.payload.newState,
            future: [],
        };
    }

    // Special, highly optimized handling for the most frequent history action.
    if (action.type === 'COMMIT_DRAWING') {
        const { activeItemId, beforeCanvas } = action.payload;
        
        // This is the state as it was *before* the drawing was committed.
        const stateForPast: AppState = {
            ...present, // Copy canvasSize etc.
            objects: present.objects.map(obj => {
                if (obj.id === activeItemId) {
                    // For the object that was drawn on, use the 'before' canvas state.
                    const context = beforeCanvas.getContext('2d', { willReadFrequently: true });
                    if (!context) throw new Error("Failed to get context for beforeCanvas");
                    return { ...obj, canvas: beforeCanvas, context: context };
                }
                // For all other objects, just carry over the reference.
                return obj;
            })
        };
        
        const newPast = [...past, stateForPast];
        if (newPast.length > MAX_HISTORY_SIZE) {
            newPast.shift();
        }

        // 'present' state was already mutated by the drawing operation.
        // To trigger a re-render, we create a new state object with a new objects array reference.
        return {
            past: newPast,
            present: { ...present, objects: [...present.objects] },
            future: [],
        };
    }

    // All other actions are processed by the appReducer to get the new state.
    const newPresent = appReducer(present, action);

    // If the reducer didn't make a change, do nothing.
    if (newPresent === present) {
        return state;
    }
    
    // The previous 'present' state becomes the newest 'past' state.
    // No deep cloning needed because appReducer should handle immutability for canvas-mutating actions.
    const newPast = [...past, present];
    if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
    }
    
    return {
        past: newPast,
        present: newPresent,
        future: [],
    };
}
