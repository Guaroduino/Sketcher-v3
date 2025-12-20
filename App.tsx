import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo, useLayoutEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from './firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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
import { useCanvasView, MAX_ZOOM } from './hooks/useCanvasView';
import { useCanvasModes } from './hooks/useCanvasModes';
import { useWorkspaceTemplates } from './hooks/useWorkspaceTemplates';
import { useQuickAccess } from './hooks/useQuickAccess';
import { useAIPanel } from './hooks/useAIPanel';
import { QuickAccessBar } from './components/QuickAccessBar';
import { ToolSelectorModal } from './components/modals/ToolSelectorModal';
import { WorkspaceTemplatesPopover } from './components/WorkspaceTemplatesPopover';
import { AIPanel } from './components/AIPanel';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { CanvasSizeModal } from './components/modals/CanvasSizeModal';
import { ConfirmClearModal } from './components/modals/ConfirmClearModal';
import { ConfirmDeleteLibraryItemModal } from './components/modals/ConfirmDeleteLibraryItemModal';
import { ConfirmResetModal } from './components/modals/ConfirmResetModal';
import { CropIcon, CheckIcon, XIcon, RulerIcon, PerspectiveIcon, ImageSquareIcon, OrthogonalIcon, MirrorIcon, GridIcon, IsometricIcon, LockIcon, LockOpenIcon, TransformIcon, FreeTransformIcon, SunIcon, MoonIcon, CopyIcon, CutIcon, PasteIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon, GoogleIcon, LogOutIcon, ArrowUpIcon, ArrowDownIcon, SnapIcon, BookmarkIcon, SaveIcon, FolderOpenIcon, GalleryIcon, StrokeModeIcon, FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon, ExpandIcon, MinimizeIcon, SolidLineIcon, DashedLineIcon, DottedLineIcon, DashDotLineIcon, HistoryIcon, MoreVerticalIcon, AddAboveIcon, AddBelowIcon, HandRaisedIcon, DownloadIcon, SparklesIcon } from './components/icons';
import type { SketchObject, ItemType, Tool, CropRect, TransformState, WorkspaceTemplate, QuickAccessTool, ProjectFile, Project, StrokeMode, StrokeState, CanvasItem, StrokeModifier, ScaleUnit, Selection, ClipboardData, AppState, Point } from './types';
import { getContentBoundingBox, createNewCanvas, createThumbnail, cloneCanvas } from './utils/canvasUtils';

type Theme = 'light' | 'dark';

// Helper to convert a Data URL to a Base64 string for the API
const dataURLtoBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// ===================================================================================
// REFACTORED HOOKS
// ===================================================================================

/**
 * Manages UI state such as modals, sidebars, and fullscreen mode.
 */
function useAppUI() {
    const [isExportModalOpen, setExportModalOpen] = useState(false);
    const [isSingleExportModalOpen, setSingleExportModalOpen] = useState(false);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isCanvasSizeModalOpen, setCanvasSizeModalOpen] = useState(false);
    const [isProjectGalleryOpen, setProjectGalleryOpen] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(false);
    const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(false);
    const [rightSidebarTopHeight, setRightSidebarTopHeight] = useState<number | undefined>(undefined);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [showSplash, setShowSplash] = useState(true);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const rightSidebarRef = useRef<HTMLElement>(null);
    const resizeDataRef = useRef({ isResizing: false, startY: 0, startHeight: 0 });

    // UI Scaling
    const [uiScale, setUiScale] = useState(1);

    useEffect(() => {
        const storedScale = localStorage.getItem('sketcher-ui-scale');
        if (storedScale) {
            const scale = parseFloat(storedScale);
            setUiScale(scale);
            document.documentElement.style.fontSize = `${16 * scale}px`;
        }
    }, []);

    const handleUiScaleChange = (newScale: number) => {
        // Clamp scale between 0.5 (small) and 1.5 (large)
        const scale = Math.max(0.5, Math.min(1.5, newScale));
        setUiScale(scale);
        document.documentElement.style.fontSize = `${16 * scale}px`;
        // Removed automatic saving to localStorage
    };

    const handleSaveUiScale = () => {
        localStorage.setItem('sketcher-ui-scale', String(uiScale));
        alert("Configuración de tamaño guardada correctamente para futuros inicios.");
    };

    useEffect(() => {
        if (rightSidebarRef.current && rightSidebarTopHeight === undefined) {
            const initialHeight = rightSidebarRef.current.offsetHeight * 0.75;
            setRightSidebarTopHeight(initialHeight);
        }
    }, [rightSidebarTopHeight]);

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

    const handleToggleFullscreen = () => {
        if (!isFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const handleStart = () => {
        setShowSplash(false);
        if (!isFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        }
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
        resizeDataRef.current = {
            isResizing: true,
            startY: e.clientY,
            startHeight: topPanel.offsetHeight,
        };
        document.body.style.cursor = 'ns-resize';
        window.addEventListener('pointermove', handlePointerMoveResize);
        window.addEventListener('pointerup', handlePointerUpResize, { once: true });
    }, [handlePointerMoveResize, handlePointerUpResize]);

    return {
        isExportModalOpen, setExportModalOpen,
        isSingleExportModalOpen, setSingleExportModalOpen,
        deletingItemId, setDeletingItemId,
        showClearConfirm, setShowClearConfirm,
        isCanvasSizeModalOpen, setCanvasSizeModalOpen,
        isProjectGalleryOpen, setProjectGalleryOpen,
        isResetConfirmOpen, setIsResetConfirmOpen,
        isRightSidebarVisible, setIsRightSidebarVisible,
        isLeftSidebarVisible, setIsLeftSidebarVisible,
        isHeaderVisible, setIsHeaderVisible,
        rightSidebarTopHeight,
        rightSidebarRef,
        handlePointerDownResize,
        isFullscreen,
        showSplash,
        handleStart,
        handleToggleFullscreen,
        uiScale,
        setUiScale: handleUiScaleChange,
        handleSaveUiScale,
        deferredPrompt,
        handleInstallClick,
    };
}


/**
 * Manages saving, loading, and deleting projects from Firebase and local files.
 */
function useProjectManager(
    user: User | null,
    dispatch: React.Dispatch<any>,
    setProjectGalleryOpen: (isOpen: boolean) => void,
    onZoomExtents: () => void,
    loadToolSettings: (settings: any) => void,
    loadGuidesState: (state: any) => void,
    loadQuickAccessState: (state: any) => void
) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setProjectsLoading(true);
            const q = query(collection(db, `users/${user.uid}/projects`), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const projectPromises = snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    try {
                        const thumbnailUrl = await getDownloadURL(ref(storage, data.thumbnailPath));
                        return {
                            id: doc.id,
                            name: data.name,
                            projectFilePath: data.projectFilePath,
                            thumbnailPath: data.thumbnailPath,
                            thumbnailUrl,
                        } as Project;
                    } catch (error) {
                        console.warn(`Could not get thumbnail for project ${data.name}`, error);
                        return null;
                    }
                });
                const loadedProjects = (await Promise.all(projectPromises)).filter(Boolean) as Project[];
                setProjects(loadedProjects);
                setProjectsLoading(false);
            }, (error) => {
                console.error("Error fetching projects:", error);
                setProjectsLoading(false);
            });
            return () => unsubscribe();
        } else {
            setProjects([]);
            setProjectsLoading(false);
        }
    }, [user]);

    const getFullProjectStateAsFile = useCallback(async (
        getStateToSave: () => { currentState: AppState, guides: any, toolSettings: any, quickAccess: any }
    ): Promise<{ projectBlob: Blob, thumbnailBlob: Blob }> => {

        const { currentState, guides, toolSettings, quickAccess } = getStateToSave();

        const serializedObjects = currentState.objects.map(item => {
            const { canvas, context, backgroundImage, ...rest } = item as SketchObject;
            const serializableItem: any = { ...rest };
            if (item.type === 'object' && canvas) {
                serializableItem.dataUrl = canvas.toDataURL();
            }
            return serializableItem;
        });

        const projectFile: ProjectFile = {
            fileFormatVersion: '1.0',
            canvasSize: currentState.canvasSize,
            objects: serializedObjects as CanvasItem[],
            scaleFactor: currentState.scaleFactor,
            scaleUnit: currentState.scaleUnit,
            guides: guides,
            toolSettings: toolSettings,
            quickAccessSettings: quickAccess,
        };

        const jsonString = JSON.stringify(projectFile);
        const projectBlob = new Blob([jsonString], { type: 'application/json' });

        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = currentState.canvasSize.width;
        compositeCanvas.height = currentState.canvasSize.height;
        const compositeCtx = compositeCanvas.getContext('2d');
        if (compositeCtx) {
            const drawableObjects = currentState.objects;
            const backgroundObject = drawableObjects.find(o => o.type === 'object' && o.isBackground);
            if (backgroundObject?.canvas && backgroundObject.isVisible) {
                compositeCtx.drawImage(backgroundObject.canvas, 0, 0);
            }
            const visibleObjects = drawableObjects.filter((obj): obj is SketchObject => obj.type === 'object' && !obj.isBackground && obj.isVisible && !!obj.canvas);
            [...visibleObjects].reverse().forEach(obj => {
                compositeCtx.globalAlpha = obj.opacity;
                compositeCtx.drawImage(obj.canvas!, 0, 0);
            });
            compositeCtx.globalAlpha = 1.0;
        }

        if (!compositeCanvas) throw new Error("Could not create composite for thumbnail.");
        const thumbnailBlob = await createThumbnail(compositeCanvas, 400, 225);

        return { projectBlob, thumbnailBlob };
    }, []);

    const handleLoadFromFile = useCallback(async (file: File) => {
        try {
            const fileContent = await file.text();
            const projectFile: ProjectFile = JSON.parse(fileContent);

            if (!projectFile.fileFormatVersion || !projectFile.canvasSize || !projectFile.objects) {
                throw new Error("Invalid project file format.");
            }

            const imageLoadPromises = projectFile.objects.map(item => {
                return new Promise<CanvasItem>((resolve, reject) => {
                    const { dataUrl, backgroundImageDataUrl, ...rest } = item as any;

                    if (item.type === 'object' && dataUrl) {
                        const img = new Image();
                        img.onload = () => {
                            const { canvas, context } = createNewCanvas(projectFile.canvasSize.width, projectFile.canvasSize.height);
                            context.drawImage(img, 0, 0);
                            const loadedItem: SketchObject = { ...(rest as SketchObject), canvas, context };
                            resolve(loadedItem);
                        };
                        img.onerror = reject;
                        img.src = dataUrl;
                    } else {
                        resolve(rest as CanvasItem);
                    }
                });
            });

            const loadedObjects = await Promise.all(imageLoadPromises);

            const newState: AppState = {
                objects: loadedObjects,
                canvasSize: projectFile.canvasSize,
                scaleFactor: projectFile.scaleFactor || 5,
                scaleUnit: projectFile.scaleUnit || 'mm',
            };

            dispatch({ type: 'LOAD_PROJECT_STATE', payload: { newState } });

            if (projectFile.toolSettings) {
                const { brushSettings, eraserSettings, solidMarkerSettings, simpleMarkerSettings, naturalMarkerSettings, airbrushSettings, fxBrushSettings, magicWandSettings, textSettings, advancedMarkerSettings } = projectFile.toolSettings;
                loadToolSettings({ brushSettings, eraserSettings, solidMarkerSettings, simpleMarkerSettings, naturalMarkerSettings, airbrushSettings, fxBrushSettings, magicWandSettings, textSettings, advancedMarkerSettings });
            }
            if (projectFile.guides) loadGuidesState(projectFile.guides);
            if (projectFile.quickAccessSettings) loadQuickAccessState(projectFile.quickAccessSettings);

            setProjectGalleryOpen(false);
            setTimeout(onZoomExtents, 100);

        } catch (error) {
            console.error("Failed to load project from file:", error);
            alert(`Error loading project: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [dispatch, loadToolSettings, loadGuidesState, loadQuickAccessState, setProjectGalleryOpen, onZoomExtents]);

    const handleSaveLocally = useCallback(async (fileName: string, getStateToSave: () => any) => {
        try {
            const { projectBlob } = await getFullProjectStateAsFile(getStateToSave);
            const url = URL.createObjectURL(projectBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.sketcher') ? fileName : `${fileName}.sketcher`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error saving project locally:", error);
            alert(`Error saving project locally: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }, [getFullProjectStateAsFile]);

    const handleSaveProject = useCallback(async (name: string, getStateToSave: () => any) => {
        if (!user) {
            alert("Please log in to save projects to the cloud.");
            return;
        }

        const { projectBlob, thumbnailBlob } = await getFullProjectStateAsFile(getStateToSave);
        const projectId = doc(collection(db, 'dummy')).id;
        const projectFilePath = `users/${user.uid}/projects/${projectId}.sketcher`;
        const thumbnailPath = `users/${user.uid}/projects/thumbnails/${projectId}.png`;

        const projectFileRef = ref(storage, projectFilePath);
        const thumbnailRef = ref(storage, thumbnailPath);

        await uploadBytes(projectFileRef, projectBlob);
        await uploadBytes(thumbnailRef, thumbnailBlob);

        await addDoc(collection(db, `users/${user.uid}/projects`), {
            name: name,
            projectFilePath: projectFilePath,
            thumbnailPath: thumbnailPath,
            createdAt: serverTimestamp(),
        });
    }, [user, getFullProjectStateAsFile]);

    const handleLoadProject = useCallback(async (project: Project) => {
        if (!user) return;
        try {
            const url = await getDownloadURL(ref(storage, project.projectFilePath));
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], `${project.name}.sketcher`);
            await handleLoadFromFile(file);
        } catch (error) {
            console.error("Error loading project from cloud:", error);
            alert("Failed to load project.");
        }
    }, [user, handleLoadFromFile]);

    const handleDeleteProject = useCallback(async (project: Project) => {
        if (!user) return;
        try {
            const docRef = doc(db, `users/${user.uid}/projects`, project.id);
            const projectFileRef = ref(storage, project.projectFilePath);
            const thumbnailRef = ref(storage, project.thumbnailPath);

            await deleteDoc(docRef);
            await Promise.all([
                deleteObject(projectFileRef).catch(e => console.warn("Project file delete failed, it might not exist.", e)),
                deleteObject(thumbnailRef).catch(e => console.warn("Thumbnail delete failed, it might not exist.", e))
            ]);
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Failed to delete project.");
        }
    }, [user]);

    return {
        projects,
        projectsLoading,
        saveProject: handleSaveProject,
        loadProject: handleLoadProject,
        deleteProject: handleDeleteProject,
        saveLocally: handleSaveLocally,
        loadFromFile: handleLoadFromFile,
    };
}


/**
 * Manages AI-powered image enhancement features using the Gemini API.
 */
