import { deserializePfx } from './projectStorage';
import { CanvasDocument } from '../types/editor';

export interface LoadedImageAsset {
  src: string;
  width: number;
  height: number;
  name: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg|ico|avif)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name);
}

export function isPfxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pfx') || file.name.toLowerCase().endsWith('.json');
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export function measureImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 400 });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function loadImageBlob(blob: Blob, name = 'Pasted Image'): Promise<LoadedImageAsset> {
  const src = await readBlobAsDataUrl(blob);
  const { width, height } = await measureImageDimensions(src);
  return {
    src,
    width,
    height,
    name: name.replace(/\.[^.]+$/, '') || 'Image',
  };
}

export async function fetchImageUrlAsAsset(url: string, name = 'Web Image'): Promise<LoadedImageAsset | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) {
    try {
      const { width, height } = await measureImageDimensions(trimmed);
      return { src: trimmed, width, height, name };
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:')) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && !IMAGE_EXT_RE.test(trimmed)) return null;
      return await loadImageBlob(blob, name);
    } catch {
      return null;
    }
  }
  return null;
}

export function extractImgSrcFromHtml(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export interface ExtractedTransferPayload {
  images: LoadedImageAsset[];
  pfxDoc: CanvasDocument | null;
}

export async function extractFromDataTransfer(dt: DataTransfer): Promise<ExtractedTransferPayload> {
  // Snapshot all synchronous DataTransfer fields immediately before any `await`,
  // because browsers clear DataTransfer items/strings once the event handler yields.
  const rawFiles: File[] = dt.files ? Array.from(dt.files) : [];
  const rawItemBlobs: File[] = [];
  if (dt.items && dt.items.length > 0) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) rawItemBlobs.push(f);
      }
    }
  }
  let htmlData = '';
  let uriListData = '';
  let plainTextData = '';
  try {
    htmlData = dt.getData('text/html') || '';
  } catch {
    // ignore
  }
  try {
    uriListData = dt.getData('text/uri-list') || '';
  } catch {
    // ignore
  }
  try {
    plainTextData = dt.getData('text/plain') || '';
  } catch {
    // ignore
  }

  const images: LoadedImageAsset[] = [];
  let pfxDoc: CanvasDocument | null = null;
  const seenFiles = new Set<string>();

  // 1. Direct files (Explorer drag-and-drop, Explorer file Ctrl+C/Ctrl+V, Snipping tool / Paint / Chrome Copy image)
  const candidateFiles = rawFiles.length > 0 ? rawFiles : rawItemBlobs;
  for (const file of candidateFiles) {
    const sig = `${file.name}:${file.size}:${file.type}`;
    if (isPfxFile(file) && !pfxDoc) {
      try {
        const text = await file.text();
        pfxDoc = await deserializePfx(text);
        continue;
      } catch {
        // ignore invalid pfx
      }
    }
    if ((isImageFile(file) || file.type.startsWith('image/')) && !seenFiles.has(sig)) {
      seenFiles.add(sig);
      try {
        images.push(await loadImageBlob(file, file.name || 'Dropped Image'));
      } catch {
        // skip unreadable image
      }
    }
  }

  // 2. Fallback: rawItemBlobs if rawFiles had entries that weren't images
  if (images.length === 0 && rawFiles.length > 0 && rawItemBlobs.length > 0) {
    for (const blob of rawItemBlobs) {
      if (blob.type.startsWith('image/')) {
        try {
          images.push(await loadImageBlob(blob, blob.name || 'Pasted Image'));
        } catch {
          // skip
        }
      }
    }
  }

  // 3. Fallback: HTML <img> tag or dragged image URL (dragging/copying an image from a browser tab)
  if (images.length === 0 && htmlData) {
    const htmlImgUrl = extractImgSrcFromHtml(htmlData);
    if (htmlImgUrl) {
      const asset = await fetchImageUrlAsAsset(htmlImgUrl, 'Web Image');
      if (asset) images.push(asset);
    }
  }

  if (images.length === 0) {
    const uriList = uriListData || plainTextData;
    if (uriList) {
      const firstLine = uriList.split(/\r?\n/).find((line) => line && !line.startsWith('#'));
      if (
        firstLine &&
        (firstLine.startsWith('data:image/') || IMAGE_EXT_RE.test(firstLine) || /^https?:\/\//i.test(firstLine))
      ) {
        const asset = await fetchImageUrlAsAsset(firstLine, 'Web Image');
        if (asset) images.push(asset);
      }
    }
  }

  return { images, pfxDoc };
}

export async function readImagesFromAsyncClipboard(): Promise<{
  images: LoadedImageAsset[];
  text: string | null;
}> {
  const images: LoadedImageAsset[] = [];
  let text: string | null = null;

  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return { images, text };
  }

  if (typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          images.push(await loadImageBlob(blob, 'Clipboard Image'));
        } else if (item.types.includes('text/html')) {
          const htmlBlob = await item.getType('text/html');
          const html = await htmlBlob.text();
          const url = extractImgSrcFromHtml(html);
          if (url) {
            const asset = await fetchImageUrlAsAsset(url, 'Web Image');
            if (asset) images.push(asset);
          }
        } else if (item.types.includes('text/plain') && !text) {
          const txtBlob = await item.getType('text/plain');
          text = await txtBlob.text();
        }
      }
    } catch {
      // Clipboard API permission denied or unsupported in context; try readText fallback
    }
  }

  if (images.length === 0 && !text && typeof navigator.clipboard.readText === 'function') {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        const asset = await fetchImageUrlAsAsset(t, 'Web Image');
        if (asset) images.push(asset);
        else text = t;
      }
    } catch {
      // ignore
    }
  }

  return { images, text };
}
