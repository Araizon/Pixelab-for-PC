import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../store/useEditorStore';
import { BezierAnchor, LayerObject } from '../types/editor';
import {
  createGradient,
  getCachedImage,
  getLayerCoreBox,
  getLayerVisualCacheKey,
  hexToRgba,
  renderFullLayerToCanvas,
} from '../utils/canvasEffects';

interface LayerNodeProps {
  layer: LayerObject;
  isLocked: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDoubleClick: () => void;
  onChangeEnd: (patch: Partial<LayerObject>) => void;
  onDragSnap: (node: Konva.Node) => void;
  onDragDone: () => void;
  registerRef: (id: string, node: Konva.Image | null) => void;
}

const RenderedLayerNode: React.FC<LayerNodeProps> = React.memo(
  ({
    layer,
    isLocked,
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

    const rendered = useMemo(() => {
      return renderFullLayerToCanvas(layer, () => setAssetTick((t) => t + 1));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visualKey, assetTick]);

    useEffect(() => {
      registerRef(layer.id, nodeRef.current);
      return () => registerRef(layer.id, null);
    }, [layer.id, registerRef]);

    const canvasW = rendered.canvas.width;
    const canvasH = rendered.canvas.height;
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
        onMouseDown={onSelect}
        onTouchStart={onSelect}
        onDblClick={onDoubleClick}
        onDblTap={onDoubleClick}
        onDragMove={(e) => onDragSnap(e.target)}
        onDragEnd={(e) => {
          onDragDone();
          onChangeEnd({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          onChangeEnd({
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

  const {
    document: doc,
    selectedIds,
    zoom,
    pan,
    gridEnabled,
    snapEnabled,
    gridSize,
    interactionMode,
    eyedropperCallback,
    drawSession,
    bezierSession,
    selectLayer,
    updateLayer,
    pushHistory,
    setZoom,
    setPan,
    openModal,
    setStageGetters,
    addDrawStroke,
    updateBezierSession,
    setInteractionMode,
    showToast,
  } = useEditorStore();

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

  // Spacebar pan & keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        useEditorStore.getState().copySelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        useEditorStore.getState().pasteClipboard();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const ids = useEditorStore.getState().selectedIds;
        if (ids.length) useEditorStore.getState().duplicateLayers(ids);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState();
        if (state.interactionMode === 'select' && state.selectedIds.length) {
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
        if (state.interactionMode === 'select' && state.selectedIds.length) {
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
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

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
    if (interactionMode !== 'select') {
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
  }, [selectedIds, doc.layers, interactionMode]);

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
        const res = renderFullLayerToCanvas(layer);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.scaleX, layer.scaleY);
        const ox = res.offsetX + res.coreWidth / 2;
        const oy = res.offsetY + res.coreHeight / 2;
        ctx.drawImage(res.canvas, -ox, -oy);
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

  // Use Konva's built-in relative pointer coordinates so zoom is always handled accurately!
  const getCanvasPointer = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getRelativePointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return { x: pos.x, y: pos.y };
  };

  const handleEyedropperClick = (pos: { x: number; y: number }) => {
    const temp = document.createElement('canvas');
    temp.width = doc.width;
    temp.height = doc.height;
    const ctx = temp.getContext('2d')!;
    if (doc.background.mode !== 'transparent') {
      ctx.drawImage(backgroundCanvas, 0, 0);
    }
    for (const l of doc.layers) {
      if (!l.visible) continue;
      const res = renderFullLayerToCanvas(l);
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.translate(l.x, l.y);
      ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.scale(l.scaleX, l.scaleY);
      ctx.drawImage(res.canvas, -(res.offsetX + res.coreWidth / 2), -(res.offsetY + res.coreHeight / 2));
      ctx.restore();
    }
    const px = Math.max(0, Math.min(doc.width - 1, Math.round(pos.x)));
    const py = Math.max(0, Math.min(doc.height - 1, Math.round(pos.y)));
    const data = ctx.getImageData(px, py, 1, 1).data;
    const hex = `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    eyedropperCallback?.(hex);
    setInteractionMode('select');
    showToast(`Picked ${hex.toUpperCase()}`);
  };

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
  };

  const singleSelectedLayer = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return doc.layers.find((l) => l.id === selectedIds[0]) ?? null;
  }, [selectedIds, doc.layers]);

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
      onWheel={handleWheel}
      onPointerDown={handleWorkspacePointerDown}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={handleWorkspacePointerUp}
      className={`relative flex-1 overflow-hidden bg-[#13151a] flex items-center justify-center ${
        spacePressed || isPanning
          ? 'cursor-grab'
          : interactionMode === 'eyedropper' || interactionMode === 'draw' || interactionMode === 'bezier'
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#20242d]/95 border border-[#2d8cff]/50 text-xs text-slate-200 shadow-lg">
          <span>
            {interactionMode === 'draw' && 'Freehand Draw Mode — Drag on canvas to paint'}
            {interactionMode === 'bezier' && 'Bezier Path Mode — Click to add anchors, drag points & handles'}
            {interactionMode === 'eyedropper' && 'Eyedropper — Click anywhere on canvas to pick color'}
            {interactionMode === 'perspective' && 'Perspective Warp — Drag the 4 corner handles'}
            {interactionMode === 'mask' && 'Mask Cutout — Drag red mask vertices over object'}
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
            if (spacePressed) return;
            const pos = getCanvasPointer();

            if (interactionMode === 'eyedropper') {
              handleEyedropperClick(pos);
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
            if (e.target === e.target.getStage() || e.target.name() === 'bg-hit') {
              selectLayer(null);
            }
          }}
          onMouseMove={() => {
            if (interactionMode === 'draw' && isDrawingRef.current) {
              const pos = getCanvasPointer();
              currentStrokeRef.current = [...currentStrokeRef.current, pos.x, pos.y];
              setLivePreviewPoints(currentStrokeRef.current);
            }
          }}
          onMouseUp={() => {
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
        >
          {/* Layer 1: Background */}
          <Layer>
            {doc.background.mode === 'transparent' ? (
              <KonvaImage image={checkerCanvas} width={doc.width} height={doc.height} name="bg-hit" />
            ) : (
              <KonvaImage image={backgroundCanvas} width={doc.width} height={doc.height} name="bg-hit" />
            )}
          </Layer>

          {/* Layer 2: User Design Objects */}
          <Layer>
            {doc.layers.map((layer) => (
              <RenderedLayerNode
                key={layer.id}
                layer={layer}
                isLocked={layer.locked || interactionMode !== 'select'}
                registerRef={registerNodeRef}
                onSelect={(e) => {
                  if (interactionMode !== 'select' || spacePressed) return;
                  e.cancelBubble = true;
                  selectLayer(layer.id, e.evt.shiftKey);
                }}
                onDoubleClick={() => {
                  if (layer.locked || interactionMode !== 'select') return;
                  if (layer.type === 'text') {
                    openModal('textEdit');
                  } else if (layer.type === 'path') {
                    useEditorStore.getState().startBezierMode(layer.id);
                  }
                }}
                onDragSnap={handleDragSnap}
                onDragDone={() => setSnapLines({ x: null, y: null })}
                onChangeEnd={(patch) => {
                  pushHistory();
                  updateLayer(layer.id, patch, false);
                }}
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

      <div className="pointer-events-none absolute bottom-2.5 left-3 px-2 py-0.5 rounded bg-[#1b1e26]/85 border border-white/10 text-[11px] font-mono tabular-nums text-slate-400">
        {doc.width} × {doc.height} px · {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};



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
