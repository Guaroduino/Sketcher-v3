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
  smoothness: number; // Range 0-100
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

export interface MarkerSettings {
  size: number;
  opacity: number;
  color: string;
  tipShape: 'square' | 'line';
  pressureControl: {
    opacity: boolean;
  };
  smoothness: number;
}

export interface AirbrushSettings {
  size: number;
  density: number; // 0-1
  color: string;
  softness: number; // 0-1
}

export type BlendMode = 
      | 'source-over' | 'source-in' | 'source-out' | 'source-atop'
      | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop'
      | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay'
      | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light'
      | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation'
      | 'color' | 'luminosity';

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
  smoothness: number; // Range 0-100
  
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

export interface BrushPreset {
    id: string;
    name: string;
    settings: FXBrushSettings;
}


// FIX: Add 'transform' and 'debug-brush' tools.
// FIX: Added 'debug-brush' to the Tool type to match its usage in the application.
export type Tool = 'select' | 'transform' | 'brush' | 'eraser' | 'pan' | 'marker' | 'airbrush' | 'fx-brush' | 'crop' | 'free-transform' | 'enhance' | 'debug-brush';

export type RgbColor = { r: number; g: number; b: number };

export interface LibraryItem {
  id: string;
  name: string;
  type: 'image';
  dataUrl?: string; // Download URL for images
  storagePath: string; // Path in Firebase Storage
  transparentColors?: RgbColor[];
}

// -- New Guide Types --
export type ItemType = 'group' | 'object';

export type Point = { x: number; y: number; pressure?: number };

export type StrokeMode = 'freehand' | 'line' | 'polyline' | 'curve' | 'arc';

export interface StrokeState {
    mode: StrokeMode;
    points: Point[];
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

export interface AppState {
    objects: SketchObject[];
    canvasSize: { width: number, height: number };
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
    markerSettings: MarkerSettings;
    airbrushSettings: AirbrushSettings;
    fxBrushSettings: FXBrushSettings;
  };
  quickAccessSettings: QuickAccessSettings;
}

export interface ProjectFile {
    fileFormatVersion: string;
    canvasSize: { width: number; height: number };
    objects: SketchObject[];
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