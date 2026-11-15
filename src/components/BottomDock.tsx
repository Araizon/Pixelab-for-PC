import React, { useRef, useState } from 'react';
import {
  AlignCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  Blend,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Copy,
  CopyPlus,
  Crop,
  Droplet,
  Edit3,
  Eraser,
  FlipHorizontal,
  FolderOpen,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Lock,
  Move,
  PaintBucket,
  Palette,
  PenTool,
  Pencil,
  Pipette,
  Plus,
  Rotate3d,
  RotateCw,
  Scissors,
  Shapes,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Square,
  SunMedium,
  Trash2,
  Type,
  Unlock,
  Wand2,
  Waves,
  Maximize2,
  Contrast,
  GripHorizontal,
} from 'lucide-react';
import { PROJECT_TEMPLATES } from '../data/presets';
import { useEditorStore } from '../store/useEditorStore';
import { BottomTab } from '../types/editor';
import { ToolPanelTray } from './ToolPanelTray';

interface RibbonItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

export const BottomDock: React.FC = () => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    document: doc,
    selectedIds,
    activeTab,
    activeTool,
    setActiveTab,
    setActiveTool,
    setInteractionMode,
    openModal,
    addTextLayer,
    duplicateLayers,
    deleteLayers,
    copySelected,
    bringToFront,
    sendToBack,
    toggleLock,
    startDrawMode,
    startBezierMode,
    updateBackground,
    resetFilters,
    setDocument,
    setPendingImportImages,
    showToast,
  } = useEditorStore();

  const selected = doc.layers.find((l) => l.id === selectedIds[0]) ?? null;

  const handleImportFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    const loaded: { src: string; naturalWidth: number; naturalHeight: number; name: string }[] = [];
    let remaining = list.length;
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onload = () => {
          loaded.push({
            src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            name: file.name.replace(/\.[^.]+$/, ''),
          });
          remaining--;
          if (remaining === 0) {
            if (loaded.length === 1) {
              setPendingImportImages(loaded);
              openModal('cropImport');
            } else {
              loaded.forEach((item) =>
                useEditorStore.getState().addImageLayer(item.src, item.naturalWidth, item.naturalHeight, item.name)
              );
              showToast(`Imported ${loaded.length} images`);
            }
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  // Build context-sensitive ribbon items per PixelLab tab & selection
  const getRibbonItems = (): RibbonItem[] => {
    // 1. PRESETS / MY PROJECTS TAB (Three Circles)
    if (activeTab === 'presets') {
      return [
        {
          id: 'myProjects',
          label: 'My Projects',
          icon: <FolderOpen className="w-4 h-4 text-[#2d8cff]" />,
          onClick: () => openModal('projects'),
        },
        ...PROJECT_TEMPLATES.map((tpl) => ({
          id: `tpl_${tpl.id}`,
          label: tpl.name,
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          onClick: () => {
            setDocument(tpl.doc(), true);
            showToast(`Loaded "${tpl.name}" template`);
          },
        })),
      ];
    }

    // 2. TEXT TAB ('A')
    if (activeTab === 'text') {
      if (!selected || selected.type !== 'text') {
        return [
          {
            id: 'addText',
            label: '+ Text',
            icon: <Plus className="w-4 h-4 text-[#2d8cff]" />,
            onClick: () => addTextLayer('New Text'),
          },
          {
            id: 'quotes',
            label: 'Quotes',
            icon: <Type className="w-4 h-4 text-amber-400" />,
            onClick: () => openModal('quotes'),
          },
        ];
      }
      return [
        {
          id: 'styles',
          label: 'Styles',
          icon: <Sparkles className="w-4 h-4" />,
          active: activeTool === 'styles',
          onClick: () => setActiveTool('styles'),
        },
        {
          id: 'edit',
          label: 'Edit',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => openModal('textEdit'),
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4 text-rose-400" />,
          onClick: () => deleteLayers([selected.id]),
        },
        {
          id: 'copy',
          label: 'Copy',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => copySelected(),
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: <CopyPlus className="w-4 h-4" />,
          onClick: () => duplicateLayers([selected.id]),
        },
        {
          id: 'toFront',
          label: 'To Front',
          icon: <ArrowUpToLine className="w-4 h-4" />,
          onClick: () => bringToFront(selected.id),
        },
        {
          id: 'toBack',
          label: 'To Back',
          icon: <ArrowDownToLine className="w-4 h-4" />,
          onClick: () => sendToBack(selected.id),
        },
        {
          id: 'position',
          label: 'Position',
          icon: <Move className="w-4 h-4" />,
          active: activeTool === 'position',
          onClick: () => setActiveTool('position'),
        },
        {
          id: 'relativePosition',
          label: 'Rel. Pos',
          icon: <GripHorizontal className="w-4 h-4" />,
          active: activeTool === 'relativePosition',
          onClick: () => setActiveTool('relativePosition'),
        },
        {
          id: 'size',
          label: 'Size',
          icon: <Type className="w-4 h-4" />,
          active: activeTool === 'size',
          onClick: () => setActiveTool('size'),
        },
        {
          id: 'padding',
          label: 'Padding',
          icon: <Square className="w-4 h-4" />,
          active: activeTool === 'padding',
          onClick: () => setActiveTool('padding'),
        },
        {
          id: 'color',
          label: 'Color',
          icon: <Palette className="w-4 h-4" />,
          active: activeTool === 'color',
          onClick: () => setActiveTool('color'),
        },
        {
          id: 'texture',
          label: 'Texture',
          icon: <ImageIcon className="w-4 h-4" />,
          active: activeTool === 'texture',
          onClick: () => setActiveTool('texture'),
        },
        {
          id: 'opacity',
          label: 'Opacity',
          icon: <Blend className="w-4 h-4" />,
          active: activeTool === 'opacity',
          onClick: () => setActiveTool('opacity'),
        },
        {
          id: 'rotate',
          label: 'Rotate',
          icon: <RotateCw className="w-4 h-4" />,
          active: activeTool === 'rotate',
          onClick: () => setActiveTool('rotate'),
        },
        {
          id: 'mask',
          label: 'Mask',
          icon: <Scissors className="w-4 h-4" />,
          active: activeTool === 'mask',
          onClick: () => setActiveTool('mask'),
        },
        {
          id: 'font',
          label: 'Font',
          icon: <Type className="w-4 h-4 text-[#60a5fa]" />,
          onClick: () => openModal('font'),
        },
        {
          id: 'style',
          label: 'B / I / U',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          active: activeTool === 'style',
          onClick: () => setActiveTool('style'),
        },
        {
          id: 'curve',
          label: 'Curve',
          icon: <Waves className="w-4 h-4" />,
          active: activeTool === 'curve',
          onClick: () => setActiveTool('curve'),
        },
        {
          id: 'textBg',
          label: 'Text Bg',
          icon: <PaintBucket className="w-4 h-4" />,
          active: activeTool === 'textBg',
          onClick: () => setActiveTool('textBg'),
        },
        {
          id: 'align',
          label: 'Align',
          icon: <AlignCenter className="w-4 h-4" />,
          active: activeTool === 'align',
          onClick: () => setActiveTool('align'),
        },
        {
          id: 'spacing',
          label: 'Spacing',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          active: activeTool === 'spacing',
          onClick: () => setActiveTool('spacing'),
        },
        {
          id: 'stroke',
          label: 'Stroke',
          icon: <Circle className="w-4 h-4" />,
          active: activeTool === 'stroke',
          onClick: () => setActiveTool('stroke'),
        },
        {
          id: 'shadow',
          label: 'Shadow',
          icon: <Droplet className="w-4 h-4" />,
          active: activeTool === 'shadow',
          onClick: () => setActiveTool('shadow'),
        },
        {
          id: 'innerShadow',
          label: 'Inner Shd',
          icon: <Droplet className="w-4 h-4" />,
          active: activeTool === 'innerShadow',
          onClick: () => setActiveTool('innerShadow'),
        },
        {
          id: 'emboss',
          label: 'Emboss',
          icon: <SunMedium className="w-4 h-4" />,
          active: activeTool === 'emboss',
          onClick: () => setActiveTool('emboss'),
        },
        {
          id: 'perspective',
          label: 'Persp.',
          icon: <Maximize2 className="w-4 h-4" />,
          active: activeTool === 'perspective',
          onClick: () => setActiveTool('perspective'),
        },
        {
          id: 'rotate3D',
          label: '3D Rotate',
          icon: <Rotate3d className="w-4 h-4" />,
          active: activeTool === 'rotate3D',
          onClick: () => setActiveTool('rotate3D'),
        },
        {
          id: 'text3D',
          label: '3D Text',
          icon: <Box className="w-4 h-4" />,
          active: activeTool === 'text3D',
          onClick: () => setActiveTool('text3D'),
        },
        {
          id: 'shadow3D',
          label: '3D Shadow',
          icon: <Layers className="w-4 h-4" />,
          active: activeTool === 'shadow3D',
          onClick: () => setActiveTool('shadow3D'),
        },
        {
          id: 'reflection',
          label: 'Reflect',
          icon: <FlipHorizontal className="w-4 h-4" />,
          active: activeTool === 'reflection',
          onClick: () => setActiveTool('reflection'),
        },
        {
          id: 'objectFilters',
          label: 'Filters',
          icon: <Contrast className="w-4 h-4" />,
          active: activeTool === 'objectFilters',
          onClick: () => setActiveTool('objectFilters'),
        },
        {
          id: 'lock',
          label: selected.locked ? 'Unlock' : 'Lock',
          icon: selected.locked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />,
          onClick: () => toggleLock(selected.id),
        },
      ];
    }

    // 3. OBJECT TAB (Hexagon) — Creation tools when none/text selected, OR Context-Sensitive Object Tools
    if (activeTab === 'object') {
      if (!selected || selected.type === 'text') {
        return [
          {
            id: 'stickers',
            label: 'Stickers',
            icon: <Smile className="w-4 h-4 text-amber-400" />,
            active: activeTool === 'stickers',
            onClick: () => setActiveTool('stickers'),
          },
          {
            id: 'import',
            label: 'Import',
            icon: <ImagePlus className="w-4 h-4 text-indigo-400" />,
            onClick: () => imageInputRef.current?.click(),
          },
          {
            id: 'drawTool',
            label: 'Draw',
            icon: <Pencil className="w-4 h-4 text-rose-400" />,
            active: activeTool === 'drawTool',
            onClick: () => startDrawMode(),
          },
          {
            id: 'shapesPicker',
            label: 'Shapes',
            icon: <Shapes className="w-4 h-4 text-[#2d8cff]" />,
            active: activeTool === 'shapesPicker',
            onClick: () => setActiveTool('shapesPicker'),
          },
          {
            id: 'bezierTool',
            label: 'Bezier',
            icon: <PenTool className="w-4 h-4 text-cyan-400" />,
            active: activeTool === 'bezierTool',
            onClick: () => startBezierMode(null),
          },
        ];
      }

      const items: RibbonItem[] = [];
      if (selected.type === 'shape') {
        items.push({
          id: 'shapeStyle',
          label: 'Edit Shape',
          icon: <Shapes className="w-4 h-4" />,
          active: activeTool === 'shapeStyle',
          onClick: () => setActiveTool('shapeStyle'),
        });
      }
      if (selected.type === 'path') {
        items.push({
          id: 'editPath',
          label: 'Edit Path',
          icon: <PenTool className="w-4 h-4" />,
          onClick: () => startBezierMode(selected.id),
        });
      }
      items.push(
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4 text-rose-400" />,
          onClick: () => deleteLayers([selected.id]),
        },
        {
          id: 'copy',
          label: 'Copy',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => copySelected(),
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: <CopyPlus className="w-4 h-4" />,
          onClick: () => duplicateLayers([selected.id]),
        },
        {
          id: 'toFront',
          label: 'To Front',
          icon: <ArrowUpToLine className="w-4 h-4" />,
          onClick: () => bringToFront(selected.id),
        },
        {
          id: 'toBack',
          label: 'To Back',
          icon: <ArrowDownToLine className="w-4 h-4" />,
          onClick: () => sendToBack(selected.id),
        },
        {
          id: 'position',
          label: 'Position',
          icon: <Move className="w-4 h-4" />,
          active: activeTool === 'position',
          onClick: () => setActiveTool('position'),
        },
        {
          id: 'relativePosition',
          label: 'Rel. Pos',
          icon: <GripHorizontal className="w-4 h-4" />,
          active: activeTool === 'relativePosition',
          onClick: () => setActiveTool('relativePosition'),
        },
        {
          id: 'relativeSize',
          label: 'Rel. Size',
          icon: <Maximize2 className="w-4 h-4" />,
          active: activeTool === 'relativeSize',
          onClick: () => setActiveTool('relativeSize'),
        }
      );

      if (selected.type === 'shape' || selected.type === 'path') {
        items.push(
          {
            id: 'fill',
            label: 'Fill / Color',
            icon: <Palette className="w-4 h-4" />,
            active: activeTool === 'fill',
            onClick: () => setActiveTool('fill'),
          },
          {
            id: 'texture',
            label: 'Texture',
            icon: <ImageIcon className="w-4 h-4" />,
            active: activeTool === 'texture',
            onClick: () => setActiveTool('texture'),
          }
        );
      } else if (selected.type === 'image' || selected.type === 'sticker') {
        items.push({
          id: 'color',
          label: 'Color Tint',
          icon: <Palette className="w-4 h-4" />,
          active: activeTool === 'color',
          onClick: () => setActiveTool('color'),
        });
      }

      if (selected.type === 'image') {
        items.push({
          id: 'cropLayer',
          label: 'Crop',
          icon: <Crop className="w-4 h-4" />,
          onClick: () => openModal('cropLayer'),
        });
      }

      if (selected.type === 'image' || selected.type === 'sticker') {
        items.push({
          id: 'eraseColor',
          label: 'Erase Color',
          icon: <Eraser className="w-4 h-4" />,
          active: activeTool === 'eraseColor' || Boolean(selected.eraseColor?.enabled),
          onClick: () => setActiveTool('eraseColor'),
        });
      }

      items.push(
        {
          id: 'objectFilters',
          label: 'Color Filters',
          icon: <Contrast className="w-4 h-4" />,
          active: activeTool === 'objectFilters',
          onClick: () => setActiveTool('objectFilters'),
        },
        {
          id: 'opacity',
          label: 'Opacity',
          icon: <Blend className="w-4 h-4" />,
          active: activeTool === 'opacity',
          onClick: () => setActiveTool('opacity'),
        },
        {
          id: 'rotate',
          label: 'Rotate',
          icon: <RotateCw className="w-4 h-4" />,
          active: activeTool === 'rotate',
          onClick: () => setActiveTool('rotate'),
        },
        {
          id: 'flip',
          label: 'Flip',
          icon: <FlipHorizontal className="w-4 h-4" />,
          active: activeTool === 'flip',
          onClick: () => setActiveTool('flip'),
        },
        {
          id: 'mask',
          label: 'Mask',
          icon: <Scissors className="w-4 h-4" />,
          active: activeTool === 'mask',
          onClick: () => setActiveTool('mask'),
        }
      );

      if ('stroke' in selected) {
        items.push({
          id: 'stroke',
          label: 'Stroke',
          icon: <Circle className="w-4 h-4" />,
          active: activeTool === 'stroke',
          onClick: () => setActiveTool('stroke'),
        });
      }

      items.push(
        {
          id: 'shadow',
          label: 'Shadow',
          icon: <Droplet className="w-4 h-4" />,
          active: activeTool === 'shadow',
          onClick: () => setActiveTool('shadow'),
        },
        {
          id: 'innerShadow',
          label: 'Inner Shd',
          icon: <Droplet className="w-4 h-4" />,
          active: activeTool === 'innerShadow',
          onClick: () => setActiveTool('innerShadow'),
        },
        {
          id: 'emboss',
          label: 'Emboss',
          icon: <SunMedium className="w-4 h-4" />,
          active: activeTool === 'emboss',
          onClick: () => setActiveTool('emboss'),
        },
        {
          id: 'perspective',
          label: 'Persp.',
          icon: <Maximize2 className="w-4 h-4" />,
          active: activeTool === 'perspective',
          onClick: () => setActiveTool('perspective'),
        },
        {
          id: 'rotate3D',
          label: '3D Rotate',
          icon: <Rotate3d className="w-4 h-4" />,
          active: activeTool === 'rotate3D',
          onClick: () => setActiveTool('rotate3D'),
        }
      );

      if (selected.type === 'shape') {
        items.push({
          id: 'shape3D',
          label: '3D Shape',
          icon: <Box className="w-4 h-4" />,
          active: activeTool === 'shape3D',
          onClick: () => setActiveTool('shape3D'),
        });
      }

      items.push(
        {
          id: 'reflection',
          label: 'Reflect',
          icon: <FlipHorizontal className="w-4 h-4" />,
          active: activeTool === 'reflection',
          onClick: () => setActiveTool('reflection'),
        },
        {
          id: 'lock',
          label: selected.locked ? 'Unlock' : 'Lock',
          icon: selected.locked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />,
          onClick: () => toggleLock(selected.id),
        }
      );

      return items;
    }

    // 4. BACKGROUND TAB (Double Square)
    if (activeTab === 'background') {
      return [
        {
          id: 'bgColor',
          label: 'Color / Grad',
          icon: <Palette className="w-4 h-4" />,
          active: activeTool === 'bgColor',
          onClick: () => setActiveTool('bgColor'),
        },
        {
          id: 'transparent',
          label: 'Transparent',
          icon: <Eraser className="w-4 h-4" />,
          active: doc.background.mode === 'transparent',
          onClick: () => updateBackground({ mode: 'transparent' }, true),
        },
        {
          id: 'imageSize',
          label: 'Image Size',
          icon: <Maximize2 className="w-4 h-4" />,
          active: activeTool === 'imageSize',
          onClick: () => setActiveTool('imageSize'),
        },
        {
          id: 'cropCanvas',
          label: 'Crop',
          icon: <Crop className="w-4 h-4" />,
          onClick: () => openModal('cropCanvas'),
        },
        {
          id: 'bgImage',
          label: 'From File',
          icon: <ImagePlus className="w-4 h-4" />,
          active: activeTool === 'bgImage',
          onClick: () => setActiveTool('bgImage'),
        },
        {
          id: 'eyedropper',
          label: 'Eyedropper',
          icon: <Pipette className="w-4 h-4" />,
          onClick: () =>
            setInteractionMode('eyedropper', (hex) => {
              updateBackground({ mode: 'solid', color: hex }, true);
            }),
        },
      ];
    }

    // 5. FILTER TAB (Magic Wand)
    return [
      {
        id: 'filterRotate',
        label: 'Rotate',
        icon: <RotateCw className="w-4 h-4" />,
        active: activeTool === 'filterRotate',
        onClick: () => setActiveTool('filterRotate'),
      },
      {
        id: 'vignette',
        label: 'Vignette',
        icon: <Circle className="w-4 h-4" />,
        active: activeTool === 'vignette' || doc.filters.vignetteEnabled,
        onClick: () => setActiveTool('vignette'),
      },
      {
        id: 'noise',
        label: 'Noise',
        icon: <Sparkles className="w-4 h-4" />,
        active: activeTool === 'noise' || doc.filters.noiseEnabled,
        onClick: () => setActiveTool('noise'),
      },
      {
        id: 'stripes',
        label: 'Stripes',
        icon: <SlidersHorizontal className="w-4 h-4" />,
        active: activeTool === 'stripes' || doc.filters.stripesEnabled,
        onClick: () => setActiveTool('stripes'),
      },
      {
        id: 'brightness',
        label: 'Brightness',
        icon: <SunMedium className="w-4 h-4" />,
        active: activeTool === 'brightness' || doc.filters.brightness !== 0,
        onClick: () => setActiveTool('brightness'),
      },
      {
        id: 'contrast',
        label: 'Contrast',
        icon: <Contrast className="w-4 h-4" />,
        active: activeTool === 'contrast' || doc.filters.contrast !== 0,
        onClick: () => setActiveTool('contrast'),
      },
      {
        id: 'hue',
        label: 'Hue',
        icon: <Palette className="w-4 h-4" />,
        active: activeTool === 'hue' || doc.filters.hue !== 0,
        onClick: () => setActiveTool('hue'),
      },
      {
        id: 'saturation',
        label: 'Saturation',
        icon: <Droplet className="w-4 h-4" />,
        active: activeTool === 'saturation' || doc.filters.saturation !== 0,
        onClick: () => setActiveTool('saturation'),
      },
      {
        id: 'resetFilters',
        label: 'Reset All',
        icon: <Trash2 className="w-4 h-4 text-rose-400" />,
        onClick: () => resetFilters(),
      },
    ];
  };

  const ribbonItems = getRibbonItems();

  const bottomTabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'presets',
      label: 'Presets',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="14" r="5" />
          <circle cx="15" cy="14" r="5" />
          <circle cx="12" cy="9" r="5" />
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Text',
      icon: <span className="text-sm font-extrabold leading-none">A</span>,
    },
    {
      id: 'object',
      label: 'Objects',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
        </svg>
      ),
    },
    {
      id: 'background',
      label: 'Background',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="12" height="12" rx="1.5" />
          <rect x="9" y="9" width="12" height="12" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'filter',
      label: 'Filters',
      icon: <Wand2 className="w-4 h-4" />,
    },
  ];

  const ribbonScrollRef = useRef<HTMLDivElement>(null);
  const [expandAllTools, setExpandAllTools] = useState(false);

  return (
    <div className="relative z-20 shrink-0 select-none">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleImportFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Expandable Tool Settings Tray */}
      <ToolPanelTray />

      {/* Context Tool Ribbon */}
      <div className="bg-[#1b1f27] border-t border-white/10 px-2 py-1.5 flex items-center gap-1">
        {!expandAllTools && (
          <button
            onClick={() => ribbonScrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
            title="Scroll tools left"
            className="h-12 w-7 rounded bg-[#232730] hover:bg-[#2c313d] border border-white/10 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div
          ref={ribbonScrollRef}
          onWheel={(e) => {
            if (!expandAllTools && ribbonScrollRef.current && e.deltaY !== 0) {
              ribbonScrollRef.current.scrollLeft += e.deltaY;
            }
          }}
          className={`flex-1 flex items-center gap-1 ${
            expandAllTools ? 'flex-wrap' : 'overflow-x-auto pixellab-scroll'
          }`}
        >
          {/* Quick "Create New" action inside Object tab even when another object is selected */}
          {activeTab === 'object' && selected && selected.type !== 'text' && (
            <div className="flex items-center gap-1 pr-2 mr-1 border-r border-white/10 shrink-0">
              <RibbonBtn
                label="Stickers"
                icon={<Smile className="w-4 h-4 text-amber-400" />}
                active={activeTool === 'stickers'}
                onClick={() => setActiveTool('stickers')}
              />
              <RibbonBtn
                label="Import"
                icon={<ImagePlus className="w-4 h-4 text-indigo-400" />}
                onClick={() => imageInputRef.current?.click()}
              />
              <RibbonBtn
                label="Draw"
                icon={<Pencil className="w-4 h-4 text-rose-400" />}
                onClick={() => startDrawMode()}
              />
              <RibbonBtn
                label="Shapes"
                icon={<Shapes className="w-4 h-4 text-[#2d8cff]" />}
                active={activeTool === 'shapesPicker'}
                onClick={() => setActiveTool('shapesPicker')}
              />
              <RibbonBtn
                label="Bezier"
                icon={<PenTool className="w-4 h-4 text-cyan-400" />}
                onClick={() => startBezierMode(null)}
              />
            </div>
          )}

          {ribbonItems.map((item) => (
            <RibbonBtn
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={item.active}
              onClick={item.onClick}
            />
          ))}
        </div>

        {!expandAllTools && (
          <button
            onClick={() => ribbonScrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
            title="Scroll tools right"
            className="h-12 w-7 rounded bg-[#232730] hover:bg-[#2c313d] border border-white/10 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => setExpandAllTools(!expandAllTools)}
          title={expandAllTools ? 'Collapse tool bar' : 'Show all tools'}
          className={`h-12 px-2 rounded border text-[10px] font-medium flex flex-col items-center justify-center gap-0.5 shrink-0 cursor-pointer ${
            expandAllTools
              ? 'bg-[#2d8cff]/20 border-[#2d8cff]/60 text-white'
              : 'bg-[#232730] hover:bg-[#2c313d] border-white/10 text-slate-300'
          }`}
        >
          {expandAllTools ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <span>All</span>
        </button>
      </div>

      {/* 5-Tab Bottom Navigation Bar (PixelLab Authentic) */}
      <nav className="h-12 bg-[#161920] border-t border-white/10 flex items-center justify-center gap-2 px-4">
        {bottomTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-4 sm:px-6 rounded-md flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#2d8cff]/15 text-[#60a5fa] border border-[#2d8cff]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

const RibbonBtn: React.FC<{
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`h-12 min-w-[58px] px-2 rounded-md flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
      active
        ? 'bg-[#2d8cff]/20 text-white border border-[#2d8cff]/60'
        : 'text-slate-300 hover:bg-white/8 hover:text-white border border-transparent'
    }`}
  >
    {icon}
    <span className="text-[10px] font-medium whitespace-nowrap leading-none">{label}</span>
  </button>
);
