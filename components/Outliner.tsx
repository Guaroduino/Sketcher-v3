import React, { useState, useRef, useEffect } from 'react';
import type { SketchObject, ItemType } from '../types';
import { LayersIcon, PlusIcon, TrashIcon, EyeOpenIcon, EyeClosedIcon, UploadIcon, FolderIcon, MergeIcon, DragHandleIcon, ExportIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, MergeUpIcon } from './icons';
import type { DragState } from '../App';

type DragPosition = 'top' | 'bottom' | 'middle';

interface OutlinerProps {
  items: SketchObject[];
  activeItemId: string | null;
  onAddItem: (type: ItemType) => void;
  onCopyItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<SketchObject>) => void;
  onMoveItem: (draggedId: string, targetId: string, position: DragPosition) => void;
  onMergeItems: (draggedId: string, targetId: string) => void;
  onUpdateBackground: (updates: { color?: string, file?: File }) => void;
  onRemoveBackgroundImage: () => void;
  onExportItem: () => void;
  onOpenCanvasSizeModal: () => void;
  dragState: DragState | null;
  onStartDrag: (dragInfo: Omit<DragState, 'isDragging'>) => void;
  onEndDrag: () => void;
  activeItemState: { canMoveUp: boolean; canMoveDown: boolean; canMergeDown: boolean; canMergeUp: boolean; };
  onMoveItemUpDown: (id: string, direction: 'up' | 'down') => void;
  onMergeItemDown: (id: string) => void;
  onMergeItemUp: (id: string) => void;
}

