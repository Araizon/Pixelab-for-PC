import React from 'react';
import {
  ArrowLeft,
  Check,
  Eraser,
  Maximize2,
  Redo2,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const IsolatedEraseHeader: React.FC = () => {
  const {
    document: doc,
    selectedIds,
    activeTool,
    historyPast,
    historyFuture,
    zoom,
    setActiveTool,
    exitErasePage,
    undo,
    redo,
    setZoom,
  } = useEditorStore();

  const selectedLayer =
    selectedIds.length === 1 ? doc.layers.find((l) => l.id === selectedIds[0]) ?? null : null;
  const canEraseColor =
    selectedLayer?.type === 'image' || selectedLayer?.type === 'sticker';

  return (
    <header
      data-testid="isolated-erase-header"
      className="h-12 bg-[#1a1d25] border-b border-[#2d8cff]/35 px-3 flex items-center justify-between gap-2 select-none shrink-0 z-30"
    >
      {/* Left: Back & Layer Label */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={exitErasePage}
          data-testid="isolated-erase-back-btn"
          className="h-8 px-2.5 rounded-md bg-[#262a34] hover:bg-[#313644] border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
          title="Return to main canvas (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 min-w-0 pl-1">
          <span className="text-xs font-semibold text-white whitespace-nowrap">
            Transparent Erase Page
          </span>
          {selectedLayer && (
            <span className="hidden sm:inline-block max-w-[160px] truncate px-2 py-0.5 rounded bg-[#242834] border border-white/10 text-[11px] text-sky-300">
              {selectedLayer.name}
            </span>
          )}
        </div>
      </div>

      {/* Center: Quick Switcher between Pixel Eraser and Color Eraser */}
      <div className="flex items-center gap-1 bg-[#12151b] p-0.5 rounded-md border border-white/10 shrink-0">
        <button
          onClick={() => {
            if (activeTool !== 'pixelEraser') setActiveTool('pixelEraser');
          }}
          className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
            activeTool === 'pixelEraser'
              ? 'bg-[#2d8cff] text-white'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Pixel Eraser</span>
        </button>

        {canEraseColor && (
          <button
            onClick={() => {
              if (activeTool !== 'eraseColor') setActiveTool('eraseColor');
            }}
            className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTool === 'eraseColor'
                ? 'bg-[#2d8cff] text-white'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Erase Color</span>
          </button>
        )}
      </div>

      {/* Right: Undo/Redo, Zoom, Done */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={undo}
          disabled={historyPast.length === 0}
          title="Undo (Ctrl+Z)"
          className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={historyFuture.length === 0}
          title="Redo (Ctrl+Y)"
          className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="hidden md:flex items-center bg-[#232730] border border-white/10 rounded-md overflow-hidden mx-1">
          <button
            onClick={() => setZoom(zoom - 0.15)}
            title="Zoom Out"
            className="h-8 w-7 text-slate-300 hover:bg-white/10 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('pixellab:fit-canvas'))}
            title="Fit to Screen"
            className="h-8 px-2 text-xs font-mono tabular-nums text-slate-200 hover:bg-white/10 cursor-pointer flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3 text-slate-400" />
            <span>{Math.round(zoom * 100)}%</span>
          </button>
          <button
            onClick={() => setZoom(zoom + 0.15)}
            title="Zoom In"
            className="h-8 w-7 text-slate-300 hover:bg-white/10 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={exitErasePage}
          data-testid="isolated-erase-done-btn"
          className="h-8 px-3 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </button>
      </div>
    </header>
  );
};
