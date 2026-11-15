import React, { useRef, useState } from 'react';
import {
  Calendar,
  ClipboardPaste,
  Download,
  FilePlus2,
  FolderOpen,
  Grid3x3,
  ImagePlus,
  Layers,
  Maximize,
  Minimize,
  MoreVertical,
  PenTool,
  Pencil,
  Plus,
  Quote,
  Redo2,
  Save,
  Shapes,
  Share2,
  Smile,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { readImagesFromAsyncClipboard } from '../utils/clipboardDrop';
import { deserializePfx, serializePfx } from '../utils/projectStorage';
import { saveTextFileNative, toggleDesktopFullscreen } from '../utils/tauriBridge';

export const TopToolbar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<'add' | 'save' | 'more' | null>(null);
  const pfxInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    document: doc,
    historyPast,
    historyFuture,
    zoom,
    gridEnabled,
    snapEnabled,
    layersDrawerOpen,
    isFullscreen,
    customFonts,
    undo,
    redo,
    setZoom,
    toggleGrid,
    toggleSnap,
    setLayersDrawerOpen,
    setIsFullscreen,
    openModal,
    addTextLayer,
    setActiveTab,
    setActiveTool,
    startDrawMode,
    startBezierMode,
    saveCurrentProject,
    setDocument,
    setPendingImportImages,
    showToast,
  } = useEditorStore();

  const closeMenu = () => setOpenMenu(null);

  const handleImportImages = (files: FileList | null) => {
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
              loaded.forEach((item) => {
                useEditorStore.getState().addImageLayer(item.src, item.naturalWidth, item.naturalHeight, item.name);
              });
              showToast(`Imported ${loaded.length} images`);
            }
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleOpenPfx = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const loadedDoc = await deserializePfx(text);
      setDocument(loadedDoc, true);
      showToast(`Opened "${loadedDoc.name}"`);
    } catch {
      showToast('Invalid .pfx project file');
    }
  };

  const handleExportPfx = async () => {
    closeMenu();
    const json = serializePfx(doc, customFonts);
    const safeName = `${doc.name.replace(/[^a-z0-9_-]/gi, '_') || 'project'}.pfx`;
    await saveTextFileNative(safeName, json, 'PixelLab Project (.pfx)', ['pfx']);
    showToast(`Saved ${safeName}`);
  };

  const handleFullscreen = async () => {
    await toggleDesktopFullscreen();
    setIsFullscreen(!isFullscreen);
  };

  const handlePasteFromClipboard = async () => {
    closeMenu();
    const state = useEditorStore.getState();
    const { images, text } = await readImagesFromAsyncClipboard();
    if (images.length > 0) {
      const { width, height } = state.document;
      images.forEach((img, idx) => {
        const pos =
          idx > 0
            ? {
                x: Math.round(width / 2 + idx * 24),
                y: Math.round(height / 2 + idx * 24),
              }
            : undefined;
        state.addImageLayer(img.src, img.width, img.height, img.name, pos);
      });
      showToast(
        images.length === 1
          ? `Pasted "${images[0].name}" (${images[0].width}×${images[0].height})`
          : `Pasted ${images.length} images`
      );
      return;
    }
    if (state.clipboard.length > 0) {
      state.pasteClipboard();
      return;
    }
    if (text && text.trim()) {
      state.addTextLayer(text.trim().slice(0, 500));
      showToast('Pasted text as new layer');
      return;
    }
    showToast('Press Ctrl+V on the canvas to paste an image');
  };

  return (
    <header className="relative z-30 h-12 bg-[#1c1f26] border-b border-white/10 px-3 flex items-center justify-between gap-3 shrink-0">
      {/* Hidden file inputs */}
      <input
        ref={pfxInputRef}
        type="file"
        accept=".pfx,.json"
        className="hidden"
        onChange={(e) => {
          handleOpenPfx(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleImportImages(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Backdrop click catcher for dropdowns */}
      {openMenu && <div className="fixed inset-0 z-20" onClick={closeMenu} />}

      {/* Left Zone: PixelLab Top Actions (+, Save, Export, Quotes, More) */}
      <div className="flex items-center gap-1.5 relative z-30">
        {/* + Add New Object */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'add' ? null : 'add')}
            title="Add New Object"
            className="h-8 px-2.5 rounded-md bg-[#2d8cff] hover:bg-[#2278e6] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
          {openMenu === 'add' && (
            <div className="absolute left-0 top-10 w-52 bg-[#232730] border border-white/15 rounded-lg shadow-2xl py-1.5 z-40">
              <MenuBtn
                icon={<Type className="w-4 h-4 text-[#2d8cff]" />}
                label="Text"
                onClick={() => {
                  closeMenu();
                  addTextLayer('New Text');
                }}
              />
              <MenuBtn
                icon={<Calendar className="w-4 h-4 text-emerald-400" />}
                label="Current Date"
                onClick={() => {
                  closeMenu();
                  addTextLayer(new Date().toLocaleDateString());
                }}
              />
              <MenuBtn
                icon={<Smile className="w-4 h-4 text-amber-400" />}
                label="Stickers & Emoji"
                onClick={() => {
                  closeMenu();
                  setActiveTab('object');
                  setActiveTool('stickers');
                }}
              />
              <MenuBtn
                icon={<Shapes className="w-4 h-4 text-sky-400" />}
                label="Shapes"
                onClick={() => {
                  closeMenu();
                  setActiveTab('object');
                  setActiveTool('shapesPicker');
                }}
              />
              <MenuBtn
                icon={<ImagePlus className="w-4 h-4 text-indigo-400" />}
                label="From File (Import)"
                onClick={() => {
                  closeMenu();
                  imageInputRef.current?.click();
                }}
              />
              <MenuBtn
                icon={<ClipboardPaste className="w-4 h-4 text-teal-400" />}
                label="Paste Image (Ctrl+V)"
                onClick={handlePasteFromClipboard}
              />
              <MenuBtn
                icon={<Pencil className="w-4 h-4 text-rose-400" />}
                label="Draw"
                onClick={() => {
                  closeMenu();
                  startDrawMode();
                }}
              />
              <MenuBtn
                icon={<PenTool className="w-4 h-4 text-cyan-400" />}
                label="Bezier Path"
                onClick={() => {
                  closeMenu();
                  startBezierMode(null);
                }}
              />
            </div>
          )}
        </div>

        {/* Save */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'save' ? null : 'save')}
            title="Save Project or Export"
            className="h-8 px-2.5 rounded-md bg-[#262a34] hover:bg-[#303542] text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          {openMenu === 'save' && (
            <div className="absolute left-0 top-10 w-56 bg-[#232730] border border-white/15 rounded-lg shadow-2xl py-1.5 z-40">
              <MenuBtn
                icon={<Save className="w-4 h-4 text-[#2d8cff]" />}
                label="Save to My Projects"
                onClick={async () => {
                  closeMenu();
                  await saveCurrentProject();
                }}
              />
              <MenuBtn
                icon={<Download className="w-4 h-4 text-emerald-400" />}
                label="Save As .pfx File"
                onClick={handleExportPfx}
              />
              <MenuBtn
                icon={<Share2 className="w-4 h-4 text-amber-400" />}
                label="Save as Image (Export)"
                onClick={() => {
                  closeMenu();
                  openModal('export');
                }}
              />
            </div>
          )}
        </div>

        {/* Export / Share */}
        <button
          onClick={() => openModal('export')}
          title="Export Image"
          className="h-8 px-2.5 rounded-md bg-[#262a34] hover:bg-[#303542] text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Export</span>
        </button>

        {/* Quotes */}
        <button
          onClick={() => openModal('quotes')}
          title="Quotes Library"
          className="h-8 w-8 rounded-md bg-[#262a34] hover:bg-[#303542] text-slate-200 flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
        >
          <Quote className="w-4 h-4" />
        </button>

        {/* More Options */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
            title="More Options & Project Menu"
            className="h-8 w-8 rounded-md bg-[#262a34] hover:bg-[#303542] text-slate-200 flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {openMenu === 'more' && (
            <div className="absolute left-0 top-10 w-56 bg-[#232730] border border-white/15 rounded-lg shadow-2xl py-1.5 z-40">
              <MenuBtn
                icon={<FilePlus2 className="w-4 h-4 text-[#2d8cff]" />}
                label="New / My Projects"
                onClick={() => {
                  closeMenu();
                  openModal('projects');
                }}
              />
              <MenuBtn
                icon={<FolderOpen className="w-4 h-4 text-amber-400" />}
                label="Open .pfx File..."
                onClick={() => {
                  closeMenu();
                  pfxInputRef.current?.click();
                }}
              />
              <div className="my-1 border-t border-white/10" />
              <MenuBtn
                icon={<Maximize2 className="w-4 h-4 text-sky-400" />}
                label="Image Size / Canvas"
                onClick={() => {
                  closeMenu();
                  setActiveTab('background');
                  setActiveTool('imageSize');
                }}
              />
              <MenuBtn
                icon={<Grid3x3 className="w-4 h-4 text-emerald-400" />}
                label={snapEnabled ? 'Disable Snap to Guides' : 'Enable Snap to Guides'}
                onClick={() => {
                  toggleSnap();
                  closeMenu();
                }}
              />
              <MenuBtn
                icon={isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
                onClick={() => {
                  closeMenu();
                  handleFullscreen();
                }}
              />
            </div>
          )}
        </div>

        {/* Editable Project Title */}
        <button
          onClick={() => openModal('projects')}
          className="hidden lg:flex items-center gap-2 ml-2 px-2.5 h-8 rounded-md hover:bg-white/5 text-xs text-slate-300 font-medium truncate max-w-[180px] cursor-pointer"
          title="Open Project Manager"
        >
          <span className="truncate">{doc.name}</span>
        </button>
      </div>

      {/* Right Zone: History, Zoom, Fit, Grid, Layers, Fullscreen */}
      <div className="flex items-center gap-1.5 relative z-30">
        {/* Undo / Redo */}
        <div className="flex items-center bg-[#262a34] border border-white/10 rounded-md p-0.5">
          <button
            onClick={undo}
            disabled={historyPast.length === 0}
            title="Undo (Ctrl+Z)"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={historyFuture.length === 0}
            title="Redo (Ctrl+Y)"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center bg-[#262a34] border border-white/10 rounded-md p-0.5">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            title="Zoom Out"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-200 hover:bg-white/10 cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('pixellab:fit-canvas'))}
            title="Fit Canvas to View"
            className="h-7 px-2 rounded text-[11px] font-mono tabular-nums text-slate-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            title="Zoom In"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-200 hover:bg-white/10 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fit Canvas button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('pixellab:fit-canvas'))}
          title="Fit Canvas"
          className="hidden sm:flex h-8 w-8 rounded-md bg-[#262a34] hover:bg-[#303542] border border-white/10 items-center justify-center text-slate-200 cursor-pointer shrink-0"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Grid Toggle */}
        <button
          onClick={toggleGrid}
          title="Toggle Alignment Grid"
          className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            gridEnabled
              ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
              : 'bg-[#262a34] hover:bg-[#303542] border-white/10 text-slate-200'
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>

        {/* Layers Drawer Toggle */}
        <button
          onClick={() => setLayersDrawerOpen(!layersDrawerOpen)}
          title="Toggle Layers Panel"
          className={`h-8 px-2.5 rounded-md border flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            layersDrawerOpen
              ? 'bg-[#2d8cff] border-[#2d8cff] text-white'
              : 'bg-[#262a34] hover:bg-[#303542] border-white/10 text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="font-mono tabular-nums text-[11px]">{doc.layers.length}</span>
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          title="Fullscreen Mode"
          className="h-8 w-8 rounded-md bg-[#262a34] hover:bg-[#303542] border border-white/10 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};

const MenuBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
  >
    {icon}
    <span>{label}</span>
  </button>
);
