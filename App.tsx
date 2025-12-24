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
import { QuickAccessBar } from './components/QuickAccessBar';
import { ToolSelectorModal } from './components/modals/ToolSelectorModal';
import { WorkspaceTemplatesPopover } from './components/WorkspaceTemplatesPopover';
import { AIPanel } from './components/AIPanel';
import { PublicGallery } from './components/PublicGallery';
import { useCredits } from './hooks/useCredits';

import { BackgroundImportModal } from './components/modals/BackgroundImportModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';

import { CanvasSizeModal } from './components/modals/CanvasSizeModal';
import { ConfirmClearModal } from './components/modals/ConfirmClearModal';
import { ConfirmDeleteLibraryItemModal } from './components/modals/ConfirmDeleteLibraryItemModal';
import { ConfirmResetModal } from './components/modals/ConfirmResetModal';
import { CropIcon, CheckIcon, XIcon, RulerIcon, PerspectiveIcon, ImageSquareIcon, OrthogonalIcon, MirrorIcon, GridIcon, IsometricIcon, LockIcon, LockOpenIcon, TransformIcon, FreeTransformIcon, SunIcon, MoonIcon, CopyIcon, CutIcon, PasteIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon, GoogleIcon, LogOutIcon, ArrowUpIcon, ArrowDownIcon, SnapIcon, BookmarkIcon, SaveIcon, FolderOpenIcon, GalleryIcon, StrokeModeIcon, FreehandIcon, LineIcon, PolylineIcon, ArcIcon, BezierIcon, ExpandIcon, MinimizeIcon, SolidLineIcon, DashedLineIcon, DottedLineIcon, DashDotLineIcon, HistoryIcon, MoreVerticalIcon, AddAboveIcon, AddBelowIcon, HandRaisedIcon, DownloadIcon, SparklesIcon, MenuIcon, ChevronDownIcon } from './components/icons';
import { ArchitecturalRenderView, ArchitecturalRenderViewHandle } from './components/ArchitecturalRenderView';
import { FreeModeView, FreeModeViewHandle } from './components/FreeModeView';
import { LandingGalleryCarousel } from './components/LandingGalleryCarousel';


import { AIRequestInspectorModal } from './components/modals/AIRequestInspectorModal';
import type { SketchObject, ItemType, Tool, CropRect, TransformState, WorkspaceTemplate, QuickAccessTool, ProjectFile, Project, StrokeMode, StrokeState, CanvasItem, StrokeModifier, ScaleUnit, Selection, ClipboardData, AppState, Point } from './types';
import { getContentBoundingBox, createNewCanvas, createThumbnail, cloneCanvas, generateMipmaps, getCompositeCanvas } from './utils/canvasUtils';
import { prepareAIRequest } from './utils/aiUtils';
import { GEMINI_MODEL_ID, AI_MODELS, UI_DEFAULT_MODEL } from './utils/constants';

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
    const [isPublicGalleryOpen, setIsPublicGalleryOpen] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(false);
    const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
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
    // AI Model Selection
    const [selectedModel, setSelectedModel] = useState<string>(UI_DEFAULT_MODEL);

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
        isPublicGalleryOpen, setIsPublicGalleryOpen,
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
        selectedModel,
        setSelectedModel,
        isInstallable: !!deferredPrompt,
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
                            const mipmaps = generateMipmaps(canvas);
                            const loadedItem: SketchObject = { ...(rest as SketchObject), canvas, context, mipmaps };
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
        getFullProjectStateAsFile,
    };
}


/**
 * Manages AI-powered image enhancement features using the Gemini API.
 */
