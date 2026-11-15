import {
  BaseLayer,
  CanvasDocument,
  CanvasFilters,
  GradientConfig,
  LayerObject,
  StylePreset,
  TextLayer,
} from '../types/editor';

export interface CanvasSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  category: string;
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: 'square', label: 'Square (1:1)', width: 1080, height: 1080, category: 'Standard' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', width: 1280, height: 720, category: 'Social' },
  { id: 'yt-banner', label: 'YouTube Channel Banner', width: 2560, height: 1440, category: 'Social' },
  { id: 'ig-portrait', label: 'Instagram Portrait (4:5)', width: 1080, height: 1350, category: 'Social' },
  { id: 'story', label: 'Story / Reels / Shorts (9:16)', width: 1080, height: 1920, category: 'Social' },
  { id: 'fb-cover', label: 'Facebook Cover', width: 851, height: 315, category: 'Social' },
  { id: 'twitter-header', label: 'X / Twitter Header', width: 1500, height: 500, category: 'Social' },
  { id: 'hd-1080', label: 'Full HD (16:9)', width: 1920, height: 1080, category: 'Standard' },
  { id: 'poster-a4', label: 'Poster Portrait', width: 1240, height: 1754, category: 'Print' },
];

export const COLOR_SWATCHES: string[] = [
  '#ffffff', '#f8fafc', '#cbd5e1', '#64748b', '#1e293b', '#0f172a', '#000000',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#2d8cff', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78350f', '#fbbf24', '#38bdf8',
];

