// FIX: Removed a self-import of 'Guide' which was causing a name conflict with the declaration below.
// FIX: Decouple 'orthogonal' and 'grid' from primary guides to allow simultaneous activation.
export type Guide = 'none' | 'ruler' | 'perspective' | 'mirror';

export interface BaseItem {
  id: string;
  name: string;
  type: ItemType;
  isVisible: boolean;
  opacity: number;
  parentId: string | null;
  isLocked?: boolean; // New: prevents deletion
}

export interface SketchObject extends BaseItem {
  type: 'group' | 'object';
  offsetX?: number;
  offsetY?: number;
  rotation?: number; // Rotation in radians
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
  isBackground?: boolean;
  color?: string;
  fillColor?: string;
  backgroundImage?: HTMLImageElement | HTMLCanvasElement;
  dataUrl?: string; // For serialization
  contentRect?: CropRect; // New: tracks the actual area occupied by the background image or content
  mipmaps?: {
    small?: HTMLCanvasElement; // ~ 1/4 resolution (or fixed small size)
    medium?: HTMLCanvasElement; // ~ 1/2 resolution
  };
}

export interface BrushSettings {
  size: number;
  opacity: number;
  color: string;
  fillColor: string; // New fill color property
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  hasStrokeCaps: boolean;
  pressureControl: {
    size: boolean;
  };
}

export interface EraserSettings {
  size: number;
  opacity: number; // 0-1, acts like flow
  hardness: number; // 0-100
  tipShape: 'round' | 'square';
}

export type BlendMode =
  | 'source-over' | 'source-in' | 'source-out' | 'source-atop'
  | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop'
  | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light'
  | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation'
  | 'color' | 'luminosity';

export interface SimpleMarkerSettings {
  size: number;
  opacity: number;
  color: string;
  // Added 'circle' as a valid tip shape for simple markers
  tipShape: 'square' | 'line' | 'circle';
  blendMode: BlendMode;
  fillColor: string;
  pressureControl: {
    opacity: boolean;
  };
}

// FIX: Added AdvancedMarkerSettings for the new tool.
export interface AdvancedMarkerSettings {
  size: number;
  color: string;
  tipShape: 'circle' | 'square';
  tipAngle: number; // 0-360
  hardness: number; // 0-100
  flow: number; // 0-100, opacity build-up
  wetness: number; // 0-100, color blending
  spacing: number; // 1-100 (% of size)
  blendMode: BlendMode;
  fillColor: string;
  pressureControl: {
    size: boolean;
    flow: boolean;
  };
}


// FIX: Added missing brush setting types
export interface NaturalMarkerSettings {
  size: number;
  opacity: number;
  color: string;
  fillColor: string;
  pressureControl: {
    size: boolean;
    opacity: boolean;
  };
}

export interface AirbrushSettings {
  size: number;
  flow: number; // 0-1
  color: string;
  fillColor: string;
  pressureControl: {
    flow: boolean;
  };
}

export interface FXBrushSettings {
  presetId: string | null;
  size: number;
  opacity: number;
  color: string;
  fillColor: string;
}

export interface WatercolorSettings {
  size: number;
  flow: number; // 0-100, density of dabs
  wetness: number; // 0-100, opacity of each dab
  opacity: number; // 0-1 overall brush opacity (slider)
  color: string;
  fillColor: string;
  pressureControl: {
    size: boolean;
    flow: boolean;
    opacity: boolean;
  };
}


export interface TextSettings {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold' | 'italic';
}

export interface MagicWandSettings {
  tolerance: number; // 0-100
  contiguous: boolean;
}

export interface Selection {
  path: Path2D;
  boundingBox: CropRect;
  sourceItemId: string;
}

export interface ClipboardData {
  imageData: ImageData;
  sourceRect: CropRect;
}


// FIX: Removed 'annotation' tool.
// FIX: Added 'debug-brush' to the Tool type to match its usage in the application.
// FIX: Added new brush tools to the Tool type.
// FIX: Renamed 'solid-marker' to 'simple-marker' and added 'advanced-marker'.
export type Tool = 'select' | 'transform' | 'brush' | 'eraser' | 'pan' | 'simple-marker' | 'crop' | 'free-transform' | 'debug-brush' | 'marquee-rect' | 'marquee-circle' | 'lasso' | 'magic-wand' | 'text' | 'natural-marker' | 'airbrush' | 'fx-brush' | 'advanced-marker' | 'watercolor';

