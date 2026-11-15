// Bridge for Tauri v2 desktop integration with safe browser fallbacks

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function saveTextFileNative(
  suggestedName: string,
  content: string,
  filterName = 'PixelLab Project',
  extensions = ['pfx']
): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const saved: boolean = await invoke('save_pfx_dialog', {
        suggestedName,
        content,
        filterName,
        extensions,
      });
      return saved;
    } catch (err) {
      console.warn('Tauri native save fallback to browser download:', err);
    }
  }
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export async function saveBinaryImageNative(
  suggestedName: string,
  dataUrl: string,
  extensions: string[]
): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const base64 = dataUrl.split(',')[1] || '';
      const saved: boolean = await invoke('save_image_dialog', {
        suggestedName,
        base64Data: base64,
        extensions,
      });
      return saved;
    } catch (err) {
      console.warn('Tauri native image save fallback to browser download:', err);
    }
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export async function toggleDesktopFullscreen(): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
      return;
    } catch {
      // fallback to browser fullscreen API
    }
  }
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    await document.exitFullscreen?.().catch(() => {});
  }
}
