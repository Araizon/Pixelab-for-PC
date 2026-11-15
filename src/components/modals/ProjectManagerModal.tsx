import React, { useEffect, useRef, useState } from 'react';
import {
  CopyPlus,
  Download,
  FilePlus2,
  FolderOpen,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { CANVAS_SIZE_PRESETS, PROJECT_TEMPLATES } from '../../data/presets';
import { useEditorStore } from '../../store/useEditorStore';
import { deserializePfx, serializePfx } from '../../utils/projectStorage';
import { saveTextFileNative } from '../../utils/tauriBridge';

export const ProjectManagerModal: React.FC = () => {
  const {
    activeModal,
    openModal,
    document: doc,
    projects,
    customFonts,
    refreshProjectsList,
    saveCurrentProject,
    loadProjectById,
    deleteProjectById,
    duplicateProjectById,
    createNewProject,
    renameCurrentProject,
    setDocument,
    showToast,
  } = useEditorStore();

  const [tab, setTab] = useState<'my' | 'new'>('my');
  const [newName, setNewName] = useState('Untitled Project');
  const [newW, setNewW] = useState(1080);
  const [newH, setNewH] = useState(1080);
  const [editingTitle, setEditingTitle] = useState(doc.name);
  const pfxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeModal === 'projects') {
      refreshProjectsList();
      setEditingTitle(doc.name);
    }
  }, [activeModal, doc.name, refreshProjectsList]);

  if (activeModal !== 'projects') return null;

  const handleOpenPfx = async (file: File | undefined) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const loaded = await deserializePfx(txt);
      setDocument(loaded, true);
      openModal(null);
      showToast(`Opened "${loaded.name}"`);
    } catch {
      showToast('Failed to parse .pfx file');
    }
  };

  const handleExportPfx = async () => {
    const json = serializePfx(doc, customFonts);
    const fname = `${doc.name.replace(/[^a-z0-9_-]/gi, '_') || 'project'}.pfx`;
    await saveTextFileNative(fname, json, 'PixelLab Project (.pfx)', ['pfx']);
    showToast(`Exported ${fname}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <input
          ref={pfxRef}
          type="file"
          accept=".pfx,.json"
          className="hidden"
          onChange={(e) => {
            handleOpenPfx(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Projects</h2>
            <div className="flex items-center bg-[#14171d] p-0.5 rounded border border-white/10">
              <button
                onClick={() => setTab('my')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  tab === 'my' ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                }`}
              >
                My Projects ({projects.length})
              </button>
              <button
                onClick={() => setTab('new')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  tab === 'new' ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                }`}
              >
                New Project
              </button>
            </div>
          </div>
          <button
            onClick={() => openModal(null)}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Project Actions Bar */}
        <div className="px-4 py-2.5 bg-[#171a21] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Current:</span>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => renameCurrentProject(editingTitle)}
              onKeyDown={(e) => e.key === 'Enter' && renameCurrentProject(editingTitle)}
              className="h-7 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs text-white outline-none focus:border-[#2d8cff]"
            />
            <button
              onClick={() => renameCurrentProject(editingTitle)}
              title="Rename current project"
              className="h-7 px-2 rounded bg-[#262a34] hover:bg-[#303542] text-xs text-slate-200 cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveCurrentProject}
              className="h-7 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={handleExportPfx}
              className="h-7 px-3 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .pfx</span>
            </button>
            <button
              onClick={() => pfxRef.current?.click()}
              className="h-7 px-3 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open .pfx</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pixellab-scroll p-4">
          {tab === 'my' ? (
            projects.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  No saved projects yet. Save your active design to access it offline anytime.
                </p>
                <button
                  onClick={saveCurrentProject}
                  className="h-8 px-4 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white cursor-pointer"
                >
                  Save Current Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg bg-[#252a35] border border-white/10 overflow-hidden flex flex-col"
                  >
                    <button
                      onClick={() => loadProjectById(p.id)}
                      className="h-32 bg-[#14171d] flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90"
                    >
                      {p.thumbnailDataUrl ? (
                        <img
                          src={p.thumbnailDataUrl}
                          alt={p.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">
                          {p.width}×{p.height}
                        </span>
                      )}
                    </button>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-400">
                          {p.width}×{p.height} · {new Date(p.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => duplicateProjectById(p.id)}
                          title="Duplicate"
                          className="p-1.5 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteProjectById(p.id)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-200">Custom Blank Canvas</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Project Name"
                    className="h-8 px-3 rounded bg-[#14171d] border border-white/15 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={newW}
                    onChange={(e) => setNewW(Number(e.target.value))}
                    className="w-24 h-8 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                  />
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    value={newH}
                    onChange={(e) => setNewH(Number(e.target.value))}
                    className="w-24 h-8 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                  />
                  <button
                    onClick={() => createNewProject(newW, newH, newName)}
                    className="h-8 px-4 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>Create</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200">Size Presets</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CANVAS_SIZE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => createNewProject(p.width, p.height, p.label)}
                      className="p-2.5 rounded-lg bg-[#252a35] hover:bg-[#2c3240] border border-white/10 text-left cursor-pointer"
                    >
                      <div className="text-xs font-medium text-white">{p.label}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {p.width} × {p.height}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200">Starter Templates</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROJECT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setDocument(t.doc(), true);
                        openModal(null);
                      }}
                      className="p-3 rounded-lg bg-[#252a35] hover:bg-[#2c3240] border border-white/10 text-left cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[#60a5fa]">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
