import React, { useState } from 'react';
import { Quote, X } from 'lucide-react';
import { QUOTES_LIBRARY } from '../../data/presets';
import { useEditorStore } from '../../store/useEditorStore';

export const QuotesModal: React.FC = () => {
  const { activeModal, openModal, addTextLayer, document: doc, selectedIds, updateLayer } =
    useEditorStore();
  const [category, setCategory] = useState('All');

  if (activeModal !== 'quotes') return null;

  const categories = ['All', ...Array.from(new Set(QUOTES_LIBRARY.map((q) => q.category)))];
  const filtered =
    category === 'All' ? QUOTES_LIBRARY : QUOTES_LIBRARY.filter((q) => q.category === category);

  const selectedText = doc.layers.find((l) => l.id === selectedIds[0] && l.type === 'text');

  const handlePickQuote = (text: string) => {
    if (selectedText) {
      updateLayer(selectedText.id, { text, name: text.split('\n')[0].slice(0, 24) }, true);
    } else {
      addTextLayer(text);
    }
    openModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4 text-[#2d8cff]" />
            <h2 className="text-sm font-semibold text-white">Quotes Library</h2>
          </div>
          <button
            onClick={() => openModal(null)}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto pixellab-scroll shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
                category === cat
                  ? 'bg-[#2d8cff] text-white'
                  : 'bg-[#262a34] text-slate-300 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto pixellab-scroll grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handlePickQuote(q.text)}
              className="p-3.5 rounded-lg bg-[#252a35] hover:bg-[#2c3240] border border-white/10 hover:border-[#2d8cff]/60 text-left transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-medium text-[#60a5fa] mb-1">{q.category}</div>
              <div className="text-xs font-medium text-slate-100 whitespace-pre-line leading-relaxed">
                {q.text}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
