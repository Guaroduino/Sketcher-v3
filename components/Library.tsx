import React, { useState, useRef, useMemo } from 'react';
import type { LibraryItem } from '../types';
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
}

export const Library: React.FC<LibraryProps> = ({ user, items, onImportImage, onCreateFolder, onEditItem, onDeleteItem, onAddItemToScene, onMoveItems }) => {
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
    <div className="p-4 flex flex-col h-full bg-[--bg-primary]">
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase text-[--text-secondary]">Libreria</h3>
          {selectedItemIds.size > 0 && (
            <button onClick={handleMove} className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500">
              Mover {selectedItemIds.size} aquí
            </button>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-[--text-secondary] flex-wrap">
          {currentFolderId !== null && (
            <button
              onClick={() => handleFolderNavigation(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null)}
              className="p-1 rounded-md hover:bg-[--bg-tertiary] mr-1"
              title="Subir un nivel"
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => handleFolderNavigation(null)} className="hover:text-[--text-primary]">Raíz</button>
          {breadcrumbs.map(folder => (
            <React.Fragment key={folder.id}>
              <ChevronRightIcon className="w-4 h-4 mx-1" />
              <button onClick={() => handleFolderNavigation(folder.id)} className="hover:text-[--text-primary]">{folder.name}</button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2">
        {!user ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[--text-secondary] p-4">
            <UserIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">Se requiere iniciar sesión</p>
            <p className="text-xs">Por favor, inicie sesión para acceder a su librería de activos en línea.</p>
          </div>
        ) : displayedItems.length === 0 && !isCreatingFolder ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[--text-secondary] p-4">
            <CubeIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">La carpeta está vacía</p>
            <p className="text-xs">Importe imágenes o cree una nueva carpeta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {isCreatingFolder && (
              <div className="aspect-square bg-[--bg-secondary] rounded-md flex flex-col items-center justify-center p-2">
                <FolderIcon className="w-10 h-10 text-[--text-secondary] mb-1" />
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={handleCreateFolder}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); } }}
                  placeholder="Nombre..."
                  className="w-full text-center bg-[--bg-tertiary] text-[--text-primary] rounded text-xs p-1"
                  autoFocus
                />
              </div>
            )}
            {displayedItems.map(item => {
              const isSelected = selectedItemIds.has(item.id);
              return (
                <div
                  key={item.id}
                  draggable={item.type === 'image'}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`group relative aspect-square bg-[--bg-secondary] rounded-md flex flex-col items-center justify-center p-1 hover:bg-[--bg-hover] ${item.type === 'folder' ? 'cursor-pointer' : 'cursor-grab'} transition-all duration-150 border-2 ${isSelected ? 'border-[--accent-primary]' : 'border-transparent'}`}
                  title={item.name}
                >
                  {/* Selection Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleSelection(item.id); }}
                    aria-label={`Select ${item.name}`}
                    className="absolute top-1 left-1 w-5 h-5 bg-black/30 backdrop-blur-sm rounded-sm flex items-center justify-center border border-white/30 z-10 hover:bg-black/50"
                  >
                    {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                  </button>

                  {/* Main content */}
                  {item.type === 'image' && item.dataUrl ? (
                    <img src={item.dataUrl} alt={item.name} className="max-w-full max-h-full object-contain pointer-events-none" />
                  ) : item.type === 'folder' ? (
                    <FolderIcon className="w-10 h-10 text-red-400" />
                  ) : (
                    <CubeIcon className="w-8 h-8 text-gray-500 pointer-events-none" />
                  )}
                  <span className="text-xs text-[--text-secondary] mt-1 truncate w-full text-center pointer-events-none">{item.name}</span>

                  {/* Overlay Buttons */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }}
                    aria-label={`Delete ${item.name}`}
                    className="absolute top-1 right-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>

                  {item.type === 'image' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddItemToScene(item.id); }}
                        aria-label={`Add ${item.name} to scene`}
                        className="absolute bottom-1 left-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-500 z-10"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditItem(item.id); }}
                        aria-label={`Edit transparency for ${item.name}`}
                        className="absolute bottom-1 right-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[--accent-primary] z-10"
                      >
                        <MagicWandIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 mt-4 flex items-center gap-2">
        <label htmlFor="library-image-upload" className="flex-grow flex items-center justify-center p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary] disabled:opacity-50 disabled:cursor-not-allowed">
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
          className="flex-shrink-0 flex items-center justify-center p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary] disabled:opacity-50 disabled:cursor-not-allowed"
          title="Crear nueva carpeta"
        >
          <FolderIcon className="w-5 h-5 mr-2" />
          <span className="text-sm">Nueva Carpeta</span>
        </button>
      </div>
    </div>
  );
};