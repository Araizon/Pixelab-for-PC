import { create } from 'zustand';
import {
  createBaseLayerDefaults,
  createBlankDocument,
  createDefaultTextLayer,
  DEFAULT_FILTERS,
  GRADIENT_PRESETS,
} from '../data/presets';
import {
  BackgroundConfig,
  BezierAnchor,
  BottomTab,
  CanvasDocument,
  CanvasFilters,
  CustomFontAsset,
  DrawingLayer,
  DrawingStroke,
  EditorInteractionMode,
  EraserStroke,
  ImageLayer,
  LayerObject,
  PathLayer,
  ProjectSummary,
  ShapeKind,
  ShapeLayer,
  StickerLayer,
  StylePreset,
  TextLayer,
} from '../types/editor';
import { getLayerCoreBox, renderFullLayerToCanvas } from '../utils/canvasEffects';
import {
  deleteProjectLocal,
  listProjectsLocal,
  loadProjectLocal,
  loadSavedCustomFonts,
  registerCustomFont,
  saveProjectLocal,
} from '../utils/projectStorage';

export type ModalType =
  | null
  | 'textEdit'
  | 'font'
  | 'quotes'
  | 'projects'
  | 'export'
  | 'cropCanvas'
  | 'cropImport'
  | 'cropLayer';

export interface PendingImportImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
}

interface DrawSessionState {
  brushSize: number;
  brushColor: string;
  brushOpacity: number;
  isEraser: boolean;
  strokes: DrawingStroke[];
  undoneStrokes: DrawingStroke[];
}

export interface EraserSessionState {
  brushSize: number;
  softness: number;
  opacity: number;
  mode: 'erase' | 'restore';
}

interface BezierSessionState {
  editingLayerId: string | null;
  anchors: BezierAnchor[];
  closed: boolean;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillEnabled: boolean;
}

interface EditorState {
  document: CanvasDocument;
  historyPast: CanvasDocument[];
  historyFuture: CanvasDocument[];
  selectedIds: string[];
  clipboard: LayerObject[];
  activeTab: BottomTab;
  activeTool: string | null;
  interactionMode: EditorInteractionMode;
  eyedropperCallback: ((hex: string) => void) | null;
  layersDrawerOpen: boolean;
  zoom: number;
  pan: { x: number; y: number };
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSize: number;
  isFullscreen: boolean;
  activeModal: ModalType;
  pendingImportImages: PendingImportImage[];
  drawSession: DrawSessionState;
  eraserSession: EraserSessionState;
  eraserUndoneMap: Record<string, EraserStroke[]>;
  bezierSession: BezierSessionState;
  savedStyles: StylePreset[];
  customFonts: CustomFontAsset[];
  projects: ProjectSummary[];
  toastMessage: string | null;
  stageThumbnailGetter: (() => string) | null;
  stageExportGetter: ((pixelRatio: number, mimeType: string, quality: number, transparentBg?: boolean) => string) | null;

  // Setup & Feedback
  initWorkspace: () => Promise<void>;
  setStageGetters: (
    thumbGetter: (() => string) | null,
    exportGetter: ((pixelRatio: number, mimeType: string, quality: number, transparentBg?: boolean) => string) | null
  ) => void;
  showToast: (msg: string) => void;

  // Navigation & Viewport
  setActiveTab: (tab: BottomTab) => void;
  setActiveTool: (tool: string | null) => void;
  exitErasePage: () => void;
  setInteractionMode: (mode: EditorInteractionMode, eyedropperCb?: (hex: string) => void) => void;
  setLayersDrawerOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;
  setIsFullscreen: (fs: boolean) => void;
  openModal: (modal: ModalType) => void;
  setPendingImportImages: (imgs: PendingImportImage[]) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Selection
  selectLayer: (id: string | null, additive?: boolean) => void;
  selectMultiple: (ids: string[]) => void;

  // Document & Background & Filters
  setDocument: (doc: CanvasDocument, recordHistory?: boolean) => void;
  renameCurrentProject: (name: string) => void;
  updateBackground: (patch: Partial<BackgroundConfig>, recordHistory?: boolean) => void;
  updateFilters: (patch: Partial<CanvasFilters>, recordHistory?: boolean) => void;
  resetFilters: () => void;
  resizeCanvas: (width: number, height: number, scaleObjects?: boolean) => void;
  cropCanvas: (x: number, y: number, width: number, height: number) => void;

  // Layer creation
  addTextLayer: (text?: string) => string;
  addShapeLayer: (kind: ShapeKind) => string;
  addStickerLayer: (kind: 'emoji' | 'svg' | 'custom', content: string, label?: string) => string;
  addImageLayer: (
    src: string,
    w: number,
    h: number,
    name?: string,
    position?: { x: number; y: number }
  ) => string;

