import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { TextLayer } from '../../types/editor';

export const TextEditModal: React.FC = () => {
  const { activeModal, openModal, document: doc, selectedIds, updateLayer } = useEditorStore();
  const target = doc.layers.find((l) => l.id === selectedIds[0] && l.type === 'text') as
    | TextLayer
    | undefined;

  const [value, setValue] = useState('');

  useEffect(() => {
    if (activeModal === 'textEdit' && target) {
      setValue(target.text);
    }
  }, [activeModal, target]);

  if (activeModal !== 'textEdit' || !target) return null;

  const apply = () => {
    updateLayer(target.id, {
      text: value || 'Text',
      name: (value || 'Text').split('\n')[0].slice(0, 24),
    }, true);
    openModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Edit Text</h2>
          <button
            onClick={() => openModal(null)}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setValue(value.toUpperCase())}
                className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
              >
                UPPER
              </button>
              <button
                onClick={() => setValue(value.toLowerCase())}
                className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
              >
                lower
              </button>
              <button
                onClick={() =>
                  setValue(
                    value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  )
                }
                className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Title Case
              </button>
            </div>
            <button
              onClick={() => setValue('')}
              className="h-7 px-2.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-xs text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          <textarea
            autoFocus
            rows={5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your text..."
            className="w-full rounded-lg bg-[#14171d] border border-white/15 focus:border-[#2d8cff] p-3 text-sm text-white outline-none resize-none"
          />
        </div>

        <div className="px-4 py-3 bg-[#171a21] border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={() => openModal(null)}
            className="h-8 px-4 rounded-md bg-[#262a34] hover:bg-[#303542] text-xs font-medium text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            className="h-8 px-4 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