// FIX: Added BrushPreset type for FX brushes.
export interface BrushPreset {
  id: string;
  name: string;
}

export type RgbColor = { r: number; g: number; b: number };

interface BaseLibraryItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface LibraryImage extends BaseLibraryItem {
  type: 'image';
  dataUrl?: string; // Download URL for images
  storagePath: string; // Path in Firebase Storage
  transparentColors?: RgbColor[];
  scaleFactor?: number; // px/mm
  tolerance?: number;
  scaleUnit?: ScaleUnit;
  originalStoragePath?: string; // Path to original opaque image in Storage
}

export interface LibraryFolder extends BaseLibraryItem {
  type: 'folder';
}

export type LibraryItem = LibraryImage | LibraryFolder;


// -- New Guide Types --
// FIX: Removed 'annotation' from ItemType
export type ItemType = 'group' | 'object' | 'virtual-layer';

// FIX: Update CanvasItem to only be SketchObject
export type CanvasItem = SketchObject;

export type Point = { x: number; y: number; pressure?: number };

export type StrokeMode = 'freehand' | 'line' | 'polyline' | 'curve' | 'arc' | 'parallelepiped' | 'rectangle' | 'circle' | 'rotated-rectangle';

export interface StrokeState {
  mode: StrokeMode;
  points: Point[];
}

export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export interface StrokeModifier {
  style: StrokeStyle;
  scale: number;
}

export interface RulerGuide {
  id: string;
  start: Point;
  end: Point;
}

export interface MirrorGuide {
  id: string;
  start: Point;
  end: Point;
}

// FIX: Add interface for grid guide settings.
export type GridType = 'none' | 'cartesian' | 'isometric';

export interface GridGuide {
  type: GridType;
  spacing: number;
  majorLineFrequency: number;
  isoAngle: number; // 30, 45, 60
  majorLineColor: string;
  minorLineColor: string;
}

export interface PerspectiveGuideLine {
  id: string;
  start: Point;
  end: Point;
}

export interface PerspectiveControlPoint {
  id: string;
  handle: Point;
}

export interface PerspectiveGuide {
  lines: {
    green: PerspectiveGuideLine[];
    red: PerspectiveGuideLine[];
    blue: PerspectiveGuideLine[];
  };
  guidePoint: Point;
  extraGuideLines: {
    green: PerspectiveControlPoint[];
    red: PerspectiveControlPoint[];
    blue: PerspectiveControlPoint[];
  };
  isGridVisible?: boolean;
  gridColor?: string;
  gridDensity?: number;
  gridVerticalScope?: 'both' | 'above' | 'below';
  gridLength?: 'full' | 'short';
}

export interface OrthogonalGuide {
  angle: number; // in degrees
}

export type ScaleUnit = 'mm' | 'cm' | 'm';

