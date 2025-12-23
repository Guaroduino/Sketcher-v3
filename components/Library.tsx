import React, { useState, useRef, useMemo } from 'react';
import type { LibraryItem, LibraryImage } from '../types';
import { UploadIcon, CubeIcon, MagicWandIcon, TrashIcon, UserIcon, PlusIcon, FolderIcon, ChevronRightIcon, ArrowUpIcon, CheckIcon } from './icons';
import { User } from 'firebase/auth';

interface LibraryProps {
  user: User | null;
  items: LibraryItem[];
  onImportImage: (file: File, parentId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (item: LibraryItem) => void;
  onAddItemToScene: (id: string) => void;
  onMoveItems: (itemIds: string[], targetParentId: string | null) => void;
  onPublish: (item: LibraryImage) => void;
  allowUpload?: boolean;
  allowPublish?: boolean;
  className?: string; // For grid columns override
}

export const Library: React.FC<LibraryProps> = React.memo(({ user, items, onImportImage, onCreateFolder, onEditItem, onDeleteItem, onAddItemToScene, onMoveItems, onPublish, allowUpload = false, allowPublish = false, className }) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportImage(e.target.files[0], currentFolderId);
      e.target.value = ''; // Reset the input
    }
  };

  const handleDragStart = (e: React.DragEvent, item: LibraryItem) => {
    if (item.type === 'folder') {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'library-item', id: item.id }));
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), currentFolderId);
    }
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleToggleSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      return newSelection;
    });
  };

  const handleFolderNavigation = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const handleMove = () => {
    if (selectedItemIds.size === 0) return;
    onMoveItems(Array.from(selectedItemIds), currentFolderId);
    setSelectedItemIds(new Set());
  };

  const breadcrumbs = useMemo(() => {
    const path: LibraryItem[] = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = items.find(item => item.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break; // Should not happen
      }
    }
    return path;
  }, [currentFolderId, items]);

  const displayedItems = useMemo(() => {
    const children = items.filter(item => item.parentId === currentFolderId);
    // Sort folders first, then alphabetically
    return children.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, currentFolderId]);

  const handleItemDoubleClick = (item: LibraryItem) => {
    if (item.type === 'folder') {
      handleFolderNavigation(item.id);
    } else {
      onAddItemToScene(item.id);
    }
  };

  return (
    <div className="p-4 flex flex-col h-full bg-theme-bg-primary">
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase text-theme-text-secondary">Libreria</h3>
          {selectedItemIds.size > 0 && (
            <button onClick={handleMove} className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500">
              Mover {selectedItemIds.size} aquí
            </button>
          )}
        </div>

        {/* Controls - Moved to Top */}
        <div className="flex-shrink-0 mb-4 flex items-center gap-2">
          {allowUpload && (
            <>
              <label htmlFor="library-image-upload" className="flex-grow flex items-center justify-center p-2 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover cursor-pointer text-theme-text-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                <UploadIcon className="w-5 h-5 mr-2" />
                <span className="text-sm">Importar</span>
              </label>
              <input
                id="library-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={!user}
              />
              <button
                onClick={() => setIsCreatingFolder(true)}
                disabled={!user || isCreatingFolder}
                className="flex-shrink-0 flex items-center justify-center p-2 rounded-lg bg-theme-bg-tertiary hover:bg-theme-bg-hover cursor-pointer text-theme-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Crear nueva carpeta"
              >
                <FolderIcon className="w-5 h-5 mr-2" />
                <span className="text-sm">Nueva Carpeta</span>
              </button>
            </>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-theme-text-secondary flex-wrap">
          {currentFolderId !== null && (
            <button
              onClick={() => handleFolderNavigation(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null)}
              className="p-1 rounded-md hover:bg-theme-bg-tertiary mr-1"
              title="Subir un nivel"
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => handleFolderNavigation(null)} className="hover:text-theme-text-primary">Raíz</button>
          {breadcrumbs.map(folder => (
            <React.Fragment key={folder.id}>
              <ChevronRightIcon className="w-4 h-4 mx-1" />
              <button onClick={() => handleFolderNavigation(folder.id)} className="hover:text-theme-text-primary">{folder.name}</button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2">
        {!user ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-secondary p-4">
            <UserIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">Se requiere iniciar sesión</p>
            <p className="text-xs">Por favor, inicie sesión para acceder a su librería de activos en línea.</p>
          </div>
        ) : displayedItems.length === 0 && !isCreatingFolder ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-secondary p-4">
            <CubeIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">La carpeta está vacía</p>
            <p className="text-xs">Importe imágenes o cree una nueva carpeta.</p>
          </div>
        ) : (
          <div className={`grid gap-2 ${className || 'grid-cols-3'}`}>
            {isCreatingFolder && (
              <div className="aspect-square bg-theme-bg-secondary rounded-md flex flex-col items-center justify-center p-2">
                <FolderIcon className="w-10 h-10 text-theme-text-secondary mb-1" />
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={handleCreateFolder}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); } }}
                  placeholder="Nombre..."
                  className="w-full text-center bg-theme-bg-tertiary text-theme-text-primary rounded text-xs p-1"
                  autoFocus
                />
              </div>
            )}
            {displayedItems.map(item => (
              <div
                key={item.id}
                className={`group relative aspect-square bg-theme-bg-tertiary rounded-md overflow-hidden cursor-pointer border ${selectedItemIds.has(item.id) ? 'border-blue-500' : 'border-transparent'} hover:border-theme-text-secondary transition-colors`}
                onClick={() => handleToggleSelection(item.id)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                draggable={item.type === 'image'}
                onDragStart={(e) => handleDragStart(e, item)}
              >
                {item.type === 'folder' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <FolderIcon className="w-10 h-10 text-theme-text-primary mb-1" />
                    <p className="text-xs text-center truncate w-full text-theme-text-secondary">{item.name}</p>
                  </div>
                ) : (
                  <>
                    <img src={item.dataUrl} alt={item.name} className="w-full h-full object-contain p-1" loading="lazy" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                      <div className="flex justify-between items-start">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleSelection(item.id); }} // Use toggle logic 
                          className={`w-4 h-4 rounded border ${selectedItemIds.has(item.id) ? 'bg-blue-500 border-blue-500' : 'bg-white/20 border-white/50'}`}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }}
                          className="bg-red-500/80 hover:bg-red-600 text-white rounded p-0.5"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex justify-between items-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddItemToScene(item.id); }}
                          className="flex-grow bg-theme-bg-primary/80 hover:bg-theme-bg-secondary text-theme-text-primary text-[10px] py-0.5 rounded text-center flex items-center justify-center"
                          title="Añadir al lienzo"
                        >
                          <PlusIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditItem(item.id); }}
                          className="bg-theme-bg-primary/80 hover:bg-theme-bg-secondary text-theme-text-primary p-0.5 rounded"
                          title="Editar Transparencia"
                        >
                          <MagicWandIcon className="w-3 h-3" />
                        </button>
                        {item.type === 'image' && allowPublish && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onPublish(item as LibraryImage); }}
                            aria-label={`Publish ${item.name}`}
                            className="bg-blue-500/80 hover:bg-blue-600 text-white p-0.5 rounded"
                            title="Publicar en Galería"
                          >
                            <UploadIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div >
  );
});