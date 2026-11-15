import React, { useRef } from 'react';
import { Pipette, Upload } from 'lucide-react';
import { COLOR_SWATCHES, GRADIENT_PRESETS } from '../../data/presets';
import { useEditorStore } from '../../store/useEditorStore';
import { FillConfig, GradientConfig } from '../../types/editor';

interface ColorPickerRowProps {
  label?: string;
  color: string;
  onChange: (hex: string) => void;
}

export const ColorPickerRow: React.FC<ColorPickerRowProps> = ({ label, color, onChange }) => {
  const { setInteractionMode } = useEditorStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {label && <span className="text-[11px] font-medium text-slate-300">{label}</span>}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="color"
            value={color.startsWith('#') ? color : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 h-7 px-2 rounded bg-[#14171d] border border-white/15 text-[11px] font-mono text-slate-100 outline-none focus:border-[#2d8cff]"
          />
          <button
            onClick={() => setInteractionMode('eyedropper', (picked) => onChange(picked))}
            title="Pick color from canvas"
            className="h-7 px-2 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pixellab-scroll pb-1">
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            onClick={() => onChange(swatch)}
            style={{ backgroundColor: swatch }}
            title={swatch}
            className={`w-6 h-6 rounded-full shrink-0 border transition-transform cursor-pointer ${
              color.toLowerCase() === swatch.toLowerCase()
                ? 'border-white scale-110 ring-2 ring-[#2d8cff]'
                : 'border-white/20 hover:scale-105'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

interface FillEditorProps {
  fill: FillConfig;
  onChange: (next: FillConfig) => void;
  allowTexture?: boolean;
}

export const FillEditor: React.FC<FillEditorProps> = ({ fill, onChange, allowTexture = true }) => {
  const texInputRef = useRef<HTMLInputElement>(null);

  const updateGradient = (patch: Partial<GradientConfig>) => {
    onChange({
      ...fill,
      mode: 'gradient',
      gradient: { ...fill.gradient, ...patch },
    });
  };

  return (
    <div className="space-y-2.5">
      <input
        ref={texInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            onChange({
              ...fill,
              mode: 'texture',
              textureDataUrl: r.result as string,
              textureScale: fill.textureScale ?? 1,
            });
          };
          r.readAsDataURL(f);
          e.target.value = '';
        }}
      />

      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-[#14171d] p-1 rounded-md border border-white/10 w-fit">
        {(['solid', 'gradient', ...(allowTexture ? ['texture'] : [])] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ ...fill, mode: m as FillConfig['mode'] })}
            className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors cursor-pointer ${
              fill.mode === m ? 'bg-[#2d8cff] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {fill.mode === 'solid' && (
        <ColorPickerRow
          label="Fill Color"
          color={fill.color}
          onChange={(c) => onChange({ ...fill, mode: 'solid', color: c })}
        />
      )}

      {fill.mode === 'gradient' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-[#14171d] p-0.5 rounded border border-white/10">
              {(['linear', 'radial'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateGradient({ type: t })}
                  className={`px-2 py-0.5 rounded text-[11px] capitalize cursor-pointer ${
                    fill.gradient.type === t ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {fill.gradient.type === 'linear' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Angle</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={fill.gradient.angle}
                  onChange={(e) => updateGradient({ angle: Number(e.target.value) })}
                  className="pl-slider w-24"
                />
                <span className="text-[11px] font-mono tabular-nums text-slate-300 w-9">
                  {fill.gradient.angle}°
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Stops</span>
              {fill.gradient.stops.map((st, idx) => (
                <input
                  key={idx}
                  type="color"
                  value={st.color}
                  onChange={(e) => {
                    const nextStops = [...fill.gradient.stops];
                    nextStops[idx] = { ...nextStops[idx], color: e.target.value };
                    updateGradient({ stops: nextStops });
                  }}
                  className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pixellab-scroll pb-1">
            {GRADIENT_PRESETS.map((gp, i) => {
              const bg =
                gp.type === 'radial'
                  ? `radial-gradient(circle, ${gp.stops.map((s) => s.color).join(', ')})`
                  : `linear-gradient(${gp.angle}deg, ${gp.stops.map((s) => s.color).join(', ')})`;
              return (
                <button
                  key={i}
                  onClick={() => onChange({ ...fill, mode: 'gradient', gradient: JSON.parse(JSON.stringify(gp)) })}
                  style={{ background: bg }}
                  className="w-8 h-8 rounded-full shrink-0 border border-white/25 hover:scale-105 transition-transform cursor-pointer"
                />
              );
            })}
          </div>
        </div>
      )}

      {fill.mode === 'texture' && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => texInputRef.current?.click()}
            className="h-8 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{fill.textureDataUrl ? 'Change Texture Image' : 'Choose Texture Image'}</span>
          </button>
          {fill.textureDataUrl && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Scale</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={fill.textureScale ?? 1}
                onChange={(e) =>
                  onChange({ ...fill, mode: 'texture', textureScale: Number(e.target.value) })
                }
                className="pl-slider w-28"
              />
              <span className="text-[11px] font-mono tabular-nums text-slate-300">
                {(fill.textureScale ?? 1).toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
