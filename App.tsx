import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { User, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { auth, db, storage } from './firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

import { Toolbar } from './components/Toolbar';
import { Outliner } from './components/Outliner';
import { CanvasContainer } from './components/CanvasContainer';
import { TransparencyEditor } from './components/TransparencyEditor';
import { Library } from './components/Library';
import { CanvasToolbar } from './components/CanvasToolbar';
import { ExportModal } from './components/ExportModal';
import { SingleObjectExportModal } from './components/SingleObjectExportModal';
import { Auth } from './components/Auth';
import { historyReducer, initialHistoryState } from './state/appState';
import { useToolSettings } from './hooks/useToolSettings';
import { useLibrary } from './hooks/useLibrary';
import { useGuides } from './hooks/useGuides';
import { useCanvasView } from './hooks/useCanvasView';
import { useCanvasModes } from './hooks/useCanvasModes';
import { useWorkspaceTemplates } from './hooks/useWorkspaceTemplates';
import { useQuickAccess } from './hooks/useQuickAccess';
import { QuickAccessBar } from './components/QuickAccessBar';
import { ToolSelectorModal } from './components/modals/ToolSelectorModal';
import { WorkspaceTemplatesPopover } from './components/WorkspaceTemplatesPopover';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { CanvasSizeModal } from './components/modals/CanvasSizeModal';
import { ConfirmClearModal } from './components/modals/ConfirmClearModal';
import { ConfirmDeleteLibraryItemModal } from './components/modals/ConfirmDeleteLibraryItemModal';
import { ConfirmResetModal } from './components/modals/ConfirmResetModal';
import { SunIcon, MoonIcon, ChevronLeftIcon, ChevronRightIcon, BookmarkIcon, GalleryIcon, XIcon, UserIcon, TrashIcon, FolderOpenIcon, SaveIcon } from './components/icons';
import type { SketchObject, ItemType, Tool, CropRect, TransformState, WorkspaceTemplate, QuickAccessTool, ProjectFile, Project, StrokeMode, StrokeState } from './types';
import { getContentBoundingBox, createNewCanvas, createThumbnail } from './utils/canvasUtils';

type Theme = 'light' | 'dark';

export interface DragState {
  type: 'library' | 'outliner';
  id: string;
  name: string;
  dataUrl?: string;
  pointerStart: { x: number; y: number };
  pointerCurrent: { x: number; y: number };
  isDragging: boolean;
}

const DragPreview: React.FC<{ dragState: DragState }> = ({ dragState }) => {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: dragState.pointerCurrent.y,
    left: dragState.pointerCurrent.x,
    transform: 'translate(10px, 10px)',
    pointerEvents: 'none',
    zIndex: 10000,
    opacity: 0.8,
  };

  if (dragState.type === 'library' && dragState.dataUrl) {
    return <img src={dragState.dataUrl} style={style} className="w-24 h-24 object-contain bg-black/20 rounded-md border border-white/50" alt="drag preview" />;
  }
  
  return (
    <div style={style} className="px-3 py-2 bg-[--bg-tertiary] text-[--text-primary] rounded-md shadow-lg border border-white/20">
      <span className="text-sm">{dragState.name}</span>
    </div>
  );
};


// Helper to convert a Data URL to a Base64 string for the API
const dataURLtoBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// --- Project Gallery Modal Component ---
interface ProjectGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    projects: Project[];
    isLoading: boolean;
    onSave: (name: string) => Promise<void>;
    onLoad: (project: Project) => Promise<void>;
    onDelete: (project: Project) => Promise<void>;
    onSaveLocally: (name: string) => Promise<void>;
    onLoadFromFile: (file: File) => Promise<void>;
}

