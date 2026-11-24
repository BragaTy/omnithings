// Shared helpers for reading text files and producing text that jsPDF's
// built-in fonts can actually render.

/**
 * Reads a text file detecting its encoding.
 * - Honors UTF-8 / UTF-16 BOMs
 * - Tries strict UTF-8 first
 * - Falls back to Windows-1252 (what Excel/Notepad in pt-BR usually save),
 *   so accents like "ç", "ã", "é" are not turned into "�".
 */
export async function readTextSmart(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return decodeTextSmart(new Uint8Array(buffer));
}

export function decodeTextSmart(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const PDF_CHAR_MAP: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '•': '·', '●': '·', '▪': '·', '◦': '·', '⁃': '-', '∙': '·',
  '…': '...',
  '€': 'EUR',
  '™': '(TM)',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '​': '', '‌': '', '‍': '', '﻿': '', '­': '',
  '→': '->', '←': '<-', '⇒': '=>',
  '≤': '<=', '≥': '>=', '≠': '!=',
  '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x',
  'ﬁ': 'fi', 'ﬂ': 'fl',
};

/**
 * jsPDF's standard fonts (Helvetica, Times, Courier) only cover Latin-1.
 * Anything above U+00FF comes out as garbage glyphs, so map common
 * typographic characters to safe equivalents and strip the rest.
 */
export function toPdfSafeText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 9) { out += '    '; continue; }
    if (code < 32) continue;
    if (code <= 0xff && code !== 0xa0 && code !== 0xad) { out += ch; continue; }
    if (ch in PDF_CHAR_MAP) { out += PDF_CHAR_MAP[ch]; continue; }
    // Try removing diacritics (e.g. "ő" -> "o", "ł" stays unknown)
    const stripped = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    if (stripped && [...stripped].every(c => c.codePointAt(0)! <= 0xff)) {
      out += stripped;
    } else {
      out += '?';
    }
  }
  return out;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getBaseName(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.substring(0, idx) : fileName;
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.substring(idx + 1).toLowerCase() : '';
}
