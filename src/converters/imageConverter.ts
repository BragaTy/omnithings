import { jsPDF } from 'jspdf';
import { ConversionOptions } from '../types';
import { getBaseName, getExtension } from './textUtils';

type Drawable = HTMLImageElement | ImageBitmap;

export async function convertImage(
  file: File,
  targetFormat: string,
  options: ConversionOptions
): Promise<{ blob: Blob; filename: string }> {
  const baseName = getBaseName(file.name);
  const target = targetFormat.toLowerCase();

  const { source, naturalWidth, naturalHeight } = await loadImage(file);

  // Target dimensions
  let width = options.imageWidth || naturalWidth;
  let height = options.imageHeight || naturalHeight;
  if (options.maintainAspectRatio !== false) {
    if (options.imageWidth && !options.imageHeight) {
      height = Math.round((naturalHeight / naturalWidth) * options.imageWidth);
    } else if (!options.imageWidth && options.imageHeight) {
      width = Math.round((naturalWidth / naturalHeight) * options.imageHeight);
    }
  }
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  // Browsers refuse canvases above ~16k px / ~268M px
  const maxSide = 16384;
  const maxArea = 120_000_000;
  const scaleDown = Math.min(1, maxSide / width, maxSide / height, Math.sqrt(maxArea / (width * height)));
  if (scaleDown < 1) {
    width = Math.floor(width * scaleDown);
    height = Math.floor(height * scaleDown);
  }

  const render = (opaque: boolean): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: !opaque })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opaque || options.backgroundColor) {
      ctx.fillStyle = options.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    if (options.grayscale) ctx.filter = 'grayscale(100%)';
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  };

  try {
    if (target === 'pdf') {
      const orientation = width > height ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation, unit: 'pt', format: options.pdfPageSize || 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = options.pdfMargin ?? 20;
      const ratio = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
      const w = width * ratio;
      const h = height * ratio;
      const canvas = render(true);
      const imgData = canvas.toDataURL('image/jpeg', options.imageQuality ?? 0.92);
      doc.addImage(imgData, 'JPEG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h);
      return { blob: doc.output('blob'), filename: `${baseName}.pdf` };
    }

    if (target === 'base64' || target === 'txt') {
      // Keep the original bytes (no re-encoding, no quality loss)
      const dataUrl = await blobToDataUrl(file);
      return { blob: new Blob([dataUrl], { type: 'text/plain;charset=utf-8' }), filename: `${baseName}_base64.txt` };
    }

    if (target === 'svg') {
      const dataUrl = render(false).toDataURL('image/png');
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" href="${dataUrl}" xlink:href="${dataUrl}"/>
</svg>`;
      return { blob: new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename: `${baseName}.svg` };
    }

    if (target === 'ico') {
      return { blob: await generateIcoBlob(source, naturalWidth, naturalHeight, [16, 24, 32, 48, 64, 128, 256]), filename: `${baseName}.ico` };
    }

    if (target === 'bmp') {
      // canvas.toBlob('image/bmp') is not supported by browsers (it silently returns PNG)
      const canvas = render(true);
      return { blob: canvasToBmp(canvas), filename: `${baseName}.bmp` };
    }

    const isJpeg = target === 'jpg' || target === 'jpeg';
    const mimeType = isJpeg ? 'image/jpeg' : target === 'webp' ? 'image/webp' : target === 'avif' ? 'image/avif' : 'image/png';
    const canvas = render(isJpeg);
    const blob = await canvasToBlob(canvas, mimeType, options.imageQuality ?? 0.92);
    if (blob.type && blob.type !== mimeType) {
      throw new Error(`Seu navegador não consegue gerar imagens ${target.toUpperCase()}. Tente PNG ou JPG.`);
    }
    return { blob, filename: `${baseName}.${target === 'jpeg' ? 'jpg' : target}` };
  } finally {
    if ('close' in source) (source as ImageBitmap).close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem (imagem grande demais?).'))), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(file: File): Promise<{ source: Drawable; naturalWidth: number; naturalHeight: number }> {
  const ext = getExtension(file.name);
  const isSvg = ext === 'svg' || file.type === 'image/svg+xml';

  if (['tif', 'tiff', 'heic', 'heif', 'psd', 'raw', 'cr2', 'nef'].includes(ext)) {
    // Try anyway (Safari opens TIFF/HEIC), but give a clear message if it fails
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, naturalWidth: bmp.width, naturalHeight: bmp.height };
    } catch {
      throw new Error(`O formato .${ext.toUpperCase()} não é suportado pelo seu navegador.`);
    }
  }

  let blob: Blob = file;
  let svgSize: { w: number; h: number } | null = null;
  if (isSvg) {
    // SVGs without width/height render as 0x0 or 150x150 — give them a real size
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg && svg.nodeName.toLowerCase() === 'svg') {
      const parseLen = (v: string | null) => {
        if (!v || v.trim().endsWith('%')) return 0;
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };
      let w = parseLen(svg.getAttribute('width'));
      let h = parseLen(svg.getAttribute('height'));
      const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      if ((!w || !h) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        if (w && !h) h = (w * vb[3]) / vb[2];
        else if (h && !w) w = (h * vb[2]) / vb[3];
        else {
          const scale = 1024 / Math.max(vb[2], vb[3]);
          w = vb[2] * scale;
          h = vb[3] * scale;
        }
      }
      if (!w || !h) {
        w = w || 1024;
        h = h || 1024;
      }
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
      svgSize = { w: Math.round(w), h: Math.round(h) };
    }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = new Image();
    el.decoding = 'async';
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível carregar a imagem. Formato inválido, corrompido ou não suportado pelo navegador.'));
    };
    el.src = url;
  });

  const naturalWidth = img.naturalWidth || svgSize?.w || 1024;
  const naturalHeight = img.naturalHeight || svgSize?.h || 1024;
  return { source: img, naturalWidth, naturalHeight };
}

// 24-bit uncompressed Windows BMP
function canvasToBmp(canvas: HTMLCanvasElement): Blob {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const buffer = new ArrayBuffer(54 + imageSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, 0x42); // B
  view.setUint8(1, 0x4d); // M
  view.setUint32(2, 54 + imageSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    let dst = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = srcRow + x * 4;
      bytes[dst++] = pixels[i + 2];
      bytes[dst++] = pixels[i + 1];
      bytes[dst++] = pixels[i];
    }
  }
  return new Blob([buffer], { type: 'image/bmp' });
}

// Multi-size ICO (PNG-compressed entries, supported by Windows Vista+ and all browsers)
async function generateIcoBlob(source: Drawable, srcW: number, srcH: number, sizes: number[]): Promise<Blob> {
  const maxSrc = Math.max(srcW, srcH);
  const usable = sizes.filter(s => s <= Math.max(maxSrc, 16));
  const images: { size: number; data: Uint8Array }[] = [];

  for (const size of usable) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Fit without distortion, centered on a transparent square
    const scale = Math.min(size / srcW, size / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
    const blob = await canvasToBlob(canvas, 'image/png');
    images.push({ size, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((a, i) => a + i.data.length, 0);
  const ico = new Uint8Array(total);
  const view = new DataView(ico.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let offset = headerSize;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    view.setUint8(e, size >= 256 ? 0 : size);
    view.setUint8(e + 1, size >= 256 ? 0 : size);
    view.setUint8(e + 2, 0);
    view.setUint8(e + 3, 0);
    view.setUint16(e + 4, 1, true);
    view.setUint16(e + 6, 32, true);
    view.setUint32(e + 8, data.length, true);
    view.setUint32(e + 12, offset, true);
    ico.set(data, offset);
    offset += data.length;
  });

  return new Blob([ico], { type: 'image/x-icon' });
}
