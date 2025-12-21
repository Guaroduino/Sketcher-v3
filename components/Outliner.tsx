import React, { useState, useRef, useEffect } from 'react';
import type { CanvasItem, ItemType } from '../types';
import { LayersIcon, PlusIcon, TrashIcon, EyeOpenIcon, EyeClosedIcon, UploadIcon, FolderIcon, MergeIcon, ExportIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, MergeUpIcon, MoreVerticalIcon, AddAboveIcon, AddBelowIcon } from './icons';

type DragPosition = 'top' | 'bottom' | 'middle';

interface OutlinerProps {
  items: CanvasItem[];
  activeItemId: string | null;
  onAddItem: (type: 'group' | 'object') => void;
  onCopyItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
  onMoveItem: (draggedId: string, targetId: string, position: DragPosition) => void;
  onMergeItems: (draggedId: string, targetId: string) => void;
  onUpdateBackground: (updates: { color?: string, file?: File }) => void;
  onRemoveBackgroundImage: () => void;
  onExportItem: () => void;
  onOpenCanvasSizeModal: () => void;
  activeItemState: { canMoveUp: boolean; canMoveDown: boolean; canMergeDown: boolean; canMergeUp: boolean; };
  onMoveItemUpDown: (id: string, direction: 'up' | 'down') => void;
  onMergeItemDown: (id: string) => void;
  onMergeItemUp: (id: string) => void;
  onAddObjectAbove: (id: string) => void;
  onAddObjectBelow: (id: string) => void;
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
  activeItemState,
  onMoveItemUpDown,
  onMergeItemDown,
  onMergeItemUp,
  onAddObjectAbove,
  onAddObjectBelow,
}) => {
  const [isAddMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ id: string; position: DragPosition } | null>(null);
  const backgroundObject = items.find(i => i.type === 'object' && i.isBackground);
  const hasBackgroundImage = !!(backgroundObject?.type === 'object' && backgroundObject.backgroundImage);

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
  
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: CanvasItem) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'copyMove';
        // Use JSON to pass rich data
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'outliner-item', id: item.id }));
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, item: CanvasItem) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        let position: DragPosition;
        
        const draggedItemType = e.dataTransfer.types.find(t => t === 'application/json');
        if (!draggedItemType) return;

        const isObjectDrop = true; // Assume any drop could be an object for merging

        if (item.type === 'group' || (item.type === 'object' && isObjectDrop)) {
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

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setDragOverInfo(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetItem: CanvasItem) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverInfo(null);
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type !== 'outliner-item' || !data.id) return;
            const draggedId = data.id;

            if (dragOverInfo && dragOverInfo.id === targetItem.id) {
                if (dragOverInfo.position === 'middle' && targetItem.type === 'object') {
                    onMergeItems(draggedId, targetItem.id);
                } else {
                    onMoveItem(draggedId, targetItem.id, dragOverInfo.position);
                }
            }
        } catch (error) {
            // Potentially a drop from another source, ignore for now.
        }
    };


  const renderItem = (item: CanvasItem, depth: number) => {
    if (item.type === 'object' && item.isBackground) return null;
    const isGroup = item.type === 'group';
    const isObject = item.type === 'object';
    const isActive = activeItemId === item.id;
    
    const isDragOver = dragOverInfo?.id === item.id;
    const dragOverPosition = dragOverInfo?.position;
    const isMergeTarget = isObject && isDragOver && dragOverPosition === 'middle';

    const getBgColor = () => {
        if (isDragOver && dragOverPosition === 'middle' && isObject) return 'bg-red-700';
        if (isActive) return 'bg-theme-accent-hover';
        return 'bg-theme-bg-secondary hover:bg-theme-bg-tertiary';
    }

    return (
      <div
        key={item.id}
        draggable={!(item.type === 'object' && item.isBackground)}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragOver={(e) => handleDragOver(e, item)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, item)}
        onClick={() => onSelectItem(item.id)}
        className={`group relative p-2 rounded-lg transition-colors duration-100 ${getBgColor()}`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        {isDragOver && dragOverPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-theme-accent-primary z-10" />}
        {isDragOver && dragOverPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent-primary z-10" />}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-grow min-w-0">
             <span className="flex-shrink-0 cursor-grab text-theme-text-secondary hover:text-theme-text-primary mr-2">
                <MoreVerticalIcon className="w-5 h-5"/>
            </span>
            {isGroup && <FolderIcon className="w-4 h-4 mr-2 text-red-400 flex-shrink-0" />}
            {isMergeTarget && <MergeIcon className="w-4 h-4 mr-2 text-red-400" />}
            <input
              type="text"
              value={item.name}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
              className="bg-transparent text-sm w-full outline-none pointer-events-auto truncate"
            />
          </div>
          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
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
            {!(item.type === 'object' && item.isBackground) && (
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                }}
                className="p-1 text-theme-text-secondary hover:text-red-500"
                >
                <TrashIcon className="w-4 h-4" />
                </button>
            )}
          </div>
        </div>
        {isActive && (item.type === 'object') && (
            <div className="mt-2 space-y-2">
                <div>
                    <label htmlFor={`opacity-${item.id}`} className="text-xs text-theme-text-secondary">Opacidad</label>
                    <input
                        id={`opacity-${item.id}`}
                        type="range"
                        min="0"
                        max="100"
                        value={item.opacity * 100}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateItem(item.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                        className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                 <div className="flex items-center flex-wrap gap-1 border-t border-theme-bg-tertiary pt-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveItemUpDown(item.id, 'up'); }}
                        disabled={!activeItemState.canMoveUp}
                        className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed" title="Mover arriba">
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveItemUpDown(item.id, 'down'); }}
                        disabled={!activeItemState.canMoveDown}
                        className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed" title="Mover abajo">
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                    </button>
                    {isObject && (
                        <>
                            <div className="w-px h-3.5 bg-theme-bg-tertiary mx-0.5" />

                            <button
                                onClick={(e) => { e.stopPropagation(); onAddObjectAbove(item.id); }}
                                className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover" title="Añadir objeto arriba">
                                <AddAboveIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddObjectBelow(item.id); }}
                                className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover" title="Añadir objeto abajo">
                                <AddBelowIcon className="w-3.5 h-3.5" />
                            </button>

                            <div className="w-px h-3.5 bg-theme-bg-tertiary mx-0.5" />

                            <button
                                onClick={(e) => { e.stopPropagation(); onMergeItemUp(item.id); }}
                                disabled={!activeItemState.canMergeUp}
                                className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed" title="Combinar arriba">
                                <MergeUpIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMergeItemDown(item.id); }}
                                disabled={!activeItemState.canMergeDown}
                                className="p-1 rounded bg-theme-bg-tertiary hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed" title="Combinar abajo">
                                <MergeIcon className="w-3.5 h-3.5" />
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
      .filter(item => item.parentId === parentId && !(item.type === 'object' && item.isBackground))
      .reverse()
      .flatMap(item => [
        renderItem(item, depth),
        ...(item.type === 'group' ? renderTree(item.id, depth + 1) : [])
      ]);
  };

  return (
    <div className="bg-theme-bg-primary text-theme-text-primary p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <LayersIcon className="w-5 h-5 mr-2 text-theme-text-secondary" />
          <h3 className="text-sm font-bold uppercase text-theme-text-secondary">Outliner</h3>
        </div>
        <div className="flex items-center space-x-1">
           <button
            onClick={onExportItem}
            disabled={!activeItemId || !!items.find(i => i.id === activeItemId && i.type === 'object' && i.isBackground)}
            className="p-2 rounded-md hover:bg-theme-bg-tertiary disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="Exportar objeto seleccionado"
          >
            <ExportIcon className="w-5 h-5" />
          </button>
           <button
            onClick={() => activeItemId && onCopyItem(activeItemId)}
            disabled={!activeItemId || !!items.find(i => i.id === activeItemId && i.type === 'object' && i.isBackground)}
            className="p-2 rounded-md hover:bg-theme-bg-tertiary disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="Duplicar objeto seleccionado"
          >
            <CopyIcon className="w-5 h-5" />
          </button>
          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setAddMenuOpen(!isAddMenuOpen)} className="p-2 rounded-md hover:bg-theme-bg-tertiary">
              <PlusIcon className="w-5 h-5" />
            </button>
            {isAddMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-theme-bg-tertiary rounded-md shadow-lg z-10">
                <button onClick={() => { onAddItem('group'); setAddMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary hover:bg-theme-bg-hover">Nueva Carpeta</button>
                <button onClick={() => { onAddItem('object'); setAddMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary hover:bg-theme-bg-hover">Nuevo Objeto</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto space-y-2 pr-2">
        {renderTree()}
      </div>

      {/* Canvas Controls */}
      <div className="flex-shrink-0 border-t border-theme-bg-tertiary mt-4 pt-4">
        <h3 className="text-sm font-bold uppercase text-theme-text-secondary mb-3">Canvas</h3>
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                 <input
                    type="color"
                    id="canvas-color"
                    value={(backgroundObject?.type === 'object' && backgroundObject.color) || '#FFFFFF'}
                    onChange={(e) => onUpdateBackground({ color: e.target.value })}
                    className="w-10 h-10 p-0.5 bg-theme-bg-tertiary border border-theme-bg-hover rounded-md cursor-pointer flex-shrink-0"
                    title="Color de fondo"
                />
                <button
                    onDoubleClick={onOpenCanvasSizeModal}
                    className="h-10 px-3 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover cursor-pointer text-theme-text-secondary text-sm flex-grow"
                    title="Tamaño del lienzo (doble clic)"
                >
                    Personalizado
                </button>
                {backgroundObject && (
                  <button
                      onClick={() => onUpdateItem(backgroundObject.id, { isVisible: !backgroundObject.isVisible })}
                      className="h-10 w-10 flex-shrink-0 p-2 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover cursor-pointer text-theme-text-secondary"
                      title={backgroundObject.isVisible ? "Ocultar fondo" : "Mostrar fondo"}
                  >
                      {backgroundObject.isVisible ? <EyeOpenIcon className="w-5 h-5" /> : <EyeClosedIcon className="w-5 h-5" />}
                  </button>
                )}
                <label htmlFor="canvas-image-upload" className="h-10 w-10 flex items-center justify-center p-2 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover cursor-pointer text-theme-text-secondary flex-shrink-0" title="Importar imagen de fondo">
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