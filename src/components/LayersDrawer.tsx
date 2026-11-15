import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Combine,
  Copy,
  Eye,
  EyeOff,
  FolderClosed,
  Image as ImageIcon,
  Lock,
  PenTool,
  Pencil,
  Shapes,
  Smile,
  Square,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  X,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { LayerObject } from '../types/editor';

export const LayersDrawer: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const {
    document: doc,
    selectedIds,
    layersDrawerOpen,
    setLayersDrawerOpen,
    selectLayer,
    selectMultiple,
    toggleVisibility,
    toggleLock,
    renameLayer,
    duplicateLayers,
    deleteLayers,
    reorderLayer,
    groupSelected,
    ungroupSelected,
    mergeLayers,
  } = useEditorStore();

  if (!layersDrawerOpen) return null;

  // Display top-most layer first (reverse of doc.layers rendering order)
  const reversed = [...doc.layers].map((layer, actualIndex) => ({ layer, actualIndex })).reverse();

  const hasGroupedSelection = doc.layers.some(
    (l) => selectedIds.includes(l.id) && Boolean(l.groupId)
  );

  const iconForLayer = (l: LayerObject) => {
    switch (l.type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-[#2d8cff]" />;
      case 'shape':
        return <Shapes className="w-3.5 h-3.5 text-sky-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />;
      case 'sticker':
        return <Smile className="w-3.5 h-3.5 text-amber-400" />;
      case 'drawing':
        return <Pencil className="w-3.5 h-3.5 text-rose-400" />;
      case 'path':
        return <PenTool className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <aside className="absolute right-0 top-0 bottom-0 w-72 bg-[#1c1f26]/98 border-l border-white/10 z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="h-11 px-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-100">Layers</span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">({doc.layers.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedIds.length >= 2 && (
            <>
              <button
                onClick={() => mergeLayers(selectedIds)}
                title="Merge Selected Layers"
                className="h-7 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Combine className="w-3 h-3" />
                <span>Merge</span>
              </button>
              <button
                onClick={groupSelected}
                title="Group Selected Layers"
                className="h-7 px-2 rounded bg-[#2d8cff]/20 hover:bg-[#2d8cff]/30 text-[#60a5fa] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <FolderClosed className="w-3 h-3" />
                <span>Group</span>
              </button>
            </>
          )}
          {hasGroupedSelection && (
            <button
              onClick={ungroupSelected}
              title="Ungroup Selected"
              className="h-7 px-2 rounded bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              <Ungroup className="w-3 h-3" />
              <span>Ungroup</span>
            </button>
          )}
          <button
            onClick={() => setLayersDrawerOpen(false)}
            className="h-7 w-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Stack */}
      <div className="flex-1 overflow-y-auto pixellab-scroll p-2 space-y-1">
        {reversed.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No objects on canvas yet.
          </div>
        ) : (
          reversed.map(({ layer, actualIndex }) => {
            const isSelected = selectedIds.includes(layer.id);
            const groupObj = layer.groupId ? doc.groups.find((g) => g.id === layer.groupId) : null;

            return (
              <div
                key={layer.id}
                draggable
                onDragStart={() => setDragIdx(actualIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null && dragIdx !== actualIndex) {
                    reorderLayer(dragIdx, actualIndex);
                  }
                  setDragIdx(null);
                }}
                onClick={(e) => selectLayer(layer.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                className={`group rounded-md border px-2 py-1.5 flex items-center gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#2d8cff]/15 border-[#2d8cff]/60'
                    : 'bg-[#232730] border-white/5 hover:border-white/15'
                }`}
              >
                {/* Multi-select checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      selectMultiple(selectedIds.filter((id) => id !== layer.id));
                    } else {
                      selectMultiple([...selectedIds, layer.id]);
                    }
                  }}
                  title="Toggle multi-select"
                  className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#2d8cff]" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Type Icon */}
                <div className="w-6 h-6 rounded bg-[#181b22] border border-white/10 flex items-center justify-center shrink-0">
                  {iconForLayer(layer)}
                </div>

                {/* Name / Inline Edit */}
                <div className="flex-1 min-w-0">
                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => {
                        renameLayer(layer.id, draftName);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameLayer(layer.id, draftName);
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[#13151a] border border-[#2d8cff] rounded px-1.5 py-0.5 text-xs text-white outline-none"
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(layer.id);
                        setDraftName(layer.name);
                      }}
                      className="truncate text-xs font-medium text-slate-200"
                      title="Double-click to rename"
                    >
                      {layer.name}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                    <span className="capitalize">{layer.type}</span>
                    {groupObj && (
                      <>
                        <span>·</span>
                        <span className="text-[#60a5fa]">{groupObj.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Layer Quick Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (actualIndex < doc.layers.length - 1) reorderLayer(actualIndex, actualIndex + 1);
                    }}
                    disabled={actualIndex === doc.layers.length - 1}
                    title="Move Up"
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (actualIndex > 0) reorderLayer(actualIndex, actualIndex - 1);
                    }}
                    disabled={actualIndex === 0}
                    title="Move Down"
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(layer.id);
                    }}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(layer.id);
                    }}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Selected Actions */}
      <div className="p-2 border-t border-white/10 flex items-center justify-between gap-2 shrink-0 bg-[#181b22]">
        <button
          onClick={() => selectedIds.length && duplicateLayers(selectedIds)}
          disabled={!selectedIds.length}
          className="flex-1 h-8 rounded bg-[#262a34] hover:bg-[#303542] disabled:opacity-35 text-xs text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Duplicate</span>
        </button>
        <button
          onClick={() => selectedIds.length && deleteLayers(selectedIds)}
          disabled={!selectedIds.length}
          className="flex-1 h-8 rounded bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-35 text-xs text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </aside>
  );
};
