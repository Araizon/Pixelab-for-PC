import {
  BezierAnchor,
  EmbossConfig,
  FillConfig,
  GradientConfig,
  LayerObject,
  PathLayer,
  PerspectivePoints,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from '../types/editor';

const imageCache = new Map<string, HTMLImageElement>();
const pendingImageLoads = new Map<string, Promise<HTMLImageElement | null>>();
const loadedFontsSet = new Set<string>();
const pendingFontLoads = new Map<string, Promise<void>>();
const layerRenderCache = new Map<string, RenderedLayerResult>();
const MAX_LAYER_CACHE = 120;
const MAX_RENDER_PIXEL_DIM = 2400;

export function quantizeRenderScale(rawScale: number, logicalW: number, logicalH: number): number {
  const s = Math.max(1, rawScale);
  const stepped = s <= 1.15 ? 1 : s <= 1.65 ? 1.5 : s <= 2.3 ? 2 : s <= 3.15 ? 3 : 4;
  const maxSafe = Math.max(1, MAX_RENDER_PIXEL_DIM / Math.max(1, logicalW, logicalH));
  return Math.max(1, Number(Math.min(stepped, maxSafe).toFixed(2)));
}

let sharedMeasureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!sharedMeasureCanvas) {
    sharedMeasureCanvas = document.createElement('canvas');
  }
  return sharedMeasureCanvas.getContext('2d')!;
}

export function getLayerVisualCacheKey(layer: LayerObject): string {
  const {
    x: _x,
    y: _y,
    scaleX: _sx,
    scaleY: _sy,
    rotation: _rot,
    opacity: _op,
    visible: _vis,
    locked: _lck,
    name: _nm,
    groupId: _grp,
    ...visualProps
  } = layer;
  return JSON.stringify(visualProps);
}

export function getLayerCoreBox(layer: LayerObject): { w: number; h: number } {
  if (layer.type === 'text') {
    const m = measureTextLayout(layer as TextLayer);
    return { w: Math.max(60, m.boxW), h: Math.max(40, m.boxH) };
  }
  return { w: layer.width, h: layer.height };
}

