export type BottomTab = 'presets' | 'text' | 'object' | 'background' | 'filter';

export type LayerType = 'text' | 'shape' | 'image' | 'sticker' | 'drawing' | 'path';

export type EditorInteractionMode =
  | 'select'
  | 'draw'
  | 'bezier'
  | 'eyedropper'
  | 'perspective'
  | 'mask';

export interface GradientStop {
  offset: number; // 0 to 1
  color: string;
}

export interface GradientConfig {
  type: 'linear' | 'radial';
  angle: number; // degrees for linear gradient
  stops: GradientStop[];
}

export interface FillConfig {
  mode: 'solid' | 'gradient' | 'texture';
  color: string;
  gradient: GradientConfig;
  textureDataUrl?: string;
  textureScale?: number;
}

export interface StrokeConfig {
  enabled: boolean;
  color: string;
  width: number;
}

export interface ShadowConfig {
  enabled: boolean;
  color: string;
  blur: number;
  opacity: number; // 0 to 1
  offsetX: number;
  offsetY: number;
}

export interface InnerShadowConfig {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface EmbossConfig {
  enabled: boolean;
  angle: number; // 0 to 360
  intensity: number; // 0 to 100
  ambient: number; // 0 to 100
  specular: number; // 0 to 100
  bevel: number; // 1 to 20
}

export interface ReflectionConfig {
  enabled: boolean;
  offsetY: number;
  opacity: number; // 0 to 1
}

export interface MaskConfig {
  enabled: boolean;
  mode: 'in' | 'out';
  points: { x: number; y: number }[]; // normalized 0..1 relative to object box
  smooth?: number; // 0 to 20 px edge feather
}

export interface EraseColorConfig {
  enabled: boolean;
  color: string;
  tolerance: number; // 0 to 100
  smooth: number; // 0 to 30
}

export interface ObjectColorFilterConfig {
  hue: number; // -180 to 180
  saturation: number; // -100 to 100
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
}

export interface PerspectivePoints {
  enabled: boolean;
  // normalized offsets relative to object bounding box corners (-0.5..0.5)
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
}

export interface Rotate3DConfig {
  enabled: boolean;
  rotateX: number; // -65 to 65 deg
  rotateY: number; // -65 to 65 deg
}

export interface Text3DConfig {
  enabled: boolean;
  mode: 'perspective' | 'oblique';
  depth: number; // 1 to 50
  angle: number; // 0 to 360 for oblique direction
  colorMode: 'auto' | 'custom';
  color: string;
  darken: number; // 0 to 100
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

export interface Shadow3DConfig {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  expand: number;
  offsetY: number;
}

export interface TextBackgroundConfig {
  enabled: boolean;
  color: string;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  radius: number;
}

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  groupId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number; // 0 to 1
  visible: boolean;
  locked: boolean;
  flipX: boolean;
  flipY: boolean;
  shadow: ShadowConfig;
  innerShadow: InnerShadowConfig;
  emboss: EmbossConfig;
  reflection: ReflectionConfig;
  mask: MaskConfig;
  perspective: PerspectivePoints;
  rotate3D: Rotate3DConfig;
  shadow3D: Shadow3DConfig;
  eraseColor?: EraseColorConfig;
  colorFilters?: ObjectColorFilterConfig;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  lineHeight: number; // multiplier e.g. 1.2
  wordSpacing: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  curve: number; // -100 to 100 (circular arc)
  fill: FillConfig;
  stroke: StrokeConfig;
  textBg: TextBackgroundConfig;
  text3D: Text3DConfig;
}

export type ShapeKind =
  | 'rect'
  | 'roundedRect'
  | 'circle'
  | 'triangle'
  | 'polygon'
  | 'heart'
  | 'star'
  | 'arrow'
  | 'diamond'
  | 'pentagon'
  | 'speech';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeKind: ShapeKind;
  cornerRadius: number;
  sides: number; // for polygon / star
  innerRadiusRatio: number; // for star
  arrowHeadSize: number;
  fill: FillConfig;
  stroke: StrokeConfig;
  shape3DDepth: number; // 0 = off, >0 = 3D extruded shape
  shape3DColor: string;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  stroke: StrokeConfig;
  tintColor?: string;
  tintEnabled?: boolean;
  cropRect?: { x: number; y: number; width: number; height: number };
}

export interface StickerLayer extends BaseLayer {
  type: 'sticker';
  stickerId: string;
  kind: 'emoji' | 'svg' | 'custom';
  content: string; // emoji char, svg markup, or dataUrl
  tintColor?: string;
  stroke: StrokeConfig;
}

export interface DrawingStroke {
  points: number[]; // [x1, y1, x2, y2, ...] local to layer
  color: string;
  size: number;
  opacity: number;
  isEraser: boolean;
  smooth?: boolean;
}

export interface DrawingLayer extends BaseLayer {
  type: 'drawing';
  strokes: DrawingStroke[];
}

export interface BezierAnchor {
  x: number;
  y: number;
  cp1x: number; // incoming handle absolute
  cp1y: number;
  cp2x: number; // outgoing handle absolute
  cp2y: number;
}

export interface PathLayer extends BaseLayer {
  type: 'path';
  anchors: BezierAnchor[];
  closed: boolean;
  fill: FillConfig;
  stroke: StrokeConfig;
}

export type LayerObject =
  | TextLayer
  | ShapeLayer
  | ImageLayer
  | StickerLayer
  | DrawingLayer
  | PathLayer;

export interface LayerGroup {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface BackgroundConfig {
  mode: 'solid' | 'transparent' | 'gradient' | 'image';
  color: string;
  gradient: GradientConfig;
  imageUrl?: string;
  imageFit: 'cover' | 'contain' | 'stretch';
}

export interface CanvasFilters {
  rotate: number; // -45 to 45 deg visual filter rotation
  vignetteEnabled: boolean;
  vignetteColor: string;
  vignetteAlpha: number; // 0 to 1
  vignetteRadius: number; // 0.1 to 1
  noiseEnabled: boolean;
  noiseAlpha: number; // 0 to 1
  stripesEnabled: boolean;
  stripesCount: number; // 2 to 60
  stripesAlpha: number; // 0 to 1
  stripesAngle: number; // -90 to 90
  stripesColor: string;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  hue: number; // -180 to 180
  saturation: number; // -100 to 100
}

export interface CanvasDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  background: BackgroundConfig;
  filters: CanvasFilters;
  layers: LayerObject[]; // index 0 = bottommost, last = topmost
  groups: LayerGroup[];
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  thumbnailDataUrl: string;
}

export interface PfxFileFormat {
  format: 'pixellab-desktop-pfx';
  version: 1;
  exportedAt: string;
  document: CanvasDocument;
  customFonts?: CustomFontAsset[];
}

export interface CustomFontAsset {
  name: string;
  dataUrl: string;
}

export interface StylePreset {
  id: string;
  name: string;
  previewBg: string;
  textStyle: Partial<TextLayer>;
}