function useAI(
    dispatch: React.Dispatch<any>,
    onImportToLibrary: (file: File, parentId: string | null, options?: { scaleFactor?: number }) => void,
    handleSelectItem: (id: string | null) => void,
    setTool: (tool: Tool) => void,
    currentScaleFactor: number
) {
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancementPreview, setEnhancementPreview] = useState<{
        fullDataUrl: string;
        croppedDataUrl: string | null;
        bbox: CropRect | null;
    } | null>(null);
    const [backgroundDataUrl, setBackgroundDataUrl] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<{ prompt: string; images: { name: string; url: string }[] } | null>(null);

    const getCombinedBbox = useCallback((objectsToScan: SketchObject[]): CropRect | null => {
        let combinedBbox: CropRect | null = null;
        objectsToScan.forEach(obj => {
            if (!obj.canvas) return;
            const bbox = getContentBoundingBox(obj.canvas);
            if (bbox) {
                if (!combinedBbox) { combinedBbox = { ...bbox }; }
                else {
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

    const getCompositeCanvas = useCallback((
        includeBackground: boolean,
        canvasSize: { width: number, height: number },
        getDrawableObjects: () => CanvasItem[],
        backgroundObject: SketchObject | undefined
    ): HTMLCanvasElement | null => {
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = canvasSize.width;
        compositeCanvas.height = canvasSize.height;
        const compositeCtx = compositeCanvas.getContext('2d');
        if (!compositeCtx) return null;

        const drawable = getDrawableObjects();

        if (includeBackground && backgroundObject?.canvas && backgroundObject.isVisible) {
            compositeCtx.drawImage(backgroundObject.canvas, 0, 0);
        }

        const visibleObjects = drawable.filter((obj): obj is SketchObject => obj.type === 'object' && !obj.isBackground && obj.isVisible && !!obj.canvas);
        [...visibleObjects].reverse().forEach(obj => {
            compositeCtx.globalAlpha = obj.opacity;
            compositeCtx.drawImage(obj.canvas!, 0, 0);
        });
        compositeCtx.globalAlpha = 1.0;
        return compositeCanvas;
    }, []);

    const generateEnhancementPreview = useCallback((
        canvasSize: { width: number, height: number },
        getDrawableObjects: () => CanvasItem[],
        backgroundObject: SketchObject | undefined,
        includeBackground: boolean
    ) => {
        setEnhancementPreview(null);
        setTimeout(() => {
            const compositeCanvas = getCompositeCanvas(includeBackground, canvasSize, getDrawableObjects, backgroundObject);
            if (!compositeCanvas) return;

            const visibleObjects = getDrawableObjects().filter((obj): obj is SketchObject => obj.type === 'object' && !obj.isBackground && obj.isVisible && !!obj.canvas);
            const combinedBbox = getCombinedBbox(visibleObjects);
            const fullDataUrl = compositeCanvas.toDataURL('image/png');
            let croppedDataUrl: string | null = null;

            // For composition (includeBackground=true), we usually care about the full scene, 
            // but we can still calculate crop if needed. However, usually composition prompt applies to whole scene.
            // If includeBackground is true, bbox might be irrelevant or should be full canvas?
            // Let's keep calculating bbox for "Solo Contenido" mode if user switches to it, 
            // though for composition usually it implies full canvas.

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
            setEnhancementPreview({ fullDataUrl, croppedDataUrl, bbox: combinedBbox });
        }, 10);
    }, [getCompositeCanvas, getCombinedBbox]);

    const processChromaKey = (image: HTMLImageElement): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Sample corners
        const corners = [
            { x: 0, y: 0 },
            { x: canvas.width - 1, y: 0 },
            { x: 0, y: canvas.height - 1 },
            { x: canvas.width - 1, y: canvas.height - 1 }
        ];

        const cornerColors: { r: number, g: number, b: number }[] = [];
        corners.forEach(p => {
            const i = (p.y * canvas.width + p.x) * 4;
            cornerColors.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        });

        const tolerance = 60;
        const isMatch = (r: number, g: number, b: number, target: { r: number, g: number, b: number }) => {
            return Math.abs(r - target.r) < tolerance &&
                Math.abs(g - target.g) < tolerance &&
                Math.abs(b - target.b) < tolerance;
        };

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (cornerColors.some(c => isMatch(r, g, b, c))) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    };

    const handleEnhance = useCallback(async (
        payload: any,
        canvasSize: { width: number, height: number },
        getDrawableObjects: () => CanvasItem[],
        backgroundObject: SketchObject | undefined,
        activeItemId: string | null,
        allObjects: CanvasItem[]
    ) => {
        setDebugInfo(null);
        setIsEnhancing(true);
        let finalPrompt = '';
        const parts: any[] = [];
        const debugImages: { name: string; url: string }[] = [];
        let referenceWidth = canvasSize.width;

        const visibleObjects = getDrawableObjects().filter((obj): obj is SketchObject => obj.type === 'object' && !obj.isBackground && obj.isVisible && !!obj.canvas);
        let filteredObjects = visibleObjects;

        if (payload.sourceScope === 'layer' && activeItemId) {
            const activeItem = allObjects.find(i => i.id === activeItemId);
            const parentId = activeItem?.type === 'group' ? activeItem.id : activeItem?.parentId;
            filteredObjects = visibleObjects.filter(obj => obj.parentId === (parentId || null));
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            switch (payload.activeAiTab) {
                case 'object': {
                    const { enhancementPrompt, enhancementStylePrompt, enhancementNegativePrompt, enhancementCreativity, enhancementInputMode, enhancementChromaKey, enhancementPreviewBgColor } = payload;
                    if (!enhancementPrompt) throw new Error("Description prompt is required.");

                    // Manual Composite Logic for filteredObjects
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvasSize.width;
                    tempCanvas.height = canvasSize.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (!tempCtx) throw new Error("Canvas context error");

                    [...filteredObjects].reverse().forEach(obj => {
                        if (obj.canvas) {
                            tempCtx.globalAlpha = obj.opacity;
                            tempCtx.drawImage(obj.canvas, 0, 0);
                        }
                    });
                    tempCtx.globalAlpha = 1.0;

                    const compositeCanvas = tempCanvas;
                    let imageCanvas = compositeCanvas;

                    // Bbox Logic
                    const combinedBbox = getCombinedBbox(filteredObjects);

                    if (combinedBbox && combinedBbox.width > 0 && combinedBbox.height > 0) {
                        referenceWidth = combinedBbox.width;
                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = combinedBbox.width;
                        cropCanvas.height = combinedBbox.height;
                        const cropCtx = cropCanvas.getContext('2d');
                        if (cropCtx) {
                            cropCtx.drawImage(compositeCanvas, combinedBbox.x, combinedBbox.y, combinedBbox.width, combinedBbox.height, 0, 0, combinedBbox.width, combinedBbox.height);
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

                    let creativityInstruction = '';
                    if (enhancementCreativity <= 40) creativityInstruction = 'Sé muy fiel a la imagen de entrada y a la descripción proporcionada. Realiza solo los cambios solicitados.';
                    else if (enhancementCreativity <= 80) creativityInstruction = 'Mantén una fidelidad moderada a la imagen y descripción, pero puedes hacer pequeñas mejoras estéticas.';
                    else if (enhancementCreativity <= 120) creativityInstruction = 'Usa la imagen y la descripción como una fuerte inspiración. Siéntete libre de reinterpretar elementos para un mejor resultado artístico.';
                    else creativityInstruction = 'Usa la imagen y la descripción solo como una vaga inspiración. Prioriza un resultado impactante y altamente creativo sobre la fidelidad al original.';

                    const promptParts = [
                        `Tu tarea es mejorar o transformar una imagen de entrada.`,
                        `Descripción de la transformación deseada: "${enhancementPrompt}".`,
                        `El estilo visual a aplicar es: "${enhancementStylePrompt}".`,
                        creativityInstruction,
                    ];
                    if (enhancementNegativePrompt.trim()) promptParts.push(`Asegúrate de evitar estrictamente lo siguiente: "${enhancementNegativePrompt}".`);
                    if (enhancementChromaKey !== 'none') {
                        const colorHex = enhancementChromaKey === 'green' ? '#00FF00' : '#0000FF';
                        promptParts.push(`Importante: La imagen resultante DEBE tener un fondo de croma sólido y uniforme de color ${enhancementChromaKey} (${colorHex}). El sujeto principal no debe contener este color.`);
                    }
                    finalPrompt = promptParts.join(' ');
                    break;
                }
                case 'composition': {
                    const compositeCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);
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
                    const slots: ('main' | 'a' | 'b' | 'c')[] = ['main', 'a', 'b', 'c'];
                    const slotNames = ['Objeto Principal', 'Elemento A', 'Elemento B', 'Elemento C'];
                    slots.forEach((slot, index) => {
                        const slotData = payload.freeFormSlots[slot];
                        if (slotData?.url) {
                            debugImages.push({ name: slotNames[index], url: slotData.url });
                            // Add a text label identifying this image
                            parts.push({ text: `[Imagen: ${slotNames[index]}]` });
                            parts.push({ inlineData: { mimeType: 'image/png', data: dataURLtoBase64(slotData.url) } });
                        }
                    });
                    finalPrompt = payload.freeFormPrompt;
                    break;
                }
            }

            setDebugInfo({ prompt: finalPrompt, images: debugImages });

            const textPart = { text: finalPrompt };
            const model = 'gemini-3-pro-image-preview';
            const config = { responseModalities: [Modality.IMAGE, Modality.TEXT] };
            const contents = (parts.length > 0) ? { parts: [...parts, textPart] } : { parts: [textPart] };

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            if (newImageBase64) {
                const img = new Image();
                img.onload = async () => {
                    const newName = `IA: ${finalPrompt.substring(0, 20)}...`;
                    const newScaleFactor = (img.width * currentScaleFactor) / (referenceWidth || 1);

                    let finalImg = img;
                    let finalScaleFactor = newScaleFactor;
                    let processedDataUrl = `data:image/png;base64,${newImageBase64}`;

                    // Auto-Chroma Processing
                    if (payload.enhancementChromaKey && payload.enhancementChromaKey !== 'none') {
                        const processedCanvas = processChromaKey(img);
                        processedDataUrl = processedCanvas.toDataURL('image/png');
                        const processedImg = new Image();
                        await new Promise((resolve) => {
                            processedImg.onload = resolve;
                            processedImg.src = processedDataUrl;
                        });
                        finalImg = processedImg;
                    }

                    if (payload.activeAiTab === 'composition') {
                        if (payload.shouldUpdateBackground !== false) { // Default to true if undefined
                            dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: finalImg } });
                        }
                    }

                    // Common Handling for All Tabs (Library, Canvas Layer, Delete Content)

                    // 1. Add to Library (Default or Checked)
                    // Note: Composition images might be large, but user might still want them in library.
                    if (payload.shouldAddToLibrary) {
                        fetch(processedDataUrl).then(res => res.blob()).then(blob => {
                            if (blob) onImportToLibrary(new File([blob], `${newName}.png`, { type: 'image/png' }), null, { scaleFactor: finalScaleFactor });
                        });
                    }

                    // 2. Add to Canvas (If Checked)
                    // For composition, this means adding the full scene as a new layer object.
                    if (payload.shouldAddToCanvas) {
                        const newItemId = `object-${Date.now()}`;
                        dispatch({
                            type: 'ADD_ITEM',
                            payload: {
                                type: 'object',
                                activeItemId: null,
                                newItemId,
                                imageElement: finalImg,
                                canvasSize,
                                name: newName,
                                initialDimensions: {
                                    width: referenceWidth, // For composition, referenceWidth is usually canvas width
                                    height: referenceWidth * (img.height / img.width)
                                }
                            }
                        });
                        handleSelectItem(newItemId);
                        setTool('select');
                    }

                    // 3. Remove Content Logic
                    // For composition, "Quitar Contenido Usado" might mean clearing the layers used for composition?
                    // User request: "para borrar contenido usado".
                    // Logic: If shouldRemoveContent is true, remove visibleObjects (which are the input).
                    if (payload.shouldRemoveContent && visibleObjects.length > 0) {
                        // Apply Source Scope Filter again to be safe? 
                        // Actually visibleObjects in scope should determine what is "used content".
                        // Wait, 'visibleObjects' was calculated at start of handleEnhance. 
                        // But 'filteredObjects' is what we actually used if sourceScope was 'layer'.
                        // We should probably delete 'filteredObjects' if sourceScope was active.
                        // Let's use 'filteredObjects' which respects the scope.

                        // Wait, current implementation uses 'visibleObjects' for deletion in the else block.
                        // We should consistently use 'filteredObjects' for deletion if we want to delete ONLY what was used.
                        // If sourceScope='all', visibleObjects === filteredObjects.
                        // If sourceScope='layer', we only delete the layer used.

                        filteredObjects.forEach(obj => {
                            dispatch({ type: 'DELETE_ITEM', payload: { id: obj.id } });
                        });
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
    }, [dispatch, onImportToLibrary, handleSelectItem, setTool, getCompositeCanvas, getCombinedBbox]);

    return {
        isEnhancing,
        enhancementPreview,
        backgroundDataUrl,
        setBackgroundDataUrl,
        debugInfo,
        generateEnhancementPreview,
        handleEnhance,
    };
}

// ===================================================================================
// MAIN APP COMPONENT
// ===================================================================================

export function App() {
    const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
    const { present: currentState, past, future } = historyState;
    // Fix: Fallback for legacy states (undefined/null/0)
    const { objects, canvasSize, scaleUnit = 'mm' } = currentState;
    const scaleFactor = (currentState.scaleFactor && currentState.scaleFactor > 0) ? currentState.scaleFactor : 0.1;

    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [tool, setTool] = useState<Tool>('brush');
    const mainAreaRef = useRef<HTMLDivElement>(null);

    const [theme, setTheme] = useState<Theme>('dark');
    const [user, setUser] = useState<User | null>(null);

    const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
    const [editingToolSlotIndex, setEditingToolSlotIndex] = useState<number | null>(null);

    const [strokeMode, setStrokeMode] = useState<StrokeMode>('freehand');
    const [strokeState, setStrokeState] = useState<StrokeState | null>(null);
    const [strokeModifier, setStrokeModifier] = useState<StrokeModifier>({ style: 'solid', scale: 1 });
    const [isPalmRejectionEnabled, setIsPalmRejectionEnabled] = useState(false); // Default: Disabled (Touch can draw)
    const [debugPointers, setDebugPointers] = useState<Map<number, { x: number, y: number }>>(new Map());

    // -- 3. CUSTOM HOOKS --
    const [selection, setSelection] = useState<Selection | null>(null);
    const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

    const [textEditState, setTextEditState] = useState<{ position: Point; value: string; activeItemId: string; } | null>(null);

    const [strokeSmoothing, setStrokeSmoothing] = useState(0.5);

    const ui = useAppUI();

    // Custom Hooks
    const toolSettings = useToolSettings();
    const library = useLibrary(user);
    const guides = useGuides(canvasSize);
    const { getMinZoom, ...canvasView } = useCanvasView(mainAreaRef, canvasSize);
    const templates = useWorkspaceTemplates();
    const quickAccess = useQuickAccess();

    const handleSelectItem = useCallback((id: string | null) => {
        setSelectedItemIds(id ? [id] : []);
        if (!id || (selection && selection.sourceItemId !== id)) {
            setSelection(null);
        }
    }, [selection]);

    const ai = useAI(dispatch, library.onImportToLibrary, handleSelectItem, setTool, scaleFactor);
    const aiPanelState = useAIPanel();

    const loadAllToolSettings = useCallback((settings: any) => {
        toolSettings.setBrushSettings(settings.brushSettings);
        toolSettings.setEraserSettings(settings.eraserSettings);
        // FIX: Use setSimpleMarkerSettings and check for both old 'solidMarkerSettings' and new 'simpleMarkerSettings' for backward compatibility.
        toolSettings.setSimpleMarkerSettings(settings.solidMarkerSettings || settings.simpleMarkerSettings);
        toolSettings.setNaturalMarkerSettings(settings.naturalMarkerSettings);
        toolSettings.setAirbrushSettings(settings.airbrushSettings);
        toolSettings.setFxBrushSettings(settings.fxBrushSettings);
        if (settings.magicWandSettings) toolSettings.setMagicWandSettings(settings.magicWandSettings);
        if (settings.textSettings) toolSettings.setTextSettings(settings.textSettings);
        if (settings.advancedMarkerSettings) toolSettings.setAdvancedMarkerSettings(settings.advancedMarkerSettings);
    }, [toolSettings]);

    const projects = useProjectManager(user, dispatch, ui.setProjectGalleryOpen, canvasView.onZoomExtents, loadAllToolSettings, guides.loadGuideState, quickAccess.loadState);

    const { onDropOnCanvas } = useCanvasModes(tool, setTool, dispatch, library.libraryItems, canvasSize, currentState.scaleFactor);

    const [isInitialized, setIsInitialized] = useState(false);
    const [isWorkspacePopoverOpen, setWorkspacePopoverOpen] = useState(false);
    const workspaceButtonRef = useRef<HTMLButtonElement>(null);

    const [isScalePopoverOpen, setIsScalePopoverOpen] = useState(false);
    const scaleButtonRef = useRef<HTMLButtonElement>(null);

    // Crop & Transform State
    const [isCropping, setIsCropping] = useState(false);
    const [cropRect, setCropRect] = useState<CropRect | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const [transformState, setTransformState] = useState<TransformState | null>(null);
    const [transformSourceBbox, setTransformSourceBbox] = useState<CropRect | null>(null);
    const [isAspectRatioLocked, setAspectRatioLocked] = useState(false);
    const [isAngleSnapEnabled, setIsAngleSnapEnabled] = useState(false);
    const [angleSnapValue, setAngleSnapValue] = useState<1 | 5 | 10 | 15>(15);

    const activeItemId = selectedItemIds.length > 0 ? selectedItemIds[selectedItemIds.length - 1] : null;
    const activeItem = activeItemId ? objects.find(o => o.id === activeItemId) : null;
    const canUndo = past.length > 0;
    const canRedo = future.length > 0;
    const backgroundObject = objects.find((o): o is SketchObject => o.type === 'object' && !!o.isBackground);
    const isAiModalOpen = tool === 'enhance';

    const { activeColor, activeSize } = useMemo(() => {
        let color: string | undefined, size: number | undefined;
        switch (tool) {
            case 'brush': color = toolSettings.brushSettings.color; size = toolSettings.brushSettings.size; break;
            // FIX: Renamed 'solid-marker' to 'simple-marker' and using simpleMarkerSettings.
            case 'simple-marker': color = toolSettings.simpleMarkerSettings.color; size = toolSettings.simpleMarkerSettings.size; break;
            case 'natural-marker': color = toolSettings.naturalMarkerSettings.color; size = toolSettings.naturalMarkerSettings.size; break;
            case 'airbrush': color = toolSettings.airbrushSettings.color; size = toolSettings.airbrushSettings.size; break;
            case 'fx-brush': color = toolSettings.fxBrushSettings.color; size = toolSettings.fxBrushSettings.size; break;
            case 'eraser': size = toolSettings.eraserSettings.size; break;
        }
        return { activeColor: color, activeSize: size };
    }, [tool, toolSettings]);

    const handleSelectColor = useCallback((color: string) => {
        switch (tool) {
            case 'brush': toolSettings.setBrushSettings(s => ({ ...s, color })); break;
            // FIX: Renamed 'solid-marker' to 'simple-marker' and using setSimpleMarkerSettings.
            case 'simple-marker': toolSettings.setSimpleMarkerSettings(s => ({ ...s, color })); break;
            case 'natural-marker': toolSettings.setNaturalMarkerSettings(s => ({ ...s, color })); break;
            case 'airbrush': toolSettings.setAirbrushSettings(s => ({ ...s, color })); break;
            case 'fx-brush': toolSettings.setFxBrushSettings(s => ({ ...s, color })); break;
        }
    }, [tool, toolSettings]);

    const handleSelectSize = useCallback((size: number) => {
        switch (tool) {
            case 'brush': toolSettings.setBrushSettings(s => ({ ...s, size })); break;
            case 'eraser': toolSettings.setEraserSettings(s => ({ ...s, size })); break;
            // FIX: Renamed 'solid-marker' to 'simple-marker' and using setSimpleMarkerSettings.
            case 'simple-marker': toolSettings.setSimpleMarkerSettings(s => ({ ...s, size })); break;
            case 'natural-marker': toolSettings.setNaturalMarkerSettings(s => ({ ...s, size })); break;
            case 'airbrush': toolSettings.setAirbrushSettings(s => ({ ...s, size })); break;
            case 'fx-brush': toolSettings.setFxBrushSettings(s => ({ ...s, size })); break;
        }
    }, [tool, toolSettings]);

    const handleSetScaleFactor = useCallback((factor: number) => dispatch({ type: 'SET_SCALE_FACTOR', payload: factor }), [dispatch]);
    const handleSetScaleUnit = useCallback((unit: ScaleUnit) => dispatch({ type: 'SET_SCALE_UNIT', payload: unit }), [dispatch]);

    const handleSaveWorkspace = (name: string) => {
        const newTemplateData: Omit<WorkspaceTemplate, 'id' | 'name'> = {
            canvasSize,
            backgroundColor: backgroundObject?.color || '#FFFFFF',
            scaleFactor: currentState.scaleFactor,
            scaleUnit: currentState.scaleUnit,
            guides: {
                activeGuide: guides.activeGuide, isOrthogonalVisible: guides.isOrthogonalVisible, rulerGuides: guides.rulerGuides,
                mirrorGuides: guides.mirrorGuides, perspectiveGuide: guides.perspectiveGuide, orthogonalGuide: guides.orthogonalGuide,
                gridGuide: guides.gridGuide, areGuidesLocked: guides.areGuidesLocked, isPerspectiveStrokeLockEnabled: guides.isPerspectiveStrokeLockEnabled,
                isSnapToGridEnabled: guides.isSnapToGridEnabled,
            },
            toolSettings: { ...toolSettings },
            quickAccessSettings: quickAccess.quickAccessSettings,
        };
        const newId = templates.saveTemplate(name, newTemplateData);
        localStorage.setItem('sketcher-active-workspace-id', newId);
    };

    const handleLoadWorkspace = useCallback((id: string) => {
        const template = templates.templates.find(t => t.id === id);
        if (!template) return;
        if (template.canvasSize.width !== canvasSize.width || template.canvasSize.height !== canvasSize.height) {
            dispatch({ type: 'RESIZE_CANVAS', payload: { width: template.canvasSize.width, height: template.canvasSize.height } });
        }
        dispatch({ type: 'UPDATE_BACKGROUND', payload: { color: template.backgroundColor } });
        dispatch({ type: 'SET_SCALE_FACTOR', payload: template.scaleFactor });
        dispatch({ type: 'SET_SCALE_UNIT', payload: template.scaleUnit });
        guides.loadGuideState(template.guides);
        loadAllToolSettings(template.toolSettings);
        quickAccess.loadState(template.quickAccessSettings);
        localStorage.setItem('sketcher-active-workspace-id', id);
        setTimeout(canvasView.onZoomExtents, 100);
    }, [templates.templates, canvasSize, dispatch, guides, loadAllToolSettings, quickAccess, canvasView.onZoomExtents]);

    const getDrawableObjects = useCallback(() => {
        const itemMap = new Map<string, CanvasItem>(objects.map(i => [i.id, i]));
        const isEffectivelyVisible = (item: CanvasItem): boolean => {
            if (!item.isVisible) return false;
            if (item.parentId) {
                const parent = itemMap.get(item.parentId);
                if (parent) return isEffectivelyVisible(parent);
            }
            return true;
        };
        return objects.map(item => ({ ...item, isVisible: isEffectivelyVisible(item) }));
    }, [objects]);

    // Effects
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const savedTheme = localStorage.getItem('sketcher-theme') as Theme | null;
        if (savedTheme) setTheme(savedTheme);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('sketcher-theme', theme);
    }, [theme]);

    useLayoutEffect(() => {
        if (isInitialized || !mainAreaRef.current || ui.showSplash) return;
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                dispatch({ type: 'INITIALIZE_CANVASES', payload: { width: Math.floor(width), height: Math.floor(height) } });
                setIsInitialized(true);
                setSelectedItemIds(['object-1']);
                observer.disconnect();
            }
        });
        observer.observe(mainAreaRef.current);
        return () => observer.disconnect();
    }, [isInitialized, ui.showSplash, dispatch]);

    useEffect(() => {
        if (!isInitialized) return;
        const activeWorkspaceId = localStorage.getItem('sketcher-active-workspace-id');
        const templateToLoad = activeWorkspaceId ? templates.templates.find(t => t.id === activeWorkspaceId) : null;
        if (templateToLoad) handleLoadWorkspace(templateToLoad.id);
        else canvasView.onZoomExtents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialized]);

    useEffect(() => {
        if (backgroundObject?.canvas) ai.setBackgroundDataUrl(backgroundObject.canvas.toDataURL());
        else ai.setBackgroundDataUrl(null);
    }, [backgroundObject, backgroundObject?.canvas, ai]);

    useEffect(() => {
        setIsCropping(false); setCropRect(null); setIsTransforming(false); setTransformState(null); setTransformSourceBbox(null);
        if (tool === 'crop') {
            setIsCropping(true);
            setCropRect({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height });
        } else if ((tool === 'transform' || tool === 'free-transform') && activeItem?.type === 'object' && activeItem.canvas) {
            const bbox = getContentBoundingBox(activeItem.canvas);
            if (bbox) {
                setIsTransforming(true); setTransformSourceBbox(bbox);
                if (tool === 'transform') {
                    setTransformState({ type: 'affine', x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, rotation: 0 });
                } else {
                    setTransformState({ type: 'free', x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, corners: { tl: { x: bbox.x, y: bbox.y }, tr: { x: bbox.x + bbox.width, y: bbox.y }, bl: { x: bbox.x, y: bbox.y + bbox.height }, br: { x: bbox.x + bbox.width, y: bbox.y + bbox.height } } });
                }
            } else {
                setTool('select');
            }
        }
    }, [tool, canvasSize.width, canvasSize.height, activeItem, setTool]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setStrokeState(null); setSelection(null); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => { setStrokeState(null); }, [tool, strokeMode]);

    // Callbacks
    const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
    const redo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);
    const addItem = useCallback((type: 'group' | 'object') => {
        const newItemId = `${type}-${Date.now()}`;
        dispatch({ type: 'ADD_ITEM', payload: { type, activeItemId, canvasSize, newItemId } });
        setSelectedItemIds([newItemId]);
        return newItemId;
    }, [activeItemId, canvasSize, dispatch]);
    const copyItem = useCallback((id: string) => dispatch({ type: 'COPY_ITEM', payload: { id } }), [dispatch]);
    const deleteItem = useCallback((id: string) => ui.setDeletingItemId(id), [ui]);
    const handleMoveItem = useCallback((draggedId: string, targetId: string, position: 'top' | 'bottom' | 'middle') => dispatch({ type: 'MOVE_ITEM', payload: { draggedId, targetId, position } }), [dispatch]);
    const handleDrawCommit = useCallback((id: string, beforeCanvas: HTMLCanvasElement) => dispatch({ type: 'COMMIT_DRAWING', payload: { activeItemId: id, beforeCanvas } }), [dispatch]);
    const updateItem = useCallback((id: string, updates: Partial<CanvasItem>) => dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } }), [dispatch]);

    const handleUpdateBackground = useCallback((updates: { color?: string, file?: File, image?: HTMLImageElement }) => {
        if (updates.file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    const img = new Image();
                    img.onload = () => {
                        // Check if canvas has valid dimensions to resize TO
                        if (canvasSize.width > 0 && canvasSize.height > 0) {
                            // Create a temporary canvas to resize the image
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = canvasSize.width;
                            tempCanvas.height = canvasSize.height;
                            const ctx = tempCanvas.getContext('2d');
                            if (ctx) {
                                // Draw image stretched to fit canvas (simplest "limit" approach)
                                ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
                                
                                // Create new image from resized content
                                const resizedImg = new Image();
                                resizedImg.onload = () => {
                                    dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: resizedImg } });
                                };
                                resizedImg.src = tempCanvas.toDataURL();
                            }
                        } else {
                            // Fallback: If canvas is 0x0 (not initialized), set canvas size from image
                            dispatch({ type: 'SET_CANVAS_FROM_IMAGE', payload: { image: img } });
                            canvasView.onZoomExtents();
                        }
                    };
                    img.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(updates.file);
        } else if (updates.image) {
            dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: updates.image } });
        } else if (updates.color) { dispatch({ type: 'UPDATE_BACKGROUND', payload: { color: updates.color } }); }
    }, [canvasSize, canvasView, dispatch]);

    const handleRemoveBackgroundImage = useCallback(() => dispatch({ type: 'REMOVE_BACKGROUND_IMAGE' }), [dispatch]);
    const handleConfirmDelete = useCallback(() => {
        if (!ui.deletingItemId) return;
        dispatch({ type: 'DELETE_ITEM', payload: { id: ui.deletingItemId } });
        setSelectedItemIds(currentIds => currentIds.filter(cid => cid !== ui.deletingItemId));
        ui.setDeletingItemId(null);
    }, [ui, dispatch]);

    const handleMergeItems = useCallback(async (sourceId: string, targetId: string) => {
        dispatch({ type: 'MERGE_ITEMS', payload: { sourceId, targetId } });
        setSelectedItemIds([targetId]);
    }, [dispatch]);

    const handleConfirmClear = useCallback(() => { dispatch({ type: 'CLEAR_CANVAS' }); ui.setShowClearConfirm(false); }, [dispatch, ui]);
    const handleSaveItemToLibrary = useCallback((imageDataUrl: string, name: string) => {
        fetch(imageDataUrl).then(res => res.blob()).then(blob => {
            if (blob) {
                const filename = name.endsWith('.png') ? name : `${name}.png`;
                library.onImportToLibrary(new File([blob], filename, { type: 'image/png' }), null);
            }
        });
    }, [library]);

    const handleCommitText = useCallback((textState: { position: Point; value: string; activeItemId: string; }) => {
        if (!textState.value.trim()) { setTextEditState(null); return; }
        const item = objects.find(o => o.id === textState.activeItemId) as SketchObject;
        if (!item || !item.context) { setTextEditState(null); return; }
        const beforeCanvas = cloneCanvas(item.canvas!);
        const ctx = item.context;
        ctx.save();
        const settings = toolSettings.textSettings;
        ctx.font = `${settings.fontWeight === 'italic' ? 'italic ' : ''}${settings.fontWeight === 'bold' ? 'bold ' : ''}${settings.fontSize}px ${settings.fontFamily}`;
        ctx.fillStyle = settings.color;
        ctx.textAlign = settings.textAlign;
        textState.value.split('\n').forEach((line, index) => ctx.fillText(line, textState.position.x, textState.position.y + (index * settings.fontSize * 1.2)));
        ctx.restore();
        dispatch({ type: 'COMMIT_DRAWING', payload: { activeItemId: textState.activeItemId, beforeCanvas } });
        setTextEditState(null);
    }, [objects, toolSettings.textSettings, dispatch]);

    // Crop & Transform handlers
    const handleApplyCrop = () => { if (cropRect) { dispatch({ type: 'CROP_CANVAS', payload: { cropRect } }); setTool('select'); } };
    const handleCancelCrop = () => setTool('select');
    const handleApplyTransform = () => { if (transformState && transformSourceBbox && activeItem) { dispatch({ type: 'APPLY_TRANSFORM', payload: { id: activeItem.id, transform: transformState, sourceBbox: transformSourceBbox } }); setTool('select'); } };
    const handleCancelTransform = () => setTool('select');

    // Selection handlers
    const handleDeselect = useCallback(() => setSelection(null), []);
    const handleDeleteSelection = useCallback(() => {
        if (!selection || !activeItem || activeItem.type !== 'object' || !activeItem.context) return;
        const beforeCanvas = cloneCanvas(activeItem.canvas!);
        const ctx = activeItem.context;
        ctx.save(); ctx.clip(selection.path); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
        handleDrawCommit(activeItem.id, beforeCanvas);
        setSelection(null);
    }, [selection, activeItem, handleDrawCommit]);

    const handleCopySelection = useCallback(() => {
        if (!selection || !activeItem || activeItem.type !== 'object' || !activeItem.context) return;
        const { boundingBox, path } = selection;
        const ctx = activeItem.context;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = boundingBox.width; tempCanvas.height = boundingBox.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        tempCtx.drawImage(ctx.canvas, boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height, 0, 0, boundingBox.width, boundingBox.height);
        tempCtx.globalCompositeOperation = 'destination-in'; tempCtx.save(); tempCtx.translate(-boundingBox.x, -boundingBox.y); tempCtx.fillStyle = 'black'; tempCtx.fill(path); tempCtx.restore();
        const imageData = tempCtx.getImageData(0, 0, boundingBox.width, boundingBox.height);
        setClipboard({ imageData, sourceRect: boundingBox });
    }, [selection, activeItem]);

    const handleCutSelection = useCallback(() => { handleCopySelection(); handleDeleteSelection(); }, [handleCopySelection, handleDeleteSelection]);
    const handlePaste = useCallback(() => {
        if (!clipboard) return;
        const newItemId = `object-${Date.now()}`;
        dispatch({ type: 'PASTE_FROM_CLIPBOARD', payload: { newItemId, clipboard, canvasSize, activeItemId } });
        handleSelectItem(newItemId);
        setTool('transform');
    }, [clipboard, canvasSize, activeItemId, handleSelectItem, dispatch]);

    // Outliner button logic
    const visualList = useMemo(() => {
        const getVisibleTree = (parentId: string | null = null): CanvasItem[] => {
            return objects.filter(item => item.parentId === parentId && (item.type !== 'object' || !item.isBackground)).flatMap(child => [child, ...(child.type === 'group' ? getVisibleTree(child.id) : [])]);
        };
        return getVisibleTree();
    }, [objects]);

    const activeItemState = useMemo(() => {
        if (!activeItemId) return { canMoveUp: false, canMoveDown: false, canMergeDown: false, canMergeUp: false };
        const currentIndex = visualList.findIndex(item => item.id === activeItemId);
        if (currentIndex === -1) return { canMoveUp: false, canMoveDown: false, canMergeDown: false, canMergeUp: false };

        const canMoveUp = currentIndex < visualList.length - 1;
        const canMoveDown = currentIndex > 0;

        let canMergeUp = false;
        let canMergeDown = false;

        const currentItem = visualList[currentIndex];

        // Merge Up (with visually-above item). Icon is arrow pointing up.
        if (canMoveUp) {
            const itemAbove = visualList[currentIndex + 1];
            if (currentItem.type === 'object' && itemAbove.type === 'object' && currentItem.parentId === itemAbove.parentId) {
                canMergeUp = true;
            }
        }

        // Merge Down (with visually-below item). Icon is arrow pointing down.
        if (canMoveDown) {
            const itemBelow = visualList[currentIndex - 1];
            if (currentItem.type === 'object' && itemBelow.type === 'object' && currentItem.parentId === itemBelow.parentId) {
                canMergeDown = true;
            }
        }

        return { canMoveUp, canMoveDown, canMergeDown, canMergeUp };
    }, [activeItemId, visualList]);

    const handleMoveItemUpDown = useCallback((id: string, direction: 'up' | 'down') => {
        const currentIndex = visualList.findIndex(item => item.id === id);
        if (currentIndex === -1) return;

        // 'up' in UI means moving towards the top of the list, which corresponds to a higher index in the data array.
        const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;

        if (targetIndex < 0 || targetIndex >= visualList.length) return;
        const targetItem = visualList[targetIndex];

        // To move item UP in data array (and UI), place it AFTER its new upper neighbor.
        // To move item DOWN in data array (and UI), place it BEFORE its new lower neighbor.
        const position = direction === 'up' ? 'bottom' : 'top';

        handleMoveItem(id, targetItem.id, position);
    }, [visualList, handleMoveItem]);

    const handleMergeItemDown = useCallback((id: string) => {
        if (activeItemState.canMergeDown) {
            const currentIndex = visualList.findIndex(item => item.id === id);
            // Merging down means merging the current item (top) into the one below it (bottom).
            handleMergeItems(id, visualList[currentIndex - 1].id);
        }
    }, [activeItemState.canMergeDown, visualList, handleMergeItems]);

    const handleMergeItemUp = useCallback((id: string) => {
        if (activeItemState.canMergeUp) {
            const currentIndex = visualList.findIndex(item => item.id === id);
            // Merging up means merging the item above (top) into the current one (bottom).
            handleMergeItems(visualList[currentIndex + 1].id, id);
        }
    }, [activeItemState.canMergeUp, visualList, handleMergeItems]);

    const handleAddObjectAbove = useCallback((id: string) => { const newItemId = `object-${Date.now()}`; dispatch({ type: 'ADD_ITEM', payload: { type: 'object', activeItemId: id, canvasSize, newItemId } }); setSelectedItemIds([newItemId]); }, [canvasSize, dispatch]);
    const handleAddObjectBelow = useCallback((id: string) => { const newItemId = `object-${Date.now()}`; dispatch({ type: 'ADD_ITEM_BELOW', payload: { targetId: id, canvasSize, newItemId } }); setSelectedItemIds([newItemId]); }, [canvasSize, dispatch]);

    const dimensionDisplay = useMemo(() => {
        if (canvasSize.width > 0 && scaleFactor > 0) {
            const widthMm = canvasSize.width / scaleFactor; const heightMm = canvasSize.height / scaleFactor;
            let displayWidth, displayHeight;
            switch (scaleUnit) {
                case 'cm': displayWidth = (widthMm / 10).toFixed(2); displayHeight = (heightMm / 10).toFixed(2); break;
                case 'm': displayWidth = (widthMm / 1000).toFixed(3); displayHeight = (heightMm / 1000).toFixed(3); break;
                default: displayWidth = widthMm.toFixed(1); displayHeight = heightMm.toFixed(1); break;
            }
            return `${canvasSize.width} x ${canvasSize.height}px  ·  ${displayWidth} x ${displayHeight}${scaleUnit}`;
        }
        return null;
    }, [canvasSize, scaleFactor, scaleUnit]);

    const drawableObjects = getDrawableObjects();
    const itemToDelete = objects.find(item => item.id === ui.deletingItemId);

    if (ui.showSplash) {
        return (
            <div className="w-screen h-screen bg-[--bg-primary] text-[--text-primary] flex items-center justify-center font-sans">
                <div className="text-center p-8">
                    <h1 className="text-5xl font-bold mb-4">Sketcher</h1>
                    <p className="text-lg text-[--text-secondary] mb-10">Tu lienzo creativo te espera.</p>
                    <button onClick={ui.handleStart} className="px-10 py-4 bg-[--accent-primary] text-white font-bold text-lg rounded-lg shadow-lg hover:bg-[--accent-hover] transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--accent-primary]">
                        Comenzar a Dibujar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-[--bg-primary] text-[--text-primary] flex flex-col font-sans overflow-hidden">
            <div className="absolute bottom-4 right-4 z-50 pointer-events-none opacity-50 text-[10px] text-[--text-secondary]">
                v0.5.2-debug
            </div>
            {/* Modals & Overlays */}
            {ui.isExportModalOpen && <ExportModal isOpen={ui.isExportModalOpen} onClose={() => ui.setExportModalOpen(false)} drawableObjects={drawableObjects.filter((o): o is SketchObject => o.type === 'object')} canvasSize={canvasSize} />}
            {ui.isSingleExportModalOpen && <SingleObjectExportModal isOpen={ui.isSingleExportModalOpen} onClose={() => ui.setSingleExportModalOpen(false)} item={activeItem as SketchObject} canvasSize={canvasSize} onSaveToLibrary={handleSaveItemToLibrary} />}
            {ui.deletingItemId && <ConfirmDeleteModal isOpen={!!ui.deletingItemId} onCancel={() => ui.setDeletingItemId(null)} onConfirm={handleConfirmDelete} itemName={itemToDelete?.name || ''} itemType={itemToDelete?.type === 'group' ? 'group' : 'object'} />}
            {library.deletingLibraryItem && <ConfirmDeleteLibraryItemModal isOpen={!!library.deletingLibraryItem} onCancel={library.onCancelDeleteLibraryItem} onConfirm={library.onConfirmDeleteLibraryItem} itemToDelete={library.deletingLibraryItem} />}
            {ui.showClearConfirm && <ConfirmClearModal isOpen={ui.showClearConfirm} onCancel={() => ui.setShowClearConfirm(false)} onConfirm={handleConfirmClear} />}
            {ui.isCanvasSizeModalOpen && <CanvasSizeModal isOpen={ui.isCanvasSizeModalOpen} onClose={() => ui.setCanvasSizeModalOpen(false)} currentSize={canvasSize} onApply={(w, h) => { dispatch({ type: 'RESIZE_CANVAS', payload: { width: w, height: h } }); ui.setCanvasSizeModalOpen(false); setTimeout(canvasView.onZoomExtents, 100); }} />}
            {ui.isResetConfirmOpen && <ConfirmResetModal isOpen={ui.isResetConfirmOpen} onCancel={() => ui.setIsResetConfirmOpen(false)} onConfirm={() => { console.log("Resetting preferences..."); ui.setIsResetConfirmOpen(false); }} />}
            {library.imageToEdit && <TransparencyEditor item={library.imageToEdit} onApply={library.onApplyTransparency} onCancel={library.onCancelEditTransparency} />}
            {isToolSelectorOpen && editingToolSlotIndex !== null && <ToolSelectorModal isOpen={isToolSelectorOpen} onClose={() => { setIsToolSelectorOpen(false); setEditingToolSlotIndex(null); }} onSelectTool={(tool) => quickAccess.updateTool(editingToolSlotIndex, tool)} fxPresets={toolSettings.brushPresets} />}

            <ProjectGalleryModal
                isOpen={ui.isProjectGalleryOpen}
                onClose={() => ui.setProjectGalleryOpen(false)}
                user={user}
                projects={projects.projects}
                isLoading={projects.projectsLoading}
                onSave={(name) => projects.saveProject(name, () => ({ currentState, guides, toolSettings: { ...toolSettings }, quickAccess: quickAccess.quickAccessSettings }))}
                onLoad={projects.loadProject}
                onDelete={projects.deleteProject}
                onSaveLocally={(name) => projects.saveLocally(name, () => ({ currentState, guides, toolSettings: { ...toolSettings }, quickAccess: quickAccess.quickAccessSettings }))}
                onLoadFromFile={projects.loadFromFile}
            />

            {/* Main Header */}
            {ui.isHeaderVisible && (
                <header className="flex-shrink-0 flex items-center justify-between p-2 bg-[--bg-primary] border-b border-[--bg-tertiary] z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold">Sketcher</h1>
                        <button onClick={() => ui.setProjectGalleryOpen(true)} className="flex items-center gap-2 p-2 rounded-md bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors text-sm">
                            <GalleryIcon className="w-5 h-5" />
                            <span>Galería</span>
                        </button>
                        <button ref={workspaceButtonRef} onClick={() => setWorkspacePopoverOpen(p => !p)} className="flex items-center gap-2 p-2 rounded-md bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors text-sm relative">
                            <BookmarkIcon className="w-5 h-5" />
                            <span>Plantillas</span>
                            <WorkspaceTemplatesPopover isOpen={isWorkspacePopoverOpen} onClose={() => setWorkspacePopoverOpen(false)} templates={templates.templates} onSave={handleSaveWorkspace} onLoad={handleLoadWorkspace} onDelete={templates.deleteTemplate} onResetPreferences={() => ui.setIsResetConfirmOpen(true)} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-[--bg-secondary] rounded-md border border-[--bg-tertiary]">
                            {ui.deferredPrompt && (
                                <>
                                    <button onClick={ui.handleInstallClick} className="flex items-center gap-1 p-1.5 rounded-md hover:bg-[--bg-tertiary] text-[--text-secondary]" title="Instalar Aplicación">
                                        <DownloadIcon className="w-4 h-4" />
                                        <span className="text-xs font-bold hidden sm:inline">Instalar</span>
                                    </button>
                                    <div className="w-px h-4 bg-[--bg-tertiary] mx-1"></div>
                                </>
                            )}
                            <button onClick={() => ui.setUiScale(ui.uiScale - 0.1)} className="p-1.5 rounded-md hover:bg-[--bg-tertiary] text-[--text-secondary]" title="Reducir Interfaz">
                                <span className="text-xs font-bold">A-</span>
                            </button>
                            <span className="text-xs font-mono w-8 text-center">{Math.round(ui.uiScale * 100)}%</span>
                            <button onClick={() => ui.setUiScale(ui.uiScale + 0.1)} className="p-1.5 rounded-md hover:bg-[--bg-tertiary] text-[--text-secondary]" title="Aumentar Interfaz">
                                <span className="text-xs font-bold">A+</span>
                            </button>
                            <div className="w-px h-4 bg-[--bg-tertiary] mx-1"></div>
                            <button onClick={ui.handleSaveUiScale} className="p-1.5 rounded-md hover:bg-[--bg-tertiary] text-[--text-secondary]" title="Guardar configuración de tamaño">
                                <SaveIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md bg-[--bg-secondary] hover:bg-[--bg-tertiary] text-[--text-secondary]">
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <Auth user={user} />
                    </div>
                </header>
            )}


            {/* Main Content Area */}
            <div className="flex flex-grow min-h-0 relative">
                {ui.isLeftSidebarVisible && (
                    <Toolbar
                        tool={tool} setTool={setTool} {...toolSettings} brushPresets={toolSettings.brushPresets} onSavePreset={toolSettings.onSavePreset}
                        onUpdatePreset={toolSettings.onUpdatePreset} onLoadPreset={toolSettings.onLoadPreset} onDeletePreset={toolSettings.onDeletePreset}
                        activeGuide={guides.activeGuide} setActiveGuide={guides.onSetActiveGuide} isOrthogonalVisible={guides.isOrthogonalVisible}
                        onToggleOrthogonal={guides.toggleOrthogonal} onExportClick={() => ui.setExportModalOpen(true)}
                        objects={objects} libraryItems={library.libraryItems} backgroundDataUrl={ai.backgroundDataUrl} debugInfo={ai.debugInfo}
                        strokeMode={strokeMode} setStrokeMode={setStrokeMode} strokeModifier={strokeModifier} setStrokeModifier={setStrokeModifier}
                    />
                )}
                <button
                    onClick={() => ui.setIsLeftSidebarVisible(!ui.isLeftSidebarVisible)}
                    className="absolute top-1/2 -translate-y-1/2 bg-[--bg-secondary] p-2 rounded-full shadow-xl z-40 border border-[--bg-tertiary] hover:bg-[--bg-tertiary] transition-all"
                    style={{ left: ui.isLeftSidebarVisible ? '4.25rem' : '0.25rem' }}
                    title={ui.isLeftSidebarVisible ? "Ocultar Herramientas" : "Mostrar Herramientas"}
                >
                    {ui.isLeftSidebarVisible ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                </button>

                <AIPanel
                    isOpen={aiPanelState.isOpen}
                    onClose={() => aiPanelState.setIsOpen(false)}
                    aiPanelState={aiPanelState}
                    onEnhance={(payload) => ai.handleEnhance(payload, canvasSize, getDrawableObjects, backgroundObject, activeItemId, objects)}
                    isEnhancing={ai.isEnhancing}
                    enhancementPreview={ai.enhancementPreview}
                    onGenerateEnhancementPreview={(includeBackground) => ai.generateEnhancementPreview(canvasSize, getDrawableObjects, backgroundObject, includeBackground)}
                />

                <button
                    onClick={() => aiPanelState.setIsOpen(true)}
                    className="absolute bottom-24 left-4 md:bottom-6 md:left-6 p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl hover:scale-110 transition-transform z-40 flex items-center justify-center border-2 border-white/20"
                    title="Mejorar con IA"
                    style={{ left: ui.isLeftSidebarVisible ? '6.5rem' : '' }}
                >
                    <SparklesIcon className="w-8 h-8" />
                </button>
                <main ref={mainAreaRef} className="flex-grow relative" onDrop={(e) => { e.preventDefault(); try { const data = JSON.parse(e.dataTransfer.getData('application/json')); if (data.type === 'library-item') { onDropOnCanvas(data, activeItemId, setSelectedItemIds); } } catch (error) { /* Ignore */ } }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} >
                    <CanvasContainer
                        items={drawableObjects} activeItemId={activeItemId} {...toolSettings} tool={tool} setTool={setTool}
                        onDrawCommit={handleDrawCommit} onUpdateItem={updateItem} viewTransform={canvasView.viewTransform}
                        setViewTransform={canvasView.setViewTransform} onSelectItem={handleSelectItem} {...guides} isCropping={isCropping}
                        cropRect={cropRect} setCropRect={setCropRect} isTransforming={isTransforming} transformState={transformState}
                        setTransformState={setTransformState} transformSourceBbox={transformSourceBbox} isAspectRatioLocked={isAspectRatioLocked}
                        strokeMode={strokeMode} strokeState={strokeState} setStrokeState={setStrokeState} strokeModifier={strokeModifier}
                        selection={selection} setSelection={setSelection} onCutSelection={handleCutSelection} onCopySelection={handleCopySelection}
                        onDeleteSelection={handleDeleteSelection} onDeselect={handleDeselect} getMinZoom={getMinZoom} MAX_ZOOM={MAX_ZOOM}
                        isAngleSnapEnabled={isAngleSnapEnabled} angleSnapValue={angleSnapValue} onAddItem={addItem}
                        textEditState={textEditState} setTextEditState={setTextEditState} onCommitText={handleCommitText}
                        strokeSmoothing={strokeSmoothing}
                        setDebugPointers={setDebugPointers}
                        isPalmRejectionEnabled={isPalmRejectionEnabled}
                        scaleFactor={scaleFactor}
                        scaleUnit={scaleUnit}
                    />
                    <div className="absolute top-36 left-4 md:top-2 md:left-2 flex items-center gap-2 z-10">
                        {dimensionDisplay && <button ref={scaleButtonRef} onClick={() => setIsScalePopoverOpen(p => !p)} className="bg-[--bg-primary]/80 backdrop-blur-sm text-[--text-secondary] text-xs rounded-md px-2 py-1 pointer-events-auto hover:bg-[--bg-secondary] transition-colors" title="Ajustar escala del lienzo">{dimensionDisplay}</button>}
                        <button
                            onClick={() => setIsPalmRejectionEnabled(prev => !prev)}
                            className={`bg-[--bg-primary]/80 backdrop-blur-sm text-xs rounded-md px-2 py-1 pointer-events-auto hover:bg-[--bg-secondary] transition-colors flex items-center gap-1 ${isPalmRejectionEnabled ? 'text-[--accent-primary] font-bold' : 'text-[--text-secondary]'}`}
                            title={isPalmRejectionEnabled ? "Rechazo de Palma: ACTIVADO (Solo Lápiz)" : "Rechazo de Palma: DESACTIVADO (Lápiz y Dedo)"}
                        >
                            <HandRaisedIcon className="w-4 h-4" />
                            <span className="hidden md:inline">{isPalmRejectionEnabled ? "Solo Lápiz" : "Táctil + Lápiz"}</span>
                        </button>
                    </div>
                    <button onClick={ui.handleToggleFullscreen} className="absolute top-2 right-2 p-2 rounded-md bg-[--bg-primary]/80 backdrop-blur-sm hover:bg-[--bg-secondary] text-[--text-primary] transition-colors z-10" title={ui.isFullscreen ? "Salir de Pantalla Completa" : "Entrar en Pantalla Completa"}>
                        {ui.isFullscreen ? <MinimizeIcon className="w-5 h-5" /> : <ExpandIcon className="w-5 h-5" />}
                    </button>
                    <ScalePopover isOpen={isScalePopoverOpen} onClose={() => setIsScalePopoverOpen(false)} anchorEl={scaleButtonRef.current} scaleFactor={scaleFactor} scaleUnit={scaleUnit} onSetScaleFactor={handleSetScaleFactor} onSetScaleUnit={handleSetScaleUnit} />
                    <CanvasToolbar
                        tool={tool} setTool={setTool} onZoomExtents={canvasView.onZoomExtents} onZoomIn={canvasView.onZoomIn} onZoomOut={canvasView.onZoomOut}
                        onUndo={undo} onRedo={redo} onClearAll={() => ui.setShowClearConfirm(true)} canUndo={canUndo} canRedo={canRedo}
                        isCropping={isCropping} onApplyCrop={handleApplyCrop} onCancelCrop={handleCancelCrop} isTransforming={isTransforming}
                        transformState={transformState} onApplyTransform={handleApplyTransform} onCancelTransform={handleCancelTransform}
                        isAspectRatioLocked={isAspectRatioLocked} onSetAspectRatioLocked={setAspectRatioLocked} isAngleSnapEnabled={isAngleSnapEnabled}
                        onToggleAngleSnap={() => setIsAngleSnapEnabled(p => !p)} angleSnapValue={angleSnapValue} onSetAngleSnapValue={setAngleSnapValue}
                        onSetActiveGuide={guides.onSetActiveGuide} onSetGridType={guides.setGridType} isSnapToGridEnabled={guides.isSnapToGridEnabled}
                        onToggleSnapToGrid={guides.toggleSnapToGrid} isOrthogonalVisible={guides.isOrthogonalVisible} activeGuide={guides.activeGuide}
                        orthogonalGuide={guides.orthogonalGuide} onSetOrthogonalAngle={guides.onSetOrthogonalAngle} gridGuide={guides.gridGuide}
                        onSetGridSpacing={guides.onSetGridSpacing} onSetGridMajorLineFrequency={guides.onSetGridMajorLineFrequency}
                        onSetGridIsoAngle={guides.onSetGridIsoAngle} onSetGridMajorLineColor={guides.onSetGridMajorLineColor}
                        onSetGridMinorLineColor={guides.onSetGridMinorLineColor} areGuidesLocked={guides.areGuidesLocked}
                        onSetAreGuidesLocked={guides.setAreGuidesLocked} isPerspectiveStrokeLockEnabled={guides.isPerspectiveStrokeLockEnabled}
                        onSetIsPerspectiveStrokeLockEnabled={guides.setIsPerspectiveStrokeLockEnabled} scaleFactor={currentState.scaleFactor}
                        scaleUnit={currentState.scaleUnit} onPaste={handlePaste} hasClipboardContent={!!clipboard}
                        strokeSmoothing={strokeSmoothing} setStrokeSmoothing={setStrokeSmoothing}
                    />
                    <QuickAccessBar
                        settings={quickAccess.quickAccessSettings} onUpdateColor={quickAccess.updateColor} onAddColor={quickAccess.addColor}
                        onRemoveColor={quickAccess.removeColor} onUpdateSize={quickAccess.updateSize} onUpdateTool={quickAccess.updateTool}
                        onAddToolSlot={quickAccess.addToolSlot}
                        onSelectColor={handleSelectColor} onSelectSize={handleSelectSize} onSelectTool={(qaTool) => { if (qaTool.type === 'tool') setTool(qaTool.tool); else if (qaTool.type === 'fx-preset') { setTool('fx-brush'); toolSettings.onLoadPreset(qaTool.id); } }}
                        onOpenToolSelector={(index) => { setIsToolSelectorOpen(true); setEditingToolSlotIndex(index); }}
                        activeTool={tool} activeColor={activeColor} activeSize={activeSize}
                        onToggleHeader={() => ui.setIsHeaderVisible(!ui.isHeaderVisible)}
                        isHeaderVisible={ui.isHeaderVisible}
                    />
                </main>
                {ui.isRightSidebarVisible && (
                    <aside ref={ui.rightSidebarRef} className={`flex-shrink-0 w-80 border-l border-[--bg-tertiary] flex flex-col ${isAiModalOpen ? 'z-50' : ''}`}>
                        <div style={{ height: ui.rightSidebarTopHeight }} className="flex-shrink-0">
                            <Outliner
                                items={objects} activeItemId={activeItemId} onAddItem={addItem} onCopyItem={copyItem} onDeleteItem={deleteItem} onSelectItem={handleSelectItem}
                                onUpdateItem={updateItem} onMoveItem={handleMoveItem} onMergeItems={handleMergeItems} onUpdateBackground={handleUpdateBackground}
                                onRemoveBackgroundImage={handleRemoveBackgroundImage} onExportItem={() => { if (activeItem) ui.setSingleExportModalOpen(true); }}
                                onOpenCanvasSizeModal={() => ui.setCanvasSizeModalOpen(true)} activeItemState={activeItemState}
                                onMoveItemUpDown={handleMoveItemUpDown} onMergeItemDown={handleMergeItemDown} onMergeItemUp={handleMergeItemUp}
                                onAddObjectAbove={handleAddObjectAbove} onAddObjectBelow={handleAddObjectBelow}
                            />
                        </div>
                        <div onPointerDown={ui.handlePointerDownResize} className="flex-shrink-0 h-1.5 bg-[--bg-secondary] hover:bg-[--accent-primary] transition-colors cursor-ns-resize" />
                        <div className="flex-grow min-h-0">
                            <Library user={user} items={library.libraryItems} onImportImage={library.onImportToLibrary} onCreateFolder={library.onCreateFolder} onEditItem={library.onEditTransparency} onDeleteItem={library.onDeleteLibraryItem} onAddItemToScene={(id) => onDropOnCanvas({ type: 'library-item', id }, activeItemId, setSelectedItemIds)} onMoveItems={library.onMoveItems} />
                        </div>
                    </aside>
                )}
                <button onClick={() => ui.setIsRightSidebarVisible(!ui.isRightSidebarVisible)} className="absolute top-1/2 -translate-y-1/2 bg-[--bg-secondary] p-2 rounded-full shadow-xl z-40 border border-[--bg-tertiary] hover:bg-[--bg-tertiary] transition-all" style={{ right: ui.isRightSidebarVisible ? '20.25rem' : '0.25rem' }} title={ui.isRightSidebarVisible ? 'Ocultar paneles' : 'Mostrar paneles'}>
                    {ui.isRightSidebarVisible ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}

// ===================================================================================
// CHILD COMPONENTS (previously in App.tsx)
// ===================================================================================

interface ProjectGalleryModalProps {
    isOpen: boolean; onClose: () => void; user: User | null; projects: Project[]; isLoading: boolean;
    onSave: (name: string) => Promise<void>; onLoad: (project: Project) => Promise<void>; onDelete: (project: Project) => Promise<void>;
    onSaveLocally: (name: string) => Promise<void>; onLoadFromFile: (file: File) => Promise<void>;
}

const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({ isOpen, onClose, user, projects, isLoading, onSave, onLoad, onDelete, onSaveLocally, onLoadFromFile }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deletingProject, setDeletingProject] = useState<Project | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [localFileName, setLocalFileName] = useState('mi-boceto');
    const localSaveInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isOpen) { setNewProjectName(''); setIsSaving(false); setDeletingProject(null); setIsSavingLocal(false); } }, [isOpen]);

    const handleHeaderSaveLocalClick = () => { setIsSavingLocal(true); setTimeout(() => { localSaveInputRef.current?.focus(); localSaveInputRef.current?.select(); }, 0); };
    const handleConfirmSaveLocal = async () => { if (localFileName.trim()) { try { await onSaveLocally(localFileName.trim()); setIsSavingLocal(false); } catch (error) { console.error("Failed to save project locally:", error); alert(`Error al guardar el proyecto localmente: ${error instanceof Error ? error.message : String(error)}`); } } };
    const handleCancelSaveLocal = () => setIsSavingLocal(false);
    const handleSave = async () => { if (!newProjectName.trim()) { alert("Please enter a project name."); return; } setIsSaving(true); try { await onSave(newProjectName.trim()); setNewProjectName(''); } catch (error) { console.error("Failed to save project:", error); alert(`Error saving project: ${error instanceof Error ? error.message : String(error)}`); } finally { setIsSaving(false); } };
    const handleDeleteConfirm = async () => { if (deletingProject) { await onDelete(deletingProject); setDeletingProject(null); } };
    const handleFileLoadClick = () => fileInputRef.current?.click();
    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { await onLoadFromFile(e.target.files[0]); } if (e.target) e.target.value = ''; };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[--bg-secondary] text-[--text-primary] rounded-lg shadow-xl p-6 w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold">Galería de Proyectos</h2>
                    {isSavingLocal ? (
                        <div className="flex items-center gap-2">
                            <input ref={localSaveInputRef} type="text" value={localFileName} onChange={(e) => setLocalFileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSaveLocal(); if (e.key === 'Escape') handleCancelSaveLocal(); }} placeholder="Nombre del archivo..." className="bg-[--bg-secondary] text-[--text-primary] text-sm rounded-md p-2 border border-[--bg-tertiary] focus:ring-1 focus:ring-[--accent-primary] focus:outline-none" />
                            <button onClick={handleConfirmSaveLocal} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-semibold">Guardar</button>
                            <button onClick={handleCancelSaveLocal} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cancelar</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input type="file" ref={fileInputRef} className="hidden" accept=".sketcher,application/json" onChange={handleFileSelected} />
                            <button onClick={handleFileLoadClick} className="flex items-center gap-2 px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] font-semibold"> <FolderOpenIcon className="w-5 h-5" /> <span>Cargar desde Archivo</span> </button>
                            <button onClick={handleHeaderSaveLocalClick} className="flex items-center gap-2 px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover] font-semibold"> <SaveIcon className="w-5 h-5" /> <span>Guardar Local</span> </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-[--bg-tertiary]"> <XIcon className="w-6 h-6" /> </button>
                        </div>
                    )}
                </div>
                {!user ? (<div className="flex-grow flex flex-col items-center justify-center text-center text-[--text-secondary]"> <UserIcon className="w-16 h-16 mb-4" /> <h3 className="text-xl font-bold">Por favor, inicie sesión</h3> <p>Inicie sesión para guardar y cargar sus proyectos en la nube.</p> </div>
                ) : (<>
                    <div className="bg-[--bg-primary] p-4 rounded-lg mb-4 flex-shrink-0">
                        <h3 className="text-lg font-semibold mb-2">Guardar Lienzo Actual</h3>
                        <div className="flex items-center gap-2">
                            <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Nombre del nuevo proyecto..." className="flex-grow bg-[--bg-secondary] text-[--text-primary] text-sm rounded-md p-2 border border-[--bg-tertiary] focus:ring-1 focus:ring-[--accent-primary] focus:outline-none" disabled={isSaving} />
                            <button onClick={handleSave} disabled={!newProjectName.trim() || isSaving || !user} className="px-4 py-2 rounded-md bg-[--accent-primary] hover:bg-[--accent-hover] text-white font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed" title={!user ? "Inicie sesión para guardar en la nube" : ""}> {isSaving ? 'Guardando...' : 'Guardar en la Nube'} </button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2">
                        {isLoading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-[--accent-primary] border-t-transparent rounded-full animate-spin"></div></div>
                            : projects.length === 0 ? <div className="text-center text-[--text-secondary] py-16"> <p>No se encontraron proyectos guardados.</p> <p className="text-sm">¡Guarda tu lienzo actual para empezar!</p> </div>
                                : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {projects.map(p => (
                                        <div key={p.id} className="group relative bg-[--bg-tertiary] rounded-lg overflow-hidden shadow-md">
                                            <div className="aspect-video bg-white/10 flex items-center justify-center"><img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" /></div>
                                            <div className="p-2"><p className="font-semibold text-sm truncate">{p.name}</p></div>
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                <button onClick={() => onLoad(p)} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white w-3/4">Cargar</button>
                                                <button onClick={() => setDeletingProject(p)} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white w-3/4">Eliminar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                        }
                    </div>
                </>
                )}
            </div>
            {deletingProject && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"> <div className="bg-[--bg-secondary] rounded-lg p-6 shadow-xl"> <h3 className="text-lg font-bold">Confirmar Eliminación</h3> <p className="my-2 text-[--text-secondary]">¿Estás seguro de que quieres eliminar "{deletingProject.name}"? Esta acción no se puede deshacer.</p> <div className="flex justify-end gap-4 mt-4"> <button onClick={() => setDeletingProject(null)} className="px-4 py-2 rounded-md bg-[--bg-tertiary] hover:bg-[--bg-hover]">Cancelar</button> <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white">Eliminar</button> </div> </div> </div>}
        </div>
    );
};

const ScalePopover: React.FC<{ isOpen: boolean; onClose: () => void; anchorEl: HTMLElement | null; scaleFactor: number; scaleUnit: ScaleUnit; onSetScaleFactor: (factor: number) => void; onSetScaleUnit: (unit: ScaleUnit) => void; }> = ({ isOpen, onClose, anchorEl, scaleFactor, scaleUnit, onSetScaleFactor, onSetScaleUnit }) => {
    const [inputValue, setInputValue] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const unitMultipliers = { mm: 1, cm: 10, m: 1000 };
    useEffect(() => { setInputValue(Number((scaleFactor * unitMultipliers[scaleUnit]).toFixed(2)).toString()); }, [scaleFactor, scaleUnit, unitMultipliers]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && anchorEl && !anchorEl.contains(event.target as Node)) { onClose(); } };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorEl]);
    const handleApply = (valueStr: string, unit: ScaleUnit) => { const value = parseFloat(valueStr); if (!isNaN(value) && value > 0) { onSetScaleFactor(value / unitMultipliers[unit]); } };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const newInputValue = e.target.value; setInputValue(newInputValue); handleApply(newInputValue, scaleUnit); };
    const handleUnitChange = (newUnit: ScaleUnit) => { onSetScaleUnit(newUnit); };
    if (!isOpen || !anchorEl) return null;
    const rect = anchorEl.getBoundingClientRect();
    return (
        <div ref={popoverRef} className="absolute z-20 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg p-3 space-y-3" style={{ top: rect.bottom + 8, left: rect.left }} >
            <p className="text-xs font-bold text-[--text-secondary]">Ajustes de Escala</p>
            <div className="flex items-center gap-2">
                <span className="text-sm">1</span>
                <select value={scaleUnit} onChange={(e) => handleUnitChange(e.target.value as ScaleUnit)} className="bg-[--bg-tertiary] text-sm rounded-md p-1 border border-[--bg-hover]"> <option value="mm">mm</option> <option value="cm">cm</option> <option value="m">m</option> </select>
                <span className="text-sm">=</span>
                <input type="number" value={inputValue} onChange={handleInputChange} className="w-24 bg-[--bg-secondary] text-sm rounded-md p-1 border border-[--bg-tertiary]" />
                <span className="text-sm">px</span>
            </div>
        </div>
    );
};