  // Layer updates & actions
  updateLayer: (id: string, patch: Partial<LayerObject>, recordHistory?: boolean) => void;
  updateSelectedLayer: (patch: Partial<LayerObject>, recordHistory?: boolean) => void;
  deleteLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reorderLayer: (fromIndex: number, toIndex: number) => void;
  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  mergeLayers: (ids: string[]) => void;
  cropImageLayer: (layerId: string, x: number, y: number, width: number, height: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  relativePositionSelected: (
    alignX: 'left' | 'center' | 'right' | null,
    alignY: 'top' | 'middle' | 'bottom' | null
  ) => void;
  saveSelectedAsStyle: (name: string) => void;
  applyStyleToSelected: (preset: StylePreset) => void;

  // Draw Mode
  startDrawMode: () => void;
  updateDrawSession: (patch: Partial<DrawSessionState>) => void;
  addDrawStroke: (stroke: DrawingStroke) => void;
  undoDrawStroke: () => void;
  redoDrawStroke: () => void;
  commitDrawSession: () => void;
  cancelDrawSession: () => void;

  // Pixel Eraser Mode
  updateEraserSession: (patch: Partial<EraserSessionState>) => void;
  undoEraserStroke: (layerId: string) => void;
  redoEraserStroke: (layerId: string) => void;
  clearEraserStrokes: (layerId: string) => void;
  clearEraserUndoneForLayer: (layerId: string) => void;

  // Bezier Mode
  startBezierMode: (existingLayerId?: string | null) => void;
  updateBezierSession: (patch: Partial<BezierSessionState>) => void;
  commitBezierSession: () => void;
  cancelBezierSession: () => void;

  // Fonts & Projects
  importCustomFont: (name: string, dataUrl: string) => Promise<void>;
  refreshProjectsList: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  loadProjectById: (id: string) => Promise<void>;
  deleteProjectById: (id: string) => Promise<void>;
  duplicateProjectById: (id: string) => Promise<void>;
  createNewProject: (width?: number, height?: number, name?: string) => void;
}

const MAX_HISTORY = 40;

function cloneDoc(doc: CanvasDocument): CanvasDocument {
  if (typeof structuredClone === 'function') {
    return structuredClone(doc);
  }
  return JSON.parse(JSON.stringify(doc)) as CanvasDocument;
}

export function isIsolatedEraseActive(
  activeTool: string | null,
  selectedIds: string[],
  layers: LayerObject[]
): boolean {
  if (activeTool !== 'pixelEraser' && activeTool !== 'eraseColor') return false;
  if (selectedIds.length !== 1) return false;
  const layer = layers.find((l) => l.id === selectedIds[0]);
  if (!layer) return false;
  if (activeTool === 'eraseColor') {
    return layer.type === 'image' || layer.type === 'sticker';
  }
  return layer.type === 'image' || layer.type === 'sticker' || layer.type === 'drawing';
}

function uid(prefix = 'layer'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createBlankDocument(1080, 1080, 'Untitled Project'),
  historyPast: [],
  historyFuture: [],
  selectedIds: [],
  clipboard: [],
  activeTab: 'text',
  activeTool: null,
  interactionMode: 'select',
  eyedropperCallback: null,
  layersDrawerOpen: false,
  zoom: 0.65,
  pan: { x: 0, y: 0 },
  gridEnabled: false,
  snapEnabled: true,
  gridSize: 60,
  isFullscreen: false,
  activeModal: null,
  pendingImportImages: [],
  drawSession: {
    brushSize: 14,
    brushColor: '#2d8cff',
    brushOpacity: 1,
    isEraser: false,
    strokes: [],
    undoneStrokes: [],
  },
  eraserSession: {
    brushSize: 32,
    softness: 0,
    opacity: 1,
    mode: 'erase',
  },
  eraserUndoneMap: {},
  bezierSession: {
    editingLayerId: null,
    anchors: [],
    closed: false,
    strokeColor: '#ffffff',
    strokeWidth: 6,
    fillColor: '#2d8cff',
    fillEnabled: true,
  },
  savedStyles: [],
  customFonts: [],
  projects: [],
  toastMessage: null,
  stageThumbnailGetter: null,
  stageExportGetter: null,

  initWorkspace: async () => {
    const fonts = await loadSavedCustomFonts();
    const projects = await listProjectsLocal();
    const firstLayer = get().document.layers[0];
    let savedStyles: StylePreset[] = [];
    try {
      const raw = localStorage.getItem('pixellab_saved_styles');
      if (raw) savedStyles = JSON.parse(raw);
    } catch {
      // ignore
    }
    set({
      customFonts: fonts,
      projects,
      savedStyles,
      selectedIds: firstLayer ? [firstLayer.id] : [],
    });
  },

  setStageGetters: (thumbGetter, exportGetter) =>
    set({ stageThumbnailGetter: thumbGetter, stageExportGetter: exportGetter }),

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      if (get().toastMessage === msg) set({ toastMessage: null });
    }, 2600);
  },

  setActiveTab: (tab) =>
    set((s) => ({
      activeTab: tab,
      activeTool: null,
      interactionMode:
        s.interactionMode === 'perspective' ||
        s.interactionMode === 'mask' ||
        s.interactionMode === 'erase'
          ? 'select'
          : s.interactionMode,
    })),
  setActiveTool: (tool) =>
    set((s) => {
      const nextTool = s.activeTool === tool ? null : tool;
      return {
        activeTool: nextTool,
        interactionMode:
          nextTool === 'perspective'
            ? 'perspective'
            : nextTool === 'mask'
            ? 'mask'
            : nextTool === 'pixelEraser'
            ? 'erase'
            : s.interactionMode === 'perspective' ||
              s.interactionMode === 'mask' ||
              s.interactionMode === 'erase'
            ? 'select'
            : s.interactionMode,
      };
    }),

  exitErasePage: () =>
    set((s) => ({
      activeTool:
        s.activeTool === 'pixelEraser' || s.activeTool === 'eraseColor' ? null : s.activeTool,
      interactionMode: 'select',
      eyedropperCallback: null,
    })),

  setInteractionMode: (mode, eyedropperCb) =>
    set({
      interactionMode: mode,
      eyedropperCallback: eyedropperCb ?? null,
    }),

  setLayersDrawerOpen: (open) => set({ layersDrawerOpen: open }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.15, Number(zoom.toFixed(2)))) }),
  setPan: (pan) => set({ pan }),
  toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setGridSize: (gridSize) => set({ gridSize: Math.max(10, Math.min(250, gridSize)) }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  openModal: (activeModal) => set({ activeModal }),
  setPendingImportImages: (pendingImportImages) => set({ pendingImportImages }),

  pushHistory: () =>
    set((s) => ({
      historyPast: [...s.historyPast.slice(-(MAX_HISTORY - 1)), cloneDoc(s.document)],
      historyFuture: [],
    })),

  undo: () =>
    set((s) => {
      if (s.historyPast.length === 0) return s;
      const previous = s.historyPast[s.historyPast.length - 1];
      const nextPast = s.historyPast.slice(0, -1);
      return {
        document: previous,
        historyPast: nextPast,
        historyFuture: [cloneDoc(s.document), ...s.historyFuture.slice(0, MAX_HISTORY - 1)],
        selectedIds: s.selectedIds.filter((id) => previous.layers.some((l) => l.id === id)),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.historyFuture.length === 0) return s;
      const next = s.historyFuture[0];
      const restFuture = s.historyFuture.slice(1);
      return {
        document: next,
        historyPast: [...s.historyPast.slice(-(MAX_HISTORY - 1)), cloneDoc(s.document)],
        historyFuture: restFuture,
        selectedIds: s.selectedIds.filter((id) => next.layers.some((l) => l.id === id)),
      };
    }),

  selectLayer: (id, additive = false) =>
    set((s) => {
      if (!id) {
        return {
          selectedIds: [],
          activeTool: s.interactionMode === 'perspective' || s.interactionMode === 'mask' ? null : s.activeTool,
          interactionMode: s.interactionMode === 'perspective' || s.interactionMode === 'mask' ? 'select' : s.interactionMode,
        };
      }
      const target = s.document.layers.find((l) => l.id === id);
      if (!target) return s;

      let nextIds: string[];
      if (additive) {
        nextIds = s.selectedIds.includes(id)
          ? s.selectedIds.filter((i) => i !== id)
          : [...s.selectedIds, id];
      } else if (target.groupId) {
        nextIds = s.document.layers
          .filter((l) => l.groupId === target.groupId)
          .map((l) => l.id);
      } else {
        nextIds = [id];
      }

      const nextTab: BottomTab = target.type === 'text' ? 'text' : 'object';
      return {
        selectedIds: nextIds,
        activeTab: s.activeTab === 'background' || s.activeTab === 'filter' || s.activeTab === 'presets' ? nextTab : nextTab,
      };
    }),

  selectMultiple: (ids) => set({ selectedIds: ids }),

  setDocument: (doc, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set({
      document: cloneDoc(doc),
      selectedIds: doc.layers.length ? [doc.layers[doc.layers.length - 1].id] : [],
      activeTool: null,
      interactionMode: 'select',
    });
  },

  renameCurrentProject: (name) =>
    set((s) => ({
      document: { ...s.document, name: name.trim() || 'Untitled Project', updatedAt: Date.now() },
    })),

  updateBackground: (patch, recordHistory = false) => {
    if (recordHistory) get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        background: { ...s.document.background, ...patch },
        updatedAt: Date.now(),
      },
    }));
  },

  updateFilters: (patch, recordHistory = false) => {
    if (recordHistory) get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        filters: { ...s.document.filters, ...patch },
        updatedAt: Date.now(),
      },
    }));
  },

  resetFilters: () => {
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        filters: { ...DEFAULT_FILTERS },
        updatedAt: Date.now(),
      },
    }));
  },

  resizeCanvas: (width, height, scaleObjects = false) => {
    const safeW = Math.max(64, Math.min(4096, Math.round(width)));
    const safeH = Math.max(64, Math.min(4096, Math.round(height)));
    get().pushHistory();
    set((s) => {
      const oldW = s.document.width;
      const oldH = s.document.height;
      const rx = safeW / oldW;
      const ry = safeH / oldH;
      const layers = s.document.layers.map((l) => {
        if (scaleObjects) {
          const factor = Math.min(rx, ry);
          return {
            ...l,
            x: l.x * rx,
            y: l.y * ry,
            scaleX: l.scaleX * factor,
            scaleY: l.scaleY * factor,
          };
        }
        // Preserve exact object scale and offset relative to canvas center
        return {
          ...l,
          x: l.x + (safeW - oldW) / 2,
          y: l.y + (safeH - oldH) / 2,
        };
      });
      return {
        document: {
          ...s.document,
          width: safeW,
          height: safeH,
          layers,
          updatedAt: Date.now(),
        },
      };
    });
  },

  cropCanvas: (x, y, width, height) => {
    const safeW = Math.max(64, Math.round(width));
    const safeH = Math.max(64, Math.round(height));
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        width: safeW,
        height: safeH,
        layers: s.document.layers.map((l) => ({
          ...l,
          x: l.x - x,
          y: l.y - y,
        })),
        updatedAt: Date.now(),
      },
    }));
  },

  addTextLayer: (text = 'New Text') => {
    get().pushHistory();
    const { width, height } = get().document;
    const id = uid('txt');
    const layer = createDefaultTextLayer(id, width, height, text);
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      activeTab: 'text',
      activeTool: null,
    }));
    return id;
  },

  addShapeLayer: (kind) => {
    get().pushHistory();
    const { width, height } = get().document;
    const id = uid('shp');
    const layer: ShapeLayer = {
      ...createBaseLayerDefaults({
        x: width / 2,
        y: height / 2,
        width: 260,
        height: kind === 'arrow' ? 140 : 260,
      }),
      id,
      name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} Shape`,
      type: 'shape',
      shapeKind: kind,
      cornerRadius: kind === 'roundedRect' ? 32 : 0,
      sides: kind === 'star' ? 5 : 6,
      innerRadiusRatio: 0.45,
      arrowHeadSize: 75,
      fill: {
        mode: 'solid',
        color: '#2d8cff',
        gradient: { ...GRADIENT_PRESETS[2] },
      },
      stroke: { enabled: false, color: '#ffffff', width: 4 },
      shape3DDepth: 0,
      shape3DColor: '#1e3a8a',
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      activeTab: 'object',
      activeTool: 'shapeStyle',
    }));
    return id;
  },

  addStickerLayer: (kind, content, label = 'Sticker') => {
    get().pushHistory();
    const { width, height } = get().document;
    const id = uid('stk');
    const layer: StickerLayer = {
      ...createBaseLayerDefaults({
        x: width / 2,
        y: height / 2,
        width: 220,
        height: 220,
      }),
      id,
      name: label,
      type: 'sticker',
      stickerId: id,
      kind,
      content,
      stroke: { enabled: false, color: '#ffffff', width: 4 },
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      activeTab: 'object',
      activeTool: null,
    }));
    return id;
  },

  addImageLayer: (src, w, h, name = 'Imported Image', position) => {
    get().pushHistory();
    const { width: cw, height: ch } = get().document;
    const maxDim = Math.min(cw, ch) * 0.65;
    const ratio = Math.min(1, maxDim / Math.max(w, h));
    const id = uid('img');
    const layer: ImageLayer = {
      ...createBaseLayerDefaults({
        x: position ? Math.round(position.x) : cw / 2,
        y: position ? Math.round(position.y) : ch / 2,
        width: Math.max(60, Math.round(w * ratio)),
        height: Math.max(60, Math.round(h * ratio)),
      }),
      id,
      name,
      type: 'image',
      src,
      naturalWidth: w,
      naturalHeight: h,
      stroke: { enabled: false, color: '#ffffff', width: 4 },
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      activeTab: 'object',
      activeTool: null,
    }));
    return id;
  },

  updateLayer: (id, patch, recordHistory = false) => {
    if (recordHistory) get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as LayerObject) : l)),
        updatedAt: Date.now(),
      },
    }));
  },

  updateSelectedLayer: (patch, recordHistory = false) => {
    const ids = get().selectedIds;
    if (!ids.length) return;
    if (recordHistory) get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          ids.includes(l.id) ? ({ ...l, ...patch } as LayerObject) : l
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  deleteLayers: (ids) => {
    if (!ids.length) return;
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.filter((l) => !ids.includes(l.id)),
        updatedAt: Date.now(),
      },
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
      activeTool: null,
    }));
  },

  duplicateLayers: (ids) => {
    if (!ids.length) return;
    get().pushHistory();
    const clones: LayerObject[] = [];
    for (const l of get().document.layers) {
      if (ids.includes(l.id)) {
        const copy = JSON.parse(JSON.stringify(l)) as LayerObject;
        copy.id = uid(l.type.slice(0, 3));
        copy.name = `${l.name} Copy`;
        copy.x += 28;
        copy.y += 28;
        copy.groupId = null;
        clones.push(copy);
      }
    }
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, ...clones],
        updatedAt: Date.now(),
      },
      selectedIds: clones.map((c) => c.id),
    }));
  },

  copySelected: () => {
    const { selectedIds, document } = get();
    const items = document.layers
      .filter((l) => selectedIds.includes(l.id))
      .map((l) => JSON.parse(JSON.stringify(l)) as LayerObject);
    if (items.length) {
      set({ clipboard: items });
      get().showToast(`Copied ${items.length} layer${items.length > 1 ? 's' : ''}`);
    }
  },

  pasteClipboard: () => {
    const { clipboard } = get();
    if (!clipboard.length) return;
    get().pushHistory();
    const pasted = clipboard.map((item) => {
      const clone = JSON.parse(JSON.stringify(item)) as LayerObject;
      clone.id = uid(clone.type.slice(0, 3));
      clone.x += 32;
      clone.y += 32;
      clone.groupId = null;
      return clone;
    });
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, ...pasted],
        updatedAt: Date.now(),
      },
      selectedIds: pasted.map((p) => p.id),
    }));
  },

  bringToFront: (id) => {
    get().pushHistory();
    set((s) => {
      const idx = s.document.layers.findIndex((l) => l.id === id);
      if (idx === -1 || idx === s.document.layers.length - 1) return s;
      const copy = [...s.document.layers];
      const [item] = copy.splice(idx, 1);
      copy.push(item);
      return { document: { ...s.document, layers: copy, updatedAt: Date.now() } };
    });
  },

  sendToBack: (id) => {
    get().pushHistory();
    set((s) => {
      const idx = s.document.layers.findIndex((l) => l.id === id);
      if (idx <= 0) return s;
      const copy = [...s.document.layers];
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      return { document: { ...s.document, layers: copy, updatedAt: Date.now() } };
    });
  },

  reorderLayer: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    get().pushHistory();
    set((s) => {
      const copy = [...s.document.layers];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return { document: { ...s.document, layers: copy, updatedAt: Date.now() } };
    });
  },

  toggleVisibility: (id) => {
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      },
    }));
  },

  toggleLock: (id) => {
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
      },
    }));
  },

  renameLayer: (id, name) => {
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
      },
    }));
  },

  groupSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    get().pushHistory();
    const gid = uid('grp');
    set((s) => ({
      document: {
        ...s.document,
        groups: [...s.document.groups, { id: gid, name: `Group ${s.document.groups.length + 1}`, collapsed: false }],
        layers: s.document.layers.map((l) => (selectedIds.includes(l.id) ? { ...l, groupId: gid } : l)),
      },
    }));
    get().showToast('Layers grouped');
  },

  ungroupSelected: () => {
    const { selectedIds, document } = get();
    const groupIds = new Set(
      document.layers.filter((l) => selectedIds.includes(l.id) && l.groupId).map((l) => l.groupId!)
    );
    if (!groupIds.size) return;
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        groups: s.document.groups.filter((g) => !groupIds.has(g.id)),
        layers: s.document.layers.map((l) => (l.groupId && groupIds.has(l.groupId) ? { ...l, groupId: null } : l)),
      },
    }));
    get().showToast('Layers ungrouped');
  },

  mergeLayers: (ids) => {
    const { document: doc } = get();
    const targets = doc.layers.filter((l) => ids.includes(l.id));
    if (targets.length < 2) return;

    // Render selected layers onto a full-canvas temporary buffer, find tight alpha bounds
    const full = window.document.createElement('canvas');
    full.width = doc.width;
    full.height = doc.height;
    const fctx = full.getContext('2d')!;

    for (const l of targets) {
      if (!l.visible) continue;
      const res = renderFullLayerToCanvas(l, undefined, 2);
      fctx.save();
      fctx.globalAlpha = l.opacity;
      fctx.translate(l.x, l.y);
      fctx.rotate((l.rotation * Math.PI) / 180);
      fctx.scale(l.scaleX, l.scaleY);
      fctx.drawImage(
        res.canvas,
        -(res.offsetX + res.coreWidth / 2),
        -(res.offsetY + res.coreHeight / 2),
        res.logicalWidth,
        res.logicalHeight
      );
      fctx.restore();
    }

    const imgData = fctx.getImageData(0, 0, doc.width, doc.height);
    const data = imgData.data;
    let minX = doc.width;
    let minY = doc.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) {
        if (data[(y * doc.width + x) * 4 + 3] > 2) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      minX = 0;
      minY = 0;
      maxX = Math.min(200, doc.width - 1);
      maxY = Math.min(200, doc.height - 1);
    }

    const cropW = Math.max(20, maxX - minX + 1);
    const cropH = Math.max(20, maxY - minY + 1);
    const out = window.document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    out.getContext('2d')!.drawImage(full, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    const mergedUrl = out.toDataURL('image/png');

    const newId = uid('mrg');
    const mergedLayer: ImageLayer = {
      ...createBaseLayerDefaults({
        x: minX + cropW / 2,
        y: minY + cropH / 2,
        width: cropW,
        height: cropH,
      }),
      id: newId,
      name: 'Merged Layer',
      type: 'image',
      src: mergedUrl,
      naturalWidth: cropW,
      naturalHeight: cropH,
      stroke: { enabled: false, color: '#ffffff', width: 4 },
    };

    // Insert at the highest index among merged layers
    let insertAt = 0;
    const remaining: LayerObject[] = [];
    doc.layers.forEach((l) => {
      if (ids.includes(l.id)) {
        insertAt = remaining.length;
      } else {
        remaining.push(l);
      }
    });
    remaining.splice(insertAt, 0, mergedLayer);

    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: remaining,
        updatedAt: Date.now(),
      },
      selectedIds: [newId],
      activeTab: 'object',
      activeTool: null,
    }));
    get().showToast(`Merged ${targets.length} layers`);
  },

  cropImageLayer: (layerId, x, y, width, height) => {
    const { document: doc } = get();
    const target = doc.layers.find((l) => l.id === layerId && l.type === 'image') as ImageLayer | undefined;
    if (!target) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const off = window.document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d')!.drawImage(img, x, y, width, height, 0, 0, width, height);
      const croppedUrl = off.toDataURL('image/png');

      const maxDim = Math.min(doc.width, doc.height) * 0.65;
      const ratio = Math.min(1, maxDim / Math.max(width, height));
      get().pushHistory();
      get().updateLayer(layerId, {
        src: croppedUrl,
        naturalWidth: width,
        naturalHeight: height,
        width: Math.max(40, Math.round(width * ratio)),
        height: Math.max(40, Math.round(height * ratio)),
      } as Partial<ImageLayer>);
      get().showToast('Image cropped');
    };
    img.src = target.src;
  },

  nudgeSelected: (dx, dy) =>
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          s.selectedIds.includes(l.id) && !l.locked
            ? { ...l, x: Math.round(l.x + dx), y: Math.round(l.y + dy) }
            : l
        ),
        updatedAt: Date.now(),
      },
    })),

  relativePositionSelected: (alignX, alignY) => {
    const { selectedIds, document } = get();
    if (!selectedIds.length) return;
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => {
          if (!selectedIds.includes(l.id) || l.locked) return l;
          const dims = getLayerCoreBox(l);
          const halfW = (dims.w * Math.abs(l.scaleX)) / 2;
          const halfH = (dims.h * Math.abs(l.scaleY)) / 2;
          let nextX = l.x;
          let nextY = l.y;
          if (alignX === 'left') nextX = halfW;
          else if (alignX === 'center') nextX = document.width / 2;
          else if (alignX === 'right') nextX = document.width - halfW;
          if (alignY === 'top') nextY = halfH;
          else if (alignY === 'middle') nextY = document.height / 2;
          else if (alignY === 'bottom') nextY = document.height - halfH;
          return { ...l, x: nextX, y: nextY };
        }),
      },
    }));
  },

  saveSelectedAsStyle: (name) => {
    const { selectedIds, document, savedStyles } = get();
    const target = document.layers.find((l) => l.id === selectedIds[0]);
    if (!target || target.type !== 'text') return;
    const t = target as TextLayer;
    const preset: StylePreset = {
      id: uid('sty'),
      name: name || 'Custom Style',
      previewBg: '#1e293b',
      textStyle: {
        fontFamily: t.fontFamily,
        bold: t.bold,
        italic: t.italic,
        fill: JSON.parse(JSON.stringify(t.fill)),
        stroke: JSON.parse(JSON.stringify(t.stroke)),
        shadow: JSON.parse(JSON.stringify(t.shadow)),
        innerShadow: JSON.parse(JSON.stringify(t.innerShadow)),
        text3D: JSON.parse(JSON.stringify(t.text3D)),
        textBg: JSON.parse(JSON.stringify(t.textBg)),
      },
    };
    const next = [preset, ...savedStyles];
    localStorage.setItem('pixellab_saved_styles', JSON.stringify(next));
    set({ savedStyles: next });
    get().showToast(`Saved style "${preset.name}"`);
  },

  applyStyleToSelected: (preset) => {
    const { selectedIds, document } = get();
    const target = document.layers.find((l) => l.id === selectedIds[0]);
    if (!target || target.type !== 'text') return;
    get().pushHistory();
    get().updateLayer(target.id, JSON.parse(JSON.stringify(preset.textStyle)), false);
  },

  startDrawMode: () =>
    set((s) => ({
      interactionMode: 'draw',
      activeTab: 'object',
      activeTool: 'drawTool',
      drawSession: { ...s.drawSession, strokes: [], undoneStrokes: [] },
    })),

  updateDrawSession: (patch) =>
    set((s) => ({ drawSession: { ...s.drawSession, ...patch } })),

  addDrawStroke: (stroke) =>
    set((s) => ({
      drawSession: {
        ...s.drawSession,
        strokes: [...s.drawSession.strokes, stroke],
        undoneStrokes: [],
      },
    })),

  undoDrawStroke: () =>
    set((s) => {
      if (!s.drawSession.strokes.length) return s;
      const last = s.drawSession.strokes[s.drawSession.strokes.length - 1];
      return {
        drawSession: {
          ...s.drawSession,
          strokes: s.drawSession.strokes.slice(0, -1),
          undoneStrokes: [last, ...s.drawSession.undoneStrokes],
        },
      };
    }),

  redoDrawStroke: () =>
    set((s) => {
      if (!s.drawSession.undoneStrokes.length) return s;
      const next = s.drawSession.undoneStrokes[0];
      return {
        drawSession: {
          ...s.drawSession,
          strokes: [...s.drawSession.strokes, next],
          undoneStrokes: s.drawSession.undoneStrokes.slice(1),
        },
      };
    }),

  updateEraserSession: (patch) =>
    set((s) => ({ eraserSession: { ...s.eraserSession, ...patch } })),

  clearEraserUndoneForLayer: (layerId) =>
    set((s) => {
      if (!s.eraserUndoneMap[layerId]?.length) return s;
      const copy = { ...s.eraserUndoneMap };
      delete copy[layerId];
      return { eraserUndoneMap: copy };
    }),

  undoEraserStroke: (layerId) => {
    const layer = get().document.layers.find((l) => l.id === layerId);
    const strokes = layer?.eraserStrokes ?? [];
    if (!strokes.length) return;
    const last = strokes[strokes.length - 1];
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === layerId ? { ...l, eraserStrokes: strokes.slice(0, -1) } : l
        ),
        updatedAt: Date.now(),
      },
      eraserUndoneMap: {
        ...s.eraserUndoneMap,
        [layerId]: [last, ...(s.eraserUndoneMap[layerId] ?? [])],
      },
    }));
  },

  redoEraserStroke: (layerId) => {
    const undone = get().eraserUndoneMap[layerId] ?? [];
    if (!undone.length) return;
    const next = undone[0];
    get().pushHistory();
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === layerId ? { ...l, eraserStrokes: [...(l.eraserStrokes ?? []), next] } : l
        ),
        updatedAt: Date.now(),
      },
      eraserUndoneMap: {
        ...s.eraserUndoneMap,
        [layerId]: undone.slice(1),
      },
    }));
  },

  clearEraserStrokes: (layerId) => {
    const layer = get().document.layers.find((l) => l.id === layerId);
    if (!layer?.eraserStrokes?.length) return;
    get().pushHistory();
    set((s) => {
      const copy = { ...s.eraserUndoneMap };
      delete copy[layerId];
      return {
        document: {
          ...s.document,
          layers: s.document.layers.map((l) =>
            l.id === layerId ? { ...l, eraserStrokes: [] } : l
          ),
          updatedAt: Date.now(),
        },
        eraserUndoneMap: copy,
      };
    });
    get().showToast('Restored all erased pixels');
  },

  commitDrawSession: () => {
    const { drawSession, document } = get();
    if (!drawSession.strokes.length) {
      set({ interactionMode: 'select', activeTool: null });
      return;
    }
    // Compute bounding box of all strokes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of drawSession.strokes) {
      const pad = s.size / 2 + 4;
      for (let i = 0; i < s.points.length; i += 2) {
        minX = Math.min(minX, s.points[i] - pad);
        maxX = Math.max(maxX, s.points[i] + pad);
        minY = Math.min(minY, s.points[i + 1] - pad);
        maxY = Math.max(maxY, s.points[i + 1] + pad);
      }
    }
    const w = Math.max(40, Math.ceil(maxX - minX));
    const h = Math.max(40, Math.ceil(maxY - minY));
    const localStrokes = drawSession.strokes.map((s) => ({
      ...s,
      points: s.points.map((v, idx) => (idx % 2 === 0 ? v - minX : v - minY)),
    }));
    get().pushHistory();
    const id = uid('drw');
    const layer: DrawingLayer = {
      ...createBaseLayerDefaults({
        x: minX + w / 2,
        y: minY + h / 2,
        width: w,
        height: h,
      }),
      id,
      name: `Drawing ${document.layers.filter((l) => l.type === 'drawing').length + 1}`,
      type: 'drawing',
      strokes: localStrokes,
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      interactionMode: 'select',
      activeTool: null,
      drawSession: { ...s.drawSession, strokes: [], undoneStrokes: [] },
    }));
  },

  cancelDrawSession: () =>
    set((s) => ({
      interactionMode: 'select',
      activeTool: null,
      drawSession: { ...s.drawSession, strokes: [], undoneStrokes: [] },
    })),

  startBezierMode: (existingLayerId = null) => {
    const doc = get().document;
    if (existingLayerId) {
      const layer = doc.layers.find((l) => l.id === existingLayerId) as PathLayer | undefined;
      if (layer && layer.type === 'path') {
        const originX = layer.x - layer.width / 2;
        const originY = layer.y - layer.height / 2;
        set({
          interactionMode: 'bezier',
          activeTab: 'object',
          activeTool: 'bezierTool',
          bezierSession: {
            editingLayerId: layer.id,
            anchors: layer.anchors.map((a) => ({
              x: a.x + originX,
              y: a.y + originY,
              cp1x: a.cp1x + originX,
              cp1y: a.cp1y + originY,
              cp2x: a.cp2x + originX,
              cp2y: a.cp2y + originY,
            })),
            closed: layer.closed,
            strokeColor: layer.stroke.color,
            strokeWidth: layer.stroke.width,
            fillColor: layer.fill.color,
            fillEnabled: layer.fill.mode !== 'solid' || layer.closed,
          },
        });
        return;
      }
    }
    set({
      interactionMode: 'bezier',
      activeTab: 'object',
      activeTool: 'bezierTool',
      bezierSession: {
        editingLayerId: null,
        anchors: [
          {
            x: doc.width * 0.3,
            y: doc.height * 0.55,
            cp1x: doc.width * 0.24,
            cp1y: doc.height * 0.55,
            cp2x: doc.width * 0.36,
            cp2y: doc.height * 0.35,
          },
          {
            x: doc.width * 0.7,
            y: doc.height * 0.45,
            cp1x: doc.width * 0.62,
            cp1y: doc.height * 0.65,
            cp2x: doc.width * 0.76,
            cp2y: doc.height * 0.45,
          },
        ],
        closed: false,
        strokeColor: '#ffffff',
        strokeWidth: 8,
        fillColor: '#2d8cff',
        fillEnabled: true,
      },
    });
  },

  updateBezierSession: (patch) =>
    set((s) => ({ bezierSession: { ...s.bezierSession, ...patch } })),

  commitBezierSession: () => {
    const { bezierSession, document } = get();
    if (bezierSession.anchors.length < 2) {
      set({ interactionMode: 'select', activeTool: null });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const pad = bezierSession.strokeWidth + 24;
    for (const a of bezierSession.anchors) {
      minX = Math.min(minX, a.x - pad, a.cp1x - pad, a.cp2x - pad);
      minY = Math.min(minY, a.y - pad, a.cp1y - pad, a.cp2y - pad);
      maxX = Math.max(maxX, a.x + pad, a.cp1x + pad, a.cp2x + pad);
      maxY = Math.max(maxY, a.y + pad, a.cp1y + pad, a.cp2y + pad);
    }
    const w = Math.max(60, Math.ceil(maxX - minX));
    const h = Math.max(60, Math.ceil(maxY - minY));
    const localAnchors = bezierSession.anchors.map((a) => ({
      x: a.x - minX,
      y: a.y - minY,
      cp1x: a.cp1x - minX,
      cp1y: a.cp1y - minY,
      cp2x: a.cp2x - minX,
      cp2y: a.cp2y - minY,
    }));

    get().pushHistory();
    if (bezierSession.editingLayerId) {
      get().updateLayer(bezierSession.editingLayerId, {
        x: minX + w / 2,
        y: minY + h / 2,
        width: w,
        height: h,
        anchors: localAnchors,
        closed: bezierSession.closed,
        fill: {
          mode: 'solid',
          color: bezierSession.fillColor,
          gradient: { ...GRADIENT_PRESETS[2] },
        },
        stroke: {
          enabled: bezierSession.strokeWidth > 0,
          color: bezierSession.strokeColor,
          width: bezierSession.strokeWidth,
        },
      } as Partial<PathLayer>);
      set({ interactionMode: 'select', activeTool: null });
      return;
    }

    const id = uid('pth');
    const layer: PathLayer = {
      ...createBaseLayerDefaults({
        x: minX + w / 2,
        y: minY + h / 2,
        width: w,
        height: h,
      }),
      id,
      name: `Bezier Path ${document.layers.filter((l) => l.type === 'path').length + 1}`,
      type: 'path',
      anchors: localAnchors,
      closed: bezierSession.closed,
      fill: {
        mode: 'solid',
        color: bezierSession.fillColor,
        gradient: { ...GRADIENT_PRESETS[2] },
      },
      stroke: {
        enabled: bezierSession.strokeWidth > 0,
        color: bezierSession.strokeColor,
        width: bezierSession.strokeWidth,
      },
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedIds: [id],
      interactionMode: 'select',
      activeTool: null,
    }));
  },

  cancelBezierSession: () =>
    set({ interactionMode: 'select', activeTool: null }),

  importCustomFont: async (name, dataUrl) => {
    const cleanName = name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
    await registerCustomFont({ name: cleanName, dataUrl }, true);
    const fonts = await loadSavedCustomFonts();
    set({ customFonts: fonts });
    get().showToast(`Imported font "${cleanName}"`);
  },

  refreshProjectsList: async () => {
    const projects = await listProjectsLocal();
    set({ projects });
  },

  saveCurrentProject: async () => {
    const { document, stageThumbnailGetter } = get();
    let thumb = '';
    if (stageThumbnailGetter) {
      try {
        thumb = stageThumbnailGetter();
      } catch {
        thumb = '';
      }
    }
    await saveProjectLocal(document, thumb);
    const projects = await listProjectsLocal();
    set({ projects });
    get().showToast(`Saved "${document.name}"`);
  },

  loadProjectById: async (id) => {
    const doc = await loadProjectLocal(id);
    if (!doc) {
      get().showToast('Could not load project');
      return;
    }
    get().setDocument(doc, true);
    set({ activeModal: null });
    get().showToast(`Opened "${doc.name}"`);
  },

  deleteProjectById: async (id) => {
    await deleteProjectLocal(id);
    const projects = await listProjectsLocal();
    set({ projects });
    get().showToast('Project deleted');
  },

  duplicateProjectById: async (id) => {
    const doc = await loadProjectLocal(id);
    if (!doc) return;
    const copy: CanvasDocument = {
      ...cloneDoc(doc),
      id: uid('proj'),
      name: `${doc.name} Copy`,
      updatedAt: Date.now(),
    };
    await saveProjectLocal(copy, '');
    const projects = await listProjectsLocal();
    set({ projects });
    get().showToast(`Duplicated "${doc.name}"`);
  },

  createNewProject: (width = 1080, height = 1080, name = 'Untitled Project') => {
    const doc = createBlankDocument(width, height, name);
    set({
      document: doc,
      historyPast: [],
      historyFuture: [],
      selectedIds: doc.layers.length ? [doc.layers[0].id] : [],
      activeTool: null,
      interactionMode: 'select',
      activeModal: null,
    });
  },
}));