export function ensureFontLoaded(
  fontFamily: string,
  bold: boolean,
  italic: boolean,
  onLoad?: () => void
) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const key = `${italic ? 'italic' : 'normal'}_${bold ? '700' : '400'}_${fontFamily}`;
  if (loadedFontsSet.has(key)) return;
  const spec = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}32px "${fontFamily}"`;
  if (document.fonts.check(spec)) {
    loadedFontsSet.add(key);
    return;
  }
  if (!pendingFontLoads.has(key)) {
    const p = document.fonts
      .load(spec)
      .then(() => {
        loadedFontsSet.add(key);
        pendingFontLoads.delete(key);
        onLoad?.();
      })
      .catch(() => {
        loadedFontsSet.add(key);
        pendingFontLoads.delete(key);
      });
    pendingFontLoads.set(key, p);
  } else if (onLoad) {
    pendingFontLoads.get(key)?.then(() => onLoad());
  }
}

export function getCachedImage(src: string, onLoad?: () => void): HTMLImageElement | null {
  if (!src) return null;
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return existing;
  }
  if (!pendingImageLoads.has(src)) {
    const p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(src, img);
        pendingImageLoads.delete(src);
        onLoad?.();
        resolve(img);
      };
      img.onerror = () => {
        pendingImageLoads.delete(src);
        resolve(null);
      };
      img.src = src;
    });
    pendingImageLoads.set(src, p);
  } else if (onLoad) {
    pendingImageLoads.get(src)?.then(() => onLoad());
  }
  return null;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createCanvasFill(
  ctx: CanvasRenderingContext2D,
  fill: FillConfig,
  width: number,
  height: number,
  onAssetLoad?: () => void
): string | CanvasGradient | CanvasPattern {
  if (fill.mode === 'texture' && fill.textureDataUrl) {
    const img = getCachedImage(fill.textureDataUrl, onAssetLoad);
    if (img) {
      const pattern = ctx.createPattern(img, 'repeat');
      if (pattern) {
        const s = fill.textureScale ?? 1;
        if (s !== 1 && typeof DOMMatrix !== 'undefined') {
          pattern.setTransform(new DOMMatrix().scale(s, s));
        }
        return pattern;
      }
    }
  }
  if (fill.mode === 'gradient') {
    return createGradient(ctx, fill.gradient, width, height);
  }
  return fill.color;
}

export function createGradient(
  ctx: CanvasRenderingContext2D,
  g: GradientConfig,
  width: number,
  height: number
): CanvasGradient {
  const cx = width / 2;
  const cy = height / 2;
  if (g.type === 'radial') {
    const r = Math.max(width, height) * 0.6;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const s of g.stops) {
      grad.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color);
    }
    return grad;
  }
  const rad = ((g.angle - 90) * Math.PI) / 180;
  const halfDiag = Math.sqrt(width * width + height * height) / 2;
  const dx = Math.cos(rad) * halfDiag;
  const dy = Math.sin(rad) * halfDiag;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const s of g.stops) {
    grad.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color);
  }
  return grad;
}

function darkenHexColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return '#111827';
  const factor = Math.max(0, Math.min(1, 1 - percent / 100));
  const r = Math.round(((num >> 16) & 255) * factor);
  const g = Math.round(((num >> 8) & 255) * factor);
  const b = Math.round((num & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

export function measureTextLayout(textLayer: TextLayer): {
  lines: string[];
  lineWidths: number[];
  lineHeightPx: number;
  contentW: number;
  contentH: number;
  boxW: number;
  boxH: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
} {
  const ctx = getMeasureCtx();
  const fontStyle = `${textLayer.italic ? 'italic ' : ''}${textLayer.bold ? '700 ' : '400 '}${textLayer.fontSize}px "${textLayer.fontFamily}", sans-serif`;
  ctx.font = fontStyle;

  const lines = (textLayer.text || ' ').split('\n');
  const lineHeightPx = textLayer.fontSize * textLayer.lineHeight;
  const lineWidths = lines.map((line) => {
    if (!line) return textLayer.fontSize * 0.3;
    const base = ctx.measureText(line).width;
    const letterExtra = Math.max(0, line.length - 1) * textLayer.letterSpacing;
    const wordCount = Math.max(0, line.split(' ').length - 1);
    const wordExtra = wordCount * textLayer.wordSpacing;
    return base + letterExtra + wordExtra;
  });

  const padL = Math.max(textLayer.paddingLeft, textLayer.textBg.enabled ? textLayer.textBg.paddingLeft : 0);
  const padR = Math.max(textLayer.paddingRight, textLayer.textBg.enabled ? textLayer.textBg.paddingRight : 0);
  const padT = Math.max(textLayer.paddingTop, textLayer.textBg.enabled ? textLayer.textBg.paddingTop : 0);
  const padB = Math.max(textLayer.paddingBottom, textLayer.textBg.enabled ? textLayer.textBg.paddingBottom : 0);
  const strokeExtra = textLayer.stroke.enabled ? textLayer.stroke.width * 2 : 0;

  if (textLayer.curve !== 0) {
    const flatStr = textLayer.text.replace(/\n/g, ' ');
    const totalW = Math.max(
      40,
      [...flatStr].reduce(
        (acc, ch) =>
          acc + ctx.measureText(ch).width + textLayer.letterSpacing + (ch === ' ' ? textLayer.wordSpacing : 0),
        0
      )
    );
    const curveNorm = Math.abs(textLayer.curve) / 100;
    const sweepAngle = Math.max(0.14, curveNorm * Math.PI * 1.85);
    const radius = totalW / sweepAngle;
    const outerR = radius + textLayer.fontSize * 0.75;
    const halfSpanX = sweepAngle >= Math.PI ? outerR : Math.sin(sweepAngle / 2) * outerR + textLayer.fontSize * 0.6;
    const sagitta = (1 - Math.cos(Math.min(Math.PI, sweepAngle / 2))) * outerR + textLayer.fontSize * 1.3;
    const boxW = Math.ceil(halfSpanX * 2 + padL + padR + strokeExtra);
    const boxH = Math.ceil(sagitta + padT + padB + strokeExtra);
    return {
      lines,
      lineWidths,
      lineHeightPx,
      contentW: halfSpanX * 2,
      contentH: sagitta,
      boxW,
      boxH,
      padL,
      padR,
      padT,
      padB,
    };
  }

  const maxLineW = Math.max(40, ...lineWidths);
  const contentW = maxLineW;
  const contentH = Math.max(lines.length * lineHeightPx, textLayer.fontSize);

  const boxW = Math.ceil(contentW + padL + padR + strokeExtra);
  const boxH = Math.ceil(contentH + padT + padB + strokeExtra);

  return {
    lines,
    lineWidths,
    lineHeightPx,
    contentW,
    contentH,
    boxW,
    boxH,
    padL,
    padR,
    padT,
    padB,
  };
}

function drawTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  letterSpacing: number,
  wordSpacing: number,
  strokeFirst: boolean,
  doFill: boolean,
  doStroke: boolean,
  underline: boolean,
  lineWidthMeasured: number,
  fontSize: number
) {
  let cursorX = x;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (strokeFirst && doStroke) ctx.strokeText(ch, cursorX, y);
    if (doFill) ctx.fillText(ch, cursorX, y);
    if (!strokeFirst && doStroke) ctx.strokeText(ch, cursorX, y);
    const w = ctx.measureText(ch).width;
    cursorX += w + letterSpacing + (ch === ' ' ? wordSpacing : 0);
  }
  if (underline && doFill) {
    ctx.save();
    ctx.fillRect(x, y + Math.max(4, fontSize * 0.08), lineWidthMeasured, Math.max(2, fontSize * 0.06));
    ctx.restore();
  }
}

function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  textLayer: TextLayer,
  w: number,
  h: number,
  doFill: boolean,
  doStroke: boolean
) {
  const str = textLayer.text.replace(/\n/g, ' ');
  if (!str) return;
  const curveNorm = textLayer.curve / 100;
  const totalWidth = Math.max(
    40,
    [...str].reduce(
      (acc, ch) =>
        acc + ctx.measureText(ch).width + textLayer.letterSpacing + (ch === ' ' ? textLayer.wordSpacing : 0),
      0
    )
  );
  const sweepAngle = Math.max(0.14, Math.abs(curveNorm) * Math.PI * 1.85);
  const radius = totalWidth / sweepAngle;
  const sign = curveNorm >= 0 ? 1 : -1;
  const startAngle = (sign > 0 ? -Math.PI / 2 : Math.PI / 2) - (sign * sweepAngle) / 2;

  // Center the vertical arc extent inside (w, h)
  const sagitta = (1 - Math.cos(Math.min(Math.PI, sweepAngle / 2))) * radius;
  const arcCenterY = sign > 0 ? (h - sagitta) / 2 + radius : (h + sagitta) / 2 - radius;
  const cx = w / 2;

  let angleCursor = startAngle;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const charW = ctx.measureText(ch).width + textLayer.letterSpacing + (ch === ' ' ? textLayer.wordSpacing : 0);
    const charAngle = charW / radius;
    const midAngle = angleCursor + (sign * charAngle) / 2;

    ctx.save();
    ctx.translate(cx + Math.cos(midAngle) * radius, arcCenterY + Math.sin(midAngle) * radius);
    ctx.rotate(midAngle + (sign > 0 ? Math.PI / 2 : -Math.PI / 2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (doStroke) ctx.strokeText(ch, 0, 0);
    if (doFill) ctx.fillText(ch, 0, 0);
    ctx.restore();

    angleCursor += sign * charAngle;
  }
}

function renderCoreObjectCanvas(
  layer: LayerObject,
  onAssetLoad?: () => void,
  renderScale = 1
): { canvas: HTMLCanvasElement; w: number; h: number } {
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d')!;

  if (layer.type === 'text') {
    ensureFontLoaded(layer.fontFamily, layer.bold, layer.italic, onAssetLoad);
    const layout = measureTextLayout(layer);
    const w = Math.max(60, layout.boxW);
    const h = Math.max(40, layout.boxH);
    off.width = Math.max(1, Math.round(w * renderScale));
    off.height = Math.max(1, Math.round(h * renderScale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(renderScale, renderScale);

    // Text background box (expands tightly around text + background padding)
    if (layer.textBg.enabled) {
      const boxLeft = Math.max(0, layout.padL - layer.textBg.paddingLeft);
      const boxTop = Math.max(0, layout.padT - layer.textBg.paddingTop);
      const boxRight = Math.min(w, w - Math.max(0, layout.padR - layer.textBg.paddingRight));
      const boxBottom = Math.min(h, h - Math.max(0, layout.padB - layer.textBg.paddingBottom));
      ctx.save();
      ctx.fillStyle = layer.textBg.color;
      roundRectPath(ctx, boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, layer.textBg.radius);
      ctx.fill();
      ctx.restore();
    }

    const fontStr = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
    ctx.font = fontStr;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawTextPass = (
      fillStyle: string | CanvasGradient | CanvasPattern,
      strokeStyle: string,
      doFill: boolean,
      doStroke: boolean
    ) => {
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = layer.stroke.width * 2;
      if (layer.curve !== 0) {
        drawCurvedText(ctx, layer, w, h, doFill, doStroke);
        return;
      }
      const startY = layout.padT + (h - layout.padT - layout.padB - layout.lines.length * layout.lineHeightPx) / 2 + layer.fontSize * 0.85;
      const innerW = w - layout.padL - layout.padR;
      layout.lines.forEach((line, idx) => {
        const lw = layout.lineWidths[idx];
        let lx = layout.padL;
        if (layer.align === 'center') lx = layout.padL + (innerW - lw) / 2;
        else if (layer.align === 'right') lx = w - layout.padR - lw;
        const ly = startY + idx * layout.lineHeightPx;
        drawTextWithSpacing(
          ctx,
          line,
          lx,
          ly,
          layer.letterSpacing,
          layer.wordSpacing,
          true,
          doFill,
          doStroke,
          layer.underline,
          lw,
          layer.fontSize
        );
      });
    };

    // 3D Extrusion pass (with optional 3D X/Y/Z rotation)
    const t3d = layer.text3D;
    const has3DRot = t3d.enabled && (t3d.rotateX !== 0 || t3d.rotateY !== 0 || t3d.rotateZ !== 0);

    if (t3d.enabled && t3d.depth > 0 && !has3DRot) {
      const steps = Math.min(48, Math.max(1, Math.round(t3d.depth)));
      const rad = (t3d.angle * Math.PI) / 180;
      const stepDx = t3d.mode === 'oblique' ? Math.cos(rad) * 1.15 : 0;
      const stepDy = t3d.mode === 'oblique' ? Math.sin(rad) * 1.15 : 1.05;
      const baseExtColor =
        t3d.colorMode === 'custom'
          ? t3d.color
          : darkenHexColor(layer.fill.color, t3d.darken);

      for (let s = steps; s >= 1; s--) {
        ctx.save();
        const scale = t3d.mode === 'perspective' ? 1 - s * 0.004 : 1;
        ctx.translate(w / 2 + stepDx * s, h / 2 + stepDy * s);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
        const shade = darkenHexColor(baseExtColor, (s / steps) * t3d.darken * 0.5);
        drawTextPass(shade, shade, true, layer.stroke.enabled);
        ctx.restore();
      }
    }

    if (has3DRot) {
      // Render un-extruded front face & silhouette, rotate in 3D, then stamp volumetric depth
      const frontCanvas = document.createElement('canvas');
      frontCanvas.width = Math.max(1, Math.round(w * renderScale));
      frontCanvas.height = Math.max(1, Math.round(h * renderScale));
      const frCtx = frontCanvas.getContext('2d')!;
      frCtx.imageSmoothingEnabled = true;
      frCtx.imageSmoothingQuality = 'high';
      frCtx.scale(renderScale, renderScale);
      frCtx.font = fontStr;
      frCtx.textBaseline = 'alphabetic';
      frCtx.lineJoin = 'round';
      frCtx.lineCap = 'round';
      const drawToTarget = (
        tctx: CanvasRenderingContext2D,
        fillS: string | CanvasGradient | CanvasPattern,
        strokeS: string
      ) => {
        tctx.fillStyle = fillS;
        tctx.strokeStyle = strokeS;
        tctx.lineWidth = layer.stroke.width * 2;
        if (layer.curve !== 0) {
          drawCurvedText(tctx, layer, w, h, true, layer.stroke.enabled);
          return;
        }
        const startY =
          layout.padT +
          (h - layout.padT - layout.padB - layout.lines.length * layout.lineHeightPx) / 2 +
          layer.fontSize * 0.85;
        const innerW = w - layout.padL - layout.padR;
        layout.lines.forEach((line, idx) => {
          const lw = layout.lineWidths[idx];
          let lx = layout.padL;
          if (layer.align === 'center') lx = layout.padL + (innerW - lw) / 2;
          else if (layer.align === 'right') lx = w - layout.padR - lw;
          const ly = startY + idx * layout.lineHeightPx;
          drawTextWithSpacing(
            tctx,
            line,
            lx,
            ly,
            layer.letterSpacing,
            layer.wordSpacing,
            true,
            true,
            layer.stroke.enabled,
            layer.underline,
            lw,
            layer.fontSize
          );
        });
      };

      const frontFill = createCanvasFill(frCtx, layer.fill, w, h, onAssetLoad);
      drawToTarget(frCtx, frontFill, layer.stroke.color);

      const baseExtColor =
        t3d.colorMode === 'custom'
          ? t3d.color
          : darkenHexColor(layer.fill.color, t3d.darken);

      const silCanvas = document.createElement('canvas');
      silCanvas.width = frontCanvas.width;
      silCanvas.height = frontCanvas.height;
      const silCtx = silCanvas.getContext('2d')!;
      silCtx.imageSmoothingEnabled = true;
      silCtx.imageSmoothingQuality = 'high';
      silCtx.scale(renderScale, renderScale);
      silCtx.font = fontStr;
      silCtx.textBaseline = 'alphabetic';
      silCtx.lineJoin = 'round';
      silCtx.lineCap = 'round';
      drawToTarget(silCtx, baseExtColor, baseExtColor);

      const rx = (t3d.rotateX * Math.PI) / 180;
      const ry = (t3d.rotateY * Math.PI) / 180;
      const rz = (t3d.rotateZ * Math.PI) / 180;
      const rotFront = apply3DEulerTilt(frontCanvas, rx, ry, rz);
      const rotSil = apply3DEulerTilt(silCanvas, rx, ry, rz);

      const rw = rotFront.width / renderScale;
      const rh = rotFront.height / renderScale;
      const steps = Math.min(48, Math.max(1, Math.round(t3d.depth)));
      const rad = (t3d.angle * Math.PI) / 180;
      const obDx = t3d.mode === 'oblique' ? Math.cos(rad) * 0.9 : 0;
      const obDy = t3d.mode === 'oblique' ? Math.sin(rad) * 0.9 : 0.6;
      const stepDx = -Math.sin(ry) * 1.1 + obDx;
      const stepDy = Math.sin(rx) * 1.1 + obDy;

      const pad = Math.ceil(steps * 1.5 + Math.max(rw - w, rh - h) / 2 + 12);
      const outW = w + pad * 2;
      const outH = h + pad * 2;
      off.width = Math.max(1, Math.round(outW * renderScale));
      off.height = Math.max(1, Math.round(outH * renderScale));
      const octx = off.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.scale(renderScale, renderScale);
      // Re-draw text background centered if enabled
      if (layer.textBg.enabled) {
        const boxLeft = pad + Math.max(0, layout.padL - layer.textBg.paddingLeft);
        const boxTop = pad + Math.max(0, layout.padT - layer.textBg.paddingTop);
        const boxRight = pad + Math.min(w, w - Math.max(0, layout.padR - layer.textBg.paddingRight));
        const boxBottom = pad + Math.min(h, h - Math.max(0, layout.padB - layer.textBg.paddingBottom));
        octx.save();
        octx.fillStyle = layer.textBg.color;
        roundRectPath(octx, boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, layer.textBg.radius);
        octx.fill();
        octx.restore();
      }

      const cx = outW / 2;
      const cy = outH / 2;
      for (let s = steps; s >= 1; s--) {
        octx.save();
        const scale = t3d.mode === 'perspective' ? 1 - s * 0.004 : 1;
        octx.translate(cx + stepDx * s, cy + stepDy * s);
        octx.scale(scale, scale);
        octx.globalAlpha = Math.max(0.25, 1 - (s / steps) * (t3d.darken / 160));
        octx.drawImage(rotSil, -rw / 2, -rh / 2, rw, rh);
        octx.restore();
      }
      octx.drawImage(rotFront, cx - rw / 2, cy - rh / 2, rw, rh);
      return { canvas: off, w: outW, h: outH };
    }

    const mainFill = createCanvasFill(ctx, layer.fill, w, h, onAssetLoad);
    drawTextPass(mainFill, layer.stroke.color, true, layer.stroke.enabled);
    return { canvas: off, w, h };
  }

  if (layer.type === 'shape') {
    const w = Math.max(20, Math.round(layer.width));
    const h = Math.max(20, Math.round(layer.height));
    off.width = Math.max(1, Math.round(w * renderScale));
    off.height = Math.max(1, Math.round(h * renderScale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(renderScale, renderScale);
    const pad = layer.stroke.enabled ? layer.stroke.width + 2 : 4;
    const iw = Math.max(8, w - pad * 2);
    const ih = Math.max(8, h - pad * 2);

    if (layer.shape3DDepth > 0) {
      const steps = Math.min(36, Math.round(layer.shape3DDepth));
      for (let s = steps; s >= 1; s--) {
        ctx.save();
        ctx.translate(s * 0.9, s * 0.9);
        buildShapePath(ctx, layer.shapeKind, pad, pad, iw, ih, layer);
        ctx.fillStyle = darkenHexColor(layer.shape3DColor || layer.fill.color, (s / steps) * 40);
        ctx.fill();
        ctx.restore();
      }
    }

    buildShapePath(ctx, layer.shapeKind, pad, pad, iw, ih, layer);
    ctx.fillStyle = createCanvasFill(ctx, layer.fill, w, h, onAssetLoad);
    ctx.fill();
    if (layer.stroke.enabled && layer.stroke.width > 0) {
      ctx.strokeStyle = layer.stroke.color;
      ctx.lineWidth = layer.stroke.width;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    return { canvas: off, w, h };
  }

  if (layer.type === 'image') {
    const w = Math.max(20, Math.round(layer.width));
    const h = Math.max(20, Math.round(layer.height));
    off.width = Math.max(1, Math.round(w * renderScale));
    off.height = Math.max(1, Math.round(h * renderScale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(renderScale, renderScale);
    const img = getCachedImage(layer.src, onAssetLoad);
    if (img) {
      ctx.drawImage(img, 0, 0, w, h);
      if (layer.tintEnabled && layer.tintColor) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = layer.tintColor;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, w, h);
    }
    if (layer.stroke.enabled && layer.stroke.width > 0) {
      ctx.strokeStyle = layer.stroke.color;
      ctx.lineWidth = layer.stroke.width * 2;
      ctx.strokeRect(0, 0, w, h);
    }
    return { canvas: off, w, h };
  }

  if (layer.type === 'sticker') {
    const w = Math.max(20, Math.round(layer.width));
    const h = Math.max(20, Math.round(layer.height));
    off.width = Math.max(1, Math.round(w * renderScale));
    off.height = Math.max(1, Math.round(h * renderScale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(renderScale, renderScale);
    if (layer.kind === 'emoji') {
      const size = Math.min(w, h) * 0.78;
      ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (layer.stroke.enabled && layer.stroke.width > 0) {
        ctx.strokeStyle = layer.stroke.color;
        ctx.lineWidth = layer.stroke.width;
        ctx.strokeText(layer.content, w / 2, h / 2 + size * 0.05);
      }
      ctx.fillText(layer.content, w / 2, h / 2 + size * 0.05);
    } else {
      const src = layer.kind === 'svg' ? svgToDataUrl(layer.content) : layer.content;
      const img = getCachedImage(src, onAssetLoad);
      if (img) {
        ctx.drawImage(img, 0, 0, w, h);
        if (layer.tintColor) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = layer.tintColor;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }
    }
    return { canvas: off, w, h };
  }

  if (layer.type === 'drawing') {
    const w = Math.max(40, Math.round(layer.width));
    const h = Math.max(40, Math.round(layer.height));
    off.width = Math.max(1, Math.round(w * renderScale));
    off.height = Math.max(1, Math.round(h * renderScale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(renderScale, renderScale);
    for (const s of layer.strokes) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.globalAlpha = s.opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0], s.points[1]);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i], s.points[i + 1]);
      }
      ctx.stroke();
      ctx.restore();
    }
    return { canvas: off, w, h };
  }

  const pathLayer = layer as PathLayer;
  const w = Math.max(40, Math.round(pathLayer.width));
  const h = Math.max(40, Math.round(pathLayer.height));
  off.width = Math.max(1, Math.round(w * renderScale));
  off.height = Math.max(1, Math.round(h * renderScale));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(renderScale, renderScale);
  if (pathLayer.anchors.length >= 2) {
    buildBezierPath(ctx, pathLayer.anchors, pathLayer.closed);
    if (pathLayer.closed) {
      ctx.fillStyle = createCanvasFill(ctx, pathLayer.fill, w, h, onAssetLoad);
      ctx.fill();
    }
    if (pathLayer.stroke.enabled && pathLayer.stroke.width > 0) {
      ctx.strokeStyle = pathLayer.stroke.color;
      ctx.lineWidth = pathLayer.stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  return { canvas: off, w, h };
}

function buildBezierPath(ctx: CanvasRenderingContext2D, anchors: BezierAnchor[], closed: boolean) {
  ctx.beginPath();
  ctx.moveTo(anchors[0].x, anchors[0].y);
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    ctx.bezierCurveTo(prev.cp2x, prev.cp2y, curr.cp1x, curr.cp1y, curr.x, curr.y);
  }
  if (closed && anchors.length > 2) {
    const last = anchors[anchors.length - 1];
    const first = anchors[0];
    ctx.bezierCurveTo(last.cp2x, last.cp2y, first.cp1x, first.cp1y, first.x, first.y);
    ctx.closePath();
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function buildShapePath(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  layer: ShapeLayer
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  switch (kind) {
    case 'rect':
      ctx.rect(x, y, w, h);
      break;
    case 'roundedRect':
      roundRectPath(ctx, x, y, w, h, layer.cornerRadius || 24);
      break;
    case 'circle':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;
    case 'pentagon':
    case 'polygon': {
      const sides = Math.max(3, kind === 'pentagon' ? 5 : layer.sides || 6);
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = cx + (w / 2) * Math.cos(a);
        const py = cy + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      const pts = Math.max(3, layer.sides || 5);
      const inner = layer.innerRadiusRatio || 0.45;
      for (let i = 0; i < pts * 2; i++) {
        const rScale = i % 2 === 0 ? 1 : inner;
        const a = (i * Math.PI) / pts - Math.PI / 2;
        const px = cx + (w / 2) * rScale * Math.cos(a);
        const py = cy + (h / 2) * rScale * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'heart': {
      const topCurveHeight = h * 0.3;
      ctx.moveTo(cx, y + topCurveHeight);
      ctx.bezierCurveTo(cx, y, x, y, x, y + topCurveHeight);
      ctx.bezierCurveTo(x, y + (h + topCurveHeight) / 2, cx, y + (h + topCurveHeight) / 1.35, cx, y + h);
      ctx.bezierCurveTo(cx, y + (h + topCurveHeight) / 1.35, x + w, y + (h + topCurveHeight) / 2, x + w, y + topCurveHeight);
      ctx.bezierCurveTo(x + w, y, cx, y, cx, y + topCurveHeight);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const headW = Math.min(w * 0.45, Math.max(20, layer.arrowHeadSize || w * 0.32));
      const shaftH = h * 0.38;
      const sy1 = cy - shaftH / 2;
      const sy2 = cy + shaftH / 2;
      ctx.moveTo(x, sy1);
      ctx.lineTo(x + w - headW, sy1);
      ctx.lineTo(x + w - headW, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(x + w - headW, y + h);
      ctx.lineTo(x + w - headW, sy2);
      ctx.lineTo(x, sy2);
      ctx.closePath();
      break;
    }
    case 'speech': {
      const bodyH = h * 0.78;
      roundRectPath(ctx, x, y, w, bodyH, 18);
      ctx.moveTo(x + w * 0.25, y + bodyH - 2);
      ctx.lineTo(x + w * 0.16, y + h);
      ctx.lineTo(x + w * 0.44, y + bodyH - 2);
      ctx.closePath();
      break;
    }
  }
}

function applyInnerShadow(
  srcCanvas: HTMLCanvasElement,
  layer: LayerObject,
  renderScale = 1
): HTMLCanvasElement {
  const { innerShadow } = layer;
  if (!innerShadow.enabled) return srcCanvas;
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(srcCanvas, 0, 0);

  const inv = document.createElement('canvas');
  inv.width = w;
  inv.height = h;
  const ictx = inv.getContext('2d')!;
  ictx.fillStyle = '#000';
  ictx.fillRect(0, 0, w, h);
  ictx.globalCompositeOperation = 'destination-out';
  ictx.drawImage(srcCanvas, 0, 0);

  const shadowLayer = document.createElement('canvas');
  shadowLayer.width = w;
  shadowLayer.height = h;
  const sctx = shadowLayer.getContext('2d')!;
  sctx.shadowColor = innerShadow.color;
  sctx.shadowBlur = innerShadow.blur * renderScale;
  sctx.shadowOffsetX = innerShadow.offsetX * renderScale;
  sctx.shadowOffsetY = innerShadow.offsetY * renderScale;
  sctx.drawImage(inv, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(shadowLayer, 0, 0);
  ctx.restore();
  return out;
}

function applyEmboss(
  srcCanvas: HTMLCanvasElement,
  emboss: EmbossConfig,
  renderScale = 1
): HTMLCanvasElement {
  if (!emboss.enabled) return srcCanvas;
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(srcCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const srcCopy = new Uint8ClampedArray(d);
  const rad = (emboss.angle * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  const strength = (emboss.intensity / 100) * 1.4;
  const step = Math.max(1, Math.min(18, Math.round(emboss.bevel * renderScale)));
  const ambientFactor = 0.65 + (emboss.ambient / 100) * 0.45;
  const specPower = (emboss.specular / 100) * 90;

  for (let y = step; y < h - step; y++) {
    for (let x = step; x < w - step; x++) {
      const idx = (y * w + x) * 4;
      if (srcCopy[idx + 3] < 8) continue;

      const aL = srcCopy[(y * w + (x - step)) * 4 + 3] / 255;
      const aR = srcCopy[(y * w + (x + step)) * 4 + 3] / 255;
      const aT = srcCopy[((y - step) * w + x) * 4 + 3] / 255;
      const aB = srcCopy[((y + step) * w + x) * 4 + 3] / 255;

      const gx = aR - aL;
      const gy = aB - aT;
      const light = (gx * lx + gy * ly) * strength;
      const highlight = light > 0 ? light * (65 + specPower) : light * 80;

      d[idx] = Math.min(255, Math.max(0, srcCopy[idx] * ambientFactor + highlight));
      d[idx + 1] = Math.min(255, Math.max(0, srcCopy[idx + 1] * ambientFactor + highlight));
      d[idx + 2] = Math.min(255, Math.max(0, srcCopy[idx + 2] * ambientFactor + highlight));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

function applyPerspectiveAnd3DRotate(
  srcCanvas: HTMLCanvasElement,
  persp: PerspectivePoints,
  rot3d: { enabled: boolean; rotateX: number; rotateY: number }
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  if (!persp.enabled && !rot3d.enabled) return srcCanvas;

  const pad = Math.round(Math.max(w, h) * 0.25);
  const outW = w + pad * 2;
  const outH = h + pad * 2;

  let tl = { x: pad, y: pad };
  let tr = { x: pad + w, y: pad };
  let br = { x: pad + w, y: pad + h };
  let bl = { x: pad, y: pad + h };

  if (persp.enabled) {
    tl.x += persp.tl.x * w;
    tl.y += persp.tl.y * h;
    tr.x += persp.tr.x * w;
    tr.y += persp.tr.y * h;
    br.x += persp.br.x * w;
    br.y += persp.br.y * h;
    bl.x += persp.bl.x * w;
    bl.y += persp.bl.y * h;
  }

  if (rot3d.enabled) {
    const rx = (rot3d.rotateX * Math.PI) / 180;
    const ry = (rot3d.rotateY * Math.PI) / 180;
    const focal = Math.max(w, h) * 1.8;
    const project = (px: number, py: number) => {
      const dx = px - (pad + w / 2);
      const dy = py - (pad + h / 2);
      const z1 = -dy * Math.sin(rx);
      const y1 = dy * Math.cos(rx);
      const x2 = dx * Math.cos(ry) + z1 * Math.sin(ry);
      const z2 = -dx * Math.sin(ry) + z1 * Math.cos(ry);
      const scale = focal / Math.max(60, focal - z2);
      return { x: pad + w / 2 + x2 * scale, y: pad + h / 2 + y1 * scale };
    };
    tl = project(tl.x, tl.y);
    tr = project(tr.x, tr.y);
    br = project(br.x, br.y);
    bl = project(bl.x, bl.y);
  }

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;

  const cols = 12;
  const rows = 12;
  const bilerp = (u: number, v: number) => {
    const topX = tl.x + (tr.x - tl.x) * u;
    const topY = tl.y + (tr.y - tl.y) * u;
    const botX = bl.x + (br.x - bl.x) * u;
    const botY = bl.y + (br.y - bl.y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    };
  };

  for (let r = 0; r < rows; r++) {
    const v0 = r / rows;
    const v1 = (r + 1) / rows;
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;

      const p00 = bilerp(u0, v0);
      const p10 = bilerp(u1, v0);
      const p11 = bilerp(u1, v1);
      const p01 = bilerp(u0, v1);

      const sx0 = u0 * w;
      const sy0 = v0 * h;
      const sx1 = u1 * w;
      const sy1 = v1 * h;

      drawTexturedTriangle(ctx, srcCanvas, sx0, sy0, sx1, sy0, sx1, sy1, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
      drawTexturedTriangle(ctx, srcCanvas, sx0, sy0, sx1, sy1, sx0, sy1, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
    }
  }
  return out;
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  const denom = sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0;
  if (Math.abs(denom) < 1e-4) {
    ctx.restore();
    return;
  }
  const m11 = -(sy0 * (dx2 - dx1) - sy1 * dx2 + sy2 * dx1 + (sy1 - sy2) * dx0) / denom;
  const m12 = (sy1 * dy2 + sy0 * (dy1 - dy2) - sy2 * dy1 + (sy2 - sy1) * dy0) / denom;
  const m21 = (sx0 * (dx2 - dx1) - sx1 * dx2 + sx2 * dx1 + (sx1 - sx2) * dx0) / denom;
  const m22 = -(sx1 * dy2 + sx0 * (dy1 - dy2) - sx2 * dy1 + (sx2 - sx1) * dy0) / denom;
  const dx = (sx0 * (sy2 * dx1 - sy1 * dx2) + sy0 * (sx1 * dx2 - sx2 * dx1) + (sx2 * sy1 - sx1 * sy2) * dx0) / denom;
  const dy = (sx0 * (sy2 * dy1 - sy1 * dy2) + sy0 * (sx1 * dy2 - sx2 * dy1) + (sx2 * sy1 - sx1 * sy2) * dy0) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function applyEraseColor(srcCanvas: HTMLCanvasElement, layer: LayerObject): HTMLCanvasElement {
  const ec = layer.eraseColor;
  if (!ec || !ec.enabled) return srcCanvas;
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(srcCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const targets = [ec.color, ...(ec.extraColors ?? [])].map(hexToRgbTuple);
  const targetLen = targets.length;

  // Use squared distance comparisons to avoid Math.sqrt on 90%+ of pixels
  const threshold = (ec.tolerance / 100) * 260;
  const feather = Math.max(1, (ec.smooth / 100) * 110);
  const threshSq = threshold * threshold;
  const maxDist = threshold + feather;
  const maxSq = maxDist * maxDist;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    const pr = d[i];
    const pg = d[i + 1];
    const pb = d[i + 2];

    let minDistSq = Infinity;
    for (let t = 0; t < targetLen; t++) {
      const [tr, tg, tb] = targets[t];
      const dr = pr - tr;
      const dg = pg - tg;
      const db = pb - tb;
      const distSq = dr * dr + dg * dg + db * db;
      if (distSq < minDistSq) minDistSq = distSq;
    }

    if (minDistSq <= threshSq) {
      d[i + 3] = 0;
    } else if (minDistSq < maxSq) {
      const dist = Math.sqrt(minDistSq);
      const t = (dist - threshold) / feather;
      d[i + 3] = Math.round(a * t);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

function applyEraserStrokes(
  srcCanvas: HTMLCanvasElement,
  layer: LayerObject,
  renderScale = 1
): HTMLCanvasElement {
  const strokes = layer.eraserStrokes;
  if (!strokes || strokes.length === 0) return srcCanvas;

  const w = srcCanvas.width;
  const h = srcCanvas.height;

  // Build an opaque mask canvas; 'erase' strokes punch holes via destination-out,
  // while 'restore' strokes paint alpha back via source-over.
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext('2d')!;
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, w, h);

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length < 2) continue;
    const opacity = Math.min(1, Math.max(0.05, stroke.opacity ?? 1));
    const diameter = Math.max(1, stroke.size * renderScale);

    mctx.save();
    mctx.globalCompositeOperation = stroke.mode === 'restore' ? 'source-over' : 'destination-out';
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.lineWidth = diameter;
    mctx.strokeStyle = `rgba(0,0,0,${opacity})`;
    mctx.fillStyle = `rgba(0,0,0,${opacity})`;

    if (stroke.softness > 0) {
      const blurPx = (stroke.softness / 100) * (diameter * 0.45);
      if (blurPx >= 0.4) {
        mctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      }
    }

    if (stroke.points.length === 2) {
      mctx.beginPath();
      mctx.arc(stroke.points[0] * w, stroke.points[1] * h, Math.max(0.5, diameter / 2), 0, Math.PI * 2);
      mctx.fill();
    } else {
      mctx.beginPath();
      mctx.moveTo(stroke.points[0] * w, stroke.points[1] * h);
      for (let i = 2; i < stroke.points.length; i += 2) {
        mctx.lineTo(stroke.points[i] * w, stroke.points[i + 1] * h);
      }
      mctx.stroke();
    }
    mctx.restore();
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.drawImage(srcCanvas, 0, 0);
  octx.save();
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(mask, 0, 0);
  octx.restore();
  return out;
}

function applyObjectColorFilters(srcCanvas: HTMLCanvasElement, layer: LayerObject): HTMLCanvasElement {
  const cf = layer.colorFilters;
  if (!cf) return srcCanvas;
  if (cf.hue === 0 && cf.saturation === 0 && cf.brightness === 0 && cf.contrast === 0) {
    return srcCanvas;
  }
  const parts: string[] = [];
  if (cf.brightness !== 0) parts.push(`brightness(${100 + cf.brightness}%)`);
  if (cf.contrast !== 0) parts.push(`contrast(${100 + cf.contrast}%)`);
  if (cf.hue !== 0) parts.push(`hue-rotate(${cf.hue}deg)`);
  if (cf.saturation !== 0) parts.push(`saturate(${100 + cf.saturation}%)`);
  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext('2d')!;
  ctx.filter = parts.join(' ');
  ctx.drawImage(srcCanvas, 0, 0);
  return out;
}

function apply3DEulerTilt(
  srcCanvas: HTMLCanvasElement,
  rx: number,
  ry: number,
  rz: number
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const pad = Math.round(Math.max(w, h) * 0.25);
  const outW = w + pad * 2;
  const outH = h + pad * 2;
  const focal = Math.max(w, h) * 1.9;
  const cx = pad + w / 2;
  const cy = pad + h / 2;

  const project = (px: number, py: number) => {
    const dx0 = px - cx;
    const dy0 = py - cy;
    // Z rotation first
    const dx = dx0 * Math.cos(rz) - dy0 * Math.sin(rz);
    const dy = dx0 * Math.sin(rz) + dy0 * Math.cos(rz);
    // X & Y rotation
    const z1 = -dy * Math.sin(rx);
    const y1 = dy * Math.cos(rx);
    const x2 = dx * Math.cos(ry) + z1 * Math.sin(ry);
    const z2 = -dx * Math.sin(ry) + z1 * Math.cos(ry);
    const scale = focal / Math.max(60, focal - z2);
    return { x: cx + x2 * scale, y: cy + y1 * scale };
  };

  const tl = project(pad, pad);
  const tr = project(pad + w, pad);
  const br = project(pad + w, pad + h);
  const bl = project(pad, pad + h);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;
  warpQuad(ctx, srcCanvas, w, h, tl, tr, br, bl, 10, 10);
  return out;
}

function warpQuad(
  ctx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  w: number,
  h: number,
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  br: { x: number; y: number },
  bl: { x: number; y: number },
  cols = 10,
  rows = 10
) {
  const bilerp = (u: number, v: number) => {
    const topX = tl.x + (tr.x - tl.x) * u;
    const topY = tl.y + (tr.y - tl.y) * u;
    const botX = bl.x + (br.x - bl.x) * u;
    const botY = bl.y + (br.y - bl.y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    };
  };

  for (let r = 0; r < rows; r++) {
    const v0 = r / rows;
    const v1 = (r + 1) / rows;
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;

      const p00 = bilerp(u0, v0);
      const p10 = bilerp(u1, v0);
      const p11 = bilerp(u1, v1);
      const p01 = bilerp(u0, v1);

      const sx0 = u0 * w;
      const sy0 = v0 * h;
      const sx1 = u1 * w;
      const sy1 = v1 * h;

      drawTexturedTriangle(ctx, srcCanvas, sx0, sy0, sx1, sy0, sx1, sy1, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
      drawTexturedTriangle(ctx, srcCanvas, sx0, sy0, sx1, sy1, sx0, sy1, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
    }
  }
}

export interface RenderedLayerResult {
  canvas: HTMLCanvasElement;
  coreWidth: number;
  coreHeight: number;
  logicalWidth: number;
  logicalHeight: number;
  offsetX: number;
  offsetY: number;
  renderScale: number;
}

export function renderFullLayerToCanvas(
  layer: LayerObject,
  onAssetLoad?: () => void,
  desiredScale = 1
): RenderedLayerResult {
  const coreBox = getLayerCoreBox(layer);
  const renderScale = quantizeRenderScale(desiredScale, coreBox.w, coreBox.h);
  const baseKey = getLayerVisualCacheKey(layer);
  const cacheKey = `${baseKey}__rs${renderScale}`;
  const cached = layerRenderCache.get(cacheKey);
  if (cached) {
    // Refresh LRU order
    layerRenderCache.delete(cacheKey);
    layerRenderCache.set(cacheKey, cached);
    return cached;
  }

  const trackPendingLoad = () => {
    layerRenderCache.delete(cacheKey);
    onAssetLoad?.();
  };

  const { canvas: core, w, h } = renderCoreObjectCanvas(layer, trackPendingLoad, renderScale);

  let processed = applyEraseColor(core, layer);
  processed = applyEraserStrokes(processed, layer, renderScale);
  processed = applyObjectColorFilters(processed, layer);
  processed = applyInnerShadow(processed, layer, renderScale);
  processed = applyEmboss(processed, layer.emboss, renderScale);

  if (layer.mask.enabled && layer.mask.points.length >= 3) {
    const masked = document.createElement('canvas');
    masked.width = processed.width;
    masked.height = processed.height;
    const mctx = masked.getContext('2d')!;
    mctx.drawImage(processed, 0, 0);

    const stencil = document.createElement('canvas');
    stencil.width = processed.width;
    stencil.height = processed.height;
    const stCtx = stencil.getContext('2d')!;
    const smooth = (layer.mask.smooth ?? 0) * renderScale;
    if (smooth > 0) {
      stCtx.filter = `blur(${smooth}px)`;
    }
    stCtx.beginPath();
    layer.mask.points.forEach((pt, idx) => {
      const px = pt.x * masked.width;
      const py = pt.y * masked.height;
      if (idx === 0) stCtx.moveTo(px, py);
      else stCtx.lineTo(px, py);
    });
    stCtx.closePath();
    stCtx.fillStyle = '#000';
    stCtx.fill();

    mctx.save();
    mctx.globalCompositeOperation = layer.mask.mode === 'in' ? 'destination-in' : 'destination-out';
    mctx.drawImage(stencil, 0, 0);
    mctx.restore();
    processed = masked;
  }

  const beforeWarpW = processed.width;
  const beforeWarpH = processed.height;
  processed = applyPerspectiveAnd3DRotate(processed, layer.perspective, layer.rotate3D);
  const warpPadX = (processed.width - beforeWarpW) / (2 * renderScale);
  const warpPadY = (processed.height - beforeWarpH) / (2 * renderScale);

  if (layer.flipX || layer.flipY) {
    const flipped = document.createElement('canvas');
    flipped.width = processed.width;
    flipped.height = processed.height;
    const fctx = flipped.getContext('2d')!;
    fctx.translate(layer.flipX ? flipped.width : 0, layer.flipY ? flipped.height : 0);
    fctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    fctx.drawImage(processed, 0, 0);
    processed = flipped;
  }

  const procLogicalW = processed.width / renderScale;
  const procLogicalH = processed.height / renderScale;

  const shadowMargin = layer.shadow.enabled
    ? layer.shadow.blur * 2 + Math.max(Math.abs(layer.shadow.offsetX), Math.abs(layer.shadow.offsetY)) + 16
    : 8;
  const extraBottom =
    (layer.reflection.enabled ? h * 0.75 + layer.reflection.offsetY : 0) +
    (layer.shadow3D.enabled ? layer.shadow3D.offsetY + layer.shadow3D.blur * 2 + 20 : 0);

  const finalW = Math.ceil(procLogicalW + shadowMargin * 2);
  const finalH = Math.ceil(procLogicalH + shadowMargin * 2 + extraBottom);
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = Math.max(1, Math.round(finalW * renderScale));
  finalCanvas.height = Math.max(1, Math.round(finalH * renderScale));
  const fctx = finalCanvas.getContext('2d')!;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.scale(renderScale, renderScale);

  const drawX = shadowMargin;
  const drawY = shadowMargin;

  if (layer.shadow3D.enabled) {
    fctx.save();
    fctx.globalAlpha = layer.shadow3D.opacity;
    fctx.filter = `blur(${layer.shadow3D.blur}px)`;
    fctx.fillStyle = layer.shadow3D.color;
    const rx = w * 0.42 + layer.shadow3D.expand;
    const ry = Math.max(8, h * 0.1 + layer.shadow3D.expand * 0.25);
    fctx.beginPath();
    fctx.ellipse(
      drawX + procLogicalW / 2,
      drawY + procLogicalH - warpPadY + layer.shadow3D.offsetY,
      rx,
      ry,
      0,
      0,
      Math.PI * 2
    );
    fctx.fill();
    fctx.restore();
  }

  if (layer.reflection.enabled) {
    const reflH = Math.max(1, Math.round(processed.height * 0.7));
    const reflCanvas = document.createElement('canvas');
    reflCanvas.width = processed.width;
    reflCanvas.height = reflH;
    const rctx = reflCanvas.getContext('2d')!;
    rctx.save();
    rctx.translate(0, processed.height);
    rctx.scale(1, -1);
    rctx.drawImage(processed, 0, 0);
    rctx.restore();
    rctx.globalCompositeOperation = 'destination-in';
    const fadeGrad = rctx.createLinearGradient(0, 0, 0, reflH);
    fadeGrad.addColorStop(0, `rgba(0,0,0,${layer.reflection.opacity})`);
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = fadeGrad;
    rctx.fillRect(0, 0, processed.width, reflH);

    fctx.drawImage(
      reflCanvas,
      drawX,
      drawY + procLogicalH - warpPadY * 2 + layer.reflection.offsetY,
      procLogicalW,
      reflH / renderScale
    );
  }

  fctx.save();
  if (layer.shadow.enabled) {
    // Canvas2D shadow metrics are always in unscaled backing pixels
    fctx.shadowColor = hexToRgba(layer.shadow.color, layer.shadow.opacity);
    fctx.shadowBlur = layer.shadow.blur * renderScale;
    fctx.shadowOffsetX = layer.shadow.offsetX * renderScale;
    fctx.shadowOffsetY = layer.shadow.offsetY * renderScale;
  }
  fctx.drawImage(processed, drawX, drawY, procLogicalW, procLogicalH);
  fctx.restore();

  const result: RenderedLayerResult = {
    canvas: finalCanvas,
    coreWidth: w,
    coreHeight: h,
    logicalWidth: finalW,
    logicalHeight: finalH,
    offsetX: drawX + warpPadX,
    offsetY: drawY + warpPadY,
    renderScale,
  };

  if (layerRenderCache.size >= MAX_LAYER_CACHE) {
    const oldestKey = layerRenderCache.keys().next().value;
    if (oldestKey !== undefined) layerRenderCache.delete(oldestKey);
  }
  layerRenderCache.set(cacheKey, result);

  return result;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
