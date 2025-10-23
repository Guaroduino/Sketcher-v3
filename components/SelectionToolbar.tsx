import React from 'react';
import { CutIcon, CopyIcon, TrashIcon, XIcon } from './icons';
import type { Selection, ViewTransform } from '../types';

interface SelectionToolbarProps {
    selection: Selection;
    viewTransform: ViewTransform;
    onCut: () => void;
    onCopy: () => void;
    onDelete: () => void;
    onDeselect: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    selection,
    viewTransform,
    onCut,
    onCopy,
    onDelete,
    onDeselect
}) => {
    if (!selection) return null;

    const { x, y, width } = selection.boundingBox;
    
    const toolbarCanvasY = y - 10;
    const toolbarCanvasX = x + width / 2;

    const viewX = toolbarCanvasX * viewTransform.zoom + viewTransform.pan.x;
    const viewY = toolbarCanvasY * viewTransform.zoom + viewTransform.pan.y;

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${viewY}px`,
        left: `${viewX}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 20,
    };

    return (
        <div 
            style={style} 
            className="bg-[--bg-primary]/80 backdrop-blur-sm rounded-lg p-1 flex items-center gap-1 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button onClick={onCopy} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Copiar">
                <CopyIcon className="w-5 h-5" />
            </button>
            <button onClick={onCut} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Cortar">
                <CutIcon className="w-5 h-5" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] hover:bg-[--bg-hover]" title="Eliminar">
                <TrashIcon className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-[--bg-hover] mx-1" />
            <button onClick={onDeselect} className="p-2 rounded-md bg-[--bg-tertiary] text-red-500 hover:bg-red-500 hover:text-white" title="Deseleccionar">
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    );
};
