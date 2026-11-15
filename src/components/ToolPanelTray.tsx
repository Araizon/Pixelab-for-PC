import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Check,
  FlipHorizontal,
  FlipVertical,
  Italic,
  Redo2,
  RotateCcw,
  Trash2,
  Underline,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  CANVAS_SIZE_PRESETS,
  EMOJI_LIBRARY,
  GRADIENT_PRESETS,
  TEXT_STYLE_PRESETS,
  VECTOR_STICKERS,
} from '../data/presets';
import { useEditorStore } from '../store/useEditorStore';
import {
  ImageLayer,
  PathLayer,
  ShapeKind,
  ShapeLayer,
  StickerLayer,
  TextLayer,
} from '../types/editor';
import { getLayerCoreBox } from '../utils/canvasEffects';
import { ColorPickerRow, FillEditor } from './controls/ColorFillEditor';

const SHAPE_OPTIONS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: 'Square' },
  { kind: 'roundedRect', label: 'Rounded' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'polygon', label: 'Polygon' },
  { kind: 'star', label: 'Star' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'pentagon', label: 'Pentagon' },
  { kind: 'speech', label: 'Bubble' },
];

export const ToolPanelTray: React.FC = () => {
  const {
    document: doc,
    selectedIds,
    activeTool,
    setActiveTool,
    setInteractionMode,
    updateLayer,
    updateBackground,
    updateFilters,
    resetFilters,
    resizeCanvas,
    relativePositionSelected,
    addShapeLayer,
    addStickerLayer,
    savedStyles,
    saveSelectedAsStyle,
    applyStyleToSelected,
    drawSession,
    updateDrawSession,
    undoDrawStroke,
    redoDrawStroke,
    commitDrawSession,
    cancelDrawSession,
    bezierSession,
    updateBezierSession,
    commitBezierSession,
    cancelBezierSession,
  } = useEditorStore();

  const [moveStep, setMoveStep] = useState(8);
  const [customW, setCustomW] = useState(doc.width);
  const [customH, setCustomH] = useState(doc.height);
  const [scaleOnResize, setScaleOnResize] = useState(false);
  const [lockRatio, setLockRatio] = useState(true);
  const [styleName, setStyleName] = useState('');
  const bgFileRef = useRef<HTMLInputElement>(null);
  const stickerFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomW(doc.width);
    setCustomH(doc.height);
  }, [doc.width, doc.height]);

  if (!activeTool) return null;

  const selected = doc.layers.find((l) => l.id === selectedIds[0]) ?? null;
  const textLayer = selected?.type === 'text' ? (selected as TextLayer) : null;
  const shapeLayer = selected?.type === 'shape' ? (selected as ShapeLayer) : null;
  const imageLayer = selected?.type === 'image' ? (selected as ImageLayer) : null;
  const stickerLayer = selected?.type === 'sticker' ? (selected as StickerLayer) : null;
  const pathLayer = selected?.type === 'path' ? (selected as PathLayer) : null;

  const closeTray = () => {
    setActiveTool(null);
    setInteractionMode('select');
  };

  return (
    <div className="bg-[#1e222b] border-t border-white/10 px-4 py-3 z-20 max-h-64 overflow-y-auto pixellab-scroll">
      <div className="max-w-5xl mx-auto">
        {/* Header bar with title & Done button */}
        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-white/10">
          <span className="text-xs font-semibold text-slate-100 capitalize">
            {activeTool.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <div className="flex items-center gap-1.5">
            {activeTool !== 'drawTool' && activeTool !== 'bezierTool' && (
              <button
                onClick={closeTray}
                className="h-6 px-2.5 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>

        {/* --- STYLES --- */}
        {activeTool === 'styles' && textLayer && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pixellab-scroll pb-1">
              {[...savedStyles, ...TEXT_STYLE_PRESETS].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyStyleToSelected(preset)}
                  style={{ backgroundColor: preset.previewBg }}
                  className="px-3.5 py-2 rounded-md border border-white/15 hover:border-[#2d8cff] text-xs font-bold text-white shrink-0 cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Style preset name..."
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                className="h-7 px-2.5 rounded bg-[#14171d] border border-white/15 text-xs text-white outline-none focus:border-[#2d8cff]"
              />
              <button
                onClick={() => {
                  saveSelectedAsStyle(styleName || 'My Style');
                  setStyleName('');
                }}
                className="h-7 px-3 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 cursor-pointer"
              >
                Save Current Style
              </button>
            </div>
          </div>
        )}

        {/* --- POSITION --- */}
        {activeTool === 'position' && selected && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateLayer(selected.id, { x: selected.x - moveStep }, true)}
                className="h-8 w-8 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateLayer(selected.id, { y: selected.y - moveStep }, true)}
                className="h-8 w-8 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateLayer(selected.id, { y: selected.y + moveStep }, true)}
                className="h-8 w-8 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateLayer(selected.id, { x: selected.x + moveStep }, true)}
                className="h-8 w-8 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <SliderField label="Step" value={moveStep} min={1} max={40} unit="px" onChange={setMoveStep} />
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-300">
              <span>X: {Math.round(selected.x)}</span>
              <span>Y: {Math.round(selected.y)}</span>
            </div>
          </div>
        )}

        {/* --- RELATIVE POSITION --- */}
        {activeTool === 'relativePosition' && selected && (
          <div className="flex flex-wrap items-center gap-2">
            <SmallBtn label="Left" onClick={() => relativePositionSelected('left', null)} />
            <SmallBtn label="Center H" onClick={() => relativePositionSelected('center', null)} />
            <SmallBtn label="Right" onClick={() => relativePositionSelected('right', null)} />
            <SmallBtn label="Top" onClick={() => relativePositionSelected(null, 'top')} />
            <SmallBtn label="Center V" onClick={() => relativePositionSelected(null, 'middle')} />
            <SmallBtn label="Bottom" onClick={() => relativePositionSelected(null, 'bottom')} />
            <SmallBtn
              label="Center Both"
              primary
              onClick={() => relativePositionSelected('center', 'middle')}
            />
          </div>
        )}

        {/* --- SIZE / RELATIVE SIZE --- */}
        {activeTool === 'size' && textLayer && (
          <SliderField
            label="Font Size"
            value={textLayer.fontSize}
            min={12}
            max={260}
            unit="px"
            onChange={(v) => updateLayer(textLayer.id, { fontSize: v })}
          />
        )}

        {activeTool === 'relativeSize' && selected && (() => {
          const box = getLayerCoreBox(selected);
          const curWPct = Math.round(((box.w * selected.scaleX) / doc.width) * 100);
          const curHPct = Math.round(((box.h * selected.scaleY) / doc.height) * 100);
          return (
            <div className="flex flex-wrap items-center gap-4">
              <SliderField
                label="Width"
                value={curWPct}
                min={5}
                max={150}
                unit="%"
                onChange={(pct) => {
                  const targetScaleX = (doc.width * (pct / 100)) / Math.max(20, box.w);
                  const ratio = targetScaleX / Math.max(0.01, selected.scaleX);
                  updateLayer(selected.id, {
                    scaleX: Number(targetScaleX.toFixed(3)),
                    ...(lockRatio ? { scaleY: Number((selected.scaleY * ratio).toFixed(3)) } : {}),
                  });
                }}
              />
              <SliderField
                label="Height"
                value={curHPct}
                min={5}
                max={150}
                unit="%"
                onChange={(pct) => {
                  const targetScaleY = (doc.height * (pct / 100)) / Math.max(20, box.h);
                  const ratio = targetScaleY / Math.max(0.01, selected.scaleY);
                  updateLayer(selected.id, {
                    scaleY: Number(targetScaleY.toFixed(3)),
                    ...(lockRatio ? { scaleX: Number((selected.scaleX * ratio).toFixed(3)) } : {}),
                  });
                }}
              />
              <ToggleRow label="Lock Ratio" checked={lockRatio} onChange={setLockRatio} />
              <SmallBtn
                label="Fit Width"
                onClick={() => {
                  const sx = doc.width / Math.max(20, box.w);
                  const ratio = sx / Math.max(0.01, selected.scaleX);
                  updateLayer(
                    selected.id,
                    {
                      scaleX: Number(sx.toFixed(3)),
                      ...(lockRatio ? { scaleY: Number((selected.scaleY * ratio).toFixed(3)) } : {}),
                    },
                    true
                  );
                }}
              />
            </div>
          );
        })()}

        {/* --- PADDING (Text) --- */}
        {activeTool === 'padding' && textLayer && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="Left"
              value={textLayer.paddingLeft}
              min={0}
              max={120}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { paddingLeft: v })}
            />
            <SliderField
              label="Right"
              value={textLayer.paddingRight}
              min={0}
              max={120}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { paddingRight: v })}
            />
            <SliderField
              label="Top"
              value={textLayer.paddingTop}
              min={0}
              max={120}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { paddingTop: v })}
            />
            <SliderField
              label="Bottom"
              value={textLayer.paddingBottom}
              min={0}
              max={120}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { paddingBottom: v })}
            />
          </div>
        )}

        {/* --- COLOR / FILL / TEXTURE --- */}
        {(activeTool === 'color' || activeTool === 'fill' || activeTool === 'texture') && selected && (
          <>
            {textLayer && (
              <FillEditor
                fill={
                  activeTool === 'texture'
                    ? { ...textLayer.fill, mode: 'texture' }
                    : textLayer.fill
                }
                onChange={(fill) => updateLayer(textLayer.id, { fill })}
              />
            )}
            {shapeLayer && (
              <FillEditor
                fill={
                  activeTool === 'texture'
                    ? { ...shapeLayer.fill, mode: 'texture' }
                    : shapeLayer.fill
                }
                onChange={(fill) => updateLayer(shapeLayer.id, { fill })}
              />
            )}
            {pathLayer && (
              <FillEditor
                fill={pathLayer.fill}
                onChange={(fill) => updateLayer(pathLayer.id, { fill })}
              />
            )}
            {imageLayer && (
              <div className="space-y-2">
                <ToggleRow
                  label="Enable Color Tint"
                  checked={Boolean(imageLayer.tintEnabled)}
                  onChange={(tintEnabled) => updateLayer(imageLayer.id, { tintEnabled })}
                />
                {imageLayer.tintEnabled && (
                  <ColorPickerRow
                    label="Tint Color"
                    color={imageLayer.tintColor || '#2d8cff'}
                    onChange={(tintColor) => updateLayer(imageLayer.id, { tintColor })}
                  />
                )}
              </div>
            )}
            {stickerLayer && (
              <ColorPickerRow
                label="Sticker Tint"
                color={stickerLayer.tintColor || '#ffffff'}
                onChange={(tintColor) => updateLayer(stickerLayer.id, { tintColor })}
              />
            )}
          </>
        )}

        {/* --- OPACITY --- */}
        {activeTool === 'opacity' && selected && (
          <SliderField
            label="Opacity"
            value={Math.round(selected.opacity * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateLayer(selected.id, { opacity: v / 100 })}
          />
        )}

        {/* --- ROTATE --- */}
        {activeTool === 'rotate' && selected && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="Angle"
              value={selected.rotation}
              min={-180}
              max={180}
              unit="°"
              onChange={(v) => updateLayer(selected.id, { rotation: v })}
            />
            <SmallBtn label="-90°" onClick={() => updateLayer(selected.id, { rotation: selected.rotation - 90 })} />
            <SmallBtn label="0°" onClick={() => updateLayer(selected.id, { rotation: 0 })} />
            <SmallBtn label="+90°" onClick={() => updateLayer(selected.id, { rotation: selected.rotation + 90 })} />
          </div>
        )}

        {/* --- FLIP --- */}
        {activeTool === 'flip' && selected && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateLayer(selected.id, { flipX: !selected.flipX }, true)}
              className={`h-8 px-3 rounded border text-xs flex items-center gap-1.5 cursor-pointer ${
                selected.flipX ? 'bg-[#2d8cff] border-[#2d8cff] text-white' : 'bg-[#262a34] border-white/10 text-slate-200'
              }`}
            >
              <FlipHorizontal className="w-4 h-4" />
              <span>Flip Horizontal</span>
            </button>
            <button
              onClick={() => updateLayer(selected.id, { flipY: !selected.flipY }, true)}
              className={`h-8 px-3 rounded border text-xs flex items-center gap-1.5 cursor-pointer ${
                selected.flipY ? 'bg-[#2d8cff] border-[#2d8cff] text-white' : 'bg-[#262a34] border-white/10 text-slate-200'
              }`}
            >
              <FlipVertical className="w-4 h-4" />
              <span>Flip Vertical</span>
            </button>
          </div>
        )}

        {/* --- TEXT STYLE (B / I / U) --- */}
        {activeTool === 'style' && textLayer && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateLayer(textLayer.id, { bold: !textLayer.bold }, true)}
              className={`h-9 w-10 rounded border flex items-center justify-center cursor-pointer ${
                textLayer.bold ? 'bg-[#2d8cff] border-[#2d8cff] text-white' : 'bg-[#262a34] border-white/10 text-slate-200'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateLayer(textLayer.id, { italic: !textLayer.italic }, true)}
              className={`h-9 w-10 rounded border flex items-center justify-center cursor-pointer ${
                textLayer.italic ? 'bg-[#2d8cff] border-[#2d8cff] text-white' : 'bg-[#262a34] border-white/10 text-slate-200'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateLayer(textLayer.id, { underline: !textLayer.underline }, true)}
              className={`h-9 w-10 rounded border flex items-center justify-center cursor-pointer ${
                textLayer.underline ? 'bg-[#2d8cff] border-[#2d8cff] text-white' : 'bg-[#262a34] border-white/10 text-slate-200'
              }`}
            >
              <Underline className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- TEXT CURVE / CIRCULAR --- */}
        {activeTool === 'curve' && textLayer && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="Bending"
              value={textLayer.curve}
              min={-100}
              max={100}
              unit="%"
              onChange={(v) => updateLayer(textLayer.id, { curve: v })}
            />
            <SmallBtn label="Reset (0)" onClick={() => updateLayer(textLayer.id, { curve: 0 }, true)} />
          </div>
        )}

        {/* --- TEXT BACKGROUND --- */}
        {activeTool === 'textBg' && textLayer && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Text Background"
              checked={textLayer.textBg.enabled}
              onChange={(enabled) =>
                updateLayer(textLayer.id, { textBg: { ...textLayer.textBg, enabled } }, true)
              }
            />
            {textLayer.textBg.enabled && (
              <>
                <ColorPickerRow
                  label="Background Color"
                  color={textLayer.textBg.color}
                  onChange={(color) =>
                    updateLayer(textLayer.id, { textBg: { ...textLayer.textBg, color } })
                  }
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Pad X"
                    value={textLayer.textBg.paddingLeft}
                    min={0}
                    max={80}
                    unit="px"
                    onChange={(v) =>
                      updateLayer(textLayer.id, {
                        textBg: { ...textLayer.textBg, paddingLeft: v, paddingRight: v },
                      })
                    }
                  />
                  <SliderField
                    label="Pad Y"
                    value={textLayer.textBg.paddingTop}
                    min={0}
                    max={80}
                    unit="px"
                    onChange={(v) =>
                      updateLayer(textLayer.id, {
                        textBg: { ...textLayer.textBg, paddingTop: v, paddingBottom: v },
                      })
                    }
                  />
                  <SliderField
                    label="Radius"
                    value={textLayer.textBg.radius}
                    min={0}
                    max={60}
                    unit="px"
                    onChange={(v) =>
                      updateLayer(textLayer.id, { textBg: { ...textLayer.textBg, radius: v } })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* --- TEXT ALIGN --- */}
        {activeTool === 'align' && textLayer && (
          <div className="flex items-center gap-2">
            {(
              [
                ['left', AlignLeft],
                ['center', AlignCenter],
                ['right', AlignRight],
                ['justify', AlignJustify],
              ] as const
            ).map(([val, Icon]) => (
              <button
                key={val}
                onClick={() => updateLayer(textLayer.id, { align: val }, true)}
                className={`h-9 px-3 rounded border flex items-center gap-1.5 text-xs capitalize cursor-pointer ${
                  textLayer.align === val
                    ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
                    : 'bg-[#262a34] border-white/10 text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{val}</span>
              </button>
            ))}
          </div>
        )}

        {/* --- TEXT SPACING --- */}
        {activeTool === 'spacing' && textLayer && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="Letters"
              value={textLayer.letterSpacing}
              min={-10}
              max={60}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { letterSpacing: v })}
            />
            <SliderField
              label="Words"
              value={textLayer.wordSpacing}
              min={-10}
              max={60}
              unit="px"
              onChange={(v) => updateLayer(textLayer.id, { wordSpacing: v })}
            />
            <SliderField
              label="Line Height"
              value={Math.round(textLayer.lineHeight * 100)}
              min={70}
              max={250}
              unit="%"
              onChange={(v) => updateLayer(textLayer.id, { lineHeight: v / 100 })}
            />
          </div>
        )}

        {/* --- STROKE --- */}
        {activeTool === 'stroke' && selected && 'stroke' in selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Stroke"
              checked={selected.stroke.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { stroke: { ...selected.stroke, enabled } }, true)
              }
            />
            {selected.stroke.enabled && (
              <>
                <SliderField
                  label="Stroke Width"
                  value={selected.stroke.width}
                  min={1}
                  max={40}
                  unit="px"
                  onChange={(width) =>
                    updateLayer(selected.id, { stroke: { ...selected.stroke, width } })
                  }
                />
                <ColorPickerRow
                  label="Stroke Color"
                  color={selected.stroke.color}
                  onChange={(color) =>
                    updateLayer(selected.id, { stroke: { ...selected.stroke, color } })
                  }
                />
              </>
            )}
          </div>
        )}

        {/* --- SHADOW --- */}
        {activeTool === 'shadow' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Shadow"
              checked={selected.shadow.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { shadow: { ...selected.shadow, enabled } }, true)
              }
            />
            {selected.shadow.enabled && (
              <>
                <ColorPickerRow
                  label="Shadow Color"
                  color={selected.shadow.color}
                  onChange={(color) =>
                    updateLayer(selected.id, { shadow: { ...selected.shadow, color } })
                  }
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Blur"
                    value={selected.shadow.blur}
                    min={0}
                    max={60}
                    unit="px"
                    onChange={(blur) =>
                      updateLayer(selected.id, { shadow: { ...selected.shadow, blur } })
                    }
                  />
                  <SliderField
                    label="Opacity"
                    value={Math.round(selected.shadow.opacity * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      updateLayer(selected.id, { shadow: { ...selected.shadow, opacity: v / 100 } })
                    }
                  />
                  <SliderField
                    label="Offset X"
                    value={selected.shadow.offsetX}
                    min={-50}
                    max={50}
                    unit="px"
                    onChange={(offsetX) =>
                      updateLayer(selected.id, { shadow: { ...selected.shadow, offsetX } })
                    }
                  />
                  <SliderField
                    label="Offset Y"
                    value={selected.shadow.offsetY}
                    min={-50}
                    max={50}
                    unit="px"
                    onChange={(offsetY) =>
                      updateLayer(selected.id, { shadow: { ...selected.shadow, offsetY } })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* --- INNER SHADOW --- */}
        {activeTool === 'innerShadow' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Inner Shadow"
              checked={selected.innerShadow.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { innerShadow: { ...selected.innerShadow, enabled } }, true)
              }
            />
            {selected.innerShadow.enabled && (
              <>
                <ColorPickerRow
                  label="Color"
                  color={selected.innerShadow.color}
                  onChange={(color) =>
                    updateLayer(selected.id, { innerShadow: { ...selected.innerShadow, color } })
                  }
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Blur"
                    value={selected.innerShadow.blur}
                    min={0}
                    max={40}
                    unit="px"
                    onChange={(blur) =>
                      updateLayer(selected.id, { innerShadow: { ...selected.innerShadow, blur } })
                    }
                  />
                  <SliderField
                    label="Offset X"
                    value={selected.innerShadow.offsetX}
                    min={-30}
                    max={30}
                    unit="px"
                    onChange={(offsetX) =>
                      updateLayer(selected.id, { innerShadow: { ...selected.innerShadow, offsetX } })
                    }
                  />
                  <SliderField
                    label="Offset Y"
                    value={selected.innerShadow.offsetY}
                    min={-30}
                    max={30}
                    unit="px"
                    onChange={(offsetY) =>
                      updateLayer(selected.id, { innerShadow: { ...selected.innerShadow, offsetY } })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* --- EMBOSS --- */}
        {activeTool === 'emboss' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Emboss Lighting"
              checked={selected.emboss.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { emboss: { ...selected.emboss, enabled } }, true)
              }
            />
            {selected.emboss.enabled && (
              <div className="flex flex-wrap items-center gap-4">
                <SliderField
                  label="Light Angle"
                  value={selected.emboss.angle}
                  min={0}
                  max={360}
                  unit="°"
                  onChange={(angle) =>
                    updateLayer(selected.id, { emboss: { ...selected.emboss, angle } })
                  }
                />
                <SliderField
                  label="Intensity"
                  value={selected.emboss.intensity}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(intensity) =>
                    updateLayer(selected.id, { emboss: { ...selected.emboss, intensity } })
                  }
                />
                <SliderField
                  label="Ambient"
                  value={selected.emboss.ambient}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(ambient) =>
                    updateLayer(selected.id, { emboss: { ...selected.emboss, ambient } })
                  }
                />
                <SliderField
                  label="Specular"
                  value={selected.emboss.specular}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(specular) =>
                    updateLayer(selected.id, { emboss: { ...selected.emboss, specular } })
                  }
                />
                <SliderField
                  label="Bevel"
                  value={selected.emboss.bevel}
                  min={1}
                  max={10}
                  unit="px"
                  onChange={(bevel) =>
                    updateLayer(selected.id, { emboss: { ...selected.emboss, bevel } })
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* --- PERSPECTIVE --- */}
        {activeTool === 'perspective' && selected && (
          <div className="flex flex-wrap items-center gap-3">
            <ToggleRow
              label="Enable Perspective Warp (Drag 4 handles on canvas)"
              checked={selected.perspective.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { perspective: { ...selected.perspective, enabled } }, true)
              }
            />
            <SmallBtn
              label="Reset Corners"
              onClick={() =>
                updateLayer(
                  selected.id,
                  {
                    perspective: {
                      enabled: false,
                      tl: { x: 0, y: 0 },
                      tr: { x: 0, y: 0 },
                      br: { x: 0, y: 0 },
                      bl: { x: 0, y: 0 },
                    },
                  },
                  true
                )
              }
            />
          </div>
        )}

        {/* --- MASK --- */}
        {activeTool === 'mask' && selected && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleRow
                label="Enable Mask Cutout (Drag red nodes on canvas)"
                checked={selected.mask.enabled}
                onChange={(enabled) =>
                  updateLayer(selected.id, { mask: { ...selected.mask, enabled } }, true)
                }
              />
              <div className="flex items-center gap-1 bg-[#14171d] p-0.5 rounded border border-white/10">
                {(['out', 'in'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      updateLayer(selected.id, { mask: { ...selected.mask, enabled: true, mode: m } }, true)
                    }
                    className={`px-2.5 py-1 rounded text-xs capitalize cursor-pointer ${
                      selected.mask.mode === m ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                    }`}
                  >
                    Mask {m}
                  </button>
                ))}
              </div>
              <SliderField
                label="Smooth Edge"
                value={selected.mask.smooth ?? 0}
                min={0}
                max={20}
                unit="px"
                onChange={(smooth) =>
                  updateLayer(selected.id, { mask: { ...selected.mask, enabled: true, smooth } })
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SmallBtn
                label="+ Add Point"
                onClick={() => {
                  const pts = selected.mask.points;
                  const last = pts[pts.length - 1] ?? { x: 0.5, y: 0.5 };
                  const first = pts[0] ?? { x: 0.5, y: 0.5 };
                  const mid = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
                  updateLayer(
                    selected.id,
                    { mask: { ...selected.mask, enabled: true, points: [...pts, mid] } },
                    true
                  );
                }}
              />
              <SmallBtn
                label="- Remove Point"
                onClick={() => {
                  if (selected.mask.points.length <= 3) return;
                  updateLayer(
                    selected.id,
                    { mask: { ...selected.mask, points: selected.mask.points.slice(0, -1) } },
                    true
                  );
                }}
              />
              <SmallBtn
                label="Reset Mask"
                onClick={() =>
                  updateLayer(
                    selected.id,
                    {
                      mask: {
                        enabled: false,
                        mode: 'out',
                        smooth: 0,
                        points: [
                          { x: 0.1, y: 0.5 },
                          { x: 0.9, y: 0.5 },
                          { x: 0.9, y: 0.95 },
                          { x: 0.1, y: 0.95 },
                        ],
                      },
                    },
                    true
                  )
                }
              />
            </div>
          </div>
        )}

        {/* --- 3D ROTATE --- */}
        {activeTool === 'rotate3D' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable 3D Rotate"
              checked={selected.rotate3D.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { rotate3D: { ...selected.rotate3D, enabled } }, true)
              }
            />
            {selected.rotate3D.enabled && (
              <div className="flex flex-wrap items-center gap-4">
                <SliderField
                  label="X Axis"
                  value={selected.rotate3D.rotateX}
                  min={-65}
                  max={65}
                  unit="°"
                  onChange={(rotateX) =>
                    updateLayer(selected.id, { rotate3D: { ...selected.rotate3D, rotateX } })
                  }
                />
                <SliderField
                  label="Y Axis"
                  value={selected.rotate3D.rotateY}
                  min={-65}
                  max={65}
                  unit="°"
                  onChange={(rotateY) =>
                    updateLayer(selected.id, { rotate3D: { ...selected.rotate3D, rotateY } })
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* --- 3D TEXT --- */}
        {activeTool === 'text3D' && textLayer && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <ToggleRow
                label="Enable 3D Text"
                checked={textLayer.text3D.enabled}
                onChange={(enabled) =>
                  updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, enabled } }, true)
                }
              />
              {textLayer.text3D.enabled && (
                <div className="flex items-center gap-1 bg-[#14171d] p-0.5 rounded border border-white/10">
                  {(['oblique', 'perspective'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, mode: m } }, true)
                      }
                      className={`px-2.5 py-1 rounded text-xs capitalize cursor-pointer ${
                        textLayer.text3D.mode === m ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {textLayer.text3D.enabled && (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Depth"
                    value={textLayer.text3D.depth}
                    min={1}
                    max={48}
                    unit="px"
                    onChange={(depth) =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, depth } })
                    }
                  />
                  {textLayer.text3D.mode === 'oblique' && (
                    <SliderField
                      label="Direction"
                      value={textLayer.text3D.angle}
                      min={0}
                      max={360}
                      unit="°"
                      onChange={(angle) =>
                        updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, angle } })
                      }
                    />
                  )}
                  <SliderField
                    label="Darken"
                    value={textLayer.text3D.darken}
                    min={0}
                    max={90}
                    unit="%"
                    onChange={(darken) =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, darken } })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="X Rot"
                    value={textLayer.text3D.rotateX}
                    min={-55}
                    max={55}
                    unit="°"
                    onChange={(rotateX) =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, rotateX } })
                    }
                  />
                  <SliderField
                    label="Y Rot"
                    value={textLayer.text3D.rotateY}
                    min={-55}
                    max={55}
                    unit="°"
                    onChange={(rotateY) =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, rotateY } })
                    }
                  />
                  <SliderField
                    label="Z Rot"
                    value={textLayer.text3D.rotateZ}
                    min={-45}
                    max={45}
                    unit="°"
                    onChange={(rotateZ) =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, rotateZ } })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] text-slate-400">Extrusion Color:</span>
                  <SmallBtn
                    label="Auto"
                    primary={textLayer.text3D.colorMode === 'auto'}
                    onClick={() =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, colorMode: 'auto' } })
                    }
                  />
                  <SmallBtn
                    label="Custom"
                    primary={textLayer.text3D.colorMode === 'custom'}
                    onClick={() =>
                      updateLayer(textLayer.id, { text3D: { ...textLayer.text3D, colorMode: 'custom' } })
                    }
                  />
                  {textLayer.text3D.colorMode === 'custom' && (
                    <input
                      type="color"
                      value={textLayer.text3D.color}
                      onChange={(e) =>
                        updateLayer(textLayer.id, {
                          text3D: { ...textLayer.text3D, color: e.target.value },
                        })
                      }
                      className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* --- ERASE COLOR (Chroma Key) --- */}
        {activeTool === 'eraseColor' && selected && (selected.type === 'image' || selected.type === 'sticker') && (() => {
          const ec = selected.eraseColor ?? { enabled: false, color: '#ffffff', tolerance: 24, smooth: 8 };
          return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <ToggleRow
                  label="Enable Erase Color (Remove Background)"
                  checked={ec.enabled}
                  onChange={(enabled) =>
                    updateLayer(selected.id, { eraseColor: { ...ec, enabled } }, true)
                  }
                />
                {ec.enabled && (
                  <div className="flex items-center gap-1.5">
                    <SmallBtn
                      label="White"
                      onClick={() =>
                        updateLayer(selected.id, { eraseColor: { ...ec, color: '#ffffff' } }, true)
                      }
                    />
                    <SmallBtn
                      label="Green"
                      onClick={() =>
                        updateLayer(selected.id, { eraseColor: { ...ec, color: '#00ff00' } }, true)
                      }
                    />
                    <SmallBtn
                      label="Black"
                      onClick={() =>
                        updateLayer(selected.id, { eraseColor: { ...ec, color: '#000000' } }, true)
                      }
                    />
                  </div>
                )}
              </div>
              {ec.enabled && (
                <>
                  <ColorPickerRow
                    label="Target Color"
                    color={ec.color}
                    onChange={(color) => updateLayer(selected.id, { eraseColor: { ...ec, color } })}
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <SliderField
                      label="Tolerance"
                      value={ec.tolerance}
                      min={1}
                      max={85}
                      unit="%"
                      onChange={(tolerance) =>
                        updateLayer(selected.id, { eraseColor: { ...ec, tolerance } })
                      }
                    />
                    <SliderField
                      label="Smooth Edges"
                      value={ec.smooth}
                      min={0}
                      max={30}
                      unit="%"
                      onChange={(smooth) =>
                        updateLayer(selected.id, { eraseColor: { ...ec, smooth } })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* --- PER-OBJECT COLOR FILTERS --- */}
        {activeTool === 'objectFilters' && selected && (() => {
          const cf = selected.colorFilters ?? { hue: 0, saturation: 0, brightness: 0, contrast: 0 };
          return (
            <div className="flex flex-wrap items-center gap-4">
              <SliderField
                label="Hue"
                value={cf.hue}
                min={-180}
                max={180}
                unit="°"
                onChange={(hue) => updateLayer(selected.id, { colorFilters: { ...cf, hue } })}
              />
              <SliderField
                label="Saturation"
                value={cf.saturation}
                min={-100}
                max={100}
                unit=""
                onChange={(saturation) =>
                  updateLayer(selected.id, { colorFilters: { ...cf, saturation } })
                }
              />
              <SliderField
                label="Brightness"
                value={cf.brightness}
                min={-80}
                max={80}
                unit=""
                onChange={(brightness) =>
                  updateLayer(selected.id, { colorFilters: { ...cf, brightness } })
                }
              />
              <SliderField
                label="Contrast"
                value={cf.contrast}
                min={-80}
                max={80}
                unit=""
                onChange={(contrast) =>
                  updateLayer(selected.id, { colorFilters: { ...cf, contrast } })
                }
              />
              <button
                onClick={() =>
                  updateLayer(
                    selected.id,
                    { colorFilters: { hue: 0, saturation: 0, brightness: 0, contrast: 0 } },
                    true
                  )
                }
                className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          );
        })()}

        {/* --- 3D SHAPE --- */}
        {activeTool === 'shape3D' && shapeLayer && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="3D Depth"
              value={shapeLayer.shape3DDepth}
              min={0}
              max={36}
              unit="px"
              onChange={(shape3DDepth) => updateLayer(shapeLayer.id, { shape3DDepth })}
            />
            {shapeLayer.shape3DDepth > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300">Depth Color</span>
                <input
                  type="color"
                  value={shapeLayer.shape3DColor}
                  onChange={(e) => updateLayer(shapeLayer.id, { shape3DColor: e.target.value })}
                  className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* --- 3D SHADOW --- */}
        {activeTool === 'shadow3D' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable 3D Floor Shadow"
              checked={selected.shadow3D.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, enabled } }, true)
              }
            />
            {selected.shadow3D.enabled && (
              <>
                <ColorPickerRow
                  label="Color"
                  color={selected.shadow3D.color}
                  onChange={(color) =>
                    updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, color } })
                  }
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Opacity"
                    value={Math.round(selected.shadow3D.opacity * 100)}
                    min={5}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, opacity: v / 100 } })
                    }
                  />
                  <SliderField
                    label="Blur"
                    value={selected.shadow3D.blur}
                    min={0}
                    max={50}
                    unit="px"
                    onChange={(blur) =>
                      updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, blur } })
                    }
                  />
                  <SliderField
                    label="Expand"
                    value={selected.shadow3D.expand}
                    min={-20}
                    max={80}
                    unit="px"
                    onChange={(expand) =>
                      updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, expand } })
                    }
                  />
                  <SliderField
                    label="Offset Y"
                    value={selected.shadow3D.offsetY}
                    min={0}
                    max={140}
                    unit="px"
                    onChange={(offsetY) =>
                      updateLayer(selected.id, { shadow3D: { ...selected.shadow3D, offsetY } })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* --- REFLECTION --- */}
        {activeTool === 'reflection' && selected && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Reflection"
              checked={selected.reflection.enabled}
              onChange={(enabled) =>
                updateLayer(selected.id, { reflection: { ...selected.reflection, enabled } }, true)
              }
            />
            {selected.reflection.enabled && (
              <div className="flex flex-wrap items-center gap-4">
                <SliderField
                  label="Vertical Gap"
                  value={selected.reflection.offsetY}
                  min={-20}
                  max={80}
                  unit="px"
                  onChange={(offsetY) =>
                    updateLayer(selected.id, { reflection: { ...selected.reflection, offsetY } })
                  }
                />
                <SliderField
                  label="Opacity"
                  value={Math.round(selected.reflection.opacity * 100)}
                  min={5}
                  max={100}
                  unit="%"
                  onChange={(v) =>
                    updateLayer(selected.id, { reflection: { ...selected.reflection, opacity: v / 100 } })
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* --- SHAPES PICKER / STYLE --- */}
        {(activeTool === 'shapesPicker' || activeTool === 'shapeStyle') && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pixellab-scroll pb-1">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.kind}
                  onClick={() => {
                    if (shapeLayer && activeTool === 'shapeStyle') {
                      updateLayer(shapeLayer.id, { shapeKind: opt.kind }, true);
                    } else {
                      addShapeLayer(opt.kind);
                    }
                  }}
                  className={`px-3 py-1.5 rounded border text-xs font-medium shrink-0 cursor-pointer ${
                    shapeLayer?.shapeKind === opt.kind
                      ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
                      : 'bg-[#262a34] border-white/10 text-slate-200 hover:border-white/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {shapeLayer && (
              <div className="flex flex-wrap items-center gap-4">
                {shapeLayer.shapeKind === 'roundedRect' && (
                  <SliderField
                    label="Corner Radius"
                    value={shapeLayer.cornerRadius}
                    min={0}
                    max={120}
                    unit="px"
                    onChange={(cornerRadius) => updateLayer(shapeLayer.id, { cornerRadius })}
                  />
                )}
                {(shapeLayer.shapeKind === 'polygon' || shapeLayer.shapeKind === 'star') && (
                  <SliderField
                    label="Sides / Points"
                    value={shapeLayer.sides}
                    min={3}
                    max={16}
                    unit=""
                    onChange={(sides) => updateLayer(shapeLayer.id, { sides })}
                  />
                )}
                {shapeLayer.shapeKind === 'star' && (
                  <SliderField
                    label="Inner Ratio"
                    value={Math.round(shapeLayer.innerRadiusRatio * 100)}
                    min={15}
                    max={85}
                    unit="%"
                    onChange={(v) => updateLayer(shapeLayer.id, { innerRadiusRatio: v / 100 })}
                  />
                )}
                {shapeLayer.shapeKind === 'arrow' && (
                  <SliderField
                    label="Arrowhead"
                    value={shapeLayer.arrowHeadSize}
                    min={20}
                    max={150}
                    unit="px"
                    onChange={(arrowHeadSize) => updateLayer(shapeLayer.id, { arrowHeadSize })}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* --- STICKERS & EMOJI --- */}
        {activeTool === 'stickers' && (
          <div className="space-y-3">
            <input
              ref={stickerFileRef}
              type="file"
              accept="image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => addStickerLayer('custom', r.result as string, f.name);
                r.readAsDataURL(f);
                e.target.value = '';
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">Vector Stickers</span>
              <button
                onClick={() => stickerFileRef.current?.click()}
                className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Import Custom Sticker</span>
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pixellab-scroll pb-1">
              {VECTOR_STICKERS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => addStickerLayer('svg', st.svg, st.label)}
                  title={st.label}
                  className="w-12 h-12 rounded-md bg-[#262a34] hover:bg-[#303542] border border-white/10 p-1.5 shrink-0 flex items-center justify-center cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: st.svg }}
                />
              ))}
            </div>
            <div className="text-[11px] font-medium text-slate-300">Emoji Library</div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_LIBRARY.map((em) => (
                <button
                  key={em}
                  onClick={() => addStickerLayer('emoji', em, `Emoji ${em}`)}
                  className="w-9 h-9 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xl flex items-center justify-center cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- FREEHAND DRAW TOOL --- */}
        {activeTool === 'drawTool' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <SliderField
                  label="Brush Size"
                  value={drawSession.brushSize}
                  min={2}
                  max={80}
                  unit="px"
                  onChange={(brushSize) => updateDrawSession({ brushSize })}
                />
                <SliderField
                  label="Opacity"
                  value={Math.round(drawSession.brushOpacity * 100)}
                  min={10}
                  max={100}
                  unit="%"
                  onChange={(v) => updateDrawSession({ brushOpacity: v / 100 })}
                />
                <button
                  onClick={() => updateDrawSession({ isEraser: !drawSession.isEraser })}
                  className={`h-8 px-3 rounded border text-xs font-medium cursor-pointer ${
                    drawSession.isEraser
                      ? 'bg-rose-500 border-rose-500 text-white'
                      : 'bg-[#262a34] border-white/10 text-slate-200'
                  }`}
                >
                  {drawSession.isEraser ? 'Eraser Active' : 'Eraser'}
                </button>
                <button
                  onClick={undoDrawStroke}
                  disabled={!drawSession.strokes.length}
                  className="h-8 px-2.5 rounded bg-[#262a34] border border-white/10 text-slate-200 disabled:opacity-35 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={redoDrawStroke}
                  disabled={!drawSession.undoneStrokes.length}
                  className="h-8 px-2.5 rounded bg-[#262a34] border border-white/10 text-slate-200 disabled:opacity-35 cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelDrawSession}
                  className="h-8 px-3 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={commitDrawSession}
                  className="h-8 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Object</span>
                </button>
              </div>
            </div>
            <ColorPickerRow
              label="Brush Color"
              color={drawSession.brushColor}
              onChange={(brushColor) => updateDrawSession({ brushColor, isEraser: false })}
            />
          </div>
        )}

        {/* --- BEZIER / PATH TOOL --- */}
        {activeTool === 'bezierTool' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <ToggleRow
                  label="Close Path & Fill"
                  checked={bezierSession.closed}
                  onChange={(closed) => updateBezierSession({ closed })}
                />
                <SliderField
                  label="Stroke"
                  value={bezierSession.strokeWidth}
                  min={0}
                  max={36}
                  unit="px"
                  onChange={(strokeWidth) => updateBezierSession({ strokeWidth })}
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-300">Stroke</span>
                  <input
                    type="color"
                    value={bezierSession.strokeColor}
                    onChange={(e) => updateBezierSession({ strokeColor: e.target.value })}
                    className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
                  />
                </div>
                {bezierSession.closed && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-300">Fill</span>
                    <input
                      type="color"
                      value={bezierSession.fillColor}
                      onChange={(e) => updateBezierSession({ fillColor: e.target.value })}
                      className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
                    />
                  </div>
                )}
                <button
                  onClick={() =>
                    bezierSession.anchors.length > 1 &&
                    updateBezierSession({ anchors: bezierSession.anchors.slice(0, -1) })
                  }
                  className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Last Point</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelBezierSession}
                  className="h-8 px-3 rounded bg-[#262a34] border border-white/10 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={commitBezierSession}
                  className="h-8 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Path</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- BACKGROUND COLOR / GRADIENT --- */}
        {activeTool === 'bgColor' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 bg-[#14171d] p-1 rounded-md border border-white/10 w-fit">
              {(['solid', 'gradient'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateBackground({ mode: m }, true)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                    doc.background.mode === m ? 'bg-[#2d8cff] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {doc.background.mode !== 'gradient' ? (
              <ColorPickerRow
                label="Background Color"
                color={doc.background.color}
                onChange={(color) => updateBackground({ mode: 'solid', color })}
              />
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <SliderField
                    label="Angle"
                    value={doc.background.gradient.angle}
                    min={0}
                    max={360}
                    unit="°"
                    onChange={(angle) =>
                      updateBackground({ gradient: { ...doc.background.gradient, angle } })
                    }
                  />
                  {doc.background.gradient.stops.map((st, idx) => (
                    <input
                      key={idx}
                      type="color"
                      value={st.color}
                      onChange={(e) => {
                        const stops = [...doc.background.gradient.stops];
                        stops[idx] = { ...stops[idx], color: e.target.value };
                        updateBackground({ gradient: { ...doc.background.gradient, stops } });
                      }}
                      className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                  ))}
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
                        onClick={() =>
                          updateBackground({ mode: 'gradient', gradient: JSON.parse(JSON.stringify(gp)) }, true)
                        }
                        style={{ background: bg }}
                        className="w-8 h-8 rounded-full shrink-0 border border-white/25 cursor-pointer"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- BACKGROUND IMAGE --- */}
        {activeTool === 'bgImage' && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={bgFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () =>
                  updateBackground({ mode: 'image', imageUrl: r.result as string }, true);
                r.readAsDataURL(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => bgFileRef.current?.click()}
              className="h-8 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Background Image</span>
            </button>
            <div className="flex items-center gap-1 bg-[#14171d] p-0.5 rounded border border-white/10">
              {(['cover', 'contain', 'stretch'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => updateBackground({ imageFit: fit })}
                  className={`px-2.5 py-1 rounded text-xs capitalize cursor-pointer ${
                    doc.background.imageFit === fit ? 'bg-[#2d8cff] text-white' : 'text-slate-400'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- IMAGE SIZE / CANVAS DIMENSIONS --- */}
        {activeTool === 'imageSize' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300">W</span>
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="w-20 h-8 px-2 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300">H</span>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="w-20 h-8 px-2 rounded bg-[#14171d] border border-white/15 text-xs font-mono tabular-nums text-white"
                />
              </div>
              <ToggleRow
                label="Scale objects proportionally"
                checked={scaleOnResize}
                onChange={setScaleOnResize}
              />
              <button
                onClick={() => resizeCanvas(customW, customH, scaleOnResize)}
                className="h-8 px-3 rounded bg-[#2d8cff] hover:bg-[#2278e6] text-xs font-semibold text-white cursor-pointer"
              >
                Apply Size
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pixellab-scroll pb-1">
              {CANVAS_SIZE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCustomW(p.width);
                    setCustomH(p.height);
                    resizeCanvas(p.width, p.height, scaleOnResize);
                  }}
                  className="px-2.5 py-1.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-left shrink-0 cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-slate-200">{p.label}</div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    {p.width}×{p.height}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- FILTERS --- */}
        {activeTool === 'filterRotate' && (
          <div className="flex flex-wrap items-center gap-4">
            <SliderField
              label="Canvas Rotate"
              value={doc.filters.rotate}
              min={-45}
              max={45}
              unit="°"
              onChange={(rotate) => updateFilters({ rotate })}
            />
            <SmallBtn label="Reset" onClick={() => updateFilters({ rotate: 0 }, true)} />
          </div>
        )}

        {activeTool === 'vignette' && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Vignette"
              checked={doc.filters.vignetteEnabled}
              onChange={(vignetteEnabled) => updateFilters({ vignetteEnabled }, true)}
            />
            {doc.filters.vignetteEnabled && (
              <>
                <ColorPickerRow
                  label="Vignette Color"
                  color={doc.filters.vignetteColor}
                  onChange={(vignetteColor) => updateFilters({ vignetteColor })}
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SliderField
                    label="Alpha"
                    value={Math.round(doc.filters.vignetteAlpha * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) => updateFilters({ vignetteAlpha: v / 100 })}
                  />
                  <SliderField
                    label="Spread"
                    value={Math.round(doc.filters.vignetteRadius * 100)}
                    min={10}
                    max={100}
                    unit="%"
                    onChange={(v) => updateFilters({ vignetteRadius: v / 100 })}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTool === 'noise' && (
          <div className="flex flex-wrap items-center gap-4">
            <ToggleRow
              label="Enable Film Noise"
              checked={doc.filters.noiseEnabled}
              onChange={(noiseEnabled) => updateFilters({ noiseEnabled }, true)}
            />
            {doc.filters.noiseEnabled && (
              <SliderField
                label="Intensity"
                value={Math.round(doc.filters.noiseAlpha * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => updateFilters({ noiseAlpha: v / 100 })}
              />
            )}
          </div>
        )}

        {activeTool === 'stripes' && (
          <div className="space-y-3">
            <ToggleRow
              label="Enable Stripes Overlay"
              checked={doc.filters.stripesEnabled}
              onChange={(stripesEnabled) => updateFilters({ stripesEnabled }, true)}
            />
            {doc.filters.stripesEnabled && (
              <div className="flex flex-wrap items-center gap-4">
                <SliderField
                  label="Count"
                  value={doc.filters.stripesCount}
                  min={2}
                  max={60}
                  unit=""
                  onChange={(stripesCount) => updateFilters({ stripesCount })}
                />
                <SliderField
                  label="Opacity"
                  value={Math.round(doc.filters.stripesAlpha * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateFilters({ stripesAlpha: v / 100 })}
                />
                <SliderField
                  label="Angle"
                  value={doc.filters.stripesAngle}
                  min={-90}
                  max={90}
                  unit="°"
                  onChange={(stripesAngle) => updateFilters({ stripesAngle })}
                />
                <input
                  type="color"
                  value={doc.filters.stripesColor}
                  onChange={(e) => updateFilters({ stripesColor: e.target.value })}
                  className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {(activeTool === 'brightness' ||
          activeTool === 'contrast' ||
          activeTool === 'hue' ||
          activeTool === 'saturation') && (
          <div className="flex flex-wrap items-center gap-5">
            <SliderField
              label="Brightness"
              value={doc.filters.brightness}
              min={-80}
              max={80}
              unit=""
              onChange={(brightness) => updateFilters({ brightness })}
            />
            <SliderField
              label="Contrast"
              value={doc.filters.contrast}
              min={-80}
              max={80}
              unit=""
              onChange={(contrast) => updateFilters({ contrast })}
            />
            <SliderField
              label="Hue"
              value={doc.filters.hue}
              min={-180}
              max={180}
              unit="°"
              onChange={(hue) => updateFilters({ hue })}
            />
            <SliderField
              label="Saturation"
              value={doc.filters.saturation}
              min={-100}
              max={100}
              unit=""
              onChange={(saturation) => updateFilters({ saturation })}
            />
            <button
              onClick={resetFilters}
              className="h-7 px-2.5 rounded bg-[#262a34] hover:bg-[#303542] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, unit, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] text-slate-300 whitespace-nowrap">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onPointerDown={() => useEditorStore.getState().pushHistory()}
      onChange={(e) => onChange(Number(e.target.value))}
      className="pl-slider w-28"
    />
    <span className="text-[11px] font-mono tabular-nums text-slate-200 w-11 text-right">
      {value}
      {unit}
    </span>
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-200">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-[#2d8cff] rounded cursor-pointer"
    />
    <span>{label}</span>
  </label>
);

const SmallBtn: React.FC<{ label: string; onClick: () => void; primary?: boolean }> = ({
  label,
  onClick,
  primary,
}) => (
  <button
    onClick={onClick}
    className={`h-7 px-2.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
      primary
        ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
        : 'bg-[#262a34] hover:bg-[#303542] border-white/10 text-slate-200'
    }`}
  >
    {label}
  </button>
);