export const GRADIENT_PRESETS: GradientConfig[] = [
  { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#0f172a' }, { offset: 1, color: '#1e3a8a' }] },
  { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#f97316' }, { offset: 1, color: '#e11d48' }] },
  { type: 'linear', angle: 120, stops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#3b82f6' }] },
  { type: 'linear', angle: 145, stops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#047857' }] },
  { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#fde047' }, { offset: 1, color: '#f97316' }] },
  { type: 'linear', angle: 180, stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#cbd5e1' }] },
  { type: 'radial', angle: 0, stops: [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#0f172a' }] },
  { type: 'radial', angle: 0, stops: [{ offset: 0, color: '#fbbf24' }, { offset: 1, color: '#991b1b' }] },
];

export const BUILTIN_FONTS: { family: string; category: string }[] = [
  { family: 'Plus Jakarta Sans', category: 'Sans' },
  { family: 'DM Sans', category: 'Sans' },
  { family: 'Montserrat', category: 'Sans' },
  { family: 'Poppins', category: 'Sans' },
  { family: 'Oswald', category: 'Display' },
  { family: 'Bebas Neue', category: 'Display' },
  { family: 'Anton', category: 'Display' },
  { family: 'Bangers', category: 'Comic' },
  { family: 'Permanent Marker', category: 'Handwritten' },
  { family: 'Pacifico', category: 'Script' },
  { family: 'Lobster', category: 'Script' },
  { family: 'Playfair Display', category: 'Serif' },
  { family: 'Cinzel', category: 'Serif' },
  { family: 'JetBrains Mono', category: 'Mono' },
  { family: 'Arial', category: 'System' },
  { family: 'Georgia', category: 'System' },
  { family: 'Impact', category: 'System' },
  { family: 'Times New Roman', category: 'System' },
];

export const QUOTES_LIBRARY: { category: string; text: string; author?: string }[] = [
  { category: 'Motivation', text: 'Create something worth remembering.', author: 'Studio Note' },
  { category: 'Motivation', text: 'Stay focused. Ship great work.' },
  { category: 'Motivation', text: 'Small details make big designs.' },
  { category: 'Motivation', text: 'Discipline outlasts inspiration.' },
  { category: 'Business', text: 'NEW ARRIVAL\nLIMITED EDITION' },
  { category: 'Business', text: 'FLASH SALE\nUP TO 50% OFF' },
  { category: 'Business', text: 'QUALITY FIRST.\nBUILT TO LAST.' },
  { category: 'YouTube', text: 'TOP 5 SECRETS\nYOU NEED TO KNOW' },
  { category: 'YouTube', text: 'BEFORE & AFTER\nFULL BREAKDOWN' },
  { category: 'Design', text: 'Less noise, sharper message.' },
  { category: 'Design', text: 'Typography carries the voice.' },
  { category: 'French', text: 'La simplicité est la sophistication suprême.' },
  { category: 'French', text: 'Chaque grand projet commence par une idée.' },
];

export const EMOJI_LIBRARY: string[] = [
  '🔥', '⚡', '✨', '🎯', '🚀', '💎', '👑', '🏆',
  '🎨', '🎬', '📸', '🎵', '💡', '✅', '❤️', '⭐',
  '💥', '🎉', '📌', '🛡️', '⚠️', '➡️', '⬆️', '💯',
  '😎', '🤩', '🙌', '👍', '💪', '🌟', '🎁', '🛒',
];

export interface VectorStickerDef {
  id: string;
  label: string;
  svg: string;
}

export const VECTOR_STICKERS: VectorStickerDef[] = [
  {
    id: 'badge-burst',
    label: 'Starburst Badge',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><polygon points="60,4 73,28 99,16 93,43 118,52 99,70 112,95 85,93 78,118 60,99 42,118 35,93 8,95 21,70 2,52 27,43 21,16 47,28" fill="#f59e0b" stroke="#ffffff" stroke-width="4"/></svg>`,
  },
  {
    id: 'ribbon-banner',
    label: 'Ribbon Banner',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 70"><path d="M10 20 L35 20 L35 55 L10 55 L22 37 Z" fill="#b91c1c"/><path d="M190 20 L165 20 L165 55 L190 55 L178 37 Z" fill="#b91c1c"/><rect x="28" y="10" width="144" height="40" rx="4" fill="#ef4444" stroke="#ffffff" stroke-width="3"/></svg>`,
  },
  {
    id: 'crown-gold',
    label: 'Crown',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><path d="M12 72 L6 24 L38 46 L60 12 L82 46 L114 24 L108 72 Z" fill="#fbbf24" stroke="#78350f" stroke-width="4" stroke-linejoin="round"/><rect x="12" y="72" width="96" height="12" rx="4" fill="#d97706" stroke="#78350f" stroke-width="3"/></svg>`,
  },
  {
    id: 'verified-check',
    label: 'Verified Seal',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="#2d8cff" stroke="#ffffff" stroke-width="5"/><path d="M36 62 L52 78 L86 42" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'play-badge',
    label: 'Play Button',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 100"><rect x="6" y="6" width="128" height="88" rx="22" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><polygon points="56,30 98,50 56,70" fill="#ffffff"/></svg>`,
  },
  {
    id: 'lightning',
    label: 'Lightning Bolt',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><polygon points="58,6 18,64 48,64 38,114 84,52 52,52" fill="#facc15" stroke="#1e293b" stroke-width="4" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'frame-corner',
    label: 'Tech Corner Frame',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M10 42 L10 10 L42 10 M78 10 L110 10 L110 42 M110 78 L110 110 L78 110 M42 110 L10 110 L10 78" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="square"/></svg>`,
  },
  {
    id: 'sun-rays',
    label: 'Radial Ring',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="none" stroke="#ffffff" stroke-width="5" stroke-dasharray="10 8"/><circle cx="60" cy="60" r="30" fill="none" stroke="#38bdf8" stroke-width="4"/></svg>`,
  },
];

export const TEXT_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'clean-white',
    name: 'Clean Bold',
    previewBg: '#1e293b',
    textStyle: {
      fontFamily: 'Montserrat',
      bold: true,
      fill: { mode: 'solid', color: '#ffffff', gradient: GRADIENT_PRESETS[0] },
      stroke: { enabled: false, color: '#000000', width: 2 },
      shadow: { enabled: true, color: '#000000', blur: 10, opacity: 0.55, offsetX: 0, offsetY: 4 },
    },
  },
  {
    id: 'yt-impact',
    name: 'Thumbnail Pop',
    previewBg: '#0f172a',
    textStyle: {
      fontFamily: 'Anton',
      bold: false,
      fill: { mode: 'gradient', color: '#fde047', gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#fef08a' }, { offset: 1, color: '#f97316' }] } },
      stroke: { enabled: true, color: '#000000', width: 7 },
      shadow: { enabled: true, color: '#000000', blur: 4, opacity: 0.9, offsetX: 4, offsetY: 6 },
    },
  },
  {
    id: '3d-gold',
    name: '3D Gold Block',
    previewBg: '#1c1917',
    textStyle: {
      fontFamily: 'Bebas Neue',
      bold: false,
      fill: { mode: 'gradient', color: '#fbbf24', gradient: { type: 'linear', angle: 180, stops: [{ offset: 0, color: '#fef3c7' }, { offset: 1, color: '#d97706' }] } },
      stroke: { enabled: true, color: '#78350f', width: 2 },
      text3D: { enabled: true, mode: 'oblique', depth: 14, angle: 135, colorMode: 'custom', color: '#78350f', darken: 45, rotateX: 0, rotateY: 0, rotateZ: 0 },
      shadow: { enabled: true, color: '#000000', blur: 14, opacity: 0.7, offsetX: 6, offsetY: 10 },
    },
  },
  {
    id: 'cyber-blue',
    name: 'Electric Sky',
    previewBg: '#090d16',
    textStyle: {
      fontFamily: 'Oswald',
      bold: true,
      fill: { mode: 'gradient', color: '#38bdf8', gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#e0f2fe' }, { offset: 1, color: '#0284c7' }] } },
      stroke: { enabled: true, color: '#0c4a6e', width: 3 },
      shadow: { enabled: true, color: '#0ea5e9', blur: 18, opacity: 0.75, offsetX: 0, offsetY: 0 },
    },
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Gold',
    previewBg: '#18181b',
    textStyle: {
      fontFamily: 'Playfair Display',
      bold: true,
      italic: true,
      fill: { mode: 'solid', color: '#f8fafc', gradient: GRADIENT_PRESETS[5] },
      stroke: { enabled: false, color: '#000000', width: 0 },
      shadow: { enabled: true, color: '#000000', blur: 8, opacity: 0.4, offsetX: 0, offsetY: 3 },
    },
  },
  {
    id: 'highlight-tag',
    name: 'Tag Pill Box',
    previewBg: '#334155',
    textStyle: {
      fontFamily: 'Plus Jakarta Sans',
      bold: true,
      fill: { mode: 'solid', color: '#0f172a', gradient: GRADIENT_PRESETS[0] },
      stroke: { enabled: false, color: '#000000', width: 0 },
      textBg: { enabled: true, color: '#facc15', paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, radius: 12 },
      shadow: { enabled: false, color: '#000000', blur: 0, opacity: 0.5, offsetX: 0, offsetY: 0 },
    },
  },
];

export const DEFAULT_FILTERS: CanvasFilters = {
  rotate: 0,
  vignetteEnabled: false,
  vignetteColor: '#000000',
  vignetteAlpha: 0.65,
  vignetteRadius: 0.65,
  noiseEnabled: false,
  noiseAlpha: 0.18,
  stripesEnabled: false,
  stripesCount: 16,
  stripesAlpha: 0.2,
  stripesAngle: 45,
  stripesColor: '#000000',
  brightness: 0,
  contrast: 0,
  hue: 0,
  saturation: 0,
};

export function createBaseLayerDefaults(partial?: Partial<BaseLayer>): Omit<BaseLayer, 'id' | 'name' | 'type'> {
  return {
    groupId: null,
    x: 540,
    y: 540,
    width: 320,
    height: 120,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    shadow: { enabled: false, color: '#000000', blur: 10, opacity: 0.65, offsetX: 4, offsetY: 6 },
    innerShadow: { enabled: false, color: '#000000', blur: 6, offsetX: 2, offsetY: 3 },
    emboss: { enabled: false, angle: 45, intensity: 65, ambient: 45, specular: 45, bevel: 5 },
    reflection: { enabled: false, offsetY: 8, opacity: 0.45 },
    mask: {
      enabled: false,
      mode: 'out',
      smooth: 0,
      points: [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
        { x: 0.9, y: 0.95 },
        { x: 0.1, y: 0.95 },
      ],
    },
    perspective: {
      enabled: false,
      tl: { x: 0, y: 0 },
      tr: { x: 0, y: 0 },
      br: { x: 0, y: 0 },
      bl: { x: 0, y: 0 },
    },
    rotate3D: { enabled: false, rotateX: 0, rotateY: 0 },
    shadow3D: { enabled: false, color: '#000000', opacity: 0.55, blur: 16, expand: 12, offsetY: 34 },
    eraseColor: { enabled: false, color: '#ffffff', tolerance: 24, smooth: 8 },
    colorFilters: { hue: 0, saturation: 0, brightness: 0, contrast: 0 },
    ...partial,
  };
}

export function createDefaultTextLayer(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
  text = 'New Text'
): TextLayer {
  return {
    ...createBaseLayerDefaults({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      width: 460,
      height: 130,
    }),
    id,
    name: text.split('\n')[0].slice(0, 24) || 'Text',
    type: 'text',
    text,
    fontFamily: 'Montserrat',
    fontSize: 84,
    bold: true,
    italic: false,
    underline: false,
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.15,
    wordSpacing: 0,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    curve: 0,
    fill: {
      mode: 'solid',
      color: '#ffffff',
      gradient: { ...GRADIENT_PRESETS[2] },
    },
    stroke: { enabled: false, color: '#000000', width: 4 },
    textBg: {
      enabled: false,
      color: '#0f172a',
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 10,
      paddingBottom: 10,
      radius: 8,
    },
    text3D: {
      enabled: false,
      mode: 'oblique',
      depth: 12,
      angle: 135,
      colorMode: 'auto',
      color: '#1e293b',
      darken: 40,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
    },
  };
}

export interface DocumentTemplate {
  id: string;
  name: string;
  doc: () => CanvasDocument;
}

export function createBlankDocument(width = 1080, height = 1080, name = 'Untitled Project'): CanvasDocument {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const initialText = createDefaultTextLayer(`layer_${Date.now()}`, width, height, 'New Text');
  const layers: LayerObject[] = [initialText];
  return {
    id,
    name,
    width,
    height,
    background: {
      mode: 'gradient',
      color: '#3b4252',
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: '#2b3240' },
          { offset: 1, color: '#1b202a' },
        ],
      },
      imageFit: 'cover',
    },
    filters: { ...DEFAULT_FILTERS },
    layers,
    groups: [],
    updatedAt: Date.now(),
  };
}

export const PROJECT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'default-dark',
    name: 'Studio Slate',
    doc: () => createBlankDocument(1080, 1080, 'Studio Slate'),
  },
  {
    id: 'yt-bold',
    name: 'YouTube Bold',
    doc: () => {
      const d = createBlankDocument(1280, 720, 'YouTube Thumbnail');
      d.background = {
        mode: 'gradient',
        color: '#0f172a',
        gradient: {
          type: 'linear',
          angle: 125,
          stops: [
            { offset: 0, color: '#0f172a' },
            { offset: 1, color: '#1d4ed8' },
          ],
        },
        imageFit: 'cover',
      };
      const t = createDefaultTextLayer('layer_yt_1', 1280, 720, 'BOLD HEADLINE');
      t.fontFamily = 'Anton';
      t.fontSize = 116;
      t.width = 960;
      t.height = 170;
      t.fill = {
        mode: 'gradient',
        color: '#fde047',
        gradient: {
          type: 'linear',
          angle: 90,
          stops: [
            { offset: 0, color: '#fef08a' },
            { offset: 1, color: '#f97316' },
          ],
        },
      };
      t.stroke = { enabled: true, color: '#000000', width: 8 };
      t.shadow = { enabled: true, color: '#000000', blur: 12, opacity: 0.85, offsetX: 4, offsetY: 8 };
      d.layers = [t];
      return d;
    },
  },
  {
    id: 'quote-minimal',
    name: 'Minimal Quote',
    doc: () => {
      const d = createBlankDocument(1080, 1080, 'Minimal Quote');
      d.background = {
        mode: 'solid',
        color: '#f8fafc',
        gradient: { ...GRADIENT_PRESETS[5] },
        imageFit: 'cover',
      };
      const t = createDefaultTextLayer('layer_q_1', 1080, 1080, 'Typography\ncarries the voice.');
      t.fontFamily = 'Playfair Display';
      t.fontSize = 78;
      t.italic = true;
      t.width = 760;
      t.height = 240;
      t.fill.color = '#0f172a';
      d.layers = [t];
      return d;
    },
  },
  {
    id: 'transparent-logo',
    name: 'Transparent Logo',
    doc: () => {
      const d = createBlankDocument(1080, 1080, 'Logo Canvas');
      d.background = {
        mode: 'transparent',
        color: '#000000',
        gradient: { ...GRADIENT_PRESETS[0] },
        imageFit: 'cover',
      };
      const t = createDefaultTextLayer('layer_logo_1', 1080, 1080, 'BRAND');
      t.fontFamily = 'Bebas Neue';
      t.fontSize = 148;
      t.letterSpacing = 10;
      t.text3D = {
        enabled: true,
        mode: 'oblique',
        depth: 12,
        angle: 135,
        colorMode: 'custom',
        color: '#1e3a8a',
        darken: 45,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
      };
      t.fill = {
        mode: 'gradient',
        color: '#38bdf8',
        gradient: {
          type: 'linear',
          angle: 180,
          stops: [
            { offset: 0, color: '#e0f2fe' },
            { offset: 1, color: '#2d8cff' },
          ],
        },
      };
      d.layers = [t];
      return d;
    },
  },
];