const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({ isOpen, onClose, user, projects, isLoading, onSave, onLoad, onDelete, onSaveLocally, onLoadFromFile }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deletingProject, setDeletingProject] = useState<Project | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // State for inline local save UI
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [localFileName, setLocalFileName] = useState('mi-boceto');
    const localSaveInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setNewProjectName('');
            setIsSaving(false);
            setDeletingProject(null);
            setIsSavingLocal(false);
        }
    }, [isOpen]);

    const handleHeaderSaveLocalClick = () => {
        setIsSavingLocal(true);
        // Focus and select the input field when it appears
        setTimeout(() => {
            localSaveInputRef.current?.focus();
            localSaveInputRef.current?.select();
        }, 0);
    };
    
    const handleConfirmSaveLocal = async () => {
        if (localFileName.trim()) {
            try {
                await onSaveLocally(localFileName.trim());
                setIsSavingLocal(false); // Close the input on success
            } catch (error) {
                console.error("Failed to save project locally:", error);
                alert(`Error al guardar el proyecto localmente: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };

    const handleCancelSaveLocal = () => {
        setIsSavingLocal(false);
    };

    const handleSave = async () => {
        if (!newProjectName.trim()) {
            alert("Please enter a project name.");
            return;
        }
        setIsSaving(true);
        try {
            await onSave(newProjectName.trim());
            setNewProjectName('');
        } catch (error) {
            console.error("Failed to save project:", error);
            alert(`Error saving project: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (deletingProject) {
            await onDelete(deletingProject);
            setDeletingProject(null);
        }
    };
    
    const handleFileLoadClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await onLoadFromFile(e.target.files[0]);
        }
        if(e.target) e.target.value = '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold">Galería de Proyectos</h2>
                    {isSavingLocal ? (
                        <div className="flex items-center gap-2">
                            <input
                                ref={localSaveInputRef}
                                type="text"
                                value={localFileName}
                                onChange={(e) => setLocalFileName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmSaveLocal();
                                    if (e.key === 'Escape') handleCancelSaveLocal();
                                }}
                                placeholder="Nombre del archivo..."
                                className="bg-[--bg-secondary] text-[--text-primary] text-sm rounded-md p-2 border border-[--bg-tertiary] focus:ring-1 focus:ring-[--accent-primary] focus:outline-none"
                            />
                            <button onClick={handleConfirmSaveLocal} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-semibold">Guardar</button>
                            <button onClick={handleCancelSaveLocal} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cancelar</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                             <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".sketcher,application/json"
                                onChange={handleFileSelected}
                            />
                            <button
                                onClick={handleFileLoadClick}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] font-semibold"
                            >
                                <FolderOpenIcon className="w-5 h-5" />
                                <span>Cargar desde Archivo</span>
                            </button>
                            <button
                                onClick={handleHeaderSaveLocalClick}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] font-semibold"
                            >
                                <SaveIcon className="w-5 h-5" />
                                <span>Guardar Local</span>
                            </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-[--bg-tertiary]">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </div>

                {!user ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-[--text-secondary]">
                        <UserIcon className="w-16 h-16 mb-4" />
                        <h3 className="text-xl font-bold">Por favor, inicie sesión</h3>
                        <p>Inicie sesión para guardar y cargar sus proyectos en la nube.</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-[--bg-primary] p-4 rounded-lg mb-4 flex-shrink-0">
                            <h3 className="text-lg font-semibold mb-2">Guardar Lienzo Actual</h3>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Nombre del nuevo proyecto..."
                                    className="flex-grow bg-[--bg-secondary] text-[--text-primary] text-sm rounded-md p-2 border border-[--bg-tertiary] focus:ring-1 focus:ring-[--accent-primary] focus:outline-none"
                                    disabled={isSaving}
                                />
                                <button
                                    onClick={handleSave}
                                    disabled={!newProjectName.trim() || isSaving || !user}
                                    className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                                    title={!user ? "Inicie sesión para guardar en la nube" : ""}
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar en la Nube'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-4 border-[--accent-primary] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="text-center text-[--text-secondary] py-16">
                                    <p>No se encontraron proyectos guardados.</p>
                                    <p className="text-sm">¡Guarda tu lienzo actual para empezar!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {projects.map(p => (
                                        <div key={p.id} className="group relative bg-[--bg-tertiary] rounded-lg overflow-hidden shadow-md">
                                            <div className="aspect-video bg-white/10 flex items-center justify-center">
                                                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="p-2">
                                                <p className="font-semibold text-sm truncate">{p.name}</p>
                                            </div>
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                <button onClick={() => onLoad(p)} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white w-3/4">Cargar</button>
                                                <button onClick={() => setDeletingProject(p)} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white w-3/4">Eliminar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
             {deletingProject && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-[--bg-secondary] rounded-lg p-6 shadow-xl">
                        <h3 className="text-lg font-bold">Confirmar Eliminación</h3>
                        <p className="my-2 text-[--text-secondary]">¿Estás seguro de que quieres eliminar "{deletingProject.name}"? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-4 mt-4">
                            <button onClick={() => setDeletingProject(null)} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


function App() {
  const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
  const { present: currentState, past, future } = historyState;
  const { objects, canvasSize } = currentState;
  
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const [isSingleExportModalOpen, setSingleExportModalOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCanvasSizeModalOpen, setCanvasSizeModalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(window.innerWidth > 1024);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // New states for Crop & Transform
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformState, setTransformState] = useState<TransformState | null>(null);
  const [transformSourceBbox, setTransformSourceBbox] = useState<CropRect | null>(null);
  const [isAspectRatioLocked, setAspectRatioLocked] = useState(false);
  
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dropTargetRef = useRef<{ type: 'canvas' | 'outliner', id?: string } | null>(null);

  // AI states
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementPreview, setEnhancementPreview] = useState<{
    fullDataUrl: string;
    croppedDataUrl: string | null;
    bbox: CropRect | null;
  } | null>(null);
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ prompt: string; images: { name: string; url: string }[] } | null>(null);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  
  // Quick Access Bar State
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
  const [editingToolSlotIndex, setEditingToolSlotIndex] = useState<number | null>(null);

  // Project Gallery State
  const [isProjectGalleryOpen, setProjectGalleryOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Stroke Modes State
  const [strokeMode, setStrokeMode] = useState<StrokeMode>('freehand');
  const [strokeState, setStrokeState] = useState<StrokeState | null>(null);
  
  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Custom Hooks
  const toolSettings = useToolSettings();
  const library = useLibrary(user);
  const guides = useGuides(canvasSize);
  const canvasView = useCanvasView(mainAreaRef, canvasSize);
  const templates = useWorkspaceTemplates();
  const quickAccess = useQuickAccess();
  const { onDropOnCanvas } = useCanvasModes(
    tool, setTool, dispatch, library.libraryItems, canvasSize
  );

  const [rightSidebarTopHeight, setRightSidebarTopHeight] = useState<number | undefined>(undefined);
  const resizeDataRef = useRef({ isResizing: false, startY: 0, startHeight: 0 });
  const [isWorkspacePopoverOpen, setWorkspacePopoverOpen] = useState(false);
  const workspaceButtonRef = useRef<HTMLButtonElement>(null);

  const activeItemId = selectedItemIds.length > 0 ? selectedItemIds[selectedItemIds.length - 1] : null;
  const activeItem = activeItemId ? objects.find(o => o.id === activeItemId) : null;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const backgroundObject = objects.find(o => o.isBackground);

  // Callbacks are memoized here
  const handleLoadWorkspace = useCallback((id: string) => {
    const template = templates.templates.find(t => t.id === id);
    if (!template) return;

    localStorage.setItem('sketcher-active-workspace-id', id);

    // Apply settings
    toolSettings.setBrushSettings(template.toolSettings.brushSettings);
    toolSettings.setEraserSettings(template.toolSettings.eraserSettings);
    toolSettings.setMarkerSettings(template.toolSettings.markerSettings);
    toolSettings.setAirbrushSettings(template.toolSettings.airbrushSettings);
    toolSettings.setFxBrushSettings(template.toolSettings.fxBrushSettings);

    guides.loadGuideState(template.guides);
    quickAccess.loadState(template.quickAccessSettings);
    
    dispatch({ type: 'RESIZE_CANVAS', payload: { width: template.canvasSize.width, height: template.canvasSize.height } });
    dispatch({ type: 'UPDATE_BACKGROUND', payload: { color: template.backgroundColor } });

    setWorkspacePopoverOpen(false);
    setTimeout(canvasView.onZoomExtents, 100);

  }, [templates.templates, toolSettings, guides, quickAccess, dispatch, canvasView.onZoomExtents]);
  
  // Effects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('sketcher-theme') as Theme | null;
    if (savedTheme) {
        setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sketcher-theme', theme);
  }, [theme]);

  useEffect(() => {
    // This effect "hydrates" the state with actual canvas elements when the app loads.
    if (isInitialized || !mainAreaRef.current) return;
    const { width, height } = mainAreaRef.current.getBoundingClientRect();
    if (width > 0 && height > 0) {
      dispatch({ type: 'INITIALIZE_CANVASES', payload: { width: Math.floor(width), height: Math.floor(height) }});
      setIsInitialized(true);
      const firstObject = currentState.objects.find(o => o.type === 'object' && !o.isBackground);
      if (firstObject) {
        setSelectedItemIds([firstObject.id]);
      }
    }
  }, [isInitialized, mainAreaRef, currentState.objects]);

  // Load last workspace and zoom to extents on startup
  useEffect(() => {
      if (!isInitialized) return;

      const activeWorkspaceId = localStorage.getItem('sketcher-active-workspace-id');
      const templateToLoad = activeWorkspaceId ? templates.templates.find(t => t.id === activeWorkspaceId) : null;

      if (templateToLoad) {
          handleLoadWorkspace(templateToLoad.id);
      } else {
          canvasView.onZoomExtents();
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  useEffect(() => {
    if (backgroundObject?.canvas) {
        setBackgroundDataUrl(backgroundObject.canvas.toDataURL());
    }
  }, [backgroundObject, backgroundObject?.canvas]);


  useEffect(() => {
    if (rightSidebarRef.current && rightSidebarTopHeight === undefined) {
      const initialHeight = rightSidebarRef.current.offsetHeight * 0.75;
      setRightSidebarTopHeight(initialHeight);
    }
  }, [rightSidebarTopHeight]);

  useEffect(() => {
    // Reset all modes first
    setIsCropping(false);
    setCropRect(null);
    setIsTransforming(false);
    setTransformState(null);
    setTransformSourceBbox(null);

    if (tool === 'crop') {
        setIsCropping(true);
        setCropRect({
            x: 0,
            y: 0,
            width: canvasSize.width,
            height: canvasSize.height
        });
    } else if ((tool === 'transform' || tool === 'free-transform') && activeItem?.canvas) {
        const bbox = getContentBoundingBox(activeItem.canvas);
        if (bbox) {
            setIsTransforming(true);
            setTransformSourceBbox(bbox);
            if (tool === 'transform') {
                setTransformState({
                    type: 'affine',
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height,
                    rotation: 0,
                });
            } else { // free-transform
                 setTransformState({
                    type: 'free',
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height,
                    corners: {
                        tl: { x: bbox.x, y: bbox.y },
                        tr: { x: bbox.x + bbox.width, y: bbox.y },
                        bl: { x: bbox.x, y: bbox.y + bbox.height },
                        br: { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
                    },
                });
            }
        } else {
            // Nothing to transform, switch back to select
            setTool('select');
        }
    }
  }, [tool, canvasSize.width, canvasSize.height, activeItem]);

    // Effect to cancel in-progress strokes
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setStrokeState(null);
        }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Effect to clear stroke state if tool or mode changes
    useEffect(() => {
        setStrokeState(null);
    }, [tool, strokeMode]);

  // Effect for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleStartDrag = useCallback((state: Omit<DragState, 'isDragging'>) => {
    setDragState({ ...state, isDragging: true });
  }, []);

  const handleEndDrag = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
        setDragState(prev => {
            if (!prev) return null;
            if (!prev.isDragging && Math.hypot(e.clientX - prev.pointerStart.x, e.clientY - prev.pointerStart.y) > 5) {
                return { ...prev, isDragging: true, pointerCurrent: { x: e.clientX, y: e.clientY } };
            }
            if (prev.isDragging) {
                return { ...prev, pointerCurrent: { x: e.clientX, y: e.clientY } };
            }
            return prev;
        });
    };

    const handlePointerUp = () => {
        if (dropTargetRef.current?.type === 'canvas' && dragState) {
            onDropOnCanvas(dragState, activeItemId, setSelectedItemIds);
        }
        dropTargetRef.current = null;
        // Defer ending the drag so onClick handlers can check dragState.isDragging
        setTimeout(() => {
            handleEndDrag();
        }, 0);
    };

    if (dragState) {
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    }

    return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, handleEndDrag, onDropOnCanvas, activeItemId]);

  // Callbacks
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const addItem = useCallback((type: ItemType) => {
    const newItemId = `${type}-${Date.now()}`;
    dispatch({ type: 'ADD_ITEM', payload: { type, activeItemId, canvasSize, newItemId } });
    setSelectedItemIds([newItemId]);
  }, [activeItemId, canvasSize]);
  const copyItem = useCallback((id: string) => dispatch({ type: 'COPY_ITEM', payload: { id } }), []);
  const deleteItem = useCallback((id: string) => setDeletingItemId(id), []);
  const updateItem = useCallback((id: string, updates: Partial<SketchObject>) => dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } }), []);
  const handleMoveItem = useCallback((draggedId: string, targetId: string, position: 'top' | 'bottom' | 'middle') => dispatch({ type: 'MOVE_ITEM', payload: { draggedId, targetId, position } }), []);
  
  const handleDrawCommit = useCallback((activeItemId: string, beforeCanvas: HTMLCanvasElement) => {
    dispatch({ type: 'COMMIT_DRAWING', payload: { activeItemId, beforeCanvas } });
  }, []);

  const getDrawableObjects = useCallback(() => {
    const itemMap = new Map<string, SketchObject>(objects.map(i => [i.id, i]));
    const isEffectivelyVisible = (item: SketchObject): boolean => {
      if (!item.isVisible) return false;
      if (item.parentId) {
        const parent = itemMap.get(item.parentId);
        if (parent) return isEffectivelyVisible(parent);
      }
      return true;
    };
    return objects.map(item => ({...item, isVisible: isEffectivelyVisible(item)}));
  }, [objects]);

  const handleSelectItem = useCallback((id: string | null) => {
      setSelectedItemIds(id ? [id] : []);
    }, []);
  
  const getCombinedBbox = useCallback((objectsToScan: SketchObject[]): CropRect | null => {
      let combinedBbox: CropRect | null = null;
      objectsToScan.forEach(obj => {
          if (!obj.canvas) return;
          const bbox = getContentBoundingBox(obj.canvas);
          if (bbox) {
              if (!combinedBbox) {
                  combinedBbox = { ...bbox };
              } else {
                  const newX1 = Math.min(combinedBbox.x, bbox.x);
                  const newY1 = Math.min(combinedBbox.y, bbox.y);
                  const newX2 = Math.max(combinedBbox.x + combinedBbox.width, bbox.x + bbox.width);
                  const newY2 = Math.max(combinedBbox.y + combinedBbox.height, bbox.y + bbox.height);
                  combinedBbox = { x: newX1, y: newY1, width: newX2 - newX1, height: newY2 - newY1 };
              }
          }
      });
      return combinedBbox;
  }, []);

  const getCompositeCanvas = useCallback((includeBackground: boolean): HTMLCanvasElement | null => {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = canvasSize.width;
      compositeCanvas.height = canvasSize.height;
      const compositeCtx = compositeCanvas.getContext('2d');
      if (!compositeCtx) return null;

      const drawable = getDrawableObjects();

      if (includeBackground && backgroundObject?.canvas && backgroundObject.isVisible) {
          compositeCtx.drawImage(backgroundObject.canvas, 0, 0);
      }
      
      const visibleObjects = drawable.filter(obj => !obj.isBackground && obj.isVisible && obj.canvas);
      [...visibleObjects].reverse().forEach(obj => {
          compositeCtx.globalAlpha = obj.opacity;
          compositeCtx.drawImage(obj.canvas!, 0, 0);
      });
      compositeCtx.globalAlpha = 1.0;
      return compositeCanvas;
  }, [canvasSize, getDrawableObjects, backgroundObject]);

  const generateEnhancementPreview = useCallback(() => {
      setEnhancementPreview(null); // Show loading state
      setTimeout(() => {
          const compositeCanvas = getCompositeCanvas(false); // Objects only for this preview
          if (!compositeCanvas) return;

          const visibleObjects = getDrawableObjects().filter(obj => !obj.isBackground && obj.isVisible && obj.canvas);
          const combinedBbox = getCombinedBbox(visibleObjects);
          const fullDataUrl = compositeCanvas.toDataURL('image/png');
          let croppedDataUrl: string | null = null;

          if (combinedBbox && combinedBbox.width > 0 && combinedBbox.height > 0) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = combinedBbox.width;
            cropCanvas.height = combinedBbox.height;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
                cropCtx.drawImage(
                    compositeCanvas,
                    combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height,
                    0, 0, combinedBbox.width, combinedBbox.height
                );
                croppedDataUrl = cropCanvas.toDataURL('image/png');
            }
          }
          
          setEnhancementPreview({
              fullDataUrl,
              croppedDataUrl,
              bbox: combinedBbox
          });
      }, 10);
  }, [getCompositeCanvas, getDrawableObjects, getCombinedBbox]);

  const handleEnhance = useCallback(async (payload: any) => {
    setDebugInfo(null);
    setIsEnhancing(true);
    let finalPrompt = '';
    const parts: any[] = [];
    const debugImages: { name: string; url: string }[] = [];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        switch (payload.activeAiTab) {
            case 'object': {
                const {
                    enhancementPrompt,
                    enhancementStylePrompt,
                    enhancementNegativePrompt,
                    enhancementCreativity,
                    enhancementInputMode,
                    enhancementChromaKey,
                    enhancementPreviewBgColor,
                } = payload;
                
                if (!enhancementPrompt) throw new Error("Description prompt is required.");
                
                const compositeCanvas = getCompositeCanvas(false);
                if (!compositeCanvas) throw new Error("Could not create composite canvas.");

                let imageCanvas = compositeCanvas;

                if (enhancementInputMode === 'bbox') {
                    const visibleObjects = getDrawableObjects().filter(obj => !obj.isBackground && obj.isVisible && obj.canvas);
                    const combinedBbox = getCombinedBbox(visibleObjects);
                    if (combinedBbox && combinedBbox.width > 0 && combinedBbox.height > 0) {
                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = combinedBbox.width;
                        cropCanvas.height = combinedBbox.height;
                        cropCanvas.getContext('2d')?.drawImage(compositeCanvas, combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height, 0, 0, combinedBbox.width, combinedBbox.height);
                        imageCanvas = cropCanvas;
                    }
                }
                
                let finalImageCanvas = document.createElement('canvas');
                finalImageCanvas.width = imageCanvas.width;
                finalImageCanvas.height = imageCanvas.height;
                const finalCtx = finalImageCanvas.getContext('2d');
                if (finalCtx) {
                    finalCtx.fillStyle = enhancementPreviewBgColor || '#FFFFFF';
                    finalCtx.fillRect(0, 0, finalImageCanvas.width, finalImageCanvas.height);
                    finalCtx.drawImage(imageCanvas, 0, 0);
                } else {
                    finalImageCanvas = imageCanvas;
                }
                const dataUrl = finalImageCanvas.toDataURL('image/jpeg');
                debugImages.push({ name: 'Imagen de Entrada', url: dataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(dataUrl) } });
                
                // Build prompt with creativity
                let creativityInstruction = '';
                if (enhancementCreativity <= 40) {
                    creativityInstruction = 'Sé muy fiel a la imagen de entrada y a la descripción proporcionada. Realiza solo los cambios solicitados.';
                } else if (enhancementCreativity <= 80) {
                    creativityInstruction = 'Mantén una fidelidad moderada a la imagen y descripción, pero puedes hacer pequeñas mejoras estéticas.';
                } else if (enhancementCreativity <= 120) {
                    creativityInstruction = 'Usa la imagen y la descripción como una fuerte inspiración. Siéntete libre de reinterpretar elementos para un mejor resultado artístico.';
                } else {
                    creativityInstruction = 'Usa la imagen y la descripción solo como una vaga inspiración. Prioriza un resultado impactante y altamente creativo sobre la fidelidad al original.';
                }

                const promptParts = [
                    `Tu tarea es mejorar o transformar una imagen de entrada.`,
                    `Descripción de la transformación deseada: "${enhancementPrompt}".`,
                    `El estilo visual a aplicar es: "${enhancementStylePrompt}".`,
                    creativityInstruction,
                ];

                if (enhancementNegativePrompt.trim()) {
                    promptParts.push(`Asegúrate de evitar estrictamente lo siguiente: "${enhancementNegativePrompt}".`);
                }

                if (enhancementChromaKey !== 'none') {
                    const colorHex = enhancementChromaKey === 'green' ? '#00FF00' : '#0000FF';
                    promptParts.push(`Importante: La imagen resultante DEBE tener un fondo de croma sólido y uniforme de color ${enhancementChromaKey} (${colorHex}). El sujeto principal no debe contener este color.`);
                }

                finalPrompt = promptParts.join(' ');
                break;
            }
            case 'composition': {
                const compositeCanvas = getCompositeCanvas(true); // Include background
                if (!compositeCanvas) throw new Error("Could not create composite canvas.");
                const dataUrl = compositeCanvas.toDataURL('image/jpeg');
                debugImages.push({ name: 'Escena Compuesta', url: dataUrl });
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(dataUrl) } });
                
                if (payload.styleRef?.url) {
                    debugImages.push({ name: 'Referencia de Estilo', url: payload.styleRef.url });
                    parts.push({ inlineData: { mimeType: 'image/jpeg', data: dataURLtoBase64(payload.styleRef.url) } });
                }
                finalPrompt = payload.compositionPrompt;
                break;
            }
            case 'free': {
                const slots = ['main', 'a', 'b', 'c'];
                const slotNames = ['Objeto 1', 'Añadido A', 'Añadido B', 'Añadido C'];
                slots.forEach((slot, index) => {
                    const slotData = payload.freeFormSlots[slot];
                    if (slotData?.url) {
                        debugImages.push({ name: slotNames[index], url: slotData.url });
                        parts.push({ inlineData: { mimeType: 'image/png', data: dataURLtoBase64(slotData.url) } });
                    }
                });
                finalPrompt = payload.freeFormPrompt;
                break;
            }
        }
        
        setDebugInfo({ prompt: finalPrompt, images: debugImages });

        const textPart = { text: finalPrompt };
        const model = 'gemini-2.5-flash-image';
        const config = { responseModalities: [Modality.IMAGE, Modality.TEXT] };
        
        const contents = (parts.length > 0) ? { parts: [...parts, textPart] } : { parts: [textPart] };

        const response = await ai.models.generateContent({ model, contents, config });

        let newImageBase64: string | null = null;
        for (const part of response.candidates?.[0]?.content.parts || []) {
            if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
        }

        if (newImageBase64) {
            const img = new Image();
            img.onload = () => {
                const newName = `IA: ${finalPrompt.substring(0, 20)}...`;

                // Logic for what to do with the generated image
                if (payload.activeAiTab === 'object' || (payload.activeAiTab === 'free' && payload.addEnhancedImageToLibrary)) {
                    const dataUrl = `data:image/png;base64,${newImageBase64}`;
                    fetch(dataUrl).then(res => res.blob()).then(blob => {
                        if (blob) {
                           library.onImportToLibrary(new File([blob], `${newName}.png`, { type: 'image/png' }));
                        }
                    });
                } else if (payload.activeAiTab === 'composition') {
                    // Replace background
                    dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: img } });
                } else { // This now correctly covers 'free' without saving, or any other case
                    const newItemId = `object-${Date.now()}`;
                    dispatch({ type: 'ADD_ITEM', payload: { type: 'object', activeItemId: null, newItemId, imageElement: img, canvasSize, name: newName } });
                    handleSelectItem(newItemId);
                    setTool('select');
                }
            };
            img.src = `data:image/png;base64,${newImageBase64}`;
        } else {
            alert(`La IA no devolvió una imagen. Dijo: "${response.text}"`);
        }

    } catch (error) {
        console.error("Error during AI enhancement:", error);
        alert(`Ocurrió un error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsEnhancing(false);
    }
  }, [canvasSize, getCompositeCanvas, getDrawableObjects, getCombinedBbox, handleSelectItem, library, dispatch]);
  
  const handleUpdateBackground = useCallback((updates: { color?: string, file?: File, image?: HTMLImageElement }) => {
    if (updates.file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const img = new Image();
          img.onload = () => {
            dispatch({ type: 'SET_CANVAS_FROM_IMAGE', payload: { image: img } });
            canvasView.onZoomExtents();
          };
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(updates.file);
    } else if (updates.image) {
        dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: updates.image } });
    } else if (updates.color) {
      dispatch({ type: 'UPDATE_BACKGROUND', payload: { color: updates.color } });
    }
  }, [canvasView.onZoomExtents]);

  const handleRemoveBackgroundImage = useCallback(() => {
    dispatch({ type: 'REMOVE_BACKGROUND_IMAGE' });
  }, []);
  
  const handleConfirmDelete = useCallback(() => {
    if (!deletingItemId) return;
    dispatch({ type: 'DELETE_ITEM', payload: { id: deletingItemId } });
    setSelectedItemIds(currentIds => currentIds.filter(cid => cid !== deletingItemId));
    setDeletingItemId(null);
  }, [deletingItemId]);

  const handleMergeItems = useCallback(async (sourceId: string, targetId: string) => {
    const sourceItem = objects.find(i => i.id === sourceId);
    const targetItem = objects.find(i => i.id === targetId);
    
    if (!sourceItem || !targetItem || !sourceItem.canvas || !targetItem.canvas) return;

    dispatch({ type: 'MERGE_ITEMS', payload: { sourceId, targetId }});
    setSelectedItemIds([targetId]);
  }, [objects]);
  
  const handleConfirmClear = useCallback(() => {
    dispatch({ type: 'CLEAR_CANVAS' });
    setShowClearConfirm(false);
  }, []);

  const handleSaveItemToLibrary = useCallback((imageDataUrl: string, name: string) => {
      fetch(imageDataUrl)
        .then(res => res.blob())
        .then(blob => {
            if (blob) {
                const filename = name.endsWith('.png') ? name : `${name}.png`;
                const file = new File([blob], filename, { type: 'image/png' });
                library.onImportToLibrary(file);
            }
        });
  }, [library.onImportToLibrary]);
  
  
    const handleEditLibraryItem = async (id: string) => {
        await library.onEditTransparency(id);
    };

    // Crop handlers
    const handleApplyCrop = () => {
        if (!cropRect) return;
        dispatch({ type: 'CROP_CANVAS', payload: { cropRect } });
        setTool('select');
    };
    const handleCancelCrop = () => setTool('select');

    // Transform handlers
    const handleApplyTransform = () => {
        if (!transformState || !transformSourceBbox || !activeItem) return;
        dispatch({
            type: 'APPLY_TRANSFORM',
            payload: {
                id: activeItem.id,
                transform: transformState,
                sourceBbox: transformSourceBbox,
            },
        });
        setTool('select');
    };
    const handleCancelTransform = () => setTool('select');
    
    const handleExportSingleItem = useCallback(() => {
        if (activeItem) {
            setSingleExportModalOpen(true);
        }
    }, [activeItem]);
  
    const handleAddItemToSceneFromLibrary = useCallback((itemId: string) => {
        const libraryItem = library.libraryItems.find(item => item.id === itemId);
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
    }, [library.libraryItems, activeItemId, canvasSize]);

  // --- Outliner Button Logic ---
  const getVisibleTree = useCallback((parentId: string | null = null): SketchObject[] => {
    const children = objects.filter(item => item.parentId === parentId && !item.isBackground);
    const result: SketchObject[] = [];
    children.forEach(child => {
      result.push(child);
      if (child.type === 'group') {
        result.push(...getVisibleTree(child.id));
      }
    });
    return result;
  }, [objects]);

  const visualList = useMemo(() => getVisibleTree(), [getVisibleTree]);

  const activeItemState = useMemo(() => {
    if (!activeItemId) return { canMoveUp: false, canMoveDown: false, canMergeDown: false, canMergeUp: false };

    const currentIndex = visualList.findIndex(item => item.id === activeItemId);
    if (currentIndex === -1) return { canMoveUp: false, canMoveDown: false, canMergeDown: false, canMergeUp: false };

    // In visualList (bottom-up array), moving "up" in the UI means increasing the index.
    const canMoveUp = currentIndex < visualList.length - 1; 
    // Moving "down" in the UI means decreasing the index.
    const canMoveDown = currentIndex > 0;

    let canMergeDown = false;
    if (canMoveDown) { // Can merge with item visually below
      const currentItem = visualList[currentIndex];
      const itemBelow = visualList[currentIndex - 1]; // Item visually below is at a lower index
      if (currentItem.type === 'object' && itemBelow.type === 'object' && currentItem.parentId === itemBelow.parentId) {
         canMergeDown = true;
      }
    }
    
    let canMergeUp = false;
    if (canMoveUp) { // Can merge with item visually above
        const currentItem = visualList[currentIndex];
        const itemAbove = visualList[currentIndex + 1]; // Item visually above is at a higher index
        if (currentItem.type === 'object' && itemAbove.type === 'object' && currentItem.parentId === itemAbove.parentId) {
            canMergeUp = true;
        }
    }

    return { canMoveUp, canMoveDown, canMergeDown, canMergeUp };
  }, [activeItemId, visualList]);

  const handleMoveItemUpDown = useCallback((id: string, direction: 'up' | 'down') => {
    const currentIndex = visualList.findIndex(item => item.id === id);
    if (currentIndex === -1) return;

    // 'up' in the UI means moving to a higher index in the array, 'down' means a lower index.
    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= visualList.length) return;

    const targetItem = visualList[targetIndex];
    
    // 'position: top' means "insert before target" (lower index)
    // 'position: bottom' means "insert after target" (higher index)
    // So moving 'up' in the UI means we want to be positioned 'bottom' relative to the target item in the array.
    const position = direction === 'up' ? 'bottom' : 'top';

    handleMoveItem(id, targetItem.id, position);
  }, [visualList, handleMoveItem]);

  const handleMergeItemDown = useCallback((id: string) => {
    const currentIndex = visualList.findIndex(item => item.id === id);
    // Can't merge down if it's the bottom item
    if (currentIndex <= 0) return;
    
    const currentItem = visualList[currentIndex];
    const itemBelow = visualList[currentIndex - 1]; // Visually below
    
    if (currentItem.type === 'object' && itemBelow.type === 'object' && currentItem.parentId === itemBelow.parentId) {
      // Merge current item (source) into the one below it (target)
      handleMergeItems(id, itemBelow.id);
    }
  }, [visualList, handleMergeItems]);

  const handleMergeItemUp = useCallback((id: string) => {
    const currentIndex = visualList.findIndex(item => item.id === id);
    // Can't merge up if it's the top item
    if (currentIndex >= visualList.length - 1) return;
    
    const currentItem = visualList[currentIndex];
    const itemAbove = visualList[currentIndex + 1]; // Visually above
    
    if (currentItem.type === 'object' && itemAbove.type === 'object' && currentItem.parentId === itemAbove.parentId) {
      // Merge the item above (source) into the current one (target)
      handleMergeItems(itemAbove.id, id);
    }
  }, [visualList, handleMergeItems]);

  const drawableObjects = getDrawableObjects();
  const itemToDelete = objects.find(item => item.id === deletingItemId);
  
  // Resizer handlers...
  const handleResizeCanvas = (width: number, height: number) => {
    dispatch({ type: 'RESIZE_CANVAS', payload: { width, height } });
    setCanvasSizeModalOpen(false);
    setTimeout(canvasView.onZoomExtents, 100); // Allow state to update before centering
  };

  const handlePointerMoveResize = useCallback((e: PointerEvent) => {
    if (!resizeDataRef.current.isResizing || !rightSidebarRef.current) return;
    const { startY, startHeight } = resizeDataRef.current;
    const deltaY = e.clientY - startY;
    let newHeight = startHeight + deltaY;
    const sidebarHeight = rightSidebarRef.current.offsetHeight;
    newHeight = Math.max(100, Math.min(newHeight, sidebarHeight - 100 - 6));
    setRightSidebarTopHeight(newHeight);
  }, []);

  const handlePointerUpResize = useCallback(() => {
    resizeDataRef.current.isResizing = false;
    document.body.style.cursor = 'default';
    window.removeEventListener('pointermove', handlePointerMoveResize);
    window.removeEventListener('pointerup', handlePointerUpResize);
  }, [handlePointerMoveResize]);

  const handlePointerDownResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!rightSidebarRef.current) return;
    const topPanel = rightSidebarRef.current.children[0] as HTMLElement;
    resizeDataRef.current = { isResizing: true, startY: e.clientY, startHeight: topPanel.offsetHeight };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('pointermove', handlePointerMoveResize);
    window.addEventListener('pointerup', handlePointerUpResize);
  }, [handlePointerMoveResize, handlePointerUpResize]);

  const handleSaveWorkspace = useCallback((name: string) => {
    if (!backgroundObject) return;

    const workspaceData: Omit<WorkspaceTemplate, 'id' | 'name'> = {
        canvasSize: canvasSize,
        backgroundColor: backgroundObject.color || '#FFFFFF',
        guides: {
            activeGuide: guides.activeGuide,
            isOrthogonalVisible: guides.isOrthogonalVisible,
            rulerGuides: guides.rulerGuides,
            mirrorGuides: guides.mirrorGuides,
            perspectiveGuide: guides.perspectiveGuide,
            orthogonalGuide: guides.orthogonalGuide,
            gridGuide: guides.gridGuide,
            areGuidesLocked: guides.areGuidesLocked,
            isPerspectiveStrokeLockEnabled: guides.isPerspectiveStrokeLockEnabled,
            isSnapToGridEnabled: guides.isSnapToGridEnabled,
        },
        toolSettings: {
            brushSettings: toolSettings.brushSettings,
            eraserSettings: toolSettings.eraserSettings,
            markerSettings: toolSettings.markerSettings,
            airbrushSettings: toolSettings.airbrushSettings,
            fxBrushSettings: toolSettings.fxBrushSettings,
        },
        quickAccessSettings: quickAccess.quickAccessSettings,
    };
    const newId = templates.saveTemplate(name, workspaceData);
    localStorage.setItem('sketcher-active-workspace-id', newId);
  }, [
      canvasSize, backgroundObject, guides, toolSettings, templates, quickAccess.quickAccessSettings
  ]);

  const handleDeleteWorkspace = useCallback((id: string) => {
    const activeId = localStorage.getItem('sketcher-active-workspace-id');
    if (activeId === id) {
        localStorage.removeItem('sketcher-active-workspace-id');
    }
    templates.deleteTemplate(id);
  }, [templates]);

  const handleResetPreferences = useCallback(() => {
    // Clear all known localStorage keys related to user preferences, EXCEPT for workspace templates
    localStorage.removeItem('sketcher-active-workspace-id');
    localStorage.removeItem('brushPresets'); // from useToolSettings
    localStorage.removeItem('sketcher-theme');
    localStorage.removeItem('sketcher-ai-prompts');

    // Close the modal
    setIsResetConfirmOpen(false);

    // Reload the page to apply defaults
    window.location.reload();
  }, []);
  
  // --- Quick Access Bar Handlers ---
  const handleSelectQuickAccessColor = useCallback((color: string) => {
      switch(tool) {
        case 'brush':
            toolSettings.setBrushSettings(s => ({ ...s, color }));
            break;
        case 'marker':
            toolSettings.setMarkerSettings(s => ({ ...s, color }));
            break;
        case 'airbrush':
            toolSettings.setAirbrushSettings(s => ({ ...s, color }));
            break;
        case 'fx-brush':
            toolSettings.setFxBrushSettings(s => ({ ...s, color }));
            break;
        default:
            // For other tools, default to setting brush color
            toolSettings.setBrushSettings(s => ({ ...s, color }));
            break;
      }
  }, [tool, toolSettings]);

  const handleSelectQuickAccessSize = useCallback((size: number) => {
      switch(tool) {
        case 'brush':
            toolSettings.setBrushSettings(s => ({ ...s, size }));
            break;
        case 'eraser':
            toolSettings.setEraserSettings(s => ({ ...s, size }));
            break;
        case 'marker':
            toolSettings.setMarkerSettings(s => ({ ...s, size }));
            break;
        case 'airbrush':
            toolSettings.setAirbrushSettings(s => ({ ...s, size }));
            break;
        case 'fx-brush':
            toolSettings.setFxBrushSettings(s => ({ ...s, size }));
            break;
        default:
            // Default to setting brush size
            toolSettings.setBrushSettings(s => ({ ...s, size }));
            break;
      }
  }, [tool, toolSettings]);

  const handleSelectQuickAccessTool = useCallback((qaTool: QuickAccessTool) => {
      if (qaTool.type === 'tool') {
        setTool(qaTool.tool);
      } else if (qaTool.type === 'fx-preset') {
        toolSettings.onLoadPreset(qaTool.id);
        setTool('fx-brush');
      }
  }, [toolSettings]);

  const handleOpenToolSelector = (index: number) => {
      setEditingToolSlotIndex(index);
      setIsToolSelectorOpen(true);
  };
  
  const handleSelectToolForSlot = (newTool: QuickAccessTool) => {
      if (editingToolSlotIndex !== null) {
          quickAccess.updateTool(editingToolSlotIndex, newTool);
      }
  };

  const handleToggleFullscreen = useCallback(() => {
    const docEl = document.documentElement as any;
    const doc = document as any;

    if (!isFullscreen) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.mozRequestFullScreen) { // Firefox
        docEl.mozRequestFullScreen();
      } else if (docEl.webkitRequestFullscreen) { // Chrome, Safari and Opera
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) { // IE/Edge
        docEl.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  }, [isFullscreen]);

  // --- Firebase Project Gallery Logic ---
    useEffect(() => {
        if (!user) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }
        setProjectsLoading(true);
        const q = query(collection(db, `users/${user.uid}/projects`), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedProjects: Project[] = [];
            querySnapshot.forEach((doc) => {
                fetchedProjects.push({ id: doc.id, ...doc.data() } as Project);
            });
            setProjects(fetchedProjects);
            setProjectsLoading(false);
        }, (error) => {
            console.error("Error fetching projects: ", error);
            setProjectsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSaveProjectToCloud = useCallback(async (name: string) => {
        if (!user) throw new Error("User not logged in.");

        // 1. Create project file content
        const projectState: ProjectFile = {
            fileFormatVersion: '1.0',
            canvasSize,
            objects: currentState.objects.map(obj => {
                const { canvas, context, backgroundImage, ...serializableObject } = obj;
                if (canvas) {
                    (serializableObject as any).dataUrl = canvas.toDataURL('image/png');
                }
                return serializableObject as SketchObject;
            }),
            guides: { activeGuide: guides.activeGuide, isOrthogonalVisible: guides.isOrthogonalVisible, rulerGuides: guides.rulerGuides, mirrorGuides: guides.mirrorGuides, perspectiveGuide: guides.perspectiveGuide, orthogonalGuide: guides.orthogonalGuide, gridGuide: guides.gridGuide, areGuidesLocked: guides.areGuidesLocked, isPerspectiveStrokeLockEnabled: guides.isPerspectiveStrokeLockEnabled, isSnapToGridEnabled: guides.isSnapToGridEnabled },
            toolSettings: { brushSettings: toolSettings.brushSettings, eraserSettings: toolSettings.eraserSettings, markerSettings: toolSettings.markerSettings, airbrushSettings: toolSettings.airbrushSettings, fxBrushSettings: toolSettings.fxBrushSettings },
            quickAccessSettings: quickAccess.quickAccessSettings,
        };
        const jsonString = JSON.stringify(projectState);
        const projectFileBlob = new Blob([jsonString], { type: 'application/json' });

        // 2. Create thumbnail
        const compositeCanvas = getCompositeCanvas(true);
        if (!compositeCanvas) throw new Error("Could not generate composite canvas for thumbnail.");
        const thumbnailBlob = await createThumbnail(compositeCanvas, 320, 180);

        // 3. Upload to Storage
        const projectId = `proj_${Date.now()}`;
        const projectFilePath = `users/${user.uid}/projects/${projectId}.sketcher`;
        const thumbnailPath = `users/${user.uid}/projects/${projectId}_thumb.png`;
        
        const projectFileRef = ref(storage, projectFilePath);
        const thumbnailRef = ref(storage, thumbnailPath);

        await uploadBytes(projectFileRef, projectFileBlob);
        await uploadBytes(thumbnailRef, thumbnailBlob);
        const thumbnailUrl = await getDownloadURL(thumbnailRef);

        // 4. Create Firestore document
        await addDoc(collection(db, `users/${user.uid}/projects`), {
            name,
            projectFilePath,
            thumbnailPath,
            thumbnailUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

    }, [user, currentState, canvasSize, guides, toolSettings, quickAccess, getCompositeCanvas]);

    const handleLoadProjectFromCloud = useCallback(async (project: Project) => {
        try {
            const projectFileRef = ref(storage, project.projectFilePath);
            const url = await getDownloadURL(projectFileRef);
            const response = await fetch(url);
            const projectData: ProjectFile = await response.json();

            // Rehydrate canvases
            const rehydratedObjectsPromises = projectData.objects.map(obj => {
                return new Promise<SketchObject>((resolve, reject) => {
                    if (!obj.dataUrl) {
                        const { canvas, context } = createNewCanvas(projectData.canvasSize.width, projectData.canvasSize.height);
                        resolve({ ...obj, canvas, context });
                        return;
                    }
                    const { canvas, context } = createNewCanvas(projectData.canvasSize.width, projectData.canvasSize.height);
                    const img = new Image();
                    img.onload = () => {
                        context.drawImage(img, 0, 0);
                        resolve({ ...obj, canvas, context });
                    };
                    img.onerror = () => reject(new Error(`Failed to load image for object: ${obj.name}`));
                    img.src = obj.dataUrl;
                });
            });
            const rehydratedObjects = await Promise.all(rehydratedObjectsPromises);

            // Load state
            dispatch({ type: 'LOAD_PROJECT_STATE', payload: { newState: { objects: rehydratedObjects, canvasSize: projectData.canvasSize } } });
            guides.loadGuideState(projectData.guides);
            toolSettings.setBrushSettings(projectData.toolSettings.brushSettings);
            toolSettings.setEraserSettings(projectData.toolSettings.eraserSettings);
            toolSettings.setMarkerSettings(projectData.toolSettings.markerSettings);
            toolSettings.setAirbrushSettings(projectData.toolSettings.airbrushSettings);
            toolSettings.setFxBrushSettings(projectData.toolSettings.fxBrushSettings);
            quickAccess.loadState(projectData.quickAccessSettings);
            
            const firstObject = rehydratedObjects.find(o => o.type === 'object' && !o.isBackground);
            setSelectedItemIds(firstObject ? [firstObject.id] : []);
            
            setProjectGalleryOpen(false);
            setTimeout(() => canvasView.onZoomExtents(), 100);
        } catch (error) {
            console.error("Failed to load project:", error);
            alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }, [dispatch, guides, toolSettings, quickAccess, canvasView]);

    const handleDeleteProjectFromCloud = useCallback(async (project: Project) => {
        if (!user) return;
        try {
            const projectFileRef = ref(storage, project.projectFilePath);
            const thumbnailRef = ref(storage, project.thumbnailPath);
            const docRef = doc(db, `users/${user.uid}/projects`, project.id);

            await deleteObject(projectFileRef);
            await deleteObject(thumbnailRef);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting project:", error);
            alert(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }, [user]);

    const handleSaveProjectLocally = useCallback(async (name: string) => {
        const projectState: ProjectFile = {
            fileFormatVersion: '1.0',
            canvasSize,
            objects: currentState.objects.map(obj => {
                // Explicitly destructure to omit non-serializable properties
                const { canvas, context, backgroundImage, ...serializableObject } = obj;
                
                // Add dataUrl if canvas exists
                if (canvas) {
                    (serializableObject as any).dataUrl = canvas.toDataURL('image/png');
                }
                return serializableObject as SketchObject;
            }),
            guides: { activeGuide: guides.activeGuide, isOrthogonalVisible: guides.isOrthogonalVisible, rulerGuides: guides.rulerGuides, mirrorGuides: guides.mirrorGuides, perspectiveGuide: guides.perspectiveGuide, orthogonalGuide: guides.orthogonalGuide, gridGuide: guides.gridGuide, areGuidesLocked: guides.areGuidesLocked, isPerspectiveStrokeLockEnabled: guides.isPerspectiveStrokeLockEnabled, isSnapToGridEnabled: guides.isSnapToGridEnabled },
            toolSettings: { brushSettings: toolSettings.brushSettings, eraserSettings: toolSettings.eraserSettings, markerSettings: toolSettings.markerSettings, airbrushSettings: toolSettings.airbrushSettings, fxBrushSettings: toolSettings.fxBrushSettings },
            quickAccessSettings: quickAccess.quickAccessSettings,
        };
        const jsonString = JSON.stringify(projectState, null, 2);
        const projectFileBlob = new Blob([jsonString], { type: 'application/json' });

        const url = URL.createObjectURL(projectFileBlob);
        const a = document.createElement('a');
        a.href = url;
        const sanitizedName = name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
        a.download = `${sanitizedName || 'sketch'}.sketcher`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [
        currentState.objects, canvasSize, 
        guides,
        toolSettings.brushSettings, toolSettings.eraserSettings, toolSettings.markerSettings, toolSettings.airbrushSettings, toolSettings.fxBrushSettings,
        quickAccess.quickAccessSettings
    ]);

    const handleLoadProjectFromFile = useCallback(async (file: File) => {
        try {
            const projectJson = await file.text();
            const projectData: ProjectFile = JSON.parse(projectJson);

            if (projectData.fileFormatVersion !== '1.0' || !projectData.objects || !projectData.canvasSize) {
                throw new Error("Invalid or unsupported project file format.");
            }

            const rehydratedObjectsPromises = projectData.objects.map(obj => {
                return new Promise<SketchObject>((resolve, reject) => {
                    if (!obj.dataUrl) {
                        const { canvas, context } = createNewCanvas(projectData.canvasSize.width, projectData.canvasSize.height);
                        resolve({ ...obj, canvas, context });
                        return;
                    }
                    const { canvas, context } = createNewCanvas(projectData.canvasSize.width, projectData.canvasSize.height);
                    const img = new Image();
                    img.onload = () => {
                        context.drawImage(img, 0, 0);
                        resolve({ ...obj, canvas, context });
                    };
                    img.onerror = () => reject(new Error(`Failed to load image for object: ${obj.name}`));
                    img.src = obj.dataUrl;
                });
            });
            const rehydratedObjects = await Promise.all(rehydratedObjectsPromises);

            dispatch({ type: 'LOAD_PROJECT_STATE', payload: { newState: { objects: rehydratedObjects, canvasSize: projectData.canvasSize } } });
            guides.loadGuideState(projectData.guides);
            toolSettings.setBrushSettings(projectData.toolSettings.brushSettings);
            toolSettings.setEraserSettings(projectData.toolSettings.eraserSettings);
            toolSettings.setMarkerSettings(projectData.toolSettings.markerSettings);
            toolSettings.setAirbrushSettings(projectData.toolSettings.airbrushSettings);
            toolSettings.setFxBrushSettings(projectData.toolSettings.fxBrushSettings);
            quickAccess.loadState(projectData.quickAccessSettings);
            
            const firstObject = rehydratedObjects.find(o => o.type === 'object' && !o.isBackground);
            setSelectedItemIds(firstObject ? [firstObject.id] : []);
            
            setProjectGalleryOpen(false);
            setTimeout(() => canvasView.onZoomExtents(), 100);
        } catch (error) {
            console.error("Failed to load project from file:", error);
            alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }, [dispatch, guides, toolSettings, quickAccess, canvasView]);

  const getActiveToolProperties = () => {
    const { brushSettings, eraserSettings, markerSettings, airbrushSettings, fxBrushSettings } = toolSettings;
    switch(tool) {
        case 'brush':
            return { color: brushSettings.color, size: brushSettings.size };
        case 'marker':
            return { color: markerSettings.color, size: markerSettings.size };
        case 'airbrush':
            return { color: airbrushSettings.color, size: airbrushSettings.size };
        case 'fx-brush':
            return { color: fxBrushSettings.color, size: fxBrushSettings.size };
        case 'eraser':
            return { size: eraserSettings.size };
        default:
            return { color: undefined, size: undefined };
    }
  };

  const activeToolProps = getActiveToolProperties();

  if (!isInitialized) {
    return (
      <div ref={mainAreaRef} className="w-screen h-screen bg-gray-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[--bg-secondary] flex text-[--text-primary] font-sans overflow-hidden">
      {dragState?.isDragging && <DragPreview dragState={dragState} />}
      <Toolbar
        tool={tool}
        setTool={setTool}
        {...toolSettings}
        objects={objects}
        libraryItems={library.libraryItems}
        activeGuide={guides.activeGuide}
        setActiveGuide={guides.onSetActiveGuide}
        isOrthogonalVisible={guides.isOrthogonalVisible}
        onToggleOrthogonal={guides.toggleOrthogonal}
        onExportClick={() => setExportModalOpen(true)}
        onEnhance={handleEnhance}
        isEnhancing={isEnhancing}
        enhancementPreview={enhancementPreview}
        onGenerateEnhancementPreview={generateEnhancementPreview}
        backgroundDataUrl={backgroundDataUrl}
        debugInfo={debugInfo}
        strokeMode={strokeMode}
        setStrokeMode={setStrokeMode}
      />

      <main 
        ref={mainAreaRef}
        className="flex-grow h-full relative flex flex-col"
        onPointerEnter={() => {
            if(dragState) dropTargetRef.current = { type: 'canvas' };
        }}
        onPointerLeave={() => {
            if(dragState) dropTargetRef.current = null;
        }}
      >
        <div className="relative flex-grow min-h-0">
            <CanvasContainer
              objects={objects}
              activeItemId={activeItemId}
              {...toolSettings}
              tool={tool}
              setTool={setTool}
              onDrawCommit={handleDrawCommit}
              onUpdateItem={updateItem}
              viewTransform={canvasView.viewTransform}
              setViewTransform={canvasView.setViewTransform}
              {...guides}
              onSelectItem={handleSelectItem}
              isCropping={isCropping}
              cropRect={cropRect}
              setCropRect={setCropRect}
              isTransforming={isTransforming}
              transformState={transformState}
              setTransformState={setTransformState}
              transformSourceBbox={transformSourceBbox}
              isAspectRatioLocked={isAspectRatioLocked}
              strokeMode={strokeMode}
              strokeState={strokeState}
              setStrokeState={setStrokeState}
            />
            <QuickAccessBar
                settings={quickAccess.quickAccessSettings}
                onUpdateColor={quickAccess.updateColor}
                onUpdateSize={quickAccess.updateSize}
                onUpdateTool={quickAccess.updateTool}
                onSelectColor={handleSelectQuickAccessColor}
                onSelectSize={handleSelectQuickAccessSize}
                onSelectTool={handleSelectQuickAccessTool}
                onOpenToolSelector={handleOpenToolSelector}
                activeTool={tool}
                activeColor={activeToolProps.color}
                activeSize={activeToolProps.size}
            />
            <CanvasToolbar
              tool={tool}
              setTool={setTool}
              onZoomExtents={canvasView.onZoomExtents}
              onZoomIn={canvasView.onZoomIn}
              onZoomOut={canvasView.onZoomOut}
              onUndo={undo}
              onRedo={redo}
              onClearAll={() => setShowClearConfirm(true)}
              canUndo={canUndo}
              canRedo={canRedo}
              isCropping={isCropping}
              onApplyCrop={handleApplyCrop}
              onCancelCrop={handleCancelCrop}
              isTransforming={isTransforming}
              transformState={transformState}
              onApplyTransform={handleApplyTransform}
              onCancelTransform={handleCancelTransform}
              isAspectRatioLocked={isAspectRatioLocked}
              onSetAspectRatioLocked={setAspectRatioLocked}
              activeGuide={guides.activeGuide}
              onSetActiveGuide={guides.onSetActiveGuide}
              onSetGridType={guides.setGridType}
              isSnapToGridEnabled={guides.isSnapToGridEnabled}
              onToggleSnapToGrid={guides.toggleSnapToGrid}
              isOrthogonalVisible={guides.isOrthogonalVisible}
              perspectiveMatchState={guides.perspectiveMatchState}
              onStartPerspectiveMatch={guides.onStartPerspectiveMatch}
              onCancelPerspectiveMatch={guides.onCancelPerspectiveMatch}
              orthogonalGuide={guides.orthogonalGuide}
              onSetOrthogonalAngle={guides.onSetOrthogonalAngle}
              gridGuide={guides.gridGuide}
              onSetGridSpacing={guides.onSetGridSpacing}
              onSetGridMajorLineFrequency={guides.onSetGridMajorLineFrequency}
              onSetGridIsoAngle={guides.onSetGridIsoAngle}
              areGuidesLocked={guides.areGuidesLocked}
              onSetAreGuidesLocked={guides.setAreGuidesLocked}
              isPerspectiveStrokeLockEnabled={guides.isPerspectiveStrokeLockEnabled}
              onSetIsPerspectiveStrokeLockEnabled={guides.setIsPerspectiveStrokeLockEnabled}
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
            />
            <div className="absolute bottom-4 left-4 bg-[--bg-primary]/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-[--text-secondary] shadow-lg z-10 pointer-events-none">
                {canvasSize.width} x {canvasSize.height} px
            </div>
        </div>

        <button
          onClick={() => setIsRightSidebarVisible(prev => !prev)}
          className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-[--bg-tertiary] hover:bg-[--accent-primary] text-[--text-secondary] hover:text-white rounded-full z-30 flex items-center justify-center transition-colors shadow-md border-2 border-[--bg-primary] ${isRightSidebarVisible ? 'right-0 translate-x-1/2' : 'right-2'}`}
          title={isRightSidebarVisible ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        >
            {isRightSidebarVisible
                ? <ChevronRightIcon className="w-5 h-5" />
                : <ChevronLeftIcon className="w-5 h-5" />}
        </button>
      </main>

      {isRightSidebarVisible && (
        <aside ref={rightSidebarRef} className="w-80 h-full bg-[--bg-primary] flex-shrink-0 flex flex-col">
            <div className="flex-shrink-0 p-2 flex items-center justify-end gap-2 border-b border-[--bg-tertiary]">
              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full bg-[--bg-secondary] text-[--text-primary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                  {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
              <div className="relative">
                  <button
                      ref={workspaceButtonRef}
                      onClick={() => setWorkspacePopoverOpen(prev => !prev)}
                      className="p-2 rounded-full bg-[--bg-secondary] text-[--text-primary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors"
                      title="Plantillas de Espacio de Trabajo"
                  >
                      <BookmarkIcon className="w-5 h-5" />
                  </button>
                  <WorkspaceTemplatesPopover
                      isOpen={isWorkspacePopoverOpen}
                      onClose={() => setWorkspacePopoverOpen(false)}
                      templates={templates.templates}
                      onSave={handleSaveWorkspace}
                      onLoad={handleLoadWorkspace}
                      onDelete={handleDeleteWorkspace}
                      onResetPreferences={() => setIsResetConfirmOpen(true)}
                  />
              </div>
              <button
                  onClick={() => setProjectGalleryOpen(true)}
                  className="p-2 rounded-full bg-[--bg-secondary] text-[--text-primary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors"
                  title="Mis Proyectos"
              >
                  <GalleryIcon className="w-5 h-5" />
              </button>
              <Auth user={user} />
            </div>
            <div style={{ height: rightSidebarTopHeight ? `${rightSidebarTopHeight}px` : '75%' }}>
              <Outliner
                  items={objects}
                  activeItemId={activeItemId}
                  onAddItem={addItem}
                  onCopyItem={copyItem}
                  onDeleteItem={deleteItem}
                  onSelectItem={handleSelectItem}
                  onUpdateItem={updateItem}
                  onMoveItem={handleMoveItem}
                  onMergeItems={handleMergeItems}
                  onUpdateBackground={handleUpdateBackground}
                  onRemoveBackgroundImage={handleRemoveBackgroundImage}
                  onExportItem={handleExportSingleItem}
                  onOpenCanvasSizeModal={() => setCanvasSizeModalOpen(true)}
                  dragState={dragState}
                  onStartDrag={handleStartDrag}
                  onEndDrag={handleEndDrag}
                  activeItemState={activeItemState}
                  onMoveItemUpDown={handleMoveItemUpDown}
                  onMergeItemDown={handleMergeItemDown}
                  onMergeItemUp={handleMergeItemUp}
              />
            </div>
            <div
                onPointerDown={handlePointerDownResize}
                className="w-full h-1.5 bg-[--bg-tertiary] hover:bg-[--accent-primary] cursor-ns-resize flex-shrink-0"
            />
            <div className="flex-grow min-h-0">
              <Library
                  user={user}
                  items={library.libraryItems}
                  onImportImage={library.onImportToLibrary}
                  onEditItem={handleEditLibraryItem}
                  onDeleteItem={library.onDeleteLibraryItem}
                  onStartDrag={handleStartDrag}
                  onAddItemToScene={handleAddItemToSceneFromLibrary}
              />
            </div>
        </aside>
      )}
      
      {library.imageToEdit && (
        <TransparencyEditor 
          item={library.imageToEdit} 
          onCancel={library.onCancelEditTransparency}
          onApply={library.onApplyTransparency}
        />
      )}
      
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setExportModalOpen(false)}
        drawableObjects={drawableObjects}
        canvasSize={canvasSize}
      />

      <SingleObjectExportModal
        isOpen={isSingleExportModalOpen}
        onClose={() => setSingleExportModalOpen(false)}
        item={activeItem}
        canvasSize={canvasSize}
        onSaveToLibrary={handleSaveItemToLibrary}
      />
      
      <ConfirmDeleteModal 
        isOpen={!!itemToDelete}
        onCancel={() => setDeletingItemId(null)}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.name || ''}
        itemType={itemToDelete?.type || 'object'}
      />
      
      <ConfirmClearModal 
        isOpen={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClear}
      />

      <CanvasSizeModal
        isOpen={isCanvasSizeModalOpen}
        onClose={() => setCanvasSizeModalOpen(false)}
        currentSize={canvasSize}
        onApply={handleResizeCanvas}
      />

      <ConfirmDeleteLibraryItemModal
        isOpen={!!library.deletingLibraryItemId}
        onCancel={library.onCancelDeleteLibraryItem}
        onConfirm={library.onConfirmDeleteLibraryItem}
      />
      
      <ToolSelectorModal
        isOpen={isToolSelectorOpen}
        onClose={() => setIsToolSelectorOpen(false)}
        onSelectTool={handleSelectToolForSlot}
        fxPresets={toolSettings.brushPresets}
      />

      <ProjectGalleryModal
          isOpen={isProjectGalleryOpen}
          onClose={() => setProjectGalleryOpen(false)}
          user={user}
          projects={projects}
          isLoading={projectsLoading}
          onSave={handleSaveProjectToCloud}
          onLoad={handleLoadProjectFromCloud}
          onDelete={handleDeleteProjectFromCloud}
          onSaveLocally={handleSaveProjectLocally}
          onLoadFromFile={handleLoadProjectFromFile}
      />
      
      <ConfirmResetModal
        isOpen={isResetConfirmOpen}
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetPreferences}
      />

    </div>
  );
}

export default App;