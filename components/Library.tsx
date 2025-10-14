import React from 'react';
import type { LibraryItem } from '../types';
import { UploadIcon, CubeIcon, MagicWandIcon, TrashIcon, UserIcon, PlusIcon } from './icons';
import { User } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import type { DragState } from '../App';

interface LibraryProps {
  user: User | null;
  items: LibraryItem[];
  onImportImage: (file: File) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onStartDrag: (dragInfo: Omit<DragState, 'isDragging'>) => void;
  onAddItemToScene: (id: string) => void;
}

export const Library: React.FC<LibraryProps> = ({ user, items, onImportImage, onEditItem, onDeleteItem, onStartDrag, onAddItemToScene }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportImage(e.target.files[0]);
      e.target.value = ''; // Reset the input
    }
  };

  const handlePointerDown = (e: React.PointerEvent, item: LibraryItem) => {
    // If the event target is a button or inside a button, don't start a drag.
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    onStartDrag({
        type: 'library',
        id: item.id,
        name: item.name,
        dataUrl: item.dataUrl,
        pointerStart: { x: e.clientX, y: e.clientY },
        pointerCurrent: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="p-4 flex flex-col h-full bg-[--bg-primary]">
      <h3 className="text-sm font-bold uppercase text-[--text-secondary] mb-3 flex-shrink-0">Libreria</h3>
      
      <div className="flex-grow overflow-y-auto pr-2">
        {!user ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[--text-secondary] p-4">
            <UserIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">Se requiere iniciar sesión</p>
            <p className="text-xs">Por favor, inicie sesión para acceder a su librería de activos en línea.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[--text-secondary] p-4">
            <CubeIcon className="w-12 h-12 mb-4" />
            <p className="text-sm font-bold">La librería está vacía</p>
            <p className="text-xs">Importe imágenes para empezar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map(item => (
              <div
                key={item.id}
                onPointerDown={(e) => handlePointerDown(e, item)}
                onDragStart={(e) => e.preventDefault()}
                className="group relative aspect-square bg-[--bg-secondary] rounded-md flex flex-col items-center justify-center p-1 cursor-grab hover:bg-[--bg-tertiary]"
                title={item.name}
                style={{ touchAction: 'none', userSelect: 'none' }}
              >
                {/* Main content */}
                {item.type === 'image' && item.dataUrl ? (
                    <img src={item.dataUrl} alt={item.name} className="max-w-full max-h-full object-contain pointer-events-none" />
                ) : (
                  <CubeIcon className="w-8 h-8 text-gray-500 pointer-events-none" />
                )}
                <span className="text-xs text-[--text-secondary] mt-1 truncate w-full text-center pointer-events-none">{item.name}</span>

                {/* Overlay Buttons */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  aria-label={`Delete ${item.name}`}
                  className="absolute top-1 left-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>

                {item.type === 'image' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem(item.id);
                      }}
                      aria-label={`Edit transparency for ${item.name}`}
                      className="absolute top-1 right-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[--accent-primary]"
                    >
                      <MagicWandIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddItemToScene(item.id); }}
                      aria-label={`Add ${item.name} to scene`}
                      className="absolute bottom-1 right-1 p-1 bg-[--bg-primary]/60 rounded-full text-[--text-primary] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-500"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 mt-4">
        <label htmlFor="library-image-upload" className="w-full flex items-center justify-center p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] cursor-pointer text-[--text-secondary] disabled:opacity-50 disabled:cursor-not-allowed">
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
      </div>
    </div>
  );
};