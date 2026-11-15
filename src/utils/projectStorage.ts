import { CanvasDocument, CustomFontAsset, PfxFileFormat, ProjectSummary } from '../types/editor';

const DB_NAME = 'pixellab_desktop_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_FONTS = 'custom_fonts';

interface StoredProjectEntry {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  thumbnailDataUrl: string;
  document: CanvasDocument;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FONTS)) {
        db.createObjectStore(STORE_FONTS, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectLocal(doc: CanvasDocument, thumbnailDataUrl: string): Promise<void> {
  const entry: StoredProjectEntry = {
    id: doc.id,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    updatedAt: Date.now(),
    thumbnailDataUrl,
    document: { ...doc, updatedAt: Date.now() },
  };
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`pfx_proj_${doc.id}`, JSON.stringify(entry));
  }
}

export async function listProjectsLocal(): Promise<ProjectSummary[]> {
  try {
    const db = await openDB();
    const entries = await new Promise<StoredProjectEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return entries
      .map(({ id, name, width, height, updatedAt, thumbnailDataUrl }) => ({
        id,
        name,
        width,
        height,
        updatedAt,
        thumbnailDataUrl,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function loadProjectLocal(id: string): Promise<CanvasDocument | null> {
  try {
    const db = await openDB();
    const entry = await new Promise<StoredProjectEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return entry?.document ?? null;
  } catch {
    const raw = localStorage.getItem(`pfx_proj_${id}`);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as StoredProjectEntry).document;
    } catch {
      return null;
    }
  }
}

export async function deleteProjectLocal(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(`pfx_proj_${id}`);
  }
}

export async function registerCustomFont(font: CustomFontAsset, persist = true): Promise<string> {
  try {
    const face = new FontFace(font.name, `url(${font.dataUrl})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch (err) {
    console.error('Failed to register font face:', font.name, err);
  }
  if (persist) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_FONTS, 'readwrite');
        tx.objectStore(STORE_FONTS).put(font);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore storage failure
    }
  }
  return font.name;
}

export async function loadSavedCustomFonts(): Promise<CustomFontAsset[]> {
  try {
    const db = await openDB();
    const fonts = await new Promise<CustomFontAsset[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FONTS, 'readonly');
      const req = tx.objectStore(STORE_FONTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const f of fonts) {
      await registerCustomFont(f, false);
    }
    return fonts;
  } catch {
    return [];
  }
}

export function serializePfx(doc: CanvasDocument, customFonts: CustomFontAsset[] = []): string {
  const payload: PfxFileFormat = {
    format: 'pixellab-desktop-pfx',
    version: 1,
    exportedAt: new Date().toISOString(),
    document: doc,
    customFonts,
  };
  return JSON.stringify(payload, null, 2);
}

export async function deserializePfx(raw: string): Promise<CanvasDocument> {
  const parsed = JSON.parse(raw) as PfxFileFormat;
  if (parsed?.format !== 'pixellab-desktop-pfx' || !parsed.document) {
    throw new Error('Invalid .pfx project file.');
  }
  if (parsed.customFonts?.length) {
    for (const font of parsed.customFonts) {
      await registerCustomFont(font, true);
    }
  }
  return {
    ...parsed.document,
    updatedAt: Date.now(),
  };
}