export const Outliner: React.FC<OutlinerProps> = ({
  items,
  activeItemId,
  onAddItem,
  onCopyItem,
  onDeleteItem,
  onSelectItem,
  onUpdateItem,
  onMoveItem,
  onMergeItems,
  onUpdateBackground,
  onRemoveBackgroundImage,
  onExportItem,
  onOpenCanvasSizeModal,
  dragState,
  onStartDrag,
  onEndDrag,
  activeItemState,
  onMoveItemUpDown,
  onMergeItemDown,
  onMergeItemUp,
}) => {
  const [isAddMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ id: string; position: DragPosition } | null>(null);
  const backgroundObject = items.find(i => i.isBackground);
  const hasBackgroundImage = !!backgroundObject?.backgroundImage;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpdateBackground({ file: e.target.files[0] });
      e.target.value = ''; // Reset
    }
  };
  
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, item: SketchObject) => {
    if (item.isBackground) return;
    // Don't start drag on interactive elements like inputs or buttons
    if ((e.target as HTMLElement).closest('button, input')) {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    onStartDrag({
        type: 'outliner',
        id: item.id,
        name: item.name,
        pointerStart: { x: e.clientX, y: e.clientY },
        pointerCurrent: { x: e.clientX, y: e.clientY },
    });
  };

  const handlePointerOver = (e: React.PointerEvent<HTMLDivElement>, item: SketchObject) => {
    if (!dragState || !dragState.isDragging || item.id === dragState.id) return;
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    let position: DragPosition;
    
    const draggedItem = items.find(i => i.id === dragState.id);
    if (!draggedItem) return;

    if (item.type === 'group' || (item.type === 'object' && draggedItem.type === 'object')) {
      const dropInsideThreshold = height * 0.25;
      if (y < dropInsideThreshold) {
        position = 'top';
      } else if (y > height - dropInsideThreshold) {
        position = 'bottom';
      } else {
        position = 'middle';
      }
    } else {
      position = y < height / 2 ? 'top' : 'bottom';
    }
    
    setDragOverInfo({ id: item.id, position });
  };
  
  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragOverInfo(null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (dragState && dragOverInfo && dragState.isDragging) {
      if (dragOverInfo.position === 'middle' && items.find(i => i.id === dragOverInfo.id)?.type === 'object') {
          onMergeItems(dragState.id, dragOverInfo.id);
      } else {
          onMoveItem(dragState.id, dragOverInfo.id, dragOverInfo.position);
      }
    }
    setDragOverInfo(null);
    // Defer ending the drag so the onClick handler can check if a drag occurred
    setTimeout(() => onEndDrag(), 0);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, item: SketchObject) => {
    // If a drag operation was just completed, don't process this as a click.
    // The dragState is still available because onEndDrag is deferred.
    if (dragState && dragState.isDragging) {
      return;
    }
    onSelectItem(item.id);
  };


  const renderItem = (item: SketchObject, depth: number) => {
    if (item.isBackground) return null;
    const isGroup = item.type === 'group';
    const isObject = item.type === 'object';
    const isActive = activeItemId === item.id;
    
    const isDragOver = dragOverInfo?.id === item.id;
    const dragOverPosition = dragOverInfo?.position;
    const isMergeTarget = isObject && isDragOver && dragOverPosition === 'middle';

    const getBgColor = () => {
        if (isDragOver && dragOverPosition === 'middle') return 'bg-red-700';
        if (isActive) return 'bg-[--accent-hover]';
        return 'bg-[--bg-secondary] hover:bg-[--bg-tertiary]';
    }

    return (
      <div
        key={item.id}
        onClick={(e) => handleClick(e, item)}
        onPointerDown={(e) => handlePointerDown(e, item)}
        onPointerOver={(e) => handlePointerOver(e, item)}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
        onDragStart={(e) => e.preventDefault()}
        className={`group relative p-2 rounded-lg transition-colors duration-100 ${getBgColor()}`}
        style={{ marginLeft: `${depth * 16}px`, cursor: item.isBackground ? 'default' : 'grab', touchAction: 'none', userSelect: 'none' }}
      >
        {isDragOver && dragOverPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[--accent-primary] z-10" />}
        {isDragOver && dragOverPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[--accent-primary] z-10" />}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-grow">
            {!item.isBackground && <DragHandleIcon className="w-4 h-4 mr-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            {isGroup && <FolderIcon className="w-4 h-4 mr-2 text-red-400" />}
            {isMergeTarget && <MergeIcon className="w-4 h-4 mr-2 text-red-400" />}
            <input
              type="text"
              value={item.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
              className="bg-transparent text-sm w-full outline-none pointer-events-auto"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateItem(item.id, { isVisible: !item.isVisible });
              }}
              className="p-1"
            >
              {item.isVisible ? (
                <EyeOpenIcon className="w-4 h-4" />
              ) : (
                <EyeClosedIcon className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {!item.isBackground && (
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                }}
                className="p-1 text-[--text-secondary] hover:text-red-500"
                >
                <TrashIcon className="w-4 h-4" />
                </button>
            )}
          </div>
        </div>
        {isActive && isObject && (
            <div className="mt-2 space-y-2">
                <div>
                    <label htmlFor={`opacity-${item.id}`} className="text-xs text-[--text-secondary]">Opacidad</label>
                    <input
                        id={`opacity-${item.id}`}
                        type="range"
                        min="0"
                        max="100"
                        value={item.opacity * 100}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateItem(item.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                        className="w-full h-1 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                 <div className="flex items-center gap-2 border-t border-[--bg-tertiary] pt-2">
                    <span className="text-xs text-[--text-secondary]">Acciones:</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveItemUpDown(item.id, 'up'); }}
                        disabled={!activeItemState.canMoveUp}
                        className="p-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Move Up">
                        <ArrowUpIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveItemUpDown(item.id, 'down'); }}
                        disabled={!activeItemState.canMoveDown}
                        className="p-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Move Down">
                        <ArrowDownIcon className="w-4 h-4" />
                    </button>
                    {isObject && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMergeItemUp(item.id); }}
                                disabled={!activeItemState.canMergeUp}
                                className="p-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Merge Up">
                                <MergeUpIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMergeItemDown(item.id); }}
                                disabled={!activeItemState.canMergeDown}
                                className="p-1 rounded bg-[--bg-tertiary] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed" title="Merge Down">
                                <MergeIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>
         )}
      </div>
    );
  };
  
  const renderTree = (parentId: string | null = null, depth = 0) => {
    return items
      .filter(item => item.parentId === parentId && !item.isBackground)
      .reverse()
      .flatMap(item => [
        renderItem(item, depth),
        ...renderTree(item.id, depth + 1)
      ]);
  };

  return (
    <div className="bg-[--bg-primary] text-[--text-primary] p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <LayersIcon className="w-5 h-5 mr-2 text-[--text-secondary]" />
          <h3 className="text-sm font-bold uppercase text-[--text-secondary]">Outliner</h3>
        </div>
        <div className="flex items-center space-x-1">
           <button
            onClick={onExportItem}
            disabled={!activeItemId || !!items.find(i => i.id === activeItemId)?.isBackground}
            className="p-2 rounded-md hover:bg-[--bg-tertiary] disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="Exportar objeto seleccionado"
          >
            <ExportIcon className="w-5 h-5" />
          </button>
           <button
            onClick={() => activeItemId && onCopyItem(activeItemId)}
            disabled={!activeItemId || !!items.find(i => i.id === activeItemId)?.isBackground}
            className="p-2 rounded-md hover:bg-[--bg-tertiary] disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="Duplicar objeto seleccionado"
          >
            <CopyIcon className="w-5 h-5" />
          </button>
          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setAddMenuOpen(!isAddMenuOpen)} className="p-2 rounded-md hover:bg-[--bg-tertiary]">
              <PlusIcon className="w-5 h-5" />
            </button>
            {isAddMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-[--bg-tertiary] rounded-md shadow-lg z-10">
                <button onClick={() => { onAddItem('group'); setAddMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-[--text-primary] hover:bg-[--bg-hover]">Nueva Carpeta</button>
                <button onClick={() => { onAddItem('object'); setAddMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-[--text-primary] hover:bg-[--bg-hover]">Nuevo Objeto</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto space-y-2 pr-2">
        {renderTree()}
      </div>

      {/* Canvas Controls */}
      <div className="flex-shrink-0 border-t border-[--bg-tertiary] mt-4 pt-4">
        <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-3">Canvas</h3>
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                 <input
                    type="color"
                    id="canvas-color"
                    value={backgroundObject?.color || '#FFFFFF'}
                    onChange={(e) => onUpdateBackground({ color: e.target.value })}
                    className="w-10 h-10 p-0.5 bg-[--bg-tertiary] border border-[--bg-hover] rounded-md cursor-pointer flex-shrink-0"
                    title="Color de fondo"
                />
                <button
                    onDoubleClick={onOpenCanvasSizeModal}
                    className="h-10 px-3 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary] text-sm flex-grow"
                    title="Tamaño del lienzo (doble clic)"
                >
                    Personalizado
                </button>
                {backgroundObject && (
                  <button
                      onClick={() => onUpdateItem(backgroundObject.id, { isVisible: !backgroundObject.isVisible })}
                      className="h-10 w-10 flex-shrink-0 p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary]"
                      title={backgroundObject.isVisible ? "Ocultar fondo" : "Mostrar fondo"}
                  >
                      {backgroundObject.isVisible ? <EyeOpenIcon className="w-5 h-5" /> : <EyeClosedIcon className="w-5 h-5" />}
                  </button>
                )}
                <label htmlFor="canvas-image-upload" className="h-10 w-10 flex items-center justify-center p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary] flex-shrink-0" title="Importar imagen de fondo">
                    <UploadIcon className="w-5 h-5" />
                </label>
                <input
                    id="canvas-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
                 {hasBackgroundImage && (
                    <button
                        onClick={onRemoveBackgroundImage}
                        className="h-10 w-10 flex-shrink-0 p-2 rounded-lg bg-red-800 hover:bg-red-700 cursor-pointer text-gray-200"
                        title="Eliminar imagen de fondo"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};