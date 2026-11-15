import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { saveBinaryImageNative } from '../../utils/tauriBridge';

export const ExportModal: React.FC = () => {
  const { activeModal, openModal, document: doc, stageExportGetter, showToast } = useEditorStore();
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [scale, setScale] = useState(1);
  const [customW, setCustomW] = useState(doc.width);
  const [customH, setCustomH] = useState(doc.height);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [quality, setQuality] = useState(92);
  const [transparentPng, setTransparentPng] = useState(doc.background.mode === 'transparent');

  useEffect(() => {
    if (activeModal === 'export') {
      setCustomW(doc.width);
      setCustomH(doc.height);
      setTransparentPng(doc.background.mode === 'transparent');
    }
  }, [activeModal, doc.width, doc.height, doc.background.mode]);

  if (activeModal !== 'export') return null;

  const outW = useCustomSize ? customW : Math.round(doc.width * scale);
  const outH = useCustomSize ? customH : Math.round(doc.height * scale);
  const effectiveRatio = outW / doc.width;

  const ext = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp';

  const handleExport = async () => {
    if (!stageExportGetter) {
      showToast('Canvas exporter unavailable');
      return;
    }
    const dataUrl = stageExportGetter(
      effectiveRatio,
      format,
      quality / 100,
      format === 'image/png' && transparentPng
    );
    const filename = `${doc.name.replace(/[^a-z0-9_-]/gi, '_') || 'export'}.${ext}`;
    await saveBinaryImageNative(filename, dataUrl, [ext]);
    showToast(`Exported ${filename} (${outW}×${outH})`);
    openModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e222b] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Export Image</h2>
          <button
            onClick={() => openModal(null)}
            className="w-7 h-7 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Image Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['image/png', 'PNG'],
                  ['image/jpeg', 'JPG'],
                  ['image/webp', 'WebP'],
                ] as const
              ).map(([mime, label]) => (
                <button
                  key={mime}
                  onClick={() => setFormat(mime)}
                  className={`h-9 rounded-md border text-xs font-semibold cursor-pointer ${
                    format === mime
                      ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
                      : 'bg-[#252a35] border-white/10 text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {format === 'image/png' && (
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={transparentPng}
                onChange={(e) => setTransparentPng(e.target.checked)}
                className="w-4 h-4 accent-[#2d8cff]"
              />
              <span>Force Transparent Background</span>
            </label>
          )}

          {format !== 'image/png' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Quality</span>
                <span className="font-mono tabular-nums">{quality}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="pl-slider w-full"
              />
            </div>
          )}

          {/* Resolution */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Dimensions</label>
              <button
                onClick={() => setUseCustomSize(!useCustomSize)}
                className="text-[11px] text-[#60a5fa] hover:underline cursor-pointer"
              >
                {useCustomSize ? 'Use Scale Presets' : 'Use Custom Resolution'}
              </button>
            </div>

            {!useCustomSize ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`h-9 rounded-md border text-xs font-mono cursor-pointer ${
                      scale === s
                        ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
                        : 'bg-[#252a35] border-white/10 text-slate-200'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => {
                    const w = Math.max(64, Number(e.target.value));
                    setCustomW(w);
                    setCustomH(Math.round((w * doc.height) / doc.width));
                  }}
                  className="flex-1 h-8 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                />
                <span className="text-xs text-slate-400">×</span>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Math.max(64, Number(e.target.value)))}
                  className="flex-1 h-8 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                />
              </div>
            )}

            <div className="text-[11px] font-mono tabular-nums text-slate-400">
              Output: {outW} × {outH} px
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-[#171a21] border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={() => openModal(null)}
            className="h-8 px-4 rounded-md bg-[#262a34] hover:bg-[#303542] text-xs font-medium text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="h-8 px-4 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};
