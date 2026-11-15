import React, { useRef, useState } from 'react';
import { Search, Type, Upload, X } from 'lucide-react';
import { BUILTIN_FONTS } from '../../data/presets';
import { useEditorStore } from '../../store/useEditorStore';
import { TextLayer } from '../../types/editor';

export const FontModal: React.FC = () => {
  const {
    activeModal,
    openModal,
    document: doc,
    selectedIds,
    customFonts,
    updateLayer,
    importCustomFont,
  } = useEditorStore();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'custom'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const target = doc.layers.find((l) => l.id === selectedIds[0] && l.type === 'text') as
    | TextLayer
    | undefined;

  if (activeModal !== 'font' || !target) return null;

  const allFonts = [
    ...customFonts.map((f) => ({ family: f.name, category: 'My Fonts' })),
    ...BUILTIN_FONTS,
  ];

  const filtered = allFonts.filter((f) => {
    if (tab === 'custom' && f.category !== 'My Fonts') return false;
    return f.family.toLowerCase().includes(query.toLowerCase());
  });

  const handleFontUpload = (files: FileList | null) => {
    if (!files || !files.length) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        await importCustomFont(file.name, reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFontUpload(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-[#2d8cff]" />
            <h2 className="text-sm font-semibold text-white">Font Selector</h2>
          </div>
          <button
            onClick={() => openModal(null)}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview banner */}
        <div className="px-4 py-3 bg-[#14171d] border-b border-white/10 text-center">
          <div
            style={{ fontFamily: `"${target.fontFamily}", sans-serif` }}
            className="text-xl text-white truncate"
          >
            {target.text.split('\n')[0] || 'Sample Preview'}
          </div>
        </div>

        {/* Search & Import */}
        <div className="p-3 border-b border-white/10 flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex-1 min-w-[180px] relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search fonts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded bg-[#14171d] border border-white/15 text-xs text-white outline-none focus:border-[#2d8cff]"
            />
          </div>
          <div className="flex items-center bg-[#14171d] p-0.5 rounded border border-white/10">
            <button
              onClick={() => setTab('all')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                tab === 'all' ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
              }`}
            >
              All Fonts
            </button>
            <button
              onClick={() => setTab('custom')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                tab === 'custom' ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
              }`}
            >
              My Fonts ({customFonts.length})
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import TTF/OTF</span>
          </button>
        </div>

        {/* Font List */}
        <div className="flex-1 overflow-y-auto pixellab-scroll p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No fonts found. Import local .ttf or .otf fonts above.
            </div>
          ) : (
            filtered.map((f) => {
              const isSelected = target.fontFamily === f.family;
              return (
                <button
                  key={`${f.category}_${f.family}`}
                  onClick={() => {
                    updateLayer(target.id, { fontFamily: f.family }, true);
                    openModal(null);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg border flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#2d8cff]/20 border-[#2d8cff]'
                      : 'bg-[#252a35] border-white/5 hover:border-white/20'
                  }`}
                >
                  <span
                    style={{ fontFamily: `"${f.family}", sans-serif` }}
                    className="text-base text-white truncate"
                  >
                    {f.family}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0 ml-3">{f.category}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
