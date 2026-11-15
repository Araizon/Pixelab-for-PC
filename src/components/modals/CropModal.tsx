import React, { useEffect, useRef, useState } from 'react';
import { Crop, X } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ImageLayer } from '../../types/editor';

export const CropModal: React.FC = () => {
  const {
    activeModal,
    openModal,
    document: doc,
    selectedIds,
    pendingImportImages,
    setPendingImportImages,
    addImageLayer,
    cropCanvas,
    cropImageLayer,
  } = useEditorStore();

  const isImportCrop = activeModal === 'cropImport';
  const isCanvasCrop = activeModal === 'cropCanvas';
  const isLayerCrop = activeModal === 'cropLayer';
  const pending = pendingImportImages[0];
  const targetImageLayer = isLayerCrop
    ? (doc.layers.find((l) => l.id === selectedIds[0] && l.type === 'image') as ImageLayer | undefined)
    : undefined;

  const srcW =
    isImportCrop && pending
      ? pending.naturalWidth
      : isLayerCrop && targetImageLayer
      ? targetImageLayer.naturalWidth
      : doc.width;
  const srcH =
    isImportCrop && pending
      ? pending.naturalHeight
      : isLayerCrop && targetImageLayer
      ? targetImageLayer.naturalHeight
      : doc.height;

  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(srcW);
  const [cropH, setCropH] = useState(srcH);

  const dragRef = useRef<{
    kind: 'move' | 'nw' | 'se';
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    setCropX(0);
    setCropY(0);
    setCropW(srcW);
    setCropH(srcH);
  }, [activeModal, srcW, srcH]);

  if (!isImportCrop && !isCanvasCrop && !isLayerCrop) return null;
  if (isImportCrop && !pending) return null;
  if (isLayerCrop && !targetImageLayer) return null;

  const previewMax = 280;
  const scale = Math.min(previewMax / srcW, previewMax / srcH);
  const dispW = srcW * scale;
  const dispH = srcH * scale;

  const applyAspect = (rw: number, rh: number) => {
    const targetRatio = rw / rh;
    let w = srcW;
    let h = Math.round(w / targetRatio);
    if (h > srcH) {
      h = srcH;
      w = Math.round(h * targetRatio);
    }
    setCropW(w);
    setCropH(h);
    setCropX(Math.round((srcW - w) / 2));
    setCropY(Math.round((srcH - h) / 2));
  };

  const handleConfirm = () => {
    const safeX = Math.max(0, Math.min(srcW - 10, Math.round(cropX)));
    const safeY = Math.max(0, Math.min(srcH - 10, Math.round(cropY)));
    const safeW = Math.max(20, Math.min(srcW - safeX, Math.round(cropW)));
    const safeH = Math.max(20, Math.min(srcH - safeY, Math.round(cropH)));

    if (isImportCrop && pending) {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = safeW;
        off.height = safeH;
        off.getContext('2d')!.drawImage(img, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH);
        const croppedUrl = off.toDataURL('image/png');
        addImageLayer(croppedUrl, safeW, safeH, pending.name);
        setPendingImportImages([]);
        openModal(null);
      };
      img.src = pending.src;
      return;
    }

    if (isLayerCrop && targetImageLayer) {
      cropImageLayer(targetImageLayer.id, safeX, safeY, safeW, safeH);
      openModal(null);
      return;
    }

    cropCanvas(safeX, safeY, safeW, safeH);
    openModal(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startMouseX) / scale;
    const dy = (e.clientY - d.startMouseY) / scale;
    if (d.kind === 'move') {
      setCropX(Math.round(Math.max(0, Math.min(srcW - d.startW, d.startX + dx))));
      setCropY(Math.round(Math.max(0, Math.min(srcH - d.startH, d.startY + dy))));
    } else if (d.kind === 'se') {
      setCropW(Math.round(Math.max(20, Math.min(srcW - d.startX, d.startW + dx))));
      setCropH(Math.round(Math.max(20, Math.min(srcH - d.startY, d.startH + dy))));
    } else if (d.kind === 'nw') {
      const nx = Math.max(0, Math.min(d.startX + d.startW - 20, d.startX + dx));
      const ny = Math.max(0, Math.min(d.startY + d.startH - 20, d.startY + dy));
      setCropX(Math.round(nx));
      setCropY(Math.round(ny));
      setCropW(Math.round(d.startW - (nx - d.startX)));
      setCropH(Math.round(d.startH - (ny - d.startY)));
    }
  };

  const previewSrc = isImportCrop && pending ? pending.src : targetImageLayer?.src;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        dragRef.current = null;
      }}
    >
      <div className="w-full max-w-lg bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-[#2d8cff]" />
            <h2 className="text-sm font-semibold text-white">
              {isImportCrop
                ? 'Crop Image Before Insert'
                : isLayerCrop
                ? 'Crop Selected Image'
                : 'Crop Canvas'}
            </h2>
          </div>
          <button
            onClick={() => {
              setPendingImportImages([]);
              openModal(null);
            }}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Aspect presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setCropX(0);
                setCropY(0);
                setCropW(srcW);
                setCropH(srcH);
              }}
              className="px-2.5 py-1 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 cursor-pointer"
            >
              Original
            </button>
            {[
              ['1:1', 1, 1],
              ['16:9', 16, 9],
              ['4:3', 4, 3],
              ['4:5', 4, 5],
              ['9:16', 9, 16],
            ].map(([label, rw, rh]) => (
              <button
                key={String(label)}
                onClick={() => applyAspect(Number(rw), Number(rh))}
                className="px-2.5 py-1 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Interactive drag-to-crop preview box */}
          <div className="h-72 bg-[#14171d] rounded-lg border border-white/10 flex items-center justify-center">
            <div
              style={{ width: dispW, height: dispH }}
              className="relative bg-[#262a34] overflow-hidden border border-white/20"
            >
              {previewSrc && (
                <img
                  src={previewSrc}
                  alt="Crop preview"
                  draggable={false}
                  className="w-full h-full object-fill opacity-55 pointer-events-none"
                />
              )}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = {
                    kind: 'move',
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startX: cropX,
                    startY: cropY,
                    startW: cropW,
                    startH: cropH,
                  };
                }}
                style={{
                  left: cropX * scale,
                  top: cropY * scale,
                  width: cropW * scale,
                  height: cropH * scale,
                }}
                className="absolute border-2 border-[#2d8cff] bg-[#2d8cff]/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] cursor-move"
              >
                {/* NW corner resize handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = {
                      kind: 'nw',
                      startMouseX: e.clientX,
                      startMouseY: e.clientY,
                      startX: cropX,
                      startY: cropY,
                      startW: cropW,
                      startH: cropH,
                    };
                  }}
                  className="absolute -left-2 -top-2 w-4 h-4 rounded-sm bg-white border-2 border-[#2d8cff] cursor-nwse-resize"
                />
                {/* SE corner resize handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = {
                      kind: 'se',
                      startMouseX: e.clientX,
                      startMouseY: e.clientY,
                      startX: cropX,
                      startY: cropY,
                      startW: cropW,
                      startH: cropH,
                    };
                  }}
                  className="absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-white border-2 border-[#2d8cff] cursor-nwse-resize"
                />
              </div>
            </div>
          </div>

          {/* Numeric crop controls */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">X</span>
              <input
                type="number"
                value={cropX}
                onChange={(e) => setCropX(Math.max(0, Number(e.target.value)))}
                className="w-full h-8 px-2 rounded bg-[#14171d] border border-white/15 font-mono tabular-nums text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Y</span>
              <input
                type="number"
                value={cropY}
                onChange={(e) => setCropY(Math.max(0, Number(e.target.value)))}
                className="w-full h-8 px-2 rounded bg-[#14171d] border border-white/15 font-mono tabular-nums text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Width</span>
              <input
                type="number"
                value={cropW}
                onChange={(e) => setCropW(Math.max(20, Number(e.target.value)))}
                className="w-full h-8 px-2 rounded bg-[#14171d] border border-white/15 font-mono tabular-nums text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">Height</span>
              <input
                type="number"
                value={cropH}
                onChange={(e) => setCropH(Math.max(20, Number(e.target.value)))}
                className="w-full h-8 px-2 rounded bg-[#14171d] border border-white/15 font-mono tabular-nums text-white"
              />
            </label>
          </div>
        </div>

        <div className="px-4 py-3 bg-[#171a21] border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setPendingImportImages([]);
              openModal(null);
            }}
            className="h-8 px-4 rounded-md bg-[#262a34] hover:bg-[#303542] text-xs font-medium text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="h-8 px-4 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white cursor-pointer"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};
