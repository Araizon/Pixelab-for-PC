import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Crop,
  Eraser,
  Files,
  ImagePlus,
  Lock,
  Maximize2,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { isIsolatedEraseActive, useEditorStore } from '../store/useEditorStore';
import { BezierAnchor, EraserStroke, LayerObject } from '../types/editor';
import {
  extractFromDataTransfer,
  LoadedImageAsset,
  readImagesFromAsyncClipboard,
} from '../utils/clipboardDrop';
import {
  createGradient,
  getCachedImage,
  getLayerCoreBox,
  getLayerVisualCacheKey,
  hexToRgba,
  quantizeRenderScale,
  renderFullLayerToCanvas,
} from '../utils/canvasEffects';

interface LayerNodeProps {
  layer: LayerObject;
  isLocked: boolean;
  viewportScale: number;
  onSelect: (id: string, shiftKey: boolean) => boolean;
  onDoubleClick: (layer: LayerObject) => void;
  onChangeEnd: (id: string, patch: Partial<LayerObject>) => void;
  onDragSnap: (node: Konva.Node) => void;
  onDragDone: () => void;
  registerRef: (id: string, node: Konva.Image | null) => void;
}

const RenderedLayerNode: React.FC<LayerNodeProps> = React.memo(
  ({
    layer,
    isLocked,
    viewportScale,
    onSelect,
    onDoubleClick,
    onChangeEnd,
    onDragSnap,
    onDragDone,
    registerRef,
  }) => {
    const [assetTick, setAssetTick] = useState(0);
    const nodeRef = useRef<Konva.Image | null>(null);
    const visualKey = getLayerVisualCacheKey(layer);
    const coreBox = useMemo(
      () => getLayerCoreBox(layer),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [visualKey]
    );
    const renderScale = quantizeRenderScale(
      viewportScale * Math.max(Math.abs(layer.scaleX), Math.abs(layer.scaleY)),
      coreBox.w,
      coreBox.h
    );

    const rendered = useMemo(() => {
      return renderFullLayerToCanvas(layer, () => setAssetTick((t) => t + 1), renderScale);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visualKey, renderScale, assetTick]);

    useEffect(() => {
      registerRef(layer.id, nodeRef.current);
      return () => registerRef(layer.id, null);
    }, [layer.id, registerRef]);

    const canvasW = rendered.logicalWidth;
    const canvasH = rendered.logicalHeight;
    const offsetX = rendered.offsetX + rendered.coreWidth / 2;
    const offsetY = rendered.offsetY + rendered.coreHeight / 2;

    return (
      <KonvaImage
        ref={nodeRef}
        id={layer.id}
        image={rendered.canvas}
        x={layer.x}
        y={layer.y}
        width={canvasW}
        height={canvasH}
        offsetX={offsetX}
        offsetY={offsetY}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        rotation={layer.rotation}
        opacity={layer.opacity}
        visible={layer.visible}
        draggable={!isLocked}
        perfectDrawEnabled={false}
        onMouseDown={(e) => {
          if (onSelect(layer.id, e.evt.shiftKey)) {
            e.cancelBubble = true;
          }
        }}
        onTouchStart={(e) => {
          if (onSelect(layer.id, Boolean(e.evt.shiftKey))) {
            e.cancelBubble = true;
          }
        }}
        onDblClick={() => onDoubleClick(layer)}
        onDblTap={() => onDoubleClick(layer)}
        onDragMove={(e) => onDragSnap(e.target)}
        onDragEnd={(e) => {
          onDragDone();
          onChangeEnd(layer.id, {
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          onChangeEnd(layer.id, {
            x: Math.round(node.x()),
            y: Math.round(node.y()),
            scaleX: Number(node.scaleX().toFixed(3)),
            scaleY: Number(node.scaleY().toFixed(3)),
            rotation: Math.round(node.rotation()),
          });
        }}
      />
    );
  }
);

export const CanvasViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMapRef = useRef<Map<string, Konva.Image>>(new Map());
  const hasMeasuredRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 600 });
  const [bgTick, setBgTick] = useState(0);
  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<number[]>([]);
  const [livePreviewPoints, setLivePreviewPoints] = useState<number[]>([]);
  const eraseCursorGroupRef = useRef<Konva.Group | null>(null);
  const eyedropperSnapshotRef = useRef<{
    ctx: CanvasRenderingContext2D;
    rawCtx: CanvasRenderingContext2D | null;
    width: number;
    height: number;
  } | null>(null);
  const eyedropperBadgeRef = useRef<HTMLDivElement | null>(null);
  const activeEraseRef = useRef<{
    layerId: string;
    baseStrokes: EraserStroke[];
    stroke: EraserStroke;
    lastCanvasPt: { x: number; y: number };
  } | null>(null);
  const eraseRafRef = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    targetLayerId: string | null;
  } | null>(null);

  const {
    document: doc,
    selectedIds,
    activeTool,
    zoom,
    pan,
    gridEnabled,
    snapEnabled,
    gridSize,
    interactionMode,
    eyedropperCallback,
    drawSession,
    eraserSession,
    bezierSession,
    selectLayer,
    updateLayer,
    pushHistory,
    setZoom,
    setPan,
    openModal,
    setStageGetters,
    addDrawStroke,
    clearEraserUndoneForLayer,
    updateBezierSession,
    setInteractionMode,
    setActiveTab,
    setActiveTool,
    showToast,
  } = useEditorStore();

  const isIsolatedErasePage = isIsolatedEraseActive(activeTool, selectedIds, doc.layers);

  const computeFitZoom = useCallback(
    (vw: number, vh: number) => {
      const pad = 64;
      const zx = (vw - pad) / doc.width;
      const zy = (vh - pad) / doc.height;
      return Math.min(1.5, Math.max(0.15, Number(Math.min(zx, zy).toFixed(2))));
    },
    [doc.width, doc.height]
  );

  const fitCanvas = useCallback(() => {
    setZoom(computeFitZoom(viewportSize.width, viewportSize.height));
    setPan({ x: 0, y: 0 });
  }, [computeFitZoom, viewportSize.width, viewportSize.height, setZoom, setPan]);

  // Measure container dynamically and auto-fit on initial measure
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
        if (!hasMeasuredRef.current) {
          hasMeasuredRef.current = true;
          setZoom(computeFitZoom(rect.width, rect.height));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFitZoom, setZoom]);

  // Re-fit when document id or dimensions change
  useEffect(() => {
    if (hasMeasuredRef.current) {
      fitCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.width, doc.height]);

  useEffect(() => {
    const handler = () => fitCanvas();
    window.addEventListener('pixellab:fit-canvas', handler);
    return () => window.removeEventListener('pixellab:fit-canvas', handler);
  }, [fitCanvas]);

  const getCanvasPointFromClient = useCallback((clientX: number, clientY: number) => {
    const state = useEditorStore.getState();
    const { width, height } = state.document;
    const curZoom = state.zoom;
    const rect = stageRef.current?.container().getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { x: Math.round(width / 2), y: Math.round(height / 2), insideStage: false };
    }
    const rx = (clientX - rect.left) / curZoom;
    const ry = (clientY - rect.top) / curZoom;
    const insideStage = rx >= 0 && ry >= 0 && rx <= width && ry <= height;
    return {
      x: insideStage ? Math.round(rx) : Math.round(width / 2),
      y: insideStage ? Math.round(ry) : Math.round(height / 2),
      insideStage,
    };
  }, []);

  const insertLoadedImages = useCallback(
    (images: LoadedImageAsset[], basePos?: { x: number; y: number }) => {
      if (!images.length) return false;
      const state = useEditorStore.getState();
      const { width, height } = state.document;
      const startX = basePos ? basePos.x : Math.round(width / 2);
      const startY = basePos ? basePos.y : Math.round(height / 2);
      images.forEach((img, idx) => {
        const pos =
          basePos || idx > 0
            ? {
                x: Math.max(0, Math.min(width, Math.round(startX + idx * 24))),
                y: Math.max(0, Math.min(height, Math.round(startY + idx * 24))),
              }
            : undefined;
        state.addImageLayer(img.src, img.width, img.height, img.name, pos);
      });
      state.showToast(
        images.length === 1
          ? `Added "${images[0].name}" (${images[0].width}×${images[0].height})`
          : `Added ${images.length} images to canvas`
      );
      return true;
    },
    []
  );

  const handleAsyncClipboardPaste = useCallback(
    async (basePos?: { x: number; y: number }) => {
      const state = useEditorStore.getState();
      const { images, text } = await readImagesFromAsyncClipboard();
      if (images.length > 0) {
        insertLoadedImages(images, basePos);
        return;
      }
      if (state.clipboard.length > 0) {
        state.pasteClipboard();
        return;
      }
      if (text && text.trim()) {
        state.addTextLayer(text.trim().slice(0, 500));
        state.showToast('Pasted text as new layer');
        return;
      }
      state.showToast('Clipboard has no image — copy an image or press Ctrl+V');
    },
    [insertLoadedImages]
  );

  // Spacebar pan & keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        const state = useEditorStore.getState();
        if (isIsolatedEraseActive(state.activeTool, state.selectedIds, state.document.layers)) {
          if (state.interactionMode === 'eyedropper') {
            state.setInteractionMode('select');
          } else {
            state.exitErasePage();
          }
        }
      }
      if (isEditableTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (
          state.selectedIds.length &&
          !isIsolatedEraseActive(state.activeTool, state.selectedIds, state.document.layers)
        ) {
          state.duplicateLayers(state.selectedIds);
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState();
        if (
          !state.activeModal &&
          state.interactionMode === 'select' &&
          state.selectedIds.length &&
          !isIsolatedEraseActive(state.activeTool, state.selectedIds, state.document.layers)
        ) {
          state.deleteLayers(state.selectedIds);
        }
      }
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        const state = useEditorStore.getState();
        if (!state.activeModal && state.interactionMode === 'select' && state.selectedIds.length) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          state.nudgeSelected(dx, dy);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const state = useEditorStore.getState();
      if (state.activeModal || state.selectedIds.length === 0) return;
      e.preventDefault();
      state.copySelected();
      e.clipboardData?.setData('application/x-pixellab-layers', '1');
    };

    const onPaste = async (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const state = useEditorStore.getState();
      if (state.activeModal) return;

      const dt = e.clipboardData;
      if (!dt) {
        if (state.clipboard.length > 0) {
          state.pasteClipboard();
        }
        return;
      }

      // If internal PixelLab layer signature is present in system clipboard, paste copied layer(s)
      const types = Array.from(dt.types || []);
      if (types.includes('application/x-pixellab-layers') && state.clipboard.length > 0) {
        e.preventDefault();
        state.pasteClipboard();
        return;
      }

      // Snapshot plain text before awaiting DataTransfer
      let plainText = '';
      try {
        plainText = dt.getData('text/plain') || '';
      } catch {
        // ignore
      }

      const { images, pfxDoc } = await extractFromDataTransfer(dt);
      if (pfxDoc) {
        e.preventDefault();
        state.setDocument(pfxDoc, true);
        state.showToast(`Opened "${pfxDoc.name}"`);
        return;
      }
      if (images.length > 0) {
        e.preventDefault();
        insertLoadedImages(images);
        return;
      }

      // Fallback to internal clipboard if user copied via toolbar/menu button
      if (state.clipboard.length > 0) {
        e.preventDefault();
        state.pasteClipboard();
        return;
      }

      // Optional fallback: plain text copied externally creates a TextLayer (ignore URLs that failed to fetch)
      const trimmed = plainText.trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        e.preventDefault();
        state.addTextLayer(trimmed.slice(0, 500));
        state.showToast('Pasted text as new layer');
      }
    };

    // Prevent browser from navigating away when files/images are dropped anywhere on window
    const onWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('copy', onCopy);
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [insertLoadedImages]);

  // Precompute reusable noise tile once so filter slider drags never allocate random pixels
  const noiseTileCanvas = useMemo(() => {
    const tile = document.createElement('canvas');
    tile.width = 160;
    tile.height = 160;
    const tctx = tile.getContext('2d')!;
    const imgData = tctx.createImageData(160, 160);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    tctx.putImageData(imgData, 0, 0);
    return tile;
  }, []);

  // Build Background + Non-Destructive Filters Canvas
  const backgroundCanvas = useMemo(() => {
    const off = document.createElement('canvas');
    off.width = doc.width;
    off.height = doc.height;
    const ctx = off.getContext('2d')!;
    const { background: bg, filters } = doc;

    const cssFilters: string[] = [];
    if (filters.brightness !== 0) cssFilters.push(`brightness(${100 + filters.brightness}%)`);
    if (filters.contrast !== 0) cssFilters.push(`contrast(${100 + filters.contrast}%)`);
    if (filters.hue !== 0) cssFilters.push(`hue-rotate(${filters.hue}deg)`);
    if (filters.saturation !== 0) cssFilters.push(`saturate(${100 + filters.saturation}%)`);

    ctx.save();
    if (cssFilters.length) ctx.filter = cssFilters.join(' ');
    if (filters.rotate !== 0) {
      ctx.translate(doc.width / 2, doc.height / 2);
      ctx.rotate((filters.rotate * Math.PI) / 180);
      ctx.translate(-doc.width / 2, -doc.height / 2);
    }

    if (bg.mode === 'solid') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, doc.width, doc.height);
    } else if (bg.mode === 'gradient') {
      ctx.fillStyle = createGradient(ctx, bg.gradient, doc.width, doc.height);
      ctx.fillRect(0, 0, doc.width, doc.height);
    } else if (bg.mode === 'image' && bg.imageUrl) {
      const img = getCachedImage(bg.imageUrl, () => setBgTick((t) => t + 1));
      if (img) {
        if (bg.imageFit === 'stretch') {
          ctx.drawImage(img, 0, 0, doc.width, doc.height);
        } else {
          const scale =
            bg.imageFit === 'cover'
              ? Math.max(doc.width / img.naturalWidth, doc.height / img.naturalHeight)
              : Math.min(doc.width / img.naturalWidth, doc.height / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          ctx.drawImage(img, (doc.width - dw) / 2, (doc.height - dh) / 2, dw, dh);
        }
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, doc.width, doc.height);
      }
    }
    ctx.restore();

    if (filters.stripesEnabled) {
      ctx.save();
      ctx.globalAlpha = filters.stripesAlpha;
      ctx.fillStyle = filters.stripesColor;
      ctx.translate(doc.width / 2, doc.height / 2);
      ctx.rotate((filters.stripesAngle * Math.PI) / 180);
      const diag = Math.sqrt(doc.width * doc.width + doc.height * doc.height);
      const step = diag / Math.max(2, filters.stripesCount);
      for (let x = -diag; x < diag; x += step * 2) {
        ctx.fillRect(x, -diag, step, diag * 2);
      }
      ctx.restore();
    }

    if (filters.noiseEnabled && filters.noiseAlpha > 0) {
      const pat = ctx.createPattern(noiseTileCanvas, 'repeat');
      if (pat) {
        ctx.save();
        ctx.globalAlpha = filters.noiseAlpha * 0.65;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, doc.width, doc.height);
        ctx.restore();
      }
    }

    if (filters.vignetteEnabled) {
      const cx = doc.width / 2;
      const cy = doc.height / 2;
      const outerR = Math.sqrt(cx * cx + cy * cy);
      const innerR = outerR * Math.max(0.05, Math.min(0.95, 1 - filters.vignetteRadius));
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, hexToRgba(filters.vignetteColor, 0));
      grad.addColorStop(1, hexToRgba(filters.vignetteColor, filters.vignetteAlpha));
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, doc.width, doc.height);
      ctx.restore();
    }

    return off;
  }, [doc.width, doc.height, doc.background, doc.filters, bgTick, noiseTileCanvas]);

  const checkerCanvas = useMemo(() => {
    const tile = document.createElement('canvas');
    tile.width = 32;
    tile.height = 32;
    const tctx = tile.getContext('2d')!;
    tctx.fillStyle = '#e2e8f0';
    tctx.fillRect(0, 0, 32, 32);
    tctx.fillStyle = '#cbd5e1';
    tctx.fillRect(0, 0, 16, 16);
    tctx.fillRect(16, 16, 16, 16);
    const full = document.createElement('canvas');
    full.width = doc.width;
    full.height = doc.height;
    const fctx = full.getContext('2d')!;
    const pat = fctx.createPattern(tile, 'repeat');
    if (pat) {
      fctx.fillStyle = pat;
      fctx.fillRect(0, 0, doc.width, doc.height);
    }
    return full;
  }, [doc.width, doc.height]);

  const registerNodeRef = useCallback((id: string, node: Konva.Image | null) => {
    if (node) nodeMapRef.current.set(id, node);
    else nodeMapRef.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (interactionMode !== 'select' || isIsolatedErasePage) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const unlockedNodes = selectedIds
      .map((id) => {
        const layer = doc.layers.find((l) => l.id === id);
        if (!layer || layer.locked || !layer.visible) return null;
        return nodeMapRef.current.get(id) ?? null;
      })
      .filter((n): n is Konva.Image => n !== null);
    tr.nodes(unlockedNodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, doc.layers, interactionMode, isIsolatedErasePage]);

  useEffect(() => {
    const exportGetter = (
      pixelRatio: number,
      mimeType: string,
      quality: number,
      transparentBg = false
    ) => {
      const outW = Math.round(doc.width * pixelRatio);
      const outH = Math.round(doc.height * pixelRatio);
      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(pixelRatio, pixelRatio);

      if (!transparentBg && doc.background.mode !== 'transparent') {
        ctx.drawImage(backgroundCanvas, 0, 0);
      } else if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, doc.width, doc.height);
        if (!transparentBg) ctx.drawImage(backgroundCanvas, 0, 0);
      }

      for (const layer of doc.layers) {
        if (!layer.visible) continue;
        const coreBox = getLayerCoreBox(layer);
        const layerScale = quantizeRenderScale(
          Math.max(1, pixelRatio * Math.max(Math.abs(layer.scaleX), Math.abs(layer.scaleY))),
          coreBox.w,
          coreBox.h
        );
        const res = renderFullLayerToCanvas(layer, undefined, layerScale);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.scaleX, layer.scaleY);
        const ox = res.offsetX + res.coreWidth / 2;
        const oy = res.offsetY + res.coreHeight / 2;
        ctx.drawImage(res.canvas, -ox, -oy, res.logicalWidth, res.logicalHeight);
        ctx.restore();
      }

      return out.toDataURL(mimeType, quality);
    };

    const thumbGetter = () => {
      const scale = Math.min(0.4, 280 / Math.max(doc.width, doc.height));
      return exportGetter(scale, 'image/png', 0.85, false);
    };

    setStageGetters(thumbGetter, exportGetter);
  }, [doc, backgroundCanvas, setStageGetters]);

  const handleDragSnap = useCallback(
    (node: Konva.Node) => {
      if (!snapEnabled) return;
      const threshold = 10;
      const cx = doc.width / 2;
      const cy = doc.height / 2;
      let nx = node.x();
      let ny = node.y();
      let guideX: number | null = null;
      let guideY: number | null = null;

      if (Math.abs(nx - cx) < threshold) {
        nx = cx;
        guideX = cx;
      } else if (gridEnabled) {
        const gx = Math.round(nx / gridSize) * gridSize;
        if (Math.abs(nx - gx) < 6) nx = gx;
      }

      if (Math.abs(ny - cy) < threshold) {
        ny = cy;
        guideY = cy;
      } else if (gridEnabled) {
        const gy = Math.round(ny / gridSize) * gridSize;
        if (Math.abs(ny - gy) < 6) ny = gy;
      }

      node.x(nx);
      node.y(ny);
      setSnapLines({ x: guideX, y: guideY });
    },
    [snapEnabled, gridEnabled, gridSize, doc.width, doc.height]
  );

  // Invalidate eyedropper snapshot whenever layers, background, or mode change
  useEffect(() => {
    eyedropperSnapshotRef.current = null;
    if (interactionMode !== 'eyedropper' && eyedropperBadgeRef.current) {
      eyedropperBadgeRef.current.style.opacity = '0';
    }
  }, [interactionMode, doc.layers, backgroundCanvas, isIsolatedErasePage]);

  // Use Konva's built-in relative pointer coordinates so zoom is always handled accurately!
  const getCanvasPointer = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getRelativePointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return { x: pos.x, y: pos.y };
  };

  const getEyedropperHexAt = useCallback(
    (pos: { x: number; y: number }): string | null => {
      if (!eyedropperSnapshotRef.current) {
        const temp = document.createElement('canvas');
        temp.width = doc.width;
        temp.height = doc.height;
        const ctx = temp.getContext('2d', { willReadFrequently: true })!;
        if (!isIsolatedErasePage && doc.background.mode !== 'transparent') {
          ctx.drawImage(backgroundCanvas, 0, 0);
        }
        const activeLayerId = selectedIds.length === 1 ? selectedIds[0] : null;
        for (const l of doc.layers) {
          if (!l.visible) continue;
          if (isIsolatedErasePage && l.id !== activeLayerId) continue;
          const res = renderFullLayerToCanvas(l, undefined, 1);
          ctx.save();
          ctx.globalAlpha = l.opacity;
          ctx.translate(l.x, l.y);
          ctx.rotate((l.rotation * Math.PI) / 180);
          ctx.scale(l.scaleX, l.scaleY);
          ctx.drawImage(
            res.canvas,
            -(res.offsetX + res.coreWidth / 2),
            -(res.offsetY + res.coreHeight / 2),
            res.logicalWidth,
            res.logicalHeight
          );
          ctx.restore();
        }

        // Un-erased selected layer fallback so clicking near transparent/erased edges still samples source color cleanly
        let rawCtx: CanvasRenderingContext2D | null = null;
        const selId = activeLayerId;
        const selLayer = selId ? doc.layers.find((l) => l.id === selId) : null;
        if (selLayer && selLayer.visible) {
          const rawLayer: LayerObject = {
            ...selLayer,
            eraseColor: {
              color: '#ffffff',
              tolerance: 24,
              smooth: 8,
              ...selLayer.eraseColor,
              enabled: false,
            },
            eraserStrokes: [],
          };
          const rawRes = renderFullLayerToCanvas(rawLayer, undefined, 1);
          const rawCanvas = document.createElement('canvas');
          rawCanvas.width = doc.width;
          rawCanvas.height = doc.height;
          rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
          rawCtx.save();
          rawCtx.translate(selLayer.x, selLayer.y);
          rawCtx.rotate((selLayer.rotation * Math.PI) / 180);
          rawCtx.scale(selLayer.scaleX, selLayer.scaleY);
          rawCtx.drawImage(
            rawRes.canvas,
            -(rawRes.offsetX + rawRes.coreWidth / 2),
            -(rawRes.offsetY + rawRes.coreHeight / 2),
            rawRes.logicalWidth,
            rawRes.logicalHeight
          );
          rawCtx.restore();
        }

        eyedropperSnapshotRef.current = {
          ctx,
          rawCtx,
          width: doc.width,
          height: doc.height,
        };
      }

      const snap = eyedropperSnapshotRef.current;
      const px = Math.max(0, Math.min(snap.width - 1, Math.round(pos.x)));
      const py = Math.max(0, Math.min(snap.height - 1, Math.round(pos.y)));
      let data = snap.ctx.getImageData(px, py, 1, 1).data;
      if (data[3] === 0 && snap.rawCtx) {
        const fallback = snap.rawCtx.getImageData(px, py, 1, 1).data;
        if (fallback[3] > 0) data = fallback;
      }
      if (data[3] === 0) return null;
      return `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    },
    [
      doc.width,
      doc.height,
      doc.background.mode,
      doc.layers,
      backgroundCanvas,
      selectedIds,
      isIsolatedErasePage,
    ]
  );

  const handleEyedropperClick = (pos: { x: number; y: number }) => {
    const hex = getEyedropperHexAt(pos);
    if (!hex) {
      showToast('Clicked transparent area — click on a colored pixel');
      return;
    }
    if (eyedropperBadgeRef.current) {
      eyedropperBadgeRef.current.style.opacity = '0';
    }
    eyedropperCallback?.(hex);
    setInteractionMode('select');
    showToast(`Picked ${hex.toUpperCase()}`);
  };

  const updateEraseCursor = useCallback((pos: { x: number; y: number } | null) => {
    const g = eraseCursorGroupRef.current;
    if (!g) return;
    if (pos) {
      g.position(pos);
      g.visible(true);
    } else {
      g.visible(false);
    }
    g.getLayer()?.batchDraw();
  }, []);

  const handleLayerSelect = useCallback(
    (id: string, shiftKey: boolean): boolean => {
      if (interactionMode !== 'select' || spacePressed) return false;
      selectLayer(id, shiftKey);
      return true;
    },
    [interactionMode, spacePressed, selectLayer]
  );

  const handleLayerDoubleClick = useCallback(
    (layer: LayerObject) => {
      if (layer.locked || interactionMode !== 'select') return;
      if (layer.type === 'text') {
        openModal('textEdit');
      } else if (layer.type === 'path') {
        useEditorStore.getState().startBezierMode(layer.id);
      }
    },
    [interactionMode, openModal]
  );

  const handleLayerDragDone = useCallback(() => {
    setSnapLines({ x: null, y: null });
  }, []);

  const handleLayerChangeEnd = useCallback(
    (id: string, patch: Partial<LayerObject>) => {
      pushHistory();
      updateLayer(id, patch, false);
    },
    [pushHistory, updateLayer]
  );

  const viewportDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const viewportScale = viewportDpr * zoom;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(zoom * factor);
  };

  const handleWorkspacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || spacePressed) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };
  const handleWorkspacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    setPan({
      x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
    });
  };
  const handleWorkspacePointerUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
    if (activeEraseRef.current) {
      if (eraseRafRef.current !== null) {
        cancelAnimationFrame(eraseRafRef.current);
        eraseRafRef.current = null;
      }
      const active = activeEraseRef.current;
      updateLayer(
        active.layerId,
        {
          eraserStrokes: [
            ...active.baseStrokes,
            { ...active.stroke, points: [...active.stroke.points] },
          ],
        },
        false
      );
      activeEraseRef.current = null;
    }
  };

  const canvasPointToLayerNorm = (px: number, py: number, layer: LayerObject) => {
    const { w, h } = getLayerCoreBox(layer);
    const dx = px - layer.x;
    const dy = py - layer.y;
    const rad = (-layer.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const sx = rx / (layer.scaleX || 1);
    const sy = ry / (layer.scaleY || 1);
    const fx = layer.flipX ? -sx : sx;
    const fy = layer.flipY ? -sy : sy;
    const lx = fx + w / 2;
    const ly = fy + h / 2;
    return {
      nx: lx / Math.max(1, w),
      ny: ly / Math.max(1, h),
    };
  };

  const flushActiveEraseStroke = () => {
    const active = activeEraseRef.current;
    if (!active) return;
    updateLayer(
      active.layerId,
      {
        eraserStrokes: [
          ...active.baseStrokes,
          { ...active.stroke, points: [...active.stroke.points] },
        ],
      },
      false
    );
  };

  const startEraseAt = (pos: { x: number; y: number }) => {
    if (!singleSelectedLayer) {
      showToast('Select an image or sticker layer first');
      return;
    }
    if (singleSelectedLayer.locked) {
      showToast('Layer is locked — unlock it before erasing');
      return;
    }
    pushHistory();
    clearEraserUndoneForLayer(singleSelectedLayer.id);
    const { nx, ny } = canvasPointToLayerNorm(pos.x, pos.y, singleSelectedLayer);
    const avgScale =
      (Math.abs(singleSelectedLayer.scaleX) + Math.abs(singleSelectedLayer.scaleY)) / 2 || 1;
    const coreBrushSize = Math.max(1, eraserSession.brushSize / Math.max(0.15, avgScale));
    const baseStrokes = singleSelectedLayer.eraserStrokes ?? [];
    const newStroke: EraserStroke = {
      points: [nx, ny],
      size: coreBrushSize,
      softness: eraserSession.softness,
      opacity: eraserSession.opacity,
      mode: eraserSession.mode,
    };
    activeEraseRef.current = {
      layerId: singleSelectedLayer.id,
      baseStrokes,
      stroke: newStroke,
      lastCanvasPt: pos,
    };
    flushActiveEraseStroke();
  };

  const moveEraseTo = (pos: { x: number; y: number }) => {
    const active = activeEraseRef.current;
    if (!active || !singleSelectedLayer || singleSelectedLayer.id !== active.layerId) return;
    const dx = pos.x - active.lastCanvasPt.x;
    const dy = pos.y - active.lastCanvasPt.y;
    if (dx * dx + dy * dy < 2.25) return;
    active.lastCanvasPt = pos;
    const { nx, ny } = canvasPointToLayerNorm(pos.x, pos.y, singleSelectedLayer);
    active.stroke.points.push(nx, ny);
    if (eraseRafRef.current === null) {
      eraseRafRef.current = requestAnimationFrame(() => {
        eraseRafRef.current = null;
        flushActiveEraseStroke();
      });
    }
  };

  const endEraseStroke = () => {
    if (!activeEraseRef.current) return;
    if (eraseRafRef.current !== null) {
      cancelAnimationFrame(eraseRafRef.current);
      eraseRafRef.current = null;
    }
    flushActiveEraseStroke();
    activeEraseRef.current = null;
  };

  const handleWorkspaceDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  };

  const handleWorkspaceDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleWorkspaceDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleWorkspaceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const dropPt = getCanvasPointFromClient(e.clientX, e.clientY);
    const { images, pfxDoc } = await extractFromDataTransfer(e.dataTransfer);
    const state = useEditorStore.getState();

    if (pfxDoc) {
      state.setDocument(pfxDoc, true);
      state.showToast(`Opened "${pfxDoc.name}"`);
      return;
    }

    if (images.length > 0) {
      insertLoadedImages(images, { x: dropPt.x, y: dropPt.y });
      return;
    }

    state.showToast('Unsupported drop — drop PNG, JPG, WebP, SVG, web image, or .pfx file');
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isIsolatedErasePage) return;
    const pt = getCanvasPointFromClient(e.clientX, e.clientY);
    const stage = stageRef.current;
    let hitLayerId: string | null = null;
    if (stage && pt.insideStage) {
      const rect = stage.container().getBoundingClientRect();
      const shape = stage.getIntersection({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      if (shape && shape.id()) {
        const found = doc.layers.find((l) => l.id === shape.id());
        if (found) {
          hitLayerId = found.id;
          if (!selectedIds.includes(found.id)) {
            selectLayer(found.id);
          }
        }
      }
    }

    const menuWidth = 216;
    const menuHeight = hitLayerId || selectedIds.length > 0 ? 330 : 140;
    const clampedX = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    setContextMenu({
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      canvasX: pt.x,
      canvasY: pt.y,
      targetLayerId: hitLayerId ?? (selectedIds.length === 1 ? selectedIds[0] : null),
    });
  };

  const singleSelectedLayer = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return doc.layers.find((l) => l.id === selectedIds[0]) ?? null;
  }, [selectedIds, doc.layers]);

  const contextLayer = useMemo(() => {
    if (!contextMenu?.targetLayerId) return null;
    return doc.layers.find((l) => l.id === contextMenu.targetLayerId) ?? null;
  }, [contextMenu, doc.layers]);

  const gridLines = useMemo(() => {
    if (!gridEnabled) return [];
    const lines: number[][] = [];
    for (let x = gridSize; x < doc.width; x += gridSize) {
      lines.push([x, 0, x, doc.height]);
    }
    for (let y = gridSize; y < doc.height; y += gridSize) {
      lines.push([0, y, doc.width, y]);
    }
    return lines;
  }, [gridEnabled, gridSize, doc.width, doc.height]);

  return (
    <div
      ref={containerRef}
      data-testid={isIsolatedErasePage ? 'isolated-erase-page' : 'editor-canvas-page'}
      onWheel={handleWheel}
      onPointerDown={(e) => {
        if (contextMenu) setContextMenu(null);
        handleWorkspacePointerDown(e);
      }}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={handleWorkspacePointerUp}
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
      onContextMenu={handleContextMenu}
      className={`relative flex-1 overflow-hidden ${
        isIsolatedErasePage ? 'bg-[#0e1116]' : 'bg-[#13151a]'
      } flex items-center justify-center ${
        spacePressed || isPanning
          ? 'cursor-grab'
          : interactionMode === 'eyedropper' ||
            interactionMode === 'draw' ||
            interactionMode === 'bezier' ||
            interactionMode === 'erase'
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(45,140,255,0.05) 0%, rgba(19,21,26,0) 65%)',
        }}
      />

      {interactionMode !== 'select' && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#20242d]/95 border border-[#2d8cff]/50 text-xs text-slate-200 shadow-lg whitespace-nowrap">
          <span>
            {interactionMode === 'draw' && 'Freehand Draw Mode — Drag on canvas to paint'}
            {interactionMode === 'bezier' && 'Bezier Path Mode — Click to add anchors, drag points & handles'}
            {interactionMode === 'eyedropper' && 'Eyedropper — Click anywhere on canvas to pick color'}
            {interactionMode === 'perspective' && 'Perspective Warp — Drag the 4 corner handles'}
            {interactionMode === 'mask' && 'Mask Cutout — Drag red mask vertices over object'}
            {interactionMode === 'erase' &&
              `Pixel Eraser (${eraserSession.mode === 'restore' ? 'Restore' : 'Erase'} · ${eraserSession.brushSize}px) — Drag over layer to ${eraserSession.mode}`}
          </span>
        </div>
      )}

      {/* Native Konva Scaled Stage */}
      <div
        style={{
          width: doc.width * zoom,
          height: doc.height * zoom,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
        className="relative shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10 shrink-0"
      >
        <Stage
          ref={stageRef}
          width={doc.width * zoom}
          height={doc.height * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(e) => {
            if (spacePressed || e.evt.button === 2) return;
            const pos = getCanvasPointer();

            if (interactionMode === 'eyedropper') {
              handleEyedropperClick(pos);
              return;
            }
            if (interactionMode === 'erase') {
              startEraseAt(pos);
              return;
            }
            if (interactionMode === 'draw') {
              isDrawingRef.current = true;
              currentStrokeRef.current = [pos.x, pos.y];
              setLivePreviewPoints([pos.x, pos.y]);
              return;
            }
            if (interactionMode === 'bezier') {
              if (e.target === e.target.getStage() || e.target.name() === 'bg-hit') {
                const newAnchor: BezierAnchor = {
                  x: pos.x,
                  y: pos.y,
                  cp1x: pos.x - 35,
                  cp1y: pos.y,
                  cp2x: pos.x + 35,
                  cp2y: pos.y,
                };
                updateBezierSession({ anchors: [...bezierSession.anchors, newAnchor] });
              }
              return;
            }
            if (!isIsolatedErasePage && (e.target === e.target.getStage() || e.target.name() === 'bg-hit')) {
              selectLayer(null);
            }
          }}
          onTouchStart={(e) => {
            if (spacePressed || interactionMode !== 'erase') return;
            e.evt.preventDefault();
            const pos = getCanvasPointer();
            updateEraseCursor(pos);
            startEraseAt(pos);
          }}
          onMouseMove={(e) => {
            if (interactionMode === 'eyedropper') {
              const pos = getCanvasPointer();
              const hex = getEyedropperHexAt(pos);
              const badge = eyedropperBadgeRef.current;
              if (badge) {
                if (hex) {
                  badge.style.opacity = '1';
                  badge.style.transform = `translate3d(${e.evt.clientX + 14}px, ${e.evt.clientY + 14}px, 0)`;
                  const swatch = badge.firstElementChild as HTMLElement | null;
                  const label = badge.lastElementChild as HTMLElement | null;
                  if (swatch) swatch.style.backgroundColor = hex;
                  if (label) label.textContent = hex.toUpperCase();
                } else {
                  badge.style.opacity = '0';
                }
              }
              return;
            }
            if (interactionMode === 'erase') {
              const pos = getCanvasPointer();
              updateEraseCursor(pos);
              if (activeEraseRef.current) {
                moveEraseTo(pos);
              }
              return;
            }
            if (interactionMode === 'draw' && isDrawingRef.current) {
              const pos = getCanvasPointer();
              currentStrokeRef.current = [...currentStrokeRef.current, pos.x, pos.y];
              setLivePreviewPoints(currentStrokeRef.current);
            }
          }}
          onTouchMove={(e) => {
            if (interactionMode !== 'erase' || !activeEraseRef.current) return;
            e.evt.preventDefault();
            const pos = getCanvasPointer();
            updateEraseCursor(pos);
            moveEraseTo(pos);
          }}
          onMouseLeave={() => {
            if (interactionMode === 'erase') {
              updateEraseCursor(null);
            }
            if (eyedropperBadgeRef.current) {
              eyedropperBadgeRef.current.style.opacity = '0';
            }
          }}
          onMouseUp={() => {
            if (interactionMode === 'erase') {
              endEraseStroke();
              return;
            }
            if (interactionMode === 'draw' && isDrawingRef.current) {
              isDrawingRef.current = false;
              if (currentStrokeRef.current.length >= 4) {
                addDrawStroke({
                  points: currentStrokeRef.current,
                  color: drawSession.brushColor,
                  size: drawSession.brushSize,
                  opacity: drawSession.brushOpacity,
                  isEraser: drawSession.isEraser,
                });
              }
              currentStrokeRef.current = [];
              setLivePreviewPoints([]);
            }
          }}
          onTouchEnd={() => {
            if (interactionMode === 'erase') {
              endEraseStroke();
              updateEraseCursor(null);
            }
          }}
        >
          {/* Layer 1: Background (Strictly transparent checkerboard on Isolated Erase Page) */}
          <Layer>
            {isIsolatedErasePage || doc.background.mode === 'transparent' ? (
              <KonvaImage
                image={checkerCanvas}
                width={doc.width}
                height={doc.height}
                name="bg-hit"
                perfectDrawEnabled={false}
              />
            ) : (
              <KonvaImage
                image={backgroundCanvas}
                width={doc.width}
                height={doc.height}
                name="bg-hit"
                perfectDrawEnabled={false}
              />
            )}
          </Layer>

          {/* Layer 2: User Design Objects (Only selected target layer visible on Isolated Erase Page) */}
          <Layer>
            {doc.layers
              .filter((layer) => !isIsolatedErasePage || layer.id === singleSelectedLayer?.id)
              .map((layer) => (
                <RenderedLayerNode
                  key={layer.id}
                  layer={layer}
                  isLocked={isIsolatedErasePage || layer.locked || interactionMode !== 'select'}
                  viewportScale={viewportScale}
                  registerRef={registerNodeRef}
                  onSelect={handleLayerSelect}
                  onDoubleClick={handleLayerDoubleClick}
                  onDragSnap={handleDragSnap}
                  onDragDone={handleLayerDragDone}
                  onChangeEnd={handleLayerChangeEnd}
                />
              ))}
          </Layer>

          {/* Layer 3: Isolated Active Draw Strokes Layer (so eraser never punches holes in lower layers) */}
          {interactionMode === 'draw' && (
            <Layer>
              {drawSession.strokes.map((s, idx) => (
                <Line
                  key={idx}
                  points={s.points}
                  stroke={s.isEraser ? '#000000' : s.color}
                  strokeWidth={s.size}
                  opacity={s.isEraser ? 1 : s.opacity}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={s.isEraser ? 'destination-out' : 'source-over'}
                />
              ))}
              {livePreviewPoints.length >= 2 && (
                <Line
                  points={livePreviewPoints}
                  stroke={drawSession.isEraser ? '#000000' : drawSession.brushColor}
                  strokeWidth={drawSession.brushSize}
                  opacity={drawSession.isEraser ? 1 : drawSession.brushOpacity}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={drawSession.isEraser ? 'destination-out' : 'source-over'}
                />
              )}
            </Layer>
          )}

          {/* Layer 4: Grid, Snap Guides, Bezier, Perspective, Mask & Transformer */}
          <Layer>
            {gridEnabled &&
              gridLines.map((pts, i) => (
                <Line
                  key={i}
                  points={pts}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1 / zoom}
                  listening={false}
                />
              ))}

            {gridEnabled && (
              <>
                <Line
                  points={[doc.width / 2, 0, doc.width / 2, doc.height]}
                  stroke="rgba(45,140,255,0.45)"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                <Line
                  points={[0, doc.height / 2, doc.width, doc.height / 2]}
                  stroke="rgba(45,140,255,0.45)"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
              </>
            )}

            {snapLines.x !== null && (
              <Line
                points={[snapLines.x, 0, snapLines.x, doc.height]}
                stroke="#38bdf8"
                strokeWidth={2 / zoom}
                dash={[8, 6]}
                listening={false}
              />
            )}
            {snapLines.y !== null && (
              <Line
                points={[0, snapLines.y, doc.width, snapLines.y]}
                stroke="#38bdf8"
                strokeWidth={2 / zoom}
                dash={[8, 6]}
                listening={false}
              />
            )}

            {interactionMode === 'bezier' && bezierSession.anchors.length > 0 && (
              <Group>
                {bezierSession.anchors.map((a, i) => {
                  if (i === 0) return null;
                  const prev = bezierSession.anchors[i - 1];
                  return (
                    <Line
                      key={`seg_${i}`}
                      points={[prev.x, prev.y, prev.cp2x, prev.cp2y, a.cp1x, a.cp1y, a.x, a.y]}
                      bezier
                      stroke={bezierSession.strokeColor}
                      strokeWidth={bezierSession.strokeWidth}
                      lineCap="round"
                      listening={false}
                    />
                  );
                })}
                {bezierSession.closed && bezierSession.anchors.length > 2 && (
                  <Line
                    points={[
                      bezierSession.anchors[bezierSession.anchors.length - 1].x,
                      bezierSession.anchors[bezierSession.anchors.length - 1].y,
                      bezierSession.anchors[bezierSession.anchors.length - 1].cp2x,
                      bezierSession.anchors[bezierSession.anchors.length - 1].cp2y,
                      bezierSession.anchors[0].cp1x,
                      bezierSession.anchors[0].cp1y,
                      bezierSession.anchors[0].x,
                      bezierSession.anchors[0].y,
                    ]}
                    bezier
                    stroke={bezierSession.strokeColor}
                    strokeWidth={bezierSession.strokeWidth}
                    listening={false}
                  />
                )}
                {bezierSession.anchors.map((a, idx) => (
                  <Group key={`anc_${idx}`}>
                    <Line
                      points={[a.cp1x, a.cp1y, a.x, a.y, a.cp2x, a.cp2y]}
                      stroke="#38bdf8"
                      strokeWidth={1.5 / zoom}
                      dash={[4, 4]}
                      listening={false}
                    />
                    <Circle
                      x={a.cp1x}
                      y={a.cp1y}
                      radius={6 / zoom}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      draggable
                      onDragMove={(e) => {
                        const next = [...bezierSession.anchors];
                        next[idx] = { ...next[idx], cp1x: e.target.x(), cp1y: e.target.y() };
                        updateBezierSession({ anchors: next });
                      }}
                    />
                    <Circle
                      x={a.cp2x}
                      y={a.cp2y}
                      radius={6 / zoom}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      draggable
                      onDragMove={(e) => {
                        const next = [...bezierSession.anchors];
                        next[idx] = { ...next[idx], cp2x: e.target.x(), cp2y: e.target.y() };
                        updateBezierSession({ anchors: next });
                      }}
                    />
                    <Circle
                      x={a.x}
                      y={a.y}
                      radius={8 / zoom}
                      fill="#2d8cff"
                      stroke="#ffffff"
                      strokeWidth={2 / zoom}
                      draggable
                      onDragMove={(e) => {
                        const dx = e.target.x() - a.x;
                        const dy = e.target.y() - a.y;
                        const next = [...bezierSession.anchors];
                        next[idx] = {
                          x: e.target.x(),
                          y: e.target.y(),
                          cp1x: a.cp1x + dx,
                          cp1y: a.cp1y + dy,
                          cp2x: a.cp2x + dx,
                          cp2y: a.cp2y + dy,
                        };
                        updateBezierSession({ anchors: next });
                      }}
                    />
                  </Group>
                ))}
              </Group>
            )}

            {interactionMode === 'perspective' && singleSelectedLayer && (
              <PerspectiveOverlay layer={singleSelectedLayer} zoom={zoom} />
            )}

            {interactionMode === 'mask' && singleSelectedLayer && (
              <MaskOverlay layer={singleSelectedLayer} zoom={zoom} />
            )}

            {interactionMode === 'erase' && (
              <Group ref={eraseCursorGroupRef} visible={false} listening={false}>
                <Circle
                  x={0}
                  y={0}
                  radius={Math.max(2, eraserSession.brushSize / 2)}
                  stroke={eraserSession.mode === 'restore' ? '#10b981' : '#f43f5e'}
                  strokeWidth={1.75 / zoom}
                  dash={[5 / zoom, 3 / zoom]}
                  fill={
                    eraserSession.mode === 'restore'
                      ? 'rgba(16,185,129,0.12)'
                      : 'rgba(244,63,94,0.12)'
                  }
                />
                <Circle x={0} y={0} radius={Math.max(1.2, 2 / zoom)} fill="#ffffff" />
              </Group>
            )}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              borderStroke="#2d8cff"
              borderStrokeWidth={1.5}
              anchorFill="#ffffff"
              anchorStroke="#2d8cff"
              anchorSize={9}
              anchorCornerRadius={2}
              padding={4}
              keepRatio={false}
            />
          </Layer>
        </Stage>
      </div>

      {/* Zero-render floating eyedropper color preview */}
      <div
        ref={eyedropperBadgeRef}
        data-testid="eyedropper-live-badge"
        className="pointer-events-none fixed top-0 left-0 z-50 flex items-center gap-1.5 rounded-md border border-white/20 bg-[#181b22]/95 px-2 py-1 text-[11px] font-mono tabular-nums text-white shadow-xl opacity-0 transition-opacity duration-75"
      >
        <span className="h-3.5 w-3.5 rounded-sm border border-white/30 bg-black" />
        <span>#000000</span>
      </div>

      <div className="pointer-events-none absolute bottom-2.5 left-3 px-2 py-0.5 rounded bg-[#1b1e26]/85 border border-white/10 text-[11px] font-mono tabular-nums text-slate-400">
        {doc.width} × {doc.height} px · {Math.round(zoom * 100)}%
      </div>

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div
          data-testid="canvas-drop-overlay"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0d1118]/70 backdrop-blur-[2px]"
        >
          <div className="mx-4 max-w-md rounded-xl border-2 border-dashed border-[#2d8cff] bg-[#1a1f29]/95 px-8 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2d8cff]/20 text-[#2d8cff]">
              <ImagePlus className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-white">Drop image or .pfx project onto canvas</p>
            <p className="mt-1 text-xs text-slate-400">
              Supports PNG, JPG, WebP, SVG, web images, multiple files, or .pfx project files
            </p>
          </div>
        </div>
      )}

      {/* Right-Click Canvas Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            data-testid="canvas-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-50 w-52 rounded-lg border border-white/15 bg-[#20242e] py-1.5 shadow-2xl"
          >
            <ContextMenuItem
              icon={<ClipboardPaste className="h-3.5 w-3.5 text-[#2d8cff]" />}
              label="Paste Image / Layer"
              shortcut="Ctrl+V"
              onClick={() => {
                const pos = { x: contextMenu.canvasX, y: contextMenu.canvasY };
                setContextMenu(null);
                handleAsyncClipboardPaste(pos);
              }}
            />
            <ContextMenuItem
              icon={<Type className="h-3.5 w-3.5 text-emerald-400" />}
              label="Add New Text"
              onClick={() => {
                setContextMenu(null);
                useEditorStore.getState().addTextLayer('New Text');
              }}
            />
            <ContextMenuItem
              icon={<Maximize2 className="h-3.5 w-3.5 text-slate-300" />}
              label="Fit Canvas"
              onClick={() => {
                setContextMenu(null);
                fitCanvas();
              }}
            />

            {(contextLayer || selectedIds.length > 0) && (
              <>
                <div className="my-1 border-t border-white/10" />
                <ContextMenuItem
                  icon={<Copy className="h-3.5 w-3.5 text-sky-400" />}
                  label="Copy Layer"
                  shortcut="Ctrl+C"
                  onClick={() => {
                    setContextMenu(null);
                    useEditorStore.getState().copySelected();
                  }}
                />
                <ContextMenuItem
                  icon={<Files className="h-3.5 w-3.5 text-indigo-400" />}
                  label="Duplicate"
                  shortcut="Ctrl+D"
                  onClick={() => {
                    const ids = useEditorStore.getState().selectedIds;
                    setContextMenu(null);
                    if (ids.length) useEditorStore.getState().duplicateLayers(ids);
                  }}
                />
                {contextLayer?.type === 'image' && (
                  <ContextMenuItem
                    icon={<Crop className="h-3.5 w-3.5 text-amber-400" />}
                    label="Crop Image"
                    onClick={() => {
                      setContextMenu(null);
                      openModal('cropLayer');
                    }}
                  />
                )}
                {contextLayer &&
                  (contextLayer.type === 'image' ||
                    contextLayer.type === 'sticker' ||
                    contextLayer.type === 'drawing') && (
                    <ContextMenuItem
                      icon={<Eraser className="h-3.5 w-3.5 text-rose-400" />}
                      label="Pixel Eraser"
                      onClick={() => {
                        setContextMenu(null);
                        setActiveTab('object');
                        setActiveTool('pixelEraser');
                      }}
                    />
                  )}
                {contextLayer && (
                  <>
                    <ContextMenuItem
                      icon={<ArrowUpToLine className="h-3.5 w-3.5 text-slate-300" />}
                      label="Bring to Front"
                      onClick={() => {
                        const id = contextLayer.id;
                        setContextMenu(null);
                        useEditorStore.getState().bringToFront(id);
                      }}
                    />
                    <ContextMenuItem
                      icon={<ArrowDownToLine className="h-3.5 w-3.5 text-slate-300" />}
                      label="Send to Back"
                      onClick={() => {
                        const id = contextLayer.id;
                        setContextMenu(null);
                        useEditorStore.getState().sendToBack(id);
                      }}
                    />
                    <ContextMenuItem
                      icon={
                        contextLayer.locked ? (
                          <Unlock className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-slate-300" />
                        )
                      }
                      label={contextLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
                      onClick={() => {
                        const id = contextLayer.id;
                        setContextMenu(null);
                        useEditorStore.getState().toggleLock(id);
                      }}
                    />
                  </>
                )}
                <ContextMenuItem
                  icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />}
                  label="Delete"
                  shortcut="Del"
                  danger
                  onClick={() => {
                    const ids = useEditorStore.getState().selectedIds;
                    setContextMenu(null);
                    if (ids.length) useEditorStore.getState().deleteLayers(ids);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ContextMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
      danger ? 'text-rose-300 hover:bg-rose-500/15' : 'text-slate-200 hover:bg-white/10'
    }`}
  >
    <span className="flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </span>
    {shortcut && <span className="text-[10px] font-mono text-slate-500">{shortcut}</span>}
  </button>
);



const PerspectiveOverlay: React.FC<{ layer: LayerObject; zoom: number }> = ({ layer, zoom }) => {
  const { updateLayer } = useEditorStore();
  const { w, h } = getLayerCoreBox(layer);
  const p = layer.perspective;

  const corners: { key: 'tl' | 'tr' | 'br' | 'bl'; bx: number; by: number; off: { x: number; y: number } }[] = [
    { key: 'tl', bx: -w / 2, by: -h / 2, off: p.tl },
    { key: 'tr', bx: w / 2, by: -h / 2, off: p.tr },
    { key: 'br', bx: w / 2, by: h / 2, off: p.br },
    { key: 'bl', bx: -w / 2, by: h / 2, off: p.bl },
  ];

  const pts = corners.flatMap((c) => [c.bx + c.off.x * w, c.by + c.off.y * h]);

  return (
    <Group x={layer.x} y={layer.y} rotation={layer.rotation} scaleX={layer.scaleX} scaleY={layer.scaleY}>
      <Line points={[...pts, pts[0], pts[1]]} stroke="#38bdf8" strokeWidth={2 / zoom} dash={[6, 4]} listening={false} />
      {corners.map((c) => (
        <Circle
          key={c.key}
          x={c.bx + c.off.x * w}
          y={c.by + c.off.y * h}
          radius={8 / (zoom * Math.max(0.4, Math.abs(layer.scaleX)))}
          fill="#2d8cff"
          stroke="#ffffff"
          strokeWidth={2 / zoom}
          draggable
          onDragMove={(e) => {
            const nx = (e.target.x() - c.bx) / Math.max(40, w);
            const ny = (e.target.y() - c.by) / Math.max(40, h);
            updateLayer(layer.id, {
              perspective: {
                ...p,
                enabled: true,
                [c.key]: {
                  x: Math.max(-0.48, Math.min(0.48, nx)),
                  y: Math.max(-0.48, Math.min(0.48, ny)),
                },
              },
            });
          }}
        />
      ))}
    </Group>
  );
};

const MaskOverlay: React.FC<{ layer: LayerObject; zoom: number }> = ({ layer, zoom }) => {
  const { updateLayer } = useEditorStore();
  const { w, h } = getLayerCoreBox(layer);
  const pts = layer.mask.points.flatMap((pt) => [(pt.x - 0.5) * w, (pt.y - 0.5) * h]);

  return (
    <Group x={layer.x} y={layer.y} rotation={layer.rotation} scaleX={layer.scaleX} scaleY={layer.scaleY}>
      <Line
        points={pts.length >= 2 ? [...pts, pts[0], pts[1]] : []}
        stroke="#f43f5e"
        strokeWidth={2 / zoom}
        dash={[6, 4]}
        listening={false}
      />
      {layer.mask.points.map((pt, idx) => (
        <Circle
          key={idx}
          x={(pt.x - 0.5) * w}
          y={(pt.y - 0.5) * h}
          radius={8 / (zoom * Math.max(0.4, Math.abs(layer.scaleX)))}
          fill="#f43f5e"
          stroke="#ffffff"
          strokeWidth={2 / zoom}
          draggable
          onDragMove={(e) => {
            const next = [...layer.mask.points];
            next[idx] = {
              x: Math.max(0, Math.min(1, e.target.x() / Math.max(20, w) + 0.5)),
              y: Math.max(0, Math.min(1, e.target.y() / Math.max(20, h) + 0.5)),
            };
            updateLayer(layer.id, {
              mask: { ...layer.mask, enabled: true, points: next },
            });
          }}
        />
      ))}
    </Group>
  );
};
