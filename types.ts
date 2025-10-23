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
  backgroundImage?: HTMLImageElement;
  dataUrl?: string; // For serialization
}

export interface BrushSettings {
  size: number;
  opacity: number;
  color: string;
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

export interface SolidMarkerSettings {
  size: number;
  opacity: number;
  color: string;
  tipShape: 'square' | 'line';
  blendMode: BlendMode;
  pressureControl: {
    opacity: boolean;
  };
}

export interface NaturalMarkerSettings {
  size: number;
  flow: number; // Build-up opacity, 0-1
  color: string;
  hardness: number; // 0-100
  spacing: number; // 1-100 percent
  tipShape: 'round' | 'square' | 'line';
  blendMode: BlendMode;
  pressureControl: {
      size: boolean;
      flow: boolean;
  };
}


export interface AirbrushSettings {
  size: number;
  density: number; // 0-1
  color: string;
  softness: number; // 0-1
  blendMode: BlendMode;
}

export interface FXBrushSettings {
  // General
  size: number;
  opacity: number;
  flow: number; // Build-up
  color: string;
  blendMode: BlendMode;
  
  // Tip
  hardness: number; // 0-100
  spacing: number; // 1-500 percent
  angle: number; // 0-360
  angleFollowsStroke: boolean;
  tipShape: 'round' | 'square' | 'line';
  
  // Shape Dynamics
  sizeJitter: number; // 0-1 percent
  angleJitter: number; // 0-1 percent
  
  // Scatter
  scatter: number; // 0-1 percent
  
  // Texture
  texture: {
    dataUrl: string | null;
    name: string | null;
  };
  
  // Color Dynamics
  hueJitter: number; // 0-1 percent
  saturationJitter: number; // 0-1 percent
  brightnessJitter: number; // 0-1 percent

  // Pressure Dynamics
  pressureControl: {
      size: boolean;
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

export interface BrushPreset {
    id: string;
    name: string;
    settings: FXBrushSettings;
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
// Removed artistic-only tools (natural-marker, airbrush, fx-brush) to simplify the tool set.
export type Tool = 'select' | 'transform' | 'brush' | 'eraser' | 'pan' | 'solid-marker' | 'crop' | 'free-transform' | 'enhance' | 'debug-brush' | 'marquee-rect' | 'lasso' | 'magic-wand' | 'text';

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
}

export interface LibraryFolder extends BaseLibraryItem {
  type: 'folder';
}

export type LibraryItem = LibraryImage | LibraryFolder;


// -- New Guide Types --
// FIX: Removed 'annotation' from ItemType
export type ItemType = 'group' | 'object';

// FIX: Update CanvasItem to only be SketchObject
export type CanvasItem = SketchObject;

export type Point = { x: number; y: number; pressure?: number };

export type StrokeMode = 'freehand' | 'line' | 'polyline' | 'curve' | 'arc';

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
export type QuickAccessTool = 
  | { type: 'tool'; tool: Tool }
  | { type: 'fx-preset'; id: string; name: string };

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
    solidMarkerSettings: SolidMarkerSettings;
    naturalMarkerSettings: NaturalMarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
    magicWandSettings: MagicWandSettings;
    textSettings: TextSettings;
  };
  quickAccessSettings: QuickAccessSettings;
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
}

export interface Project {
  id: string;
  name: string;
  projectFilePath: string;
  thumbnailPath: string;
  thumbnailUrl: string;
}