function useAI(
    dispatch: React.Dispatch<any>,
    onImportToLibrary: (file: File, parentId: string | null, options?: { scaleFactor?: number, transparentColors?: { r: number, g: number, b: number }[], tolerance?: number, originalFile?: File }) => void,
    handleSelectItem: (id: string | null) => void,
    setTool: (tool: Tool) => void,
    currentScaleFactor: number,
    credits: number | null,
    deductCredit: () => Promise<boolean>,
    selectedModel: string, // Accept from hook
    inspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>
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

    const processChromaKey = (image: HTMLImageElement): { canvas: HTMLCanvasElement, transparentColors: { r: number, g: number, b: number }[], tolerance: number } => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { canvas, transparentColors: [], tolerance: 0 };

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

        // De-duplicate corners colors very roughly to return unique colors for editor
        const uniqueColors: { r: number, g: number, b: number }[] = [];
        cornerColors.forEach(c => {
            if (!uniqueColors.some(uc => Math.abs(uc.r - c.r) < 5 && Math.abs(uc.g - c.g) < 5 && Math.abs(uc.b - c.b) < 5)) {
                uniqueColors.push(c);
            }
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
        return { canvas, transparentColors: uniqueColors, tolerance };
    };

    const handleUpdateDebugInfo = useCallback((
        payload: any,
        canvasSize: { width: number, height: number },
        getDrawableObjects: () => CanvasItem[],
        backgroundObject: SketchObject | undefined,
        activeItemId: string | null,
        allObjects: CanvasItem[]
    ) => {
        const result = prepareAIRequest(payload, canvasSize, getDrawableObjects, backgroundObject, activeItemId, allObjects, getCompositeCanvas, getCombinedBbox);
        if (result) {
            setDebugInfo({ prompt: result.finalPrompt, images: result.debugImages });
        }
    }, [getCompositeCanvas, getCombinedBbox]);

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

        const requestData = prepareAIRequest(payload, canvasSize, getDrawableObjects, backgroundObject, activeItemId, allObjects, getCompositeCanvas, getCombinedBbox);
        if (!requestData) {
            setIsEnhancing(false);
            alert("No se pudo preparar la solicitud. Verifica los campos requeridos.");
            return;
        }

        if (credits === null) {
            setIsEnhancing(false);
            alert("Debes iniciar sesión para usar la IA (2 créditos gratis).");
            return;
        }

        if (credits <= 0) {
            setIsEnhancing(false);
            alert("No tienes suficientes créditos para usar la función de IA.");
            return;
        }

        const { parts, debugImages, finalPrompt, referenceWidth, filteredObjects, visibleObjects } = requestData;

        // Strict validation for execution
        if (payload.activeAiTab === 'object' && !payload.enhancementPrompt) {
            setIsEnhancing(false);
            alert("Description prompt is required.");
            return;
        }

        setDebugInfo({ prompt: finalPrompt, images: debugImages });

        try {
            // @ts-ignore
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const textPart = { text: finalPrompt };
            // Use selected model from state (passed as dependency/arg)
            const model = selectedModel;
            const config = {}; // Modalitiy set dynamically if needed, but avoided for general stability
            const contents = (parts.length > 0) ? { parts: [...parts, textPart] } : { parts: [textPart] };

            // INSPECTOR CHECK
            if (inspectRequest) {
                const confirmed = await inspectRequest({ model, parts: contents.parts, config });
                if (!confirmed) {
                    setIsEnhancing(false);
                    return;
                }
            }

            const response = await ai.models.generateContent({ model, contents, config });

            let newImageBase64: string | null = null;
            for (const part of response.candidates?.[0]?.content.parts || []) {
                if (part.inlineData) { newImageBase64 = part.inlineData.data; break; }
            }

            // Fallback for Upscale Mode: if AI fails to return image, use composition for client-side upscale
            if (!newImageBase64 && payload.activeAiTab === 'upscale') {
                console.warn("AI did not return an upscaled image, using client-side fallback.");
                // We'll proceed to the img.onload section using the original composition
                // We need to trigger the success flow manually with original data
                const compositionCanvas = getCompositeCanvas(true, canvasSize, getDrawableObjects, backgroundObject);
                if (compositionCanvas) {
                    newImageBase64 = compositionCanvas.toDataURL('image/jpeg', 1.0).split(',')[1];
                }
            }

            if (newImageBase64) {
                // Deduct credit on successful generation (or fallback upscale)
                if (deductCredit) {
                    deductCredit();
                }
                const img = new Image();
                img.onload = async () => {
                    const newName = `IA: ${finalPrompt.substring(0, 20)}...`;
                    const newScaleFactor = (img.width * currentScaleFactor) / (referenceWidth || 1);

                    let finalImg = img;
                    let finalScaleFactor = newScaleFactor;
                    let processedDataUrl = `data:image/png;base64,${newImageBase64}`;
                    let transparentColors: { r: number, g: number, b: number }[] = [];
                    let tolerance: number | undefined = undefined;
                    let originalFile: File | undefined = undefined;

                    // Auto-Chroma Processing
                    if (payload.enhancementChromaKey && payload.enhancementChromaKey !== 'none') {
                        const result = processChromaKey(img);
                        processedDataUrl = result.canvas.toDataURL('image/png');
                        transparentColors = result.transparentColors;
                        tolerance = result.tolerance;

                        // Prepare original file
                        // Prepare original file
                        const res = await fetch(`data:image/png;base64,${newImageBase64}`);
                        const blob = await res.blob();
                        originalFile = new File([blob], `${newName}_original.png`, { type: 'image/png' });

                        const processedImg = new Image();
                        await new Promise((resolve) => {
                            processedImg.onload = resolve;
                            processedImg.src = processedDataUrl;
                        });
                        finalImg = processedImg;
                    }

                    if (payload.activeAiTab === 'composition' || payload.activeAiTab === 'sketch') {
                        if (payload.shouldUpdateBackground) {
                            dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: finalImg } });
                        }
                    }

                    if (payload.activeAiTab === 'upscale') {
                        // Force 4K Resolution (3840px width)
                        const TARGET_WIDTH = 3840;
                        const scale = TARGET_WIDTH / img.width;
                        const targetHeight = Math.round(img.height * scale);

                        const downloadCanvas = document.createElement('canvas');
                        downloadCanvas.width = TARGET_WIDTH;
                        downloadCanvas.height = targetHeight;
                        const ctx = downloadCanvas.getContext('2d');
                        if (ctx) {
                            // High quality scaling
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(img, 0, 0, downloadCanvas.width, downloadCanvas.height);
                            const format = payload.upscaleFormat === 'jpg' ? 'image/jpeg' : 'image/png';
                            const ext = payload.upscaleFormat === 'jpg' ? 'jpg' : 'png';
                            // Use 0.92 quality for JPG to balance size/quality at 4K
                            const downloadUrl = downloadCanvas.toDataURL(format, 0.92);

                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = `Upscale_4K_${Date.now()}.${ext}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);

                            // --- Substitution Logic (NEW) ---
                            // If user wants to update the background with the upscaled version
                            if (payload.shouldUpdateBackground) {
                                const upscaledImg = new Image();
                                upscaledImg.onload = () => {
                                    dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: upscaledImg } });
                                };
                                upscaledImg.src = downloadUrl;
                            }
                        }
                        // If shouldUpdateBackground is false, we just stop here (classic download behavior)
                        if (!payload.shouldUpdateBackground) return;
                    }

                    // Common Handling for All Tabs (Library, Canvas Layer, Delete Content)

                    // 1. Add to Library (Default or Checked)
                    // Note: Composition images might be large, but user might still want them in library.
                    if (payload.shouldAddToLibrary) {
                        fetch(processedDataUrl).then(res => res.blob()).then(blob => {
                            if (blob) onImportToLibrary(new File([blob], `${newName}.png`, { type: 'image/png' }), null, {
                                scaleFactor: 0, // Force 0 scale factor for AI generated images so they use the smart scaling logic (50% viewport) on drag & drop
                                transparentColors,
                                tolerance,
                                originalFile
                            });
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
    }, [dispatch, onImportToLibrary, handleSelectItem, setTool, getCompositeCanvas, getCombinedBbox, inspectRequest, credits, deductCredit]);

    return {
        isEnhancing,
        enhancementPreview,
        backgroundDataUrl,
        setBackgroundDataUrl,
        debugInfo,
        setDebugInfo, // Exposed for external setting if needed
        updateDebugInfo: handleUpdateDebugInfo,
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
    const [isSolidBox, setIsSolidBox] = useState(false);
    const [isPalmRejectionEnabled, setIsPalmRejectionEnabled] = useState(false); // Default: Disabled (Touch can draw)
    const [debugPointers, setDebugPointers] = useState<Map<number, { x: number, y: number }>>(new Map());

    // -- View State --
    const [activeView, setActiveView] = useState<'sketch' | 'render' | 'free'>('sketch'); // Using string for safety
    const [galleryInitialTab, setGalleryInitialTab] = useState<'projects' | 'library'>('projects');
    const [lastRenderedImage, setLastRenderedImage] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // -- Autosave & Recovery State --
    const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
    const [recoveredData, setRecoveredData] = useState<any>(null);

    // -- 3. CUSTOM HOOKS --
    const [selection, setSelection] = useState<Selection | null>(null);
    const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

    const [textEditState, setTextEditState] = useState<{ position: Point; value: string; activeItemId: string; } | null>(null);

    const [strokeSmoothing, setStrokeSmoothing] = useState(0.5);

    // AI Inspector State
    const [inspectorPayload, setInspectorPayload] = useState<{ model: string; parts: any[]; config?: any } | null>(null);
    const [inspectorResolve, setInspectorResolve] = useState<((confirm: boolean) => void) | null>(null);

    const inspectAIRequest = useCallback((payload: { model: string; parts: any[]; config?: any }) => {
        return new Promise<boolean>((resolve) => {
            // ONLY SHOW DEBUG MODAL FOR ADMINS
            // We need to access 'role' here. Since 'role' comes from useCredits which is used below,
            // we have a closure issue if useCredits is defined after.
            // However, useCredits is called inside App component, but 'inspectAIRequest' is also defined inside App.
            // We just need to ensure 'role' is available in the dependency array or accessible via ref if needed.
            // OR just add 'role' to dependency array (which might re-create it often, but that's fine for this app).

            // Actually, let's look at where useCredits is called. Line 919.
            // inspectAIRequest is line 891.
            // I should access 'role' from a Ref to avoid breaking changes or re-ordering too much code?
            // Or just check it inside. But I can't check 'role' if it's not defined yet.
            // BETTER PLAN: Move 'useCredits' call to top of App component (standard hook practice)
            // or just rely on 'ai' which passes it?
            // 'ai' hook uses 'inspectAIRequest' as a prop.

            // Let's rely on a 'roleRef' that we verify.

            if (roleRef.current !== 'admin') {
                resolve(true);
                return;
            }

            setInspectorPayload(payload);
            setInspectorResolve(() => resolve);
        });
    }, []);

    const confirmInspector = () => {
        if (inspectorResolve) inspectorResolve(true);
        setInspectorPayload(null);
        setInspectorResolve(null);
    };

    const cancelInspector = () => {
        if (inspectorResolve) inspectorResolve(false);
        setInspectorPayload(null);
        setInspectorResolve(null);
    };

    const ui = useAppUI();
    // Destructure for easier access
    const {
        isExportModalOpen, setExportModalOpen,
        isSingleExportModalOpen, setSingleExportModalOpen,
        selectedModel, setSelectedModel,
    } = ui;

    const freeModeRef = useRef<FreeModeViewHandle>(null);
    const archRenderRef = useRef<ArchitecturalRenderViewHandle>(null);

    // Custom Hooks
    const toolSettings = useToolSettings();
    const library = useLibrary(user);
    const guides = useGuides(canvasSize);
    const { getMinZoom, ...canvasView } = useCanvasView(mainAreaRef, canvasSize);
    const templates = useWorkspaceTemplates();
    const quickAccess = useQuickAccess();
    const { credits, deductCredit, role } = useCredits(user);
    // Keep a ref to role for the callback
    const roleRef = useRef(role);
    useEffect(() => { roleRef.current = role; }, [role]);

    const handleSelectItem = useCallback((id: string | null) => {
        setSelectedItemIds(id ? [id] : []);
        if (!id || (selection && selection.sourceItemId !== id)) {
            setSelection(null);
        }
    }, [selection]);

    const ai = useAI(dispatch, library.onImportToLibrary, handleSelectItem, setTool, scaleFactor, credits, deductCredit, selectedModel, inspectAIRequest);
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

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

    // Exit Confirmation
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (objects.filter(o => !o.isBackground).length > 0 || lastRenderedImage) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [objects, lastRenderedImage]);

    // Debounced Autosave
    useEffect(() => {
        if (!isInitialized || (objects.length === 0 && !lastRenderedImage)) return;

        const timer = setTimeout(async () => {
            try {
                const { projectBlob } = await projects.getFullProjectStateAsFile(() => ({
                    currentState,
                    guides: {
                        activeGuide: guides.activeGuide, isOrthogonalVisible: guides.isOrthogonalVisible, rulerGuides: guides.rulerGuides,
                        mirrorGuides: guides.mirrorGuides, perspectiveGuide: guides.perspectiveGuide, orthogonalGuide: guides.orthogonalGuide,
                        gridGuide: guides.gridGuide, areGuidesLocked: guides.areGuidesLocked, isPerspectiveStrokeLockEnabled: guides.isPerspectiveStrokeLockEnabled,
                        isSnapToGridEnabled: guides.isSnapToGridEnabled,
                    },
                    toolSettings: { ...toolSettings },
                    quickAccess: quickAccess.quickAccessSettings
                }));

                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        localStorage.setItem('sketcher_v3_autosave', reader.result as string);
                    } catch (e) {
                        console.warn("Autosave quota exceeded, could not save to localStorage.");
                    }
                };
                reader.readAsText(projectBlob);
            } catch (err) {
                console.error("Autosave failed:", err);
            }
        }, 5000); // 5 second debounce

        return () => clearTimeout(timer);
    }, [currentState, guides, toolSettings, quickAccess, isInitialized, projects.getFullProjectStateAsFile, lastRenderedImage, objects.length]);

    // Session Recovery Check
    useEffect(() => {
        if (!isInitialized) return;
        const savedData = localStorage.getItem('sketcher_v3_autosave');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed && parsed.objects && parsed.objects.length > 0) {
                    setRecoveredData(parsed);
                    setShowRecoveryPrompt(true);
                }
            } catch (e) {
                console.error("Failed to parse autosave data");
            }
        }
    }, [isInitialized]);

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

        const handleGlobalPaste = (e: ClipboardEvent) => {
            // Check if we are pasting into a text input, if so, ignore
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.clipboardData && e.clipboardData.items) {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            e.preventDefault();

                            // LOGIC: Handle paste based on active view
                            if (activeView === 'render') {
                                // 1. Render View: Import as Background Prompt
                                const file = new File([blob], `Pasted_Image_${Date.now()}.png`, { type: 'image/png' });
                                setPendingBgFile(file);
                                setIsBgImportModalOpen(true);
                            } else if (activeView === 'free') {
                                // 2. Free Mode: Attach to Chat
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    if (ev.target?.result && freeModeRef.current) {
                                        freeModeRef.current.addAttachment(ev.target.result as string);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            } else {
                                // 3. Sketch Mode: Add to Canvas (Existing Logic)
                                // We need to convert blob to proper ClipboardData format for dispatch
                                // Or simpler: use a FileReader and direct dispatch if needed, but existing dispatch works with ClipboardData object from event?
                                // The original code dispatch uses 'clipboard' which is read from navigator? No, paylod uses 'clipboard' type.
                                // Let's look at how PASTE_FROM_CLIPBOARD handler works. It expects 'clipboard' object.
                                // But here we have a blob.
                                // Actually, existing code below was:
                                // dispatch({ type: 'PASTE_FROM_CLIPBOARD', payload: { ... clipboard: ... } })
                                // But wait, existing code calls 'handlePaste' which reads from navigator.clipboard OR uses event data?
                                // The original code didn't actually use the blob inside the listener logic for dispatch!
                                // It just called preventDefault.
                                // Wait, let's check original.

                                // Original just did: 
                                // if (blob) { ... e.preventDefault(); ... }
                                // It seems the actual paste logic was handled elsewhere or incomplete in the snippet showed.
                                // Ah, see line 1211 (original): it didn't do anything after preventing default?
                                // Wait, the provided snippet ended at line 1195.
                                // Let's assume we need to trigger the standard paste action for sketch.

                                handlePaste(); // This function (defined later) handles the logic.
                            }
                        }
                    }
                }
            }
        };



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

    // Background Import Logic
    const [pendingBgFile, setPendingBgFile] = useState<File | null>(null);
    const [isBgImportModalOpen, setIsBgImportModalOpen] = useState(false);

    const handleUpdateBackground = useCallback((updates: { color?: string, file?: File, image?: HTMLImageElement }) => {
        if (updates.file) {
            setPendingBgFile(updates.file);
            // If canvas is empty/new (size 0 or default), maybe auto-resize? 
            // For now, ALWAYS ask as requested.
            setIsBgImportModalOpen(true);
        } else if (updates.color) {
            dispatch({ type: 'UPDATE_BACKGROUND', payload: { color: updates.color } });
        } else if (updates.image) {
            // Direct image update (e.g. from history or other internal logic if any)
            dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: updates.image } });
        }
    }, [dispatch, canvasSize]); // canvasSize dependency to check if empty?

    const confirmBackgroundImport = (mode: 'resize-canvas' | 'fit-image', cropToFit: boolean = false) => {

        if (!pendingBgFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const img = new Image();
                img.onload = () => {
                    if (mode === 'resize-canvas') {
                        dispatch({ type: 'RESIZE_CANVAS', payload: { width: img.width, height: img.height } });
                        dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: img } });
                    } else {
                        // Fit to existing canvas
                        dispatch({ type: 'UPDATE_BACKGROUND', payload: { image: img, cropToFit } });
                    }
                    setIsBgImportModalOpen(false);
                    setPendingBgFile(null);
                    setTimeout(canvasView.onZoomExtents, 100);
                };
                img.src = e.target.result as string;
            }
        };
        reader.readAsDataURL(pendingBgFile);
    };

    const handleImportRenderToSketch = useCallback(() => {
        if (!lastRenderedImage) return;

        // Convert DataURL to File to reuse the existing import logic (Resize vs Fit)
        fetch(lastRenderedImage)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], `Render_${Date.now()}.png`, { type: "image/png" });

                // For Render Import, we ALMOST ALWAYS want to resize the canvas to match the render
                // to avoid stretching/borders.
                setPendingBgFile(file);
                setIsBgImportModalOpen(true);
            })
            .catch(err => {
                console.error("Error importing render:", err);
                alert("Error al importar el render.");
            });
    }, [lastRenderedImage]);

    const handleSendFreeToSketch = useCallback((url: string) => {
        // Similar to handleImportRenderToSketch but from a URL
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], `FreeMode_${Date.now()}.png`, { type: "image/png" });
                setPendingBgFile(file);
                setIsBgImportModalOpen(true);
                setActiveView('sketch');
            })
            .catch(err => {
                console.error("Error importing free mode image:", err);
                alert("Error al importar la imagen.");
            });
    }, []);

    const handleSendFreeToRender = useCallback((url: string) => {
        if (archRenderRef.current) {
            archRenderRef.current.setInputImage(url);
            setActiveView('render');
        }
    }, []);


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

    const handleConfirmClear = useCallback(() => {
        dispatch({ type: 'CLEAR_CANVAS' });
        ui.setShowClearConfirm(false);
        localStorage.removeItem('sketcher_v3_autosave');
    }, [dispatch, ui]);
    const handleSaveItemToLibrary = useCallback((fileOrUrl: string | File, name?: string) => {
        if (fileOrUrl instanceof File) {
            library.onImportToLibrary(fileOrUrl, null);
        } else if (typeof fileOrUrl === 'string' && name) {
            fetch(fileOrUrl).then(res => res.blob()).then(blob => {
                if (blob) {
                    const filename = name.endsWith('.png') ? name : `${name}.png`;
                    library.onImportToLibrary(new File([blob], filename, { type: 'image/png' }), null);
                }
            });
        }
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

    // KeyDown Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setStrokeState(null); setSelection(null); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Global Paste Handler
    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            // NOTE: We do NOT return early for inputs anymore, because we want to intercept IMAGES even if an input is focused.
            // Text pastes will fall through because we only preventDefault if we find an image.

            if (e.clipboardData && e.clipboardData.items) {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            e.preventDefault();
                            console.log('Global Paste Detected. ActiveView:', activeView);
                            if (activeView === 'free') {
                                console.log('Handling paste for Free Mode');
                                // 1. Free Mode: Attach to Chat
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    if (ev.target?.result && freeModeRef.current) {
                                        freeModeRef.current.addAttachment(ev.target.result as string);
                                    } else {
                                        console.error('FreeModeRef is null:', freeModeRef.current);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            } else {
                                console.log('Handling paste for Render/Sketch Mode');
                                const file = new File([blob], `Pasted_Image_${Date.now()}.png`, { type: 'image/png' });

                                if (activeView === 'render') {
                                    // 2. Render Mode: Use "Upload" logic (Input Image) via Ref
                                    if (archRenderRef.current) {
                                        console.log("Delegating paste to ArchitecturalRenderView");
                                        archRenderRef.current.setInputImageFromFile(file);
                                    } else {
                                        console.error("ArchRenderRef is null");
                                    }
                                } else {
                                    // 3. Sketch Mode: Import as Background (Ask to resize/fit)
                                    setPendingBgFile(file);
                                    setIsBgImportModalOpen(true);
                                }
                            }
                        }
                    }
                }
            }
        };
        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [activeView, activeItemId, canvasSize, dispatch]);

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
    // -- 6. RENDER HELPERS --
    const getSketchSnapshot = useCallback(() => {
        const getter = () => drawableObjects;
        const canvas = getCompositeCanvas(true, currentState.canvasSize, getter, currentState.backgroundObject);
        return canvas ? canvas.toDataURL('image/png') : null;
    }, [drawableObjects, currentState.canvasSize, currentState.backgroundObject]);

    const itemToDelete = objects.find(item => item.id === ui.deletingItemId);

    if (ui.showSplash) {
        return (
            <div className="h-[100dvh] w-screen bg-theme-bg-primary text-theme-text-primary flex items-center justify-center font-sans select-none touch-none overscroll-none">
                <div className="text-center p-8">
                    <h1 className="text-5xl font-bold mb-4">Sketcher</h1>
                    <p className="text-lg text-theme-text-secondary mb-10">Tu lienzo creativo te espera.</p>
                    <div className="flex flex-col gap-4 items-center">
                        <button onClick={ui.handleStart} className="px-10 py-4 bg-theme-accent-primary text-white font-bold text-lg rounded-lg shadow-lg hover:bg-theme-accent-hover transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-theme-bg-primary focus:ring-theme-accent-primary">
                            Comenzar a Dibujar
                        </button>

                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <LandingGalleryCarousel onOpenGallery={() => { ui.handleStart(); ui.setIsPublicGalleryOpen(true); }} />
                </div>
                <PublicGallery isOpen={ui.isPublicGalleryOpen} onClose={() => ui.setIsPublicGalleryOpen(false)} isAdmin={role === 'admin'} />
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-screen bg-theme-bg-primary text-theme-text-primary flex flex-col font-sans overflow-hidden select-none touch-none overscroll-none">
            <div className="absolute bottom-4 right-4 z-50 pointer-events-none opacity-50 text-[10px] text-theme-text-secondary">
                v0.5.3-debug-render-fix
            </div>
            {/* Modals & Overlays */}
            {ui.isExportModalOpen && <ExportModal isOpen={ui.isExportModalOpen} onClose={() => ui.setExportModalOpen(false)} drawableObjects={drawableObjects.filter((o): o is SketchObject => o.type === 'object')} canvasSize={canvasSize} onSaveToLibrary={handleSaveItemToLibrary} />}
            {ui.isSingleExportModalOpen && <SingleObjectExportModal isOpen={ui.isSingleExportModalOpen} onClose={() => ui.setSingleExportModalOpen(false)} item={activeItem as SketchObject} canvasSize={canvasSize} onSaveToLibrary={handleSaveItemToLibrary} />}
            {ui.deletingItemId && <ConfirmDeleteModal isOpen={!!ui.deletingItemId} onCancel={() => ui.setDeletingItemId(null)} onConfirm={handleConfirmDelete} itemName={itemToDelete?.name || ''} itemType={itemToDelete?.type === 'group' ? 'group' : 'object'} />}
            {library.deletingLibraryItem && <ConfirmDeleteLibraryItemModal isOpen={!!library.deletingLibraryItem} onCancel={library.onCancelDeleteLibraryItem} onConfirm={library.onConfirmDeleteLibraryItem} itemToDelete={library.deletingLibraryItem} />}
            {ui.showClearConfirm && <ConfirmClearModal isOpen={ui.showClearConfirm} onCancel={() => ui.setShowClearConfirm(false)} onConfirm={handleConfirmClear} />}
            {ui.isCanvasSizeModalOpen && <CanvasSizeModal isOpen={ui.isCanvasSizeModalOpen} onClose={() => ui.setCanvasSizeModalOpen(false)} currentSize={canvasSize} onApply={(w, h) => { dispatch({ type: 'RESIZE_CANVAS', payload: { width: w, height: h } }); ui.setCanvasSizeModalOpen(false); setTimeout(canvasView.onZoomExtents, 100); }} />}
            {ui.isResetConfirmOpen && <ConfirmResetModal isOpen={ui.isResetConfirmOpen} onCancel={() => ui.setIsResetConfirmOpen(false)} onConfirm={() => { console.log("Resetting preferences..."); ui.setIsResetConfirmOpen(false); }} />}
            <WorkspaceTemplatesPopover isOpen={isWorkspacePopoverOpen} onClose={() => setWorkspacePopoverOpen(false)} templates={templates.templates} onSave={handleSaveWorkspace} onLoad={handleLoadWorkspace} onDelete={templates.deleteTemplate} onResetPreferences={() => ui.setIsResetConfirmOpen(true)} />
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
                libraryItems={library.libraryItems}
                onAddLibraryItemToScene={(item) => {
                    if (activeView === 'render') {
                        archRenderRef.current?.setInputImage(item.dataUrl);
                        ui.setProjectGalleryOpen(false);
                    } else {
                        addItem(item.type, item.dataUrl);
                    }
                }}
                onPublishLibraryItem={(item) => library.publishToPublicGallery(item, item.name || 'Sin Título')}
                onDeleteLibraryItem={library.onDeleteLibraryItem}
                onImportImage={library.onImportToLibrary}
                onCreateFolder={library.onCreateFolder}
                onEditItem={library.onEditTransparency}
                onMoveItems={library.onMoveItems}
                onOpenPublicGallery={() => ui.setIsPublicGalleryOpen(true)}
                initialTab={galleryInitialTab}
            />

            {/* Main Header */}
            {ui.isHeaderVisible && (
                <header className="flex-shrink-0 relative z-50">
                    <div className="flex items-center justify-between p-2 bg-theme-bg-primary border-b border-theme-bg-tertiary">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                {/* Mobile Menu Button */}
                                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-md hover:bg-theme-bg-tertiary text-theme-text-secondary">
                                    <MenuIcon className="w-5 h-5" />
                                </button>
                                <h1 className="text-xl font-bold">Sketcher</h1>
                            </div>

                            {/* Recovery Banner */}
                            {showRecoveryPrompt && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] bg-theme-accent-primary text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center gap-2">
                                        <HistoryIcon className="w-5 h-5" />
                                        <span className="text-xs font-bold whitespace-nowrap">¿Recuperar sesión anterior?</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const file = new File([JSON.stringify(recoveredData)], 'recovery.sketcher', { type: 'application/json' });
                                                projects.loadFromFile(file);
                                                setShowRecoveryPrompt(false);
                                                localStorage.removeItem('sketcher_v3_autosave');
                                            }}
                                            className="bg-white text-theme-accent-primary px-3 py-1 rounded-full text-[10px] font-black hover:bg-theme-bg-primary transition-colors"
                                        >
                                            SÍ, RECUPERAR
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowRecoveryPrompt(false);
                                                localStorage.removeItem('sketcher_v3_autosave');
                                            }}
                                            className="bg-black/20 hover:bg-black/40 p-1 rounded-full transition-colors"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* DESKTOP NAVIGATION (Hidden on Mobile) */}
                            <div className="hidden md:flex items-center gap-2">
                                <button onClick={() => ui.setProjectGalleryOpen(true)} className="flex items-center gap-2 p-2 rounded-md bg-theme-bg-secondary hover:bg-theme-bg-tertiary border border-theme-bg-tertiary transition-colors text-sm">
                                    <GalleryIcon className="w-5 h-5" />
                                    <span>Proyectos</span>
                                </button>
                                {/* Templates button moved to user menu */}

                                <div className="h-6 w-px bg-theme-bg-tertiary mx-1 hidden md:block"></div>

                                {/* AI Model Selector - Desktop */}
                                <div className="hidden md:flex items-center gap-2">
                                    <div className="relative">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="h-9 bg-theme-bg-primary text-theme-text-primary text-xs font-medium border border-theme-bg-tertiary rounded-md pl-2 pr-8 focus:ring-2 focus:ring-theme-accent-primary outline-none cursor-pointer hover:bg-theme-bg-hover transition-colors appearance-none"
                                        >
                                            {AI_MODELS.map(model => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name} {model.isNew ? '(Nuevo)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-theme-text-secondary">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Center Tabs */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center bg-theme-bg-secondary rounded-lg p-1 border border-theme-bg-tertiary hidden md:flex">
                            <button
                                onClick={() => setActiveView('sketch')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'sketch'
                                    ? 'bg-theme-bg-primary text-theme-text-primary shadow-sm'
                                    : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary'
                                    }`}
                            >
                                Sketch
                            </button>
                            <button
                                onClick={() => { setActiveView('render'); ui.setIsRightSidebarVisible(true); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'render'
                                    ? 'bg-theme-bg-primary text-theme-text-primary shadow-sm'
                                    : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary'
                                    }`}
                            >
                                Render
                            </button>
                            <button
                                onClick={() => { setActiveView('free'); ui.setIsRightSidebarVisible(false); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'free'
                                    ? 'bg-theme-bg-primary text-theme-text-primary shadow-sm'
                                    : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary'
                                    }`}
                            >
                                Libre
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-theme-bg-secondary rounded-md border border-theme-bg-tertiary">
                                {ui.deferredPrompt && (
                                    <>

                                    </>
                                )}

                                <button onClick={ui.handleToggleFullscreen} className="p-1.5 rounded-md hover:bg-theme-bg-tertiary text-theme-text-secondary" title={ui.isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}>
                                    {ui.isFullscreen ? <MinimizeIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
                                </button>
                            </div>

                            <Auth
                                user={user}
                                credits={credits}
                                role={role}
                                onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                isDarkTheme={theme === 'dark'}
                                uiScale={ui.uiScale}
                                setUiScale={ui.setUiScale}
                                onSaveUiScale={ui.handleSaveUiScale}
                                onOpenTemplates={() => setWorkspacePopoverOpen(true)}
                                onInstallApp={ui.handleInstallClick}
                                isInstallable={ui.isInstallable}
                            />
                        </div>
                    </div>

                    {/* MOBILE MENU DROPDOWN */}
                    {
                        isMobileMenuOpen && (
                            <div className="md:hidden absolute top-full left-0 w-full bg-theme-bg-secondary border-b border-theme-bg-tertiary shadow-xl flex flex-col p-4 gap-3 z-50">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-theme-text-tertiary">Navegación</label>
                                    <button onClick={() => { ui.setProjectGalleryOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-md bg-theme-bg-primary hover:bg-theme-bg-hover text-sm font-medium">
                                        <GalleryIcon className="w-5 h-5" /> Proyectos
                                    </button>

                                    <button onClick={() => { ui.setIsPublicGalleryOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-md bg-theme-bg-primary hover:bg-theme-bg-hover text-sm font-medium">
                                        <SparklesIcon className="w-5 h-5 text-theme-accent-primary" /> Galería Pública
                                    </button>
                                </div>
                                <div className="h-px bg-theme-bg-tertiary"></div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-theme-text-tertiary">Modelo AI</label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full bg-theme-bg-primary text-theme-text-primary text-xs rounded-md border border-theme-bg-tertiary p-2 focus:outline-none focus:ring-1 focus:ring-theme-accent-primary"
                                    >
                                        {AI_MODELS.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} {model.isNew ? '(Nuevo)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="h-px bg-theme-bg-tertiary"></div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-theme-text-tertiary">Modo</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => { setActiveView('sketch'); setIsMobileMenuOpen(false); }} className={`p-2 rounded text-xs font-bold text-center ${activeView === 'sketch' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-primary'}`}>Sketch</button>
                                        <button onClick={() => { setActiveView('render'); ui.setIsRightSidebarVisible(true); setIsMobileMenuOpen(false); }} className={`p-2 rounded text-xs font-bold text-center ${activeView === 'render' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-primary'}`}>Render</button>
                                        <button onClick={() => { setActiveView('free'); ui.setIsRightSidebarVisible(false); setIsMobileMenuOpen(false); }} className={`p-2 rounded text-xs font-bold text-center ${activeView === 'free' ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-primary'}`}>Libre</button>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </header >
            )}


            {/* Main Content Area */}
            <div className="flex flex-grow min-h-0 relative">

                {activeView === 'sketch' && (
                    <>
                        {ui.isLeftSidebarVisible && (
                            <Toolbar
                                tool={tool} setTool={setTool} {...toolSettings} brushPresets={toolSettings.brushPresets} onSavePreset={toolSettings.onSavePreset}
                                onUpdatePreset={toolSettings.onUpdatePreset} onLoadPreset={toolSettings.onLoadPreset} onDeletePreset={toolSettings.onDeletePreset}
                                activeGuide={guides.activeGuide} setActiveGuide={guides.onSetActiveGuide} isOrthogonalVisible={guides.isOrthogonalVisible}
                                onToggleOrthogonal={guides.toggleOrthogonal} onExportClick={() => ui.setExportModalOpen(true)}
                                onImportBackgroundClick={() => { setPendingBgFile(null); setIsBgImportModalOpen(true); }}
                                objects={objects} libraryItems={library.libraryItems} backgroundDataUrl={ai.backgroundDataUrl} debugInfo={ai.debugInfo}
                                strokeMode={strokeMode} setStrokeMode={setStrokeMode} strokeModifier={strokeModifier} setStrokeModifier={setStrokeModifier}
                                isSolidBox={isSolidBox} setIsSolidBox={setIsSolidBox}
                            />
                        )}
                        <button
                            onClick={() => ui.setIsLeftSidebarVisible(!ui.isLeftSidebarVisible)}
                            className="absolute top-1/2 -translate-y-1/2 bg-theme-bg-secondary p-2 rounded-full shadow-xl z-40 border border-theme-bg-tertiary hover:bg-theme-bg-tertiary transition-all"
                            style={{ left: ui.isLeftSidebarVisible ? '4.25rem' : '0.25rem' }}
                            title={ui.isLeftSidebarVisible ? "Ocultar Herramientas" : "Mostrar Herramientas"}
                        >
                            {ui.isLeftSidebarVisible ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                        </button>
                    </>
                )}

                <BackgroundImportModal
                    isOpen={isBgImportModalOpen}
                    onClose={() => { setIsBgImportModalOpen(false); setPendingBgFile(null); }}
                    onResizeCanvas={() => confirmBackgroundImport('resize-canvas')}
                    onFitImage={(cropToFit) => confirmBackgroundImport('fit-image', cropToFit)}
                    pendingFile={pendingBgFile}
                    onFileSelected={(file) => setPendingBgFile(file)}
                    libraryItems={library.libraryItems}
                />

                <AIPanel
                    isOpen={isAIPanelOpen}
                    onClose={() => setIsAIPanelOpen(false)}
                    onEnhance={(payload) => ai.handleEnhance(payload, canvasSize, getDrawableObjects, backgroundObject, activeItemId, objects)}
                    onUpdateDebugInfo={(payload) => ai.updateDebugInfo(payload, canvasSize, getDrawableObjects, backgroundObject, activeItemId, objects)}
                    isEnhancing={ai.isEnhancing}
                    enhancementPreview={ai.enhancementPreview}
                    onGenerateEnhancementPreview={(includeBackground) => ai.generateEnhancementPreview(canvasSize, getDrawableObjects, backgroundObject, includeBackground)}
                    debugInfo={ai.debugInfo}
                />

                {activeView === 'sketch' && (
                    <button
                        onClick={() => setIsAIPanelOpen(true)}
                        className="absolute bottom-24 left-4 md:bottom-6 md:left-6 p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl hover:scale-110 transition-transform z-40 flex items-center justify-center border-2 border-white/20"
                        title="Mejorar con IA"
                        style={{ left: ui.isLeftSidebarVisible ? '6.5rem' : '' }}
                    >
                        <SparklesIcon className="w-8 h-8" />
                    </button>
                )}
                <main ref={mainAreaRef} className="flex-grow relative" onDrop={(e) => { e.preventDefault(); try { const data = JSON.parse(e.dataTransfer.getData('application/json')); if (data.type === 'library-item') { onDropOnCanvas(data, activeItemId, setSelectedItemIds); } } catch (error) { /* Ignore */ } }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} >
                    {/* Fullscreen Toggle - Always Visible */}


                    <div className={activeView === 'sketch' ? 'contents' : 'hidden'}>
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
                            isSolidBox={isSolidBox}
                            scaleUnit={scaleUnit}
                        />
                        <div className="absolute top-36 left-4 md:top-2 md:left-2 flex items-center gap-2 z-10">
                            {dimensionDisplay && <button ref={scaleButtonRef} onClick={() => setIsScalePopoverOpen(p => !p)} className="bg-theme-bg-primary/80 backdrop-blur-sm text-theme-text-secondary text-xs rounded-md px-2 py-1 pointer-events-auto hover:bg-theme-bg-secondary transition-colors" title="Ajustar escala del lienzo">{dimensionDisplay}</button>}
                            <button
                                onClick={() => setIsPalmRejectionEnabled(prev => !prev)}
                                className={`bg-theme-bg-primary/80 backdrop-blur-sm text-xs rounded-md px-2 py-1 pointer-events-auto hover:bg-theme-bg-secondary transition-colors flex items-center gap-1 ${isPalmRejectionEnabled ? 'text-theme-accent-primary font-bold' : 'text-theme-text-secondary'}`}
                                title={isPalmRejectionEnabled ? "Rechazo de Palma: ACTIVADO (Solo Lápiz)" : "Rechazo de Palma: DESACTIVADO (Lápiz y Dedo)"}
                            >
                                <HandRaisedIcon className="w-4 h-4" />
                                <span className="hidden md:inline">{isPalmRejectionEnabled ? "Solo Lápiz" : "Táctil + Lápiz"}</span>
                            </button>
                        </div>

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
                            onSetIsPerspectiveStrokeLockEnabled={guides.setIsPerspectiveStrokeLockEnabled}
                            onResetPerspective={guides.resetPerspective}
                            scaleFactor={currentState.scaleFactor}
                            scaleUnit={currentState.scaleUnit} onPaste={handlePaste} hasClipboardContent={!!clipboard}
                            strokeSmoothing={strokeSmoothing} setStrokeSmoothing={setStrokeSmoothing}
                            strokeMode={strokeMode} isSolidBox={isSolidBox} setIsSolidBox={setIsSolidBox}
                        />
                        <QuickAccessBar
                            settings={quickAccess.quickAccessSettings} onUpdateColor={quickAccess.updateColor} onAddColor={quickAccess.addColor}
                            onRemoveColor={quickAccess.removeColor} onUpdateSize={quickAccess.updateSize} onUpdateTool={quickAccess.updateTool}
                            onAddToolSlot={quickAccess.addToolSlot}
                            onSelectColor={handleSelectColor} onSelectSize={handleSelectSize} onSelectTool={(qaTool) => { if (qaTool.type === 'tool') setTool(qaTool.tool); else if (qaTool.type === 'fx-preset') { setTool('fx-brush'); toolSettings.onLoadPreset(qaTool.id); } else if (qaTool.type === 'mode-preset') { setTool(qaTool.tool); setStrokeMode(qaTool.mode); } }}
                            onOpenToolSelector={(index) => { setIsToolSelectorOpen(true); setEditingToolSlotIndex(index); }}
                            activeTool={tool} activeColor={activeColor} activeSize={activeSize} strokeMode={strokeMode}
                            onToggleHeader={() => ui.setIsHeaderVisible(!ui.isHeaderVisible)}
                            isHeaderVisible={ui.isHeaderVisible}
                        />
                    </div>

                    <div className={activeView === 'render' ? 'flex flex-col h-full w-full relative' : 'hidden'}>
                        <ArchitecturalRenderView
                            ref={archRenderRef}
                            onImportFromSketch={getSketchSnapshot}
                            isSidebarOpen={ui.isRightSidebarVisible}
                            selectedModel={selectedModel}
                            onOpenLibrary={() => {
                                setGalleryInitialTab('library');
                                ui.setProjectGalleryOpen(true);
                            }}
                            onUndo={() => dispatch({ type: 'UNDO' })}
                            onRedo={() => dispatch({ type: 'REDO' })}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onRenderComplete={setLastRenderedImage}
                            onInspectRequest={inspectAIRequest}
                            credits={credits}
                            deductCredit={deductCredit}
                            onSaveToLibrary={handleSaveItemToLibrary}
                        />
                    </div>

                    <div className={activeView === 'free' ? 'flex flex-col h-full w-full relative' : 'hidden'}>
                        <FreeModeView
                            ref={freeModeRef}
                            user={user}
                            onImportFromSketch={getSketchSnapshot}
                            lastRenderedImage={lastRenderedImage}
                            onSaveToLibrary={handleSaveItemToLibrary}
                            deductCredit={deductCredit}
                            onInspectRequest={role === 'admin' ? inspectAIRequest : undefined}
                            libraryItems={library.libraryItems}
                            selectedModel={selectedModel}
                            onSendToSketch={handleSendFreeToSketch}
                            onSendToRender={handleSendFreeToRender}
                        />
                    </div>
                </main>
                {activeView === 'sketch' && ui.isRightSidebarVisible && (
                    <aside ref={ui.rightSidebarRef} className={`flex-shrink-0 w-80 border-l border-theme-bg-tertiary flex flex-col ${isAIPanelOpen ? 'z-50' : ''}`}>
                        <div style={{ height: ui.rightSidebarTopHeight }} className="flex-shrink-0">
                            <Outliner
                                items={objects} activeItemId={activeItemId} onAddItem={addItem} onCopyItem={copyItem} onDeleteItem={deleteItem} onSelectItem={handleSelectItem}
                                onUpdateItem={updateItem} onMoveItem={handleMoveItem} onMergeItems={handleMergeItems} onUpdateBackground={handleUpdateBackground}
                                onRemoveBackgroundImage={handleRemoveBackgroundImage} onExportItem={() => { if (activeItem) ui.setSingleExportModalOpen(true); }}
                                onOpenCanvasSizeModal={() => ui.setCanvasSizeModalOpen(true)} activeItemState={activeItemState}
                                onMoveItemUpDown={handleMoveItemUpDown} onMergeItemDown={handleMergeItemDown} onMergeItemUp={handleMergeItemUp}
                                onAddObjectAbove={handleAddObjectAbove} onAddObjectBelow={handleAddObjectBelow}
                                lastRenderedImage={lastRenderedImage} onImportRender={handleImportRenderToSketch}
                            />
                        </div>
                        <div onPointerDown={ui.handlePointerDownResize} className="flex-shrink-0 h-1.5 bg-theme-bg-secondary hover:bg-theme-accent-primary transition-colors cursor-ns-resize" />
                        <div className="flex-grow min-h-0">
                            <Library
                                user={user}
                                items={library.libraryItems}
                                onImportImage={library.onImportToLibrary}
                                onCreateFolder={library.onCreateFolder}
                                onEditItem={library.onEditTransparency}
                                onDeleteItem={library.onDeleteLibraryItem}
                                onAddItemToScene={(id) => onDropOnCanvas({ type: 'library-item', id }, activeItemId, setSelectedItemIds)}
                                onMoveItems={library.onMoveItems}
                                onPublish={library.publishToPublicGallery}
                                allowUpload={true} // Enable upload in sidebar as requested
                                allowPublish={false} // Disable publish in sidebar items
                            />
                        </div>
                    </aside>
                )}
                {activeView !== 'free' && (
                    <button onClick={() => ui.setIsRightSidebarVisible(!ui.isRightSidebarVisible)} className="absolute top-1/2 -translate-y-1/2 bg-theme-bg-secondary p-2 rounded-full shadow-xl z-40 border border-theme-bg-tertiary hover:bg-theme-bg-tertiary transition-all" style={{ right: ui.isRightSidebarVisible ? '20.25rem' : '0.25rem' }} title={ui.isRightSidebarVisible ? 'Ocultar paneles' : 'Mostrar paneles'}>
                        {ui.isRightSidebarVisible ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                    </button>
                )}
            </div >
            <AIRequestInspectorModal
                isOpen={!!inspectorPayload}
                onClose={cancelInspector}
                onConfirm={confirmInspector}
                payload={inspectorPayload}
            />
            <BackgroundImportModal
                isOpen={isBgImportModalOpen}
                onClose={() => setIsBgImportModalOpen(false)}
                onResizeCanvas={() => confirmBackgroundImport('resize-canvas')}
                onFitImage={(cropToFit) => confirmBackgroundImport('fit-image', cropToFit)}
                pendingFile={pendingBgFile}
                onFileSelected={setPendingBgFile}
                libraryItems={library.libraryItems}
            />
            <PublicGallery isOpen={ui.isPublicGalleryOpen} onClose={() => ui.setIsPublicGalleryOpen(false)} isAdmin={role === 'admin'} currentUser={user} />
        </div >
    );
}

// ===================================================================================
// CHILD COMPONENTS (previously in App.tsx)
// ===================================================================================

interface ProjectGalleryModalProps {
    isOpen: boolean; onClose: () => void; user: User | null; projects: Project[]; isLoading: boolean;
    onSave: (name: string) => Promise<void>; onLoad: (project: Project) => Promise<void>; onDelete: (project: Project) => Promise<void>;
    onSaveLocally: (name: string) => Promise<void>; onLoadFromFile: (file: File) => Promise<void>;
    libraryItems: any[]; onAddLibraryItemToScene: (item: any) => void; onPublishLibraryItem: (item: any) => void; onDeleteLibraryItem: (item: any) => void;
    onImportImage: (file: File, parentId: string | null) => void;
    onCreateFolder: (name: string, parentId: string | null) => void;
    onEditItem: (id: string) => void;
    onMoveItems: (itemIds: string[], targetParentId: string | null) => void;
    onOpenPublicGallery?: () => void;
    initialTab?: 'projects' | 'library';
}

const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({
    isOpen, onClose, user, projects, isLoading, onSave, onLoad, onDelete, onSaveLocally, onLoadFromFile,
    libraryItems, onAddLibraryItemToScene, onPublishLibraryItem, onDeleteLibraryItem,
    onImportImage, onCreateFolder, onEditItem, onMoveItems, onOpenPublicGallery, initialTab = 'projects'
}) => {
    const [activeTab, setActiveTab] = useState<'projects' | 'library'>(initialTab);
    const [newProjectName, setNewProjectName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deletingProject, setDeletingProject] = useState<Project | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [localFileName, setLocalFileName] = useState('mi-boceto');
    const localSaveInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setNewProjectName('');
            setIsSaving(false);
            setDeletingProject(null);
            setIsSavingLocal(false);
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

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
            <div className="bg-theme-bg-secondary text-theme-text-primary rounded-lg shadow-xl p-6 w-full max-w-5xl h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0 border-b border-theme-bg-tertiary pb-4">
                    <div className="flex items-center gap-6">
                        <h2 className="text-2xl font-bold">Galería</h2>
                        <div className="flex bg-theme-bg-tertiary rounded-lg p-1">
                            <button onClick={() => setActiveTab('projects')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'projects' ? 'bg-theme-bg-primary text-theme-text-primary shadow-sm' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}>Proyectos</button>
                            <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'library' ? 'bg-theme-bg-primary text-theme-text-primary shadow-sm' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}>Mi Librería</button>
                        </div>
                    </div>
                    {isSavingLocal ? (
                        <div className="flex items-center gap-2">
                            <input ref={localSaveInputRef} type="text" value={localFileName} onChange={(e) => setLocalFileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSaveLocal(); if (e.key === 'Escape') handleCancelSaveLocal(); }} placeholder="Nombre del archivo..." className="bg-theme-bg-secondary text-theme-text-primary text-sm rounded-md p-2 border border-theme-bg-tertiary focus:ring-1 focus:ring-theme-accent-primary focus:outline-none" />
                            <button onClick={handleConfirmSaveLocal} className="px-4 py-2 rounded-md bg-theme-accent-primary hover:bg-theme-accent-hover text-white font-semibold">Guardar</button>
                            <button onClick={handleCancelSaveLocal} className="px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover">Cancelar</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input type="file" ref={fileInputRef} className="hidden" accept=".sketcher,application/json" onChange={handleFileSelected} />
                            {onOpenPublicGallery && (
                                <button onClick={() => { onOpenPublicGallery(); onClose(); }} className="flex items-center gap-2 px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover font-semibold text-theme-accent-primary">
                                    <SparklesIcon className="w-5 h-5" /> <span className="hidden md:inline">Galería Pública</span>
                                </button>
                            )}
                            <button onClick={handleFileLoadClick} className="flex items-center gap-2 px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover font-semibold"> <FolderOpenIcon className="w-5 h-5" /> <span>Cargar desde Archivo</span> </button>
                            <button onClick={handleHeaderSaveLocalClick} className="flex items-center gap-2 px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover font-semibold"> <SaveIcon className="w-5 h-5" /> <span>Guardar Local</span> </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-theme-bg-tertiary"> <XIcon className="w-6 h-6" /> </button>
                        </div>
                    )}
                </div>

                {!user ? (<div className="flex-grow flex flex-col items-center justify-center text-center text-theme-text-secondary"> <UserIcon className="w-16 h-16 mb-4" /> <h3 className="text-xl font-bold">Por favor, inicie sesión</h3> <p>Inicie sesión para acceder a su galería en la nube.</p> </div>
                ) : (
                    activeTab === 'projects' ? (
                        <>
                            <div className="bg-theme-bg-primary p-4 rounded-lg mb-4 flex-shrink-0 border border-theme-bg-tertiary">
                                <h3 className="text-lg font-semibold mb-2">Guardar Lienzo Actual en Proyectos</h3>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Nombre del nuevo proyecto..." className="flex-grow bg-theme-bg-secondary text-theme-text-primary text-sm rounded-md p-2 border border-theme-bg-tertiary focus:ring-1 focus:ring-theme-accent-primary focus:outline-none" disabled={isSaving} />
                                    <button onClick={handleSave} disabled={!newProjectName.trim() || isSaving || !user} className="px-4 py-2 rounded-md bg-theme-accent-primary hover:bg-theme-accent-hover text-white font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"> {isSaving ? 'Guardando...' : 'Guardar Nuevo'} </button>
                                </div>
                            </div>
                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                                {isLoading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-theme-accent-primary border-t-transparent rounded-full animate-spin"></div></div>
                                    : projects.length === 0 ? <div className="text-center text-theme-text-secondary py-16"> <p>No se encontraron proyectos guardados.</p> <p className="text-sm">¡Guarda tu lienzo actual para empezar!</p> </div>
                                        : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {projects.map(p => (
                                                <div key={p.id} className="group relative bg-theme-bg-tertiary rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all border border-theme-bg-tertiary/50">
                                                    <div className="aspect-video bg-white/5 flex items-center justify-center overflow-hidden"><img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" /></div>
                                                    <div className="p-3"><p className="font-semibold text-sm truncate text-theme-text-primary">{p.name}</p></div>
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                                        <button onClick={() => onLoad(p)} className="px-4 py-2 rounded-md bg-theme-accent-primary hover:bg-theme-accent-hover text-white w-3/4 font-medium shadow-lg">Cargar</button>
                                                        <button onClick={() => setDeletingProject(p)} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white w-3/4 font-medium shadow-lg">Eliminar</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                }
                            </div>
                        </>
                    ) : (
                        <div className="flex-grow overflow-hidden relative rounded-lg border border-theme-bg-tertiary">
                            <Library
                                user={user}
                                items={libraryItems}
                                onImportImage={onImportImage}
                                onCreateFolder={onCreateFolder}
                                onEditItem={onEditItem}
                                onDeleteItem={onDeleteLibraryItem}
                                onAddItemToScene={(id) => { onAddLibraryItemToScene({ id, type: 'library-item' }); onClose(); }}
                                onMoveItems={onMoveItems}
                                onPublish={onPublishLibraryItem}
                                allowUpload={true}
                                allowPublish={true}
                                className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                            />
                        </div>
                    )
                )}
            </div>
            {deletingProject && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"> <div className="bg-theme-bg-secondary rounded-lg p-6 shadow-xl border border-theme-bg-tertiary max-w-sm w-full mx-4"> <h3 className="text-lg font-bold text-theme-text-primary">Confirmar Eliminación</h3> <p className="my-4 text-theme-text-secondary">¿Estás seguro de que quieres eliminar el proyecto <span className="text-theme-text-primary font-bold">"{deletingProject.name}"</span>?<br />Esta acción no se puede deshacer.</p> <div className="flex justify-end gap-3"> <button onClick={() => setDeletingProject(null)} className="px-4 py-2 rounded-md bg-theme-bg-tertiary hover:bg-theme-bg-hover text-theme-text-primary">Cancelar</button> <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium shadow-lg">Eliminar</button> </div> </div> </div>}
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
        <div ref={popoverRef} className="absolute z-20 bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-lg p-3 space-y-3" style={{ top: rect.bottom + 8, left: rect.left }} >
            <p className="text-xs font-bold text-theme-text-secondary">Ajustes de Escala</p>
            <div className="flex items-center gap-2">
                <span className="text-sm">1</span>
                <select value={scaleUnit} onChange={(e) => handleUnitChange(e.target.value as ScaleUnit)} className="bg-theme-bg-tertiary text-sm rounded-md p-1 border border-theme-bg-hover"> <option value="mm">mm</option> <option value="cm">cm</option> <option value="m">m</option> </select>
                <span className="text-sm">=</span>
                <input type="number" value={inputValue} onChange={handleInputChange} className="w-24 bg-theme-bg-secondary text-sm rounded-md p-1 border border-theme-bg-tertiary" />
                <span className="text-sm">px</span>
            </div>
        </div>
    );
};