export interface AppState {
  objects: CanvasItem[];
  canvasSize: { width: number, height: number };
  scaleFactor: number; // px/mm
  scaleUnit: ScaleUnit;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// FIX: Export ViewTransform to be used in multiple files.
export type ViewTransform = { zoom: number, pan: { x: number, y: number } };

export type AffineTransformState = {
  type: 'affine';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in radians
}

export type FreeTransformState = {
  type: 'free';
  x: number; // Initial bbox x
  y: number; // Initial bbox y
  width: number; // Initial bbox width
  height: number; // Initial bbox height
  corners: {
    tl: Point;
    tr: Point;
    bl: Point;
    br: Point;
  };
}

export type TransformState = AffineTransformState | FreeTransformState;

// -- Quick Access Bar --
// FIX: Converted QuickAccessTool to a union to support presets.
export type QuickAccessTool = { type: 'tool'; tool: Tool } | { type: 'fx-preset'; id: string; name: string } | { type: 'mode-preset'; mode: StrokeMode; tool: Tool; label?: string };

export interface QuickAccessSettings {
  colors: string[];
  sizes: number[];
  tools: (QuickAccessTool | null)[];
}


export interface WorkspaceTemplate {
  id: string;
  name: string;
  canvasSize: { width: number; height: number };
  backgroundColor: string;
  scaleFactor: number; // px/mm
  scaleUnit: ScaleUnit;
  guides: {
    activeGuide: Guide;
    isOrthogonalVisible: boolean;
    rulerGuides: RulerGuide[];
    mirrorGuides: MirrorGuide[];
    perspectiveGuide: PerspectiveGuide | null;
    orthogonalGuide: OrthogonalGuide;
    gridGuide: GridGuide;
    areGuidesLocked: boolean;
    isPerspectiveStrokeLockEnabled: boolean;
    isSnapToGridEnabled: boolean;
  };
  toolSettings: {
    brushSettings: BrushSettings;
    eraserSettings: EraserSettings;
    // FIX: Cannot find name 'SolidMarkerSettings'. Changed to 'SimpleMarkerSettings' for backward compatibility.
    solidMarkerSettings?: SimpleMarkerSettings; // For backwards compatibility
    simpleMarkerSettings: SimpleMarkerSettings;
    // FIX: Added new tool settings to WorkspaceTemplate
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    magicWandSettings: MagicWandSettings;
    textSettings: TextSettings;
    advancedMarkerSettings: AdvancedMarkerSettings;
    watercolorSettings: WatercolorSettings;
  };
  quickAccessSettings: QuickAccessSettings;
}


export interface RenderStyleSettings {
  // Photorealistic (ph) - UPDATED: No geometry distortion
  phCamera?: string; // 'dslr', 'large_format', 'drone', 'instant'
  phFilm?: string;   // 'digital', 'kodak_portra', 'fujifilm', 'bw_film'
  phEffect?: string; // 'clean', 'bokeh', 'vignette', 'cinematic_bloom'
  // Digital Sketch
  dsBrush: string;
  dsFinish: string;
  dsStroke: string;
  // Watercolor
  wcTechnique: string;
  wcPaper: string;
  wcInk: string;
  // Technical Plan
  tpBackground: string;
  tpPrecision: string;
  tpDetails: string;
  // Charcoal
  chSmudge: string;
  chContrast: string;
  chHatch: string;
  // Clay Model
  cmMaterial: string;
  cmSurface: string;
  cmLighting: string;
  // Ink Marker
  imPaper: string;
  imTechnique: string;
  imColor: string;
  // 3D Cartoon
  tcStyle: string;
  tcMaterial: string;
  tcLighting: string;
  // Colored Pencil
  cpTechnique: string;
  cpPaper: string;
  cpVibrancy: string;

}

export interface ArchRenderState {
  inputImage: string | null;
  resultImage: string | null;
  styleReferenceImage: string | null;
  renderStyle: string;
  renderStyleSettings: RenderStyleSettings; // New settings object
  sceneType: string;
  timeOfDay: string;
  weather: string;
  archStyle: string;
  roomType: string;
  lighting: string;
  studioLighting: string;
  studioBackground: string;
  studioShot: string;
  carAngle: string;
  carEnvironment: string;
  carColor: string;
  objectMaterial: string;
  objectDoF: string;
  objectContext: string;
  creativeFreedom: number;
  additionalPrompt: string;
  manualPrompt: string;
  savedPrompts: string[];
  regions: any[];
  vpGeneralInstructions: string;
  vpReferenceImage: string | null;
  aiStructuredPrompt: string;
  isPromptManuallyEdited: boolean;
  drawingData?: string; // PNG data url of the LayeredCanvas drawing
  generationHistory: { input: string | null, result: string | null }[];
  historyIndex: number;
}

export interface FreeModeMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: string[];
  timestamp: number;
  isImageOnly?: boolean;
}

export interface FreeModeState {
  messages: FreeModeMessage[];
  attachments: string[];
}

export interface ProjectFile {
  fileFormatVersion: string;
  canvasSize: { width: number; height: number };
  objects: CanvasItem[];
  scaleFactor: number; // px/mm
  scaleUnit: ScaleUnit;
  guides: WorkspaceTemplate['guides'];
  toolSettings: WorkspaceTemplate['toolSettings'];
  quickAccessSettings: QuickAccessSettings;
  archRenderState?: ArchRenderState;
  freeModeState?: FreeModeState;
}

export interface Project {
  id: string;
  name: string;
  projectFilePath: string;
  thumbnailPath: string;
  thumbnailUrl: string;
}

// -- Saved Instruction Presets --
export interface SavedInstruction {
  id: string;
  name: string;
  content: string;
  source?: 'simple' | 'advanced'; // Track where it was created
}