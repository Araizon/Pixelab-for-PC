import { useEffect } from 'react';
import { BottomDock } from './components/BottomDock';
import { CanvasViewport } from './components/CanvasViewport';
import { IsolatedEraseHeader } from './components/IsolatedEraseHeader';
import { LayersDrawer } from './components/LayersDrawer';
import { CropModal } from './components/modals/CropModal';
import { ExportModal } from './components/modals/ExportModal';
import { FontModal } from './components/modals/FontModal';
import { ProjectManagerModal } from './components/modals/ProjectManagerModal';
import { QuotesModal } from './components/modals/QuotesModal';
import { TextEditModal } from './components/modals/TextEditModal';
import { TopToolbar } from './components/TopToolbar';
import { isIsolatedEraseActive, useEditorStore } from './store/useEditorStore';

export default function App() {
  const { initWorkspace, toastMessage, activeTool, selectedIds, document: doc } = useEditorStore();
  const isolatedErase = isIsolatedEraseActive(activeTool, selectedIds, doc.layers);

  useEffect(() => {
    initWorkspace();
  }, [initWorkspace]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#14161b] text-slate-100 overflow-hidden">
      {/* Compact PixelLab Top Toolbar or Dedicated Isolated Erase Header */}
      {isolatedErase ? <IsolatedEraseHeader /> : <TopToolbar />}

      {/* Central Canvas + Slide-Over Layers Drawer */}
      <main className="relative flex-1 flex overflow-hidden">
        <CanvasViewport />
        {!isolatedErase && <LayersDrawer />}
      </main>

      {/* Expandable Tool Tray + Context Ribbon + 5-Tab Bottom Bar */}
      <BottomDock />

      {/* Modal Dialogs */}
      <TextEditModal />
      <QuotesModal />
      <FontModal />
      <ProjectManagerModal />
      <ExportModal />
      <CropModal />

      {/* Transient Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-md bg-[#232730] border border-[#2d8cff]/50 text-xs font-medium text-white shadow-xl pointer-events-none">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
