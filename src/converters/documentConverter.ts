import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { ConversionOptions } from '../types';
import { readTextSmart, toPdfSafeText, escapeHtml, getBaseName, getExtension } from './textUtils';

// Ensure pdf.js worker is properly configured for browser environments
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ---------------------------------------------------------------------------
// Intermediate document model
// ---------------------------------------------------------------------------

export interface TextRunInfo {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export interface StructuredParagraph {
  text: string;
  runs?: TextRunInfo[];
  isHeading?: boolean;
  headingLevel?: number;
  isList?: boolean;
  ordered?: boolean;
  listIndex?: number;
  listLevel?: number;
  isCode?: boolean;
  table?: string[][];
  /** Embedded picture; width/height in points (1/72 inch) */
  image?: { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' };
}

export interface PdfLine {
  text: string;
  cells: string[];
  y: number;
  fontSize: number;
}

export interface ExtractedDocument {
  fullText: string;
  paragraphs: StructuredParagraph[];
  pages?: { pageNum: number; lines: string[]; text: string; rows?: string[][] }[];
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function convertDocument(
  file: File,
  targetFormat: string,
  options: ConversionOptions
): Promise<{ blob: Blob; filename: string }> {
  const baseName = getBaseName(file.name);
  const inputExt = getExtension(file.name);
  const target = targetFormat.toLowerCase();

  // PDF -> images
  if (inputExt === 'pdf' && ['png', 'jpg', 'jpeg', 'webp'].includes(target)) {
    return await convertPdfToImages(file, target, options);
  }

  // PDF -> Excel: use the column positions detected in the PDF
  if (inputExt === 'pdf' && target === 'xlsx') {
    const docData = await extractStructuredPdfText(file);
    const rows = docData.pages.flatMap(p => p.rows);
    if (rows.length === 0) throw new Error(NO_TEXT_PDF_ERROR);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(parseNumberCell)));
    XLSX.utils.book_append_sheet(wb, ws, 'Dados_PDF');
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { blob, filename: `${baseName}.xlsx` };
  }

  const extracted = await extractDocumentTextAndStructure(file, inputExt);
  if (extracted.paragraphs.length === 0 && !extracted.fullText.trim()) {
    throw new Error(inputExt === 'pdf' ? NO_TEXT_PDF_ERROR : 'Nenhum texto foi encontrado no documento.');
  }

  if (target === 'docx') {
    const docxBlob = await buildDocxFromStructure(baseName, extracted.paragraphs);
    return { blob: docxBlob, filename: `${baseName}.docx` };
  }

  if (target === 'pdf') {
    const pdfBlob = buildPdfFromStructure(baseName, extracted.paragraphs, options);
    return { blob: pdfBlob, filename: `${baseName}.pdf` };
  }

  if (target === 'html') {
    let bodyHtml: string;
    if (inputExt === 'md' || inputExt === 'markdown') {
      bodyHtml = await marked.parse(extracted.fullText);
    } else {
      bodyHtml = structureToHtml(extracted.paragraphs);
    }
    const blob = new Blob([wrapHtml(baseName, bodyHtml)], { type: 'text/html;charset=utf-8' });
    return { blob, filename: `${baseName}.html` };
  }

  if (target === 'md' || target === 'markdown') {
    const md = structureToMarkdown(extracted.paragraphs);
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename: `${baseName}.md` };
  }

  if (target === 'txt') {
    const txt = inputExt === 'txt' ? extracted.fullText : structureToPlainText(extracted.paragraphs);
    return { blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }), filename: `${baseName}.txt` };
  }

  throw new Error(`Conversão de .${inputExt || 'arquivo'} para ${target.toUpperCase()} não é suportada.`);
}

const NO_TEXT_PDF_ERROR =
  'Este PDF não contém texto selecionável (provavelmente é digitalizado/escaneado). ' +
  'Converta para imagem (PNG/JPG) ou use um OCR.';

// Turns "1.234,56" / "42" / "3,5" into numbers so Excel can sum them.
// Ambiguous values ("1.234"), codes with leading zeros and long IDs stay as text.
function parseNumberCell(value: string): string | number {
  const v = value.trim().replace(/^R\$\s*/, '');
  if (v.replace(/\D/g, '').length > 15 || /^-?0\d/.test(v)) return value;
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(v) || /^-?\d+,\d+$/.test(v)) {
    return Number(v.replace(/\./g, '').replace(',', '.'));
  }
  if (/^-?\d+$/.test(v)) return Number(v);
  return value;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export async function extractDocumentTextAndStructure(file: File, inputExt: string): Promise<ExtractedDocument> {
  // Sniff the real format: many ".doc" files are actually RTF, HTML or DOCX
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  const headStr = String.fromCharCode(...head);
  const isRtf = headStr.startsWith('{\\rtf');

  if (inputExt === 'pdf' || headStr.startsWith('%PDF')) {
    const { pages, paragraphs, fullText } = await extractStructuredPdfText(file);
    return { fullText, paragraphs, pages };
  }

  if ((inputExt === 'docx' || inputExt === 'doc' || inputExt === 'odt') && isZip) {
    if (inputExt === 'odt') return await extractOdtContent(file);
    return await extractDocxContent(file);
  }

  if (isRtf || inputExt === 'rtf') {
    // RTF is 7-bit ASCII; accented chars come as \'xx escapes
    const text = rtfToText(new TextDecoder('windows-1252').decode(await file.arrayBuffer()));
    return plainTextToStructure(text);
  }

  if (isOle) {
    const text = await extractLegacyDocText(file);
    return plainTextToStructure(text);
  }

  if (inputExt === 'docx' || inputExt === 'odt') {
    throw new Error(`Arquivo .${inputExt} inválido ou corrompido (não é um documento Office válido).`);
  }

  const text = await readTextSmart(file);

  if (inputExt === 'html' || inputExt === 'htm' || (inputExt === 'doc' && /^\s*</.test(text))) {
    const paragraphs = htmlToStructure(text);
    return { fullText: structureToPlainText(paragraphs), paragraphs };
  }

  if (inputExt === 'md' || inputExt === 'markdown') {
    const html = await marked.parse(text);
    const paragraphs = htmlToStructure(html);
    return { fullText: text, paragraphs };
  }

  // TXT and anything else: keep the text exactly as it is
  return plainTextToStructure(text);
}

function plainTextToStructure(text: string): ExtractedDocument {
  const normalized = text.replace(/\r\n?/g, '\n');
  const paragraphs: StructuredParagraph[] = normalized
    .split(/\n\s*\n/)
    .map(block => block.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, ''))
    .filter(block => block.trim().length > 0)
    .map(block => ({ text: block }));
  return { fullText: normalized, paragraphs };
}

// ----------------------------- PDF ------------------------------------------

export async function extractStructuredPdfText(file: File): Promise<{
  pages: { pageNum: number; lines: string[]; text: string; rows: string[][] }[];
  paragraphs: StructuredParagraph[];
  fullText: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pagesLines: PdfLine[][] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    pagesLines.push(groupPdfItemsIntoLines(textContent.items as any[]));
  }

  // Most common font size (weighted by characters) = body text size
  const sizeWeights = new Map<number, number>();
  for (const lines of pagesLines) {
    for (const l of lines) {
      const s = Math.round(l.fontSize * 2) / 2;
      sizeWeights.set(s, (sizeWeights.get(s) || 0) + l.text.length);
    }
  }
  let bodySize = 10;
  let bestWeight = -1;
  sizeWeights.forEach((w, s) => {
    if (w > bestWeight) {
      bestWeight = w;
      bodySize = s;
    }
  });

  const paragraphs: StructuredParagraph[] = [];
  const pages: { pageNum: number; lines: string[]; text: string; rows: string[][] }[] = [];

  pagesLines.forEach((lines, idx) => {
    const pageParagraphs = pdfLinesToParagraphs(lines, bodySize);
    paragraphs.push(...pageParagraphs);
    pages.push({
      pageNum: idx + 1,
      lines: lines.map(l => l.text),
      rows: lines.map(l => l.cells),
      text: structureToPlainText(pageParagraphs),
    });
  });

  const fullText = pages.map(p => p.text).filter(Boolean).join('\n\n');
  return { pages, paragraphs, fullText };
}

function groupPdfItemsIntoLines(rawItems: any[]): PdfLine[] {
  const items = rawItems
    .filter(it => typeof it.str === 'string' && it.transform)
    .map(it => ({
      str: it.str as string,
      x: it.transform[4] as number,
      y: it.transform[5] as number,
      w: (it.width as number) || 0,
      size: Math.abs(it.transform[3]) || Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
    }))
    .filter(it => it.str.length > 0);

  // Sort top -> bottom (items on the same visual line end up next to each other)
  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const buckets: (typeof items)[] = [];
  for (const it of items) {
    const last = buckets[buckets.length - 1];
    if (last) {
      const ref = last[0];
      if (Math.abs(ref.y - it.y) <= Math.max(2, Math.min(ref.size, it.size) * 0.5)) {
        last.push(it);
        continue;
      }
    }
    buckets.push([it]);
  }

  const lines: PdfLine[] = [];
  for (const bucket of buckets) {
    bucket.sort((a, b) => a.x - b.x);
    let text = '';
    let cell = '';
    const cells: string[] = [];
    let prevEnd: number | null = null;
    let maxSize = 0;

    for (const it of bucket) {
      if (it.str.trim()) maxSize = Math.max(maxSize, it.size);
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > it.size * 1.8) {
          // Big horizontal gap: new table column
          if (cell.trim()) cells.push(cell.trim());
          cell = '';
          if (!text.endsWith(' ')) text += ' ';
        } else if (gap > it.size * 0.12 && !text.endsWith(' ') && !it.str.startsWith(' ')) {
          text += ' ';
          cell += ' ';
        }
      }
      text += it.str;
      cell += it.str;
      prevEnd = it.x + it.w;
    }
    if (cell.trim()) cells.push(cell.trim());

    const clean = text.replace(/\s{2,}/g, ' ').trim();
    if (clean) lines.push({ text: clean, cells, y: bucket[0].y, fontSize: maxSize || bucket[0].size });
  }
  return lines;
}

const BULLET_RE = /^([•●▪◦■□➢►✓\-–*·])\s+/;
const ORDERED_RE = /^(\d{1,3})[.)]\s+/;

function pdfLinesToParagraphs(lines: PdfLine[], bodySize: number): StructuredParagraph[] {
  const result: StructuredParagraph[] = [];
  let current: { text: string; size: number; lastY: number; isList?: boolean; ordered?: boolean; listIndex?: number } | null = null;

  const headingLevelFor = (size: number) => {
    const ratio = size / bodySize;
    if (ratio >= 1.7) return 1;
    if (ratio >= 1.35) return 2;
    if (ratio >= 1.15) return 3;
    return 0;
  };

  const flush = () => {
    if (!current) return;
    const level = headingLevelFor(current.size);
    if (level > 0 && current.text.length < 200 && !current.isList) {
      result.push({ text: current.text, isHeading: true, headingLevel: level });
    } else if (current.isList) {
      result.push({ text: current.text, isList: true, ordered: current.ordered, listIndex: current.listIndex });
    } else {
      result.push({ text: current.text });
    }
    current = null;
  };

  for (const line of lines) {
    let text = line.text;
    const bullet = text.match(BULLET_RE);
    const ordered = !bullet && text.match(ORDERED_RE);
    const startsList = !!bullet || !!ordered;
    if (bullet) text = text.replace(BULLET_RE, '');
    if (ordered) text = text.replace(ORDERED_RE, '');

    if (current) {
      const gap = current.lastY - line.y;
      const sizeChanged = Math.abs(line.fontSize - current.size) > current.size * 0.12;
      const bigGap = gap > Math.max(current.size, line.fontSize) * 1.7 || gap < 0;
      if (startsList || sizeChanged || bigGap) {
        flush();
      }
    }

    if (!current) {
      current = {
        text,
        size: line.fontSize,
        lastY: line.y,
        isList: startsList,
        ordered: !!ordered,
        listIndex: ordered ? parseInt(ordered[1], 10) : undefined,
      };
      continue;
    }

    // Join wrapped line, fixing hyphenation ("conver-\nsão" -> "conversão")
    if (/[a-zà-ÿ]-$/i.test(current.text) && /^[a-zà-ÿ]/.test(text)) {
      current.text = current.text.slice(0, -1) + text;
    } else {
      current.text += ' ' + text;
    }
    current.lastY = line.y;
  }
  flush();
  return result;
}

// ----------------------------- DOCX -----------------------------------------

export async function extractDocxContent(file: File): Promise<ExtractedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  let docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    const matchKey = Object.keys(zip.files).find(k => /(^|\/)document\d*\.xml$/.test(k));
    if (matchKey) docXmlFile = zip.file(matchKey);
  }
  if (!docXmlFile) {
    throw new Error('Não foi possível ler o documento Word (document.xml não encontrado).');
  }

  const parser = new DOMParser();

  // Map style IDs to heading levels. Style IDs are localized
  // ("Ttulo1" in pt-BR Word), but style *names* are always "heading 1".
  const headingStyles = new Map<string, number>();
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    const stylesDoc = parser.parseFromString(await stylesFile.async('text'), 'application/xml');
    const styles = stylesDoc.getElementsByTagName('w:style');
    for (let i = 0; i < styles.length; i++) {
      const s = styles[i];
      const id = s.getAttribute('w:styleId') || '';
      const name = (s.getElementsByTagName('w:name')[0]?.getAttribute('w:val') || '').toLowerCase();
      const outline = s.getElementsByTagName('w:outlineLvl')[0]?.getAttribute('w:val');
      let level = 0;
      const m = name.match(/^heading\s*(\d)/);
      if (m) level = parseInt(m[1], 10);
      else if (name === 'title') level = 1;
      else if (name === 'subtitle') level = 2;
      else if (outline !== undefined && outline !== null && parseInt(outline, 10) < 6) level = parseInt(outline, 10) + 1;
      if (level > 0) headingStyles.set(id, level);
    }
  }

  const xmlDoc = parser.parseFromString(await docXmlFile.async('text'), 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('Documento Word inválido ou corrompido.');

  // Relationship id -> file inside the zip (images live in word/media/)
  const rels = new Map<string, string>();
  const docDir = (docXmlFile.name.includes('/') ? docXmlFile.name.slice(0, docXmlFile.name.lastIndexOf('/') + 1) : '');
  const relsFile = zip.file(`${docDir}_rels/${docXmlFile.name.slice(docDir.length)}.rels`);
  if (relsFile) {
    const relsDoc = parser.parseFromString(await relsFile.async('text'), 'application/xml');
    const relEls = relsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < relEls.length; i++) {
      const id = relEls[i].getAttribute('Id');
      const target = relEls[i].getAttribute('Target');
      if (!id || !target || relEls[i].getAttribute('TargetMode') === 'External') continue;
      rels.set(id, resolveZipPath(docDir, target));
    }
  }

  const paragraphs: StructuredParagraph[] = [];
  // Image placeholders resolved asynchronously after the walk
  const pendingImages: { block: StructuredParagraph; path: string; widthPt: number; heightPt: number }[] = [];

  const collectImages = (p: Element) => {
    const found: { rId: string; el: Element }[] = [];
    const blips = p.getElementsByTagName('a:blip');
    for (let i = 0; i < blips.length; i++) {
      const rId = blips[i].getAttribute('r:embed');
      if (rId) found.push({ rId, el: blips[i] });
    }
    const vml = p.getElementsByTagName('v:imagedata');
    for (let i = 0; i < vml.length; i++) {
      const rId = vml[i].getAttribute('r:id');
      if (rId) found.push({ rId, el: vml[i] });
    }
    for (const { rId, el } of found) {
      // The same picture is usually present twice (mc:Choice + mc:Fallback); keep only one
      let ancestor: Element | null = el.parentElement;
      let inFallback = false;
      let container: Element | null = null;
      while (ancestor && ancestor !== p) {
        if (ancestor.nodeName === 'mc:Fallback') inFallback = true;
        if (!container && (ancestor.nodeName === 'wp:inline' || ancestor.nodeName === 'wp:anchor')) container = ancestor;
        ancestor = ancestor.parentElement;
      }
      if (inFallback) continue;
      const path = rels.get(rId);
      if (!path) continue;

      // Size: DrawingML extent is in EMU (12700 per point); VML uses CSS style
      let widthPt = 0;
      let heightPt = 0;
      const extent = container?.getElementsByTagName('wp:extent')[0];
      if (extent) {
        widthPt = parseInt(extent.getAttribute('cx') || '0', 10) / 12700;
        heightPt = parseInt(extent.getAttribute('cy') || '0', 10) / 12700;
      } else {
        const style = el.parentElement?.getAttribute('style') || '';
        const toPt = (v?: string) => {
          if (!v) return 0;
          const n = parseFloat(v);
          if (v.endsWith('in')) return n * 72;
          if (v.endsWith('cm')) return (n * 72) / 2.54;
          if (v.endsWith('px')) return n * 0.75;
          return n;
        };
        widthPt = toPt(style.match(/width:\s*([\d.]+\w*)/)?.[1]);
        heightPt = toPt(style.match(/height:\s*([\d.]+\w*)/)?.[1]);
      }
      const block: StructuredParagraph = { text: '' };
      pendingImages.push({ block, path, widthPt, heightPt });
      paragraphs.push(block);
    }
  };

  const collectRuns = (node: Element, runs: TextRunInfo[], fmt: { bold?: boolean; italic?: boolean }) => {
    for (const child of Array.from(node.children)) {
      const name = child.nodeName;
      if (name === 'mc:Fallback' || name === 'w:del' || name === 'w:instrText' || name === 'w:pPr') continue;
      if (name === 'w:r') {
        const rPr = child.getElementsByTagName('w:rPr')[0];
        const isOn = (tag: string) => {
          const el = rPr?.getElementsByTagName(tag)[0];
          if (!el) return false;
          const v = el.getAttribute('w:val');
          return v === null || (v !== '0' && v !== 'false' && v !== 'none');
        };
        const runFmt = { bold: isOn('w:b'), italic: isOn('w:i') };
        let text = '';
        for (const rc of Array.from(child.children)) {
          switch (rc.nodeName) {
            case 'w:t': text += rc.textContent || ''; break;
            case 'w:tab': text += '\t'; break;
            case 'w:br':
            case 'w:cr': text += '\n'; break;
            case 'w:noBreakHyphen': text += '-'; break;
            case 'w:sym': {
              const c = rc.getAttribute('w:char');
              if (c) {
                const code = parseInt(c, 16);
                // Symbol-font bullets live in the private use area
                text += code >= 0xf000 ? '•' : String.fromCharCode(code);
              }
              break;
            }
            case 'mc:AlternateContent':
            case 'w:drawing':
            case 'w:pict': {
              // Text boxes
              const inner: TextRunInfo[] = [];
              collectRuns(rc, inner, runFmt);
              const t = inner.map(r => r.text).join('');
              if (t.trim()) text += ' ' + t + ' ';
              break;
            }
          }
        }
        if (text) runs.push({ text, ...runFmt });
      } else if (name === 'w:hyperlink' || name === 'w:smartTag' || name === 'w:ins' || name === 'w:sdt' ||
                 name === 'w:sdtContent' || name === 'w:fldSimple' || name === 'w:customXml' ||
                 name === 'mc:AlternateContent' || name === 'mc:Choice' || name === 'w:txbxContent' ||
                 name === 'wps:txbx' || name === 'w:p') {
        collectRuns(child, runs, fmt);
        if (name === 'w:p') runs.push({ text: '\n' });
      } else if (child.children.length > 0 && !name.startsWith('w:')) {
        // Drawing containers (wp:inline, a:graphic, …) may hold text boxes
        collectRuns(child, runs, fmt);
      }
    }
  };

  const readParagraph = (p: Element): StructuredParagraph | null => {
    const pPr = Array.from(p.children).find(c => c.nodeName === 'w:pPr');
    const styleId = pPr?.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
    let headingLevel = headingStyles.get(styleId) || 0;
    if (!headingLevel && /^(heading|ttulo|titulo|título)\s*(\d)$/i.test(styleId)) {
      headingLevel = parseInt(styleId.replace(/\D/g, ''), 10);
    }
    const outline = pPr?.getElementsByTagName('w:outlineLvl')[0]?.getAttribute('w:val');
    if (!headingLevel && outline !== undefined && outline !== null && parseInt(outline, 10) < 6) {
      headingLevel = parseInt(outline, 10) + 1;
    }
    const numPr = pPr?.getElementsByTagName('w:numPr')[0];
    const ilvl = numPr?.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val');

    const runs: TextRunInfo[] = [];
    collectRuns(p, runs, {});
    const merged = mergeRuns(runs);
    while (merged.length && !merged[merged.length - 1].text.replace(/\s+$/, '')) merged.pop();
    if (merged.length) merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, '');
    const text = merged.map(r => r.text).join('');
    if (!text.trim()) return null;

    return {
      text,
      runs: merged,
      isHeading: headingLevel > 0,
      headingLevel: headingLevel || undefined,
      isList: !!numPr && headingLevel === 0,
      listLevel: ilvl ? parseInt(ilvl, 10) : 0,
    };
  };

  const readTable = (tbl: Element): string[][] => {
    const rows: string[][] = [];
    for (const tr of Array.from(tbl.children).filter(c => c.nodeName === 'w:tr')) {
      const cells: string[] = [];
      for (const tc of Array.from(tr.children).filter(c => c.nodeName === 'w:tc')) {
        const parts: string[] = [];
        for (const p of Array.from(tc.getElementsByTagName('w:p'))) {
          const runs: TextRunInfo[] = [];
          collectRuns(p, runs, {});
          const t = runs.map(r => r.text).join('').trim();
          if (t) parts.push(t);
        }
        cells.push(parts.join('\n'));
      }
      if (cells.some(c => c.trim())) rows.push(cells);
    }
    return rows;
  };

  const walkBlocks = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      switch (child.nodeName) {
        case 'w:p': {
          const p = readParagraph(child);
          if (p) paragraphs.push(p);
          collectImages(child);
          break;
        }
        case 'w:tbl': {
          const table = readTable(child);
          if (table.length > 0) {
            paragraphs.push({ text: table.map(r => r.join('\t')).join('\n'), table });
          }
          break;
        }
        case 'w:sdt':
        case 'w:sdtContent':
        case 'w:customXml':
        case 'w:ins':
          walkBlocks(child);
          break;
      }
    }
  };

  walkBlocks(body);

  // Load the pictures; drop the ones the browser can't render (EMF/WMF/TIFF)
  for (const pending of pendingImages) {
    const file = zip.file(pending.path);
    if (!file) continue;
    try {
      const img = await loadDocImage(await file.async('uint8array'), pending.path);
      const widthPt = pending.widthPt || img.naturalWidth * 0.75;
      const heightPt = pending.heightPt || img.naturalHeight * 0.75;
      pending.block.image = { dataUrl: img.dataUrl, format: img.format, width: widthPt, height: heightPt };
    } catch {
      // unsupported picture format: skip it
    }
  }
  const withImages = paragraphs.filter(p => p.text || p.image || p.table);
  return { paragraphs: withImages, fullText: structureToPlainText(withImages) };
}

function resolveZipPath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (baseDir + target).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Returns the picture as PNG or JPEG data URL (the formats jsPDF embeds natively). */
async function loadDocImage(
  bytes: Uint8Array,
  path: string
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; naturalWidth: number; naturalHeight: number }> {
  const ext = getExtension(path);
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (['emf', 'wmf', 'tif', 'tiff'].includes(ext)) throw new Error('formato de imagem não suportado');

  const mime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/webp';
  const sourceUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('imagem inválida'));
    el.src = sourceUrl;
  });
  const naturalWidth = img.naturalWidth || 400;
  const naturalHeight = img.naturalHeight || 300;

  if (isPng) return { dataUrl: sourceUrl, format: 'PNG', naturalWidth, naturalHeight };
  if (isJpeg) return { dataUrl: sourceUrl, format: 'JPEG', naturalWidth, naturalHeight };

  // GIF, BMP, WEBP, SVG -> PNG through a canvas
  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0, naturalWidth, naturalHeight);
  return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', naturalWidth, naturalHeight };
}

function mergeRuns(runs: TextRunInfo[]): TextRunInfo[] {
  const out: TextRunInfo[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && !!last.bold === !!r.bold && !!last.italic === !!r.italic && last.href === r.href) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

// ----------------------------- ODT ------------------------------------------

async function extractOdtContent(file: File): Promise<ExtractedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const content = zip.file('content.xml');
  if (!content) throw new Error('Documento ODT inválido (content.xml não encontrado).');
  const xml = new DOMParser().parseFromString(await content.async('text'), 'application/xml');
  const paragraphs: StructuredParagraph[] = [];

  const textOf = (el: Element): string => {
    let t = '';
    el.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) t += n.nodeValue || '';
      else if (n.nodeType === Node.ELEMENT_NODE) {
        const name = (n as Element).nodeName;
        if (name === 'text:s') t += ' '.repeat(parseInt((n as Element).getAttribute('text:c') || '1', 10));
        else if (name === 'text:tab') t += '\t';
        else if (name === 'text:line-break') t += '\n';
        else if (name !== 'text:note') t += textOf(n as Element);
      }
    });
    return t;
  };

  const walk = (el: Element, listLevel: number) => {
    for (const child of Array.from(el.children)) {
      const name = child.nodeName;
      if (name === 'text:h') {
        const t = textOf(child).trim();
        if (t) paragraphs.push({ text: t, isHeading: true, headingLevel: parseInt(child.getAttribute('text:outline-level') || '1', 10) });
      } else if (name === 'text:p') {
        const t = textOf(child).trim();
        if (t) paragraphs.push(listLevel >= 0 ? { text: t, isList: true, listLevel } : { text: t });
      } else if (name === 'text:list') {
        walk(child, listLevel + 1);
      } else if (name === 'table:table') {
        const rows = Array.from(child.getElementsByTagName('table:table-row')).map(r =>
          Array.from(r.getElementsByTagName('table:table-cell')).map(c => textOf(c).trim())
        ).filter(r => r.some(Boolean));
        if (rows.length) paragraphs.push({ text: rows.map(r => r.join('\t')).join('\n'), table: rows });
      } else {
        walk(child, listLevel);
      }
    }
  };

  const body = xml.getElementsByTagName('office:text')[0];
  if (body) walk(body, -1);
  return { paragraphs, fullText: structureToPlainText(paragraphs) };
}

// ----------------------------- Legacy DOC (Word 97-2003) --------------------

export async function extractLegacyDocText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const text = parseWordBinary(bytes);
    if (text.trim()) return text;
  } catch (e: any) {
    if (/senha/.test(e?.message || '')) throw e;
  }
  const fallback = heuristicBinaryText(bytes);
  if (!fallback.trim()) throw new Error('Não foi possível extrair texto deste arquivo .doc.');
  return fallback;
}

// Last resort: collect readable UTF-16LE and Latin-1 runs from the binary
function heuristicBinaryText(bytes: Uint8Array): string {
  const isText = (c: number) => (c >= 0x20 && c < 0x7f) || (c >= 0xc0 && c <= 0xff) || c === 0x0d || c === 0x09;
  const chunks: string[] = [];
  let cur = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const c = bytes[i] | (bytes[i + 1] << 8);
    if (isText(c)) cur += c === 0x0d ? '\n' : String.fromCharCode(c);
    else {
      if (cur.trim().length > 20) chunks.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim().length > 20) chunks.push(cur.trim());
  if (chunks.join('').length < 50) {
    const latin = new TextDecoder('windows-1252').decode(bytes);
    const runs = latin.match(/[\x20-\x7e\xc0-\xff\r\t]{20,}/g) || [];
    chunks.push(...runs.map(r => r.replace(/\r/g, '\n').trim()));
  }
  return chunks.join('\n\n');
}

function parseWordBinary(bytes: Uint8Array): string {
  const CFB = (XLSX as any).CFB;
  if (!CFB) throw new Error('Leitor de arquivos .doc indisponível.');

  let cfb: any;
  try {
    cfb = CFB.read(bytes, { type: 'array' });
  } catch {
    throw new Error('Arquivo .doc inválido ou corrompido.');
  }

  const toBytes = (entry: any): Uint8Array | null => {
    if (!entry || !entry.content) return null;
    return entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
  };

  const wordDoc = toBytes(CFB.find(cfb, 'WordDocument'));
  if (!wordDoc || wordDoc.length < 0x200) throw new Error('Arquivo .doc inválido (stream WordDocument ausente).');

  const view = new DataView(wordDoc.buffer, wordDoc.byteOffset, wordDoc.byteLength);
  if (view.getUint16(0, true) !== 0xa5ec) throw new Error('Arquivo .doc em formato não reconhecido.');
  const flags = view.getUint16(0x0a, true);
  if (flags & 0x0100) throw new Error('Este documento .doc está protegido por senha.');

  const tableName = flags & 0x0200 ? '1Table' : '0Table';
  const tableStream = toBytes(CFB.find(cfb, tableName));

  // FIB layout: FibBase(32) | csw | fibRgW | cslw | fibRgLw | cbRgFcLcb | fibRgFcLcb
  const csw = view.getUint16(32, true);
  const lwStart = 32 + 2 + csw * 2 + 2;
  const cslw = view.getUint16(lwStart - 2, true);
  const ccpText = view.getInt32(lwStart + 3 * 4, true);
  const fcLcbStart = lwStart + cslw * 4 + 2;
  const fcClx = view.getUint32(fcLcbStart + 33 * 8, true);
  const lcbClx = view.getUint32(fcLcbStart + 33 * 8 + 4, true);

  const cp1252 = new TextDecoder('windows-1252');
  const utf16 = new TextDecoder('utf-16le');
  let raw = '';

  if (tableStream && lcbClx > 0 && fcClx + lcbClx <= tableStream.length) {
    const t = new DataView(tableStream.buffer, tableStream.byteOffset, tableStream.byteLength);
    let pos = fcClx;
    // Skip Prc entries
    while (pos < fcClx + lcbClx && tableStream[pos] === 0x01) {
      pos += 3 + t.getInt16(pos + 1, true);
    }
    if (tableStream[pos] !== 0x02) throw new Error('Estrutura interna do .doc não reconhecida.');
    const lcb = t.getUint32(pos + 1, true);
    const plc = pos + 5;
    const n = Math.floor((lcb - 4) / 12);
    let remaining = ccpText > 0 ? ccpText : Infinity;

    for (let i = 0; i < n && remaining > 0; i++) {
      const cpStart = t.getUint32(plc + i * 4, true);
      const cpEnd = t.getUint32(plc + (i + 1) * 4, true);
      const pcd = plc + (n + 1) * 4 + i * 8;
      const fcRaw = t.getUint32(pcd + 2, true);
      const count = Math.min(cpEnd - cpStart, remaining);
      if (count <= 0) continue;
      if (fcRaw & 0x40000000) {
        const fc = (fcRaw & 0x3fffffff) / 2;
        raw += cp1252.decode(wordDoc.subarray(fc, fc + count));
      } else {
        raw += utf16.decode(wordDoc.subarray(fcRaw, fcRaw + count * 2));
      }
      remaining -= count;
    }
  } else {
    // Very old / non-complex files: text stored contiguously between fcMin and fcMac
    const fcMin = view.getUint32(0x18, true);
    const fcMac = view.getUint32(0x1c, true);
    raw = cp1252.decode(wordDoc.subarray(fcMin, Math.min(fcMac, wordDoc.length)));
  }

  return cleanWordText(raw);
}

function cleanWordText(raw: string): string {
  // Fields: \x13 instruction \x14 result \x15 -> keep only the result
  let out = '';
  const stack: boolean[] = []; // true = currently in instruction part
  for (const ch of raw) {
    if (ch === '\x13') { stack.push(true); continue; }
    if (ch === '\x14') { if (stack.length) stack[stack.length - 1] = false; continue; }
    if (ch === '\x15') { stack.pop(); continue; }
    if (stack.some(inInstr => inInstr)) continue;
    out += ch;
  }
  return out
    .replace(/\x07\x07\r?/g, '\n') // end of table row (last cell mark + row mark)
    .replace(/\x07\r?/g, '\t')     // table cell marks
    .replace(/\r/g, '\n')          // paragraph marks
    .replace(/[\x0b\x0c\x0e]/g, '\n') // line, page, column breaks
    .replace(/\x1e/g, '-')         // non-breaking hyphen
    .replace(/[\x00-\x08\x1f]/g, '') // objects, pictures, soft hyphen
    .replace(/\t+\n/g, '\n')
    .replace(/\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ----------------------------- RTF ------------------------------------------

const RTF_DESTINATIONS = new Set([
  'aftncn', 'aftnsep', 'aftnsepc', 'annotation', 'atnauthor', 'atndate', 'atnicn', 'atnid', 'atnparent', 'atnref',
  'atntime', 'atrfend', 'atrfstart', 'author', 'background', 'bkmkend', 'bkmkstart', 'buptim', 'category',
  'colorschememapping', 'colortbl', 'comment', 'company', 'creatim', 'datafield', 'datastore', 'defchp', 'defpap',
  'do', 'doccomm', 'docvar', 'dptxbxtext', 'ebcend', 'ebcstart', 'factoidname', 'falt', 'fchars', 'ffdeftext',
  'ffentrymcr', 'ffexitmcr', 'ffformat', 'ffhelptext', 'ffl', 'ffname', 'ffstattext', 'file', 'filetbl',
  'fldinst', 'fldtype', 'fname', 'fontemb', 'fontfile', 'fonttbl', 'footer', 'footerf', 'footerl', 'footerr',
  'footnote', 'formfield', 'ftncn', 'ftnsep', 'ftnsepc', 'g', 'generator', 'gridtbl', 'header', 'headerf',
  'headerl', 'headerr', 'hl', 'hlfr', 'hlinkbase', 'hlloc', 'hlsrc', 'hsv', 'htmltag', 'info', 'keycode',
  'keywords', 'latentstyles', 'lchars', 'levelnumbers', 'leveltext', 'lfolevel', 'linkval', 'list', 'listlevel',
  'listname', 'listoverride', 'listoverridetable', 'listpicture', 'liststylename', 'listtable', 'listtext',
  'lsdlockedexcept', 'macc', 'maccPr', 'mailmerge', 'maln', 'malnScr', 'manager', 'margPr', 'mbar', 'mbarPr',
  'mbaseJc', 'mbegChr', 'mborderBox', 'mborderBoxPr', 'mbox', 'mboxPr', 'mchr', 'mcount', 'mctrlPr', 'md',
  'mdeg', 'mdegHide', 'mden', 'mdiff', 'mdPr', 'me', 'mendChr', 'meqArr', 'meqArrPr', 'mf', 'mfName', 'mfPr',
  'mfunc', 'mfuncPr', 'mgroupChr', 'mgroupChrPr', 'mgrow', 'mhideBot', 'mhideLeft', 'mhideRight', 'mhideTop',
  'mhtmltag', 'mlim', 'mlimloc', 'mlimlow', 'mlimlowPr', 'mlimupp', 'mlimuppPr', 'mm', 'mmaddfieldname',
  'mmath', 'mmathPict', 'mmathPr', 'mmaxdist', 'mmc', 'mmcJc', 'mmconnectstr', 'mmconnectstrdata', 'mmcPr',
  'mmcs', 'mmdatasource', 'mmheadersource', 'mmmailsubject', 'mmodso', 'mmodsofilter', 'mmodsofldmpdata',
  'mmodsomappedname', 'mmodsoname', 'mmodsorecipdata', 'mmodsosort', 'mmodsosrc', 'mmodsotable', 'mmodsoudl',
  'mmodsoudldata', 'mmodsouniquetag', 'mmPr', 'mmquery', 'mmr', 'mnary', 'mnaryPr', 'mnoBreak', 'mnum', 'mobjDist',
  'moMath', 'moMathPara', 'moMathParaPr', 'mopEmu', 'mphant', 'mphantPr', 'mplcHide', 'mpos', 'mr', 'mrad',
  'mradPr', 'mrPr', 'msepChr', 'mshow', 'mshp', 'msPre', 'msPrePr', 'msSub', 'msSubPr', 'msSubSup', 'msSubSupPr',
  'msSup', 'msSupPr', 'mstrikeBLTR', 'mstrikeH', 'mstrikeTLBR', 'mstrikeV', 'msub', 'msubHide', 'msup',
  'msupHide', 'mtransp', 'mtype', 'mvertJc', 'mvfmf', 'mvfml', 'mvtof', 'mvtol', 'mzeroAsc', 'mzeroDesc',
  'mzeroWid', 'nesttableprops', 'nextfile', 'nonesttables', 'objalias', 'objclass', 'objdata', 'object',
  'objname', 'objsect', 'objtime', 'oldcprops', 'oldpprops', 'oldsprops', 'oldtprops', 'oleclsid', 'operator',
  'panose', 'password', 'passwordhash', 'pgp', 'pgptbl', 'picprop', 'pict', 'pn', 'pnseclvl', 'pntext',
  'pntxta', 'pntxtb', 'printim', 'private', 'propname', 'protend', 'protstart', 'protusertbl', 'pxe', 'result',
  'revtbl', 'revtim', 'rsidtbl', 'rxe', 'shp', 'shpgrp', 'shpinst', 'shppict', 'shprslt', 'shptxt', 'sn', 'sp',
  'staticval', 'stylesheet', 'subject', 'sv', 'svb', 'tc', 'template', 'themedata', 'title', 'txe', 'ud',
  'upr', 'userprops', 'wgrffmtfilter', 'windowcaption', 'writereservation', 'writereservhash', 'xe', 'xform',
  'xmlattrname', 'xmlattrvalue', 'xmlclose', 'xmlname', 'xmlnstbl', 'xmlopen',
]);

const RTF_SPECIAL: Record<string, string> = {
  par: '\n', sect: '\n\n', page: '\n\n', line: '\n', tab: '\t', emdash: '—', endash: '–',
  emspace: ' ', enspace: ' ', qmspace: ' ', bullet: '•', lquote: '‘', rquote: '’',
  ldblquote: '“', rdblquote: '”', cell: '\t', row: '\n', nestcell: '\t', nestrow: '\n',
};

export function rtfToText(rtf: string): string {
  const pattern = /\\([a-z]{1,32})(-?\d{1,10})?[ ]?|\\'([0-9a-f]{2})|\\([^a-z])|([{}])|[\r\n]+|(.)/gis;
  const stack: { ucskip: number; ignorable: boolean }[] = [];
  let ignorable = false;
  let ucskip = 1;
  let curskip = 0;
  let out = '';
  let pendingBytes: number[] = [];
  const decoder = new TextDecoder('windows-1252');

  const flushBytes = () => {
    if (pendingBytes.length) {
      out += decoder.decode(new Uint8Array(pendingBytes));
      pendingBytes = [];
    }
  };

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(rtf)) !== null) {
    const [, word, arg, hex, char, brace, tchar] = m;
    if (hex === undefined) flushBytes();

    if (brace) {
      curskip = 0;
      if (brace === '{') {
        stack.push({ ucskip, ignorable });
      } else {
        const prev = stack.pop();
        if (prev) {
          ucskip = prev.ucskip;
          ignorable = prev.ignorable;
        }
      }
    } else if (char) {
      curskip = 0;
      if (char === '~') { if (!ignorable) out += '\u00a0'; }
      else if (char === '{' || char === '}' || char === '\\') { if (!ignorable) out += char; }
      else if (char === '*') ignorable = true;
      else if (char === '_') { if (!ignorable) out += '-'; }
      else if (char === '\n' || char === '\r') { if (!ignorable) out += '\n'; }
    } else if (word) {
      curskip = 0;
      if (RTF_DESTINATIONS.has(word)) {
        ignorable = true;
      } else if (ignorable) {
        // skip
      } else if (RTF_SPECIAL[word] !== undefined) {
        out += RTF_SPECIAL[word];
      } else if (word === 'uc') {
        ucskip = parseInt(arg || '1', 10);
      } else if (word === 'u') {
        let c = parseInt(arg || '0', 10);
        if (c < 0) c += 0x10000;
        out += String.fromCharCode(c);
        curskip = ucskip;
      }
    } else if (hex !== undefined) {
      if (curskip > 0) curskip--;
      else if (!ignorable) pendingBytes.push(parseInt(hex, 16));
    } else if (tchar) {
      if (curskip > 0) curskip--;
      else if (!ignorable) out += tchar;
    }
  }
  flushBytes();

  return out
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ----------------------------- HTML -----------------------------------------

const BLOCK_CONTAINERS = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'figure', 'figcaption', 'body',
  'form', 'center', 'details', 'summary', 'dl', 'dd', 'dt', 'address', 'fieldset', 'blockquote', 'tbody',
]);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'svg', 'canvas', 'iframe', 'select', 'button', 'input', 'textarea']);

export function htmlToStructure(html: string): StructuredParagraph[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: StructuredParagraph[] = [];
  let inline: TextRunInfo[] = [];

  const pushRuns = (runs: TextRunInfo[], extra: Partial<StructuredParagraph> = {}) => {
    const merged = mergeRuns(runs);
    // collapse whitespace and trim edges
    merged.forEach(r => (r.text = r.text.replace(/[ \t\r\n\f]+/g, ' ').replace(/ ?\u2028 ?/g, '\n')));
    if (merged.length) {
      merged[0].text = merged[0].text.replace(/^\s+/, '');
      merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, '');
    }
    const clean = merged.filter(r => r.text.length > 0);
    const text = clean.map(r => r.text).join('');
    if (!text.trim()) return;
    blocks.push({ text, runs: clean, ...extra });
  };

  const flush = () => {
    if (inline.length) pushRuns(inline);
    inline = [];
  };

  const collectInline = (node: Node, fmt: { bold?: boolean; italic?: boolean; href?: string }, runs: TextRunInfo[], skipLists: boolean) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        runs.push({ text: child.nodeValue || '', ...fmt });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return;
      if (skipLists && (tag === 'ul' || tag === 'ol')) return;
      if (tag === 'br') { runs.push({ text: '\u2028', ...fmt }); return; }
      const next = { ...fmt };
      if (tag === 'b' || tag === 'strong') next.bold = true;
      if (tag === 'i' || tag === 'em') next.italic = true;
      if (tag === 'a' && el.getAttribute('href')) next.href = el.getAttribute('href') || undefined;
      collectInline(el, next, runs, skipLists);
      if (tag === 'p' || tag === 'div' || tag === 'li') runs.push({ text: ' ', ...fmt });
    });
  };

  const walkList = (list: HTMLElement, level: number) => {
    const ordered = list.tagName.toLowerCase() === 'ol';
    let index = parseInt(list.getAttribute('start') || '1', 10) || 1;
    Array.from(list.children).forEach(li => {
      if (li.tagName.toLowerCase() !== 'li') return;
      const runs: TextRunInfo[] = [];
      collectInline(li, {}, runs, true);
      pushRuns(runs, { isList: true, ordered, listIndex: index, listLevel: level });
      index++;
      li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => walkList(sub as HTMLElement, level + 1));
    });
  };

  const walk = (node: Node) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        inline.push({ text: child.nodeValue || '' });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return;

      if (/^h[1-6]$/.test(tag)) {
        flush();
        const runs: TextRunInfo[] = [];
        collectInline(el, {}, runs, false);
        pushRuns(runs, { isHeading: true, headingLevel: parseInt(tag[1], 10) });
      } else if (tag === 'p') {
        flush();
        const runs: TextRunInfo[] = [];
        collectInline(el, {}, runs, false);
        pushRuns(runs);
      } else if (tag === 'ul' || tag === 'ol') {
        flush();
        walkList(el, 0);
      } else if (tag === 'pre') {
        flush();
        const text = (el.textContent || '').replace(/\n$/, '');
        if (text.trim()) blocks.push({ text, isCode: true });
      } else if (tag === 'table') {
        flush();
        const rows = Array.from(el.querySelectorAll('tr'))
          .map(tr => Array.from(tr.children).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()))
          .filter(r => r.some(Boolean));
        if (rows.length) blocks.push({ text: rows.map(r => r.join('\t')).join('\n'), table: rows });
      } else if (tag === 'hr') {
        flush();
      } else if (BLOCK_CONTAINERS.has(tag)) {
        flush();
        walk(el);
        flush();
      } else if (tag === 'br') {
        inline.push({ text: '\u2028' });
      } else {
        const fmt: { bold?: boolean; italic?: boolean; href?: string } = {};
        if (tag === 'b' || tag === 'strong') fmt.bold = true;
        if (tag === 'i' || tag === 'em') fmt.italic = true;
        if (tag === 'a' && el.getAttribute('href')) fmt.href = el.getAttribute('href') || undefined;
        collectInline(el, fmt, inline, false);
      }
    });
  };

  walk(doc.body);
  flush();
  return blocks;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function runsOf(p: StructuredParagraph): TextRunInfo[] {
  return p.runs && p.runs.length ? p.runs : [{ text: p.text }];
}

export function structureToPlainText(allParagraphs: StructuredParagraph[]): string {
  const paragraphs = allParagraphs.filter(p => !p.image);
  const out: string[] = [];
  paragraphs.forEach((p, i) => {
    let line: string;
    if (p.table) line = p.table.map(r => r.join('\t')).join('\n');
    else if (p.isList) line = '  '.repeat(p.listLevel || 0) + (p.ordered ? `${p.listIndex ?? 1}. ` : '- ') + p.text;
    else line = p.text;
    const prev = paragraphs[i - 1];
    const tight = p.isList && prev?.isList;
    out.push((i === 0 ? '' : tight ? '\n' : '\n\n') + line);
  });
  return out.join('');
}

function escapeMd(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1').replace(/^(\s*)([#>+-]|\d+\.)(\s)/gm, '$1\\$2$3');
}

export function structureToMarkdown(allParagraphs: StructuredParagraph[]): string {
  const paragraphs = allParagraphs.filter(p => !p.image);
  const inlineMd = (p: StructuredParagraph) =>
    runsOf(p)
      .map(r => {
        let t = escapeMd(r.text);
        const m = t.match(/^(\s*)(.*?)(\s*)$/s)!;
        let core = m[2];
        if (!core) return t;
        if (r.bold && r.italic) core = `***${core}***`;
        else if (r.bold) core = `**${core}**`;
        else if (r.italic) core = `*${core}*`;
        if (r.href) core = `[${core}](${r.href})`;
        t = m[1] + core + m[3];
        return t;
      })
      .join('')
      .replace(/\n/g, '  \n');

  const out: string[] = [];
  paragraphs.forEach((p, i) => {
    let block: string;
    if (p.table) {
      const cols = Math.max(...p.table.map(r => r.length));
      const cell = (c: string) => (c || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const row = (r: string[]) => `| ${Array.from({ length: cols }, (_, k) => cell(r[k] || '')).join(' | ')} |`;
      block = [row(p.table[0]), `| ${Array(cols).fill('---').join(' | ')} |`, ...p.table.slice(1).map(row)].join('\n');
    } else if (p.isCode) {
      block = '```\n' + p.text + '\n```';
    } else if (p.isHeading) {
      block = `${'#'.repeat(Math.min(Math.max(p.headingLevel || 1, 1), 6))} ${inlineMd(p).replace(/ {2}\n/g, ' ')}`;
    } else if (p.isList) {
      block = '  '.repeat(p.listLevel || 0) + (p.ordered ? `${p.listIndex ?? 1}. ` : '- ') + inlineMd(p);
    } else {
      block = inlineMd(p);
    }
    const prev = paragraphs[i - 1];
    out.push((i === 0 ? '' : p.isList && prev?.isList ? '\n' : '\n\n') + block);
  });
  return out.join('') + '\n';
}

export function structureToHtml(paragraphs: StructuredParagraph[]): string {
  const inlineHtml = (p: StructuredParagraph) =>
    runsOf(p)
      .map(r => {
        let t = escapeHtml(r.text).replace(/\n/g, '<br>');
        if (r.bold) t = `<strong>${t}</strong>`;
        if (r.italic) t = `<em>${t}</em>`;
        if (r.href && !/^\s*javascript:/i.test(r.href)) t = `<a href="${escapeHtml(r.href)}">${t}</a>`;
        return t;
      })
      .join('');

  const out: string[] = [];
  const openLists: string[] = [];
  const closeListsTo = (level: number) => {
    while (openLists.length > level) out.push(`</${openLists.pop()}>`);
  };

  for (const p of paragraphs) {
    if (p.isList) {
      const level = (p.listLevel || 0) + 1;
      const tag = p.ordered ? 'ol' : 'ul';
      closeListsTo(level);
      if (openLists.length === level && openLists[level - 1] !== tag) closeListsTo(level - 1);
      while (openLists.length < level) {
        out.push(`<${tag}>`);
        openLists.push(tag);
      }
      out.push(`<li>${inlineHtml(p)}</li>`);
      continue;
    }
    closeListsTo(0);
    if (p.image) {
      out.push(`<p><img src="${p.image.dataUrl}" alt="" width="${Math.round(p.image.width / 0.75)}" style="max-width:100%;height:auto"></p>`);
    } else if (p.table) {
      const [head, ...rest] = p.table;
      out.push(
        `<table>\n<thead><tr>${head.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>\n<tbody>\n` +
        rest.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('\n') +
        `\n</tbody>\n</table>`
      );
    } else if (p.isCode) {
      out.push(`<pre><code>${escapeHtml(p.text)}</code></pre>`);
    } else if (p.isHeading) {
      const tag = `h${Math.min(Math.max(p.headingLevel || 1, 1), 6)}`;
      out.push(`<${tag}>${inlineHtml(p)}</${tag}>`);
    } else {
      out.push(`<p>${inlineHtml(p)}</p>`);
    }
  }
  closeListsTo(0);
  return out.join('\n');
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 820px; margin: 0 auto; background: #fff; padding: 48px; border-radius: 12px; border: 1px solid #e2e8f0; }
    h1, h2, h3, h4, h5, h6 { color: #0f172a; margin: 1.4em 0 0.5em; line-height: 1.25; }
    p { margin: 0.9em 0; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.9em; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote { border-left: 4px solid #3b82f6; margin-left: 0; padding-left: 16px; color: #64748b; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    img { max-width: 100%; }
    @media print { body { background: #fff; padding: 0; } .container { border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
${bodyHtml}
  </div>
</body>
</html>`;
}

function docxRuns(p: StructuredParagraph, size?: number): TextRun[] {
  const runs: TextRun[] = [];
  for (const r of runsOf(p)) {
    const parts = r.text.split('\n');
    parts.forEach((part, idx) => {
      runs.push(new TextRun({ text: part, bold: r.bold, italics: r.italic, size, break: idx > 0 ? 1 : undefined }));
    });
  }
  return runs;
}

export async function buildDocxFromStructure(title: string, paragraphs: StructuredParagraph[]): Promise<Blob> {
  const HEADINGS = [
    HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
  ];
  const children: (Paragraph | Table)[] = [];

  for (const p of paragraphs) {
    if (p.image) continue; // only DOCX inputs carry images, and DOCX -> DOCX is not offered
    if (p.table) {
      const cols = Math.max(...p.table.map(r => r.length));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: p.table.map((r, ri) =>
            new TableRow({
              children: Array.from({ length: cols }, (_, ci) =>
                new TableCell({
                  children: (r[ci] || '').split('\n').map(line =>
                    new Paragraph({ children: [new TextRun({ text: line, bold: ri === 0, size: 20 })] })
                  ),
                })
              ),
            })
          ),
        })
      );
      children.push(new Paragraph({ text: '' }));
    } else if (p.isHeading) {
      const level = Math.min(Math.max(p.headingLevel || 1, 1), 6);
      children.push(new Paragraph({ children: docxRuns(p), heading: HEADINGS[level - 1], spacing: { before: 280, after: 120 } }));
    } else if (p.isList) {
      const level = Math.min(p.listLevel || 0, 8);
      if (p.ordered) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${p.listIndex ?? 1}. `, size: 22 }), ...docxRuns(p, 22)],
          indent: { left: 720 * (level + 1), hanging: 360 },
          spacing: { after: 80 },
        }));
      } else {
        children.push(new Paragraph({ children: docxRuns(p, 22), bullet: { level }, spacing: { after: 80 } }));
      }
    } else if (p.isCode) {
      children.push(new Paragraph({
        children: p.text.split('\n').map((line, idx) => new TextRun({ text: line, font: 'Consolas', size: 20, break: idx > 0 ? 1 : undefined })),
        spacing: { after: 120 },
      }));
    } else {
      children.push(new Paragraph({ children: docxRuns(p, 22), spacing: { after: 120, line: 276 } }));
    }
  }

  const doc = new Document({
    title,
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  return await Packer.toBlob(doc);
}

export function buildPdfFromStructure(
  title: string,
  paragraphs: StructuredParagraph[],
  options: ConversionOptions
): Blob {
  const doc = new jsPDF({
    orientation: options.pdfOrientation || 'portrait',
    unit: 'pt',
    format: options.pdfPageSize || 'a4',
  });
  doc.setProperties({ title });

  const margin = options.pdfMargin ?? 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - margin;

  let y = margin;
  let pageNum = 1;

  const addFooter = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`${pageNum}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  };

  const ensure = (needed: number) => {
    if (y + needed > bottom) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = margin;
    }
  };

  const writeLines = (text: string, x: number, width: number, lineHeight: number, firstLineCallback?: () => void) => {
    const lines: string[] = [];
    for (const raw of text.split('\n')) {
      const wrapped = doc.splitTextToSize(toPdfSafeText(raw), width) as string[];
      lines.push(...(wrapped.length ? wrapped : ['']));
    }
    lines.forEach((line, i) => {
      ensure(lineHeight);
      if (i === 0) firstLineCallback?.();
      doc.text(line, x, y + lineHeight * 0.75);
      y += lineHeight;
    });
  };

  for (const p of paragraphs) {
    if (p.image) {
      // Keep the size from Word, but never wider than the text column or taller than a page
      const maxH = bottom - margin;
      const scale = Math.min(1, contentWidth / p.image.width, maxH / p.image.height);
      const w = p.image.width * scale;
      const h = p.image.height * scale;
      ensure(h + 6);
      try {
        doc.addImage(p.image.dataUrl, p.image.format, margin, y + 3, w, h, undefined, 'FAST');
      } catch {
        // corrupt picture: leave the space empty rather than failing the whole PDF
      }
      y += h + 10;
      continue;
    }
    if (p.table) {
      const cols = Math.max(...p.table.map(r => r.length));
      const colW = contentWidth / cols;
      doc.setFontSize(9);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      y += 4;
      p.table.forEach((row, ri) => {
        doc.setFont('helvetica', ri === 0 ? 'bold' : 'normal');
        const cellLines = Array.from({ length: cols }, (_, ci) =>
          (toPdfSafeText(row[ci] || '').split('\n').flatMap(l => doc.splitTextToSize(l, colW - 8) as string[]))
        );
        const h = Math.max(1, ...cellLines.map(l => l.length)) * 11 + 6;
        ensure(h);
        if (ri === 0) {
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, h, 'F');
        }
        doc.setTextColor(30, 41, 59);
        cellLines.forEach((lines, ci) => {
          doc.rect(margin + ci * colW, y, colW, h);
          lines.forEach((l, li) => doc.text(l, margin + ci * colW + 4, y + 12 + li * 11));
        });
        y += h;
      });
      y += 10;
    } else if (p.isHeading) {
      const level = p.headingLevel || 1;
      const fontSize = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 11.5;
      ensure(fontSize * 3);
      y += fontSize * 0.6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(15, 23, 42);
      writeLines(p.text, margin, contentWidth, fontSize * 1.3);
      y += fontSize * 0.35;
    } else if (p.isCode) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      writeLines(p.text, margin + 8, contentWidth - 16, 12);
      y += 8;
    } else {
      const allBold = runsOf(p).every(r => r.bold || !r.text.trim());
      doc.setFont('helvetica', allBold ? 'bold' : 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      const lineHeight = 15;
      if (p.isList) {
        const indent = 16 + (p.listLevel || 0) * 16;
        const marker = p.ordered ? `${p.listIndex ?? 1}.` : '';
        writeLines(p.text, margin + indent, contentWidth - indent, lineHeight, () => {
          if (marker) {
            doc.text(marker, margin + indent - 4, y + lineHeight * 0.75, { align: 'right' });
          } else {
            doc.setFillColor(51, 65, 85);
            doc.circle(margin + indent - 8, y + lineHeight * 0.5, 1.6, 'F');
          }
        });
        y += 3;
      } else {
        writeLines(p.text, margin, contentWidth, lineHeight);
        y += 7;
      }
    }
  }

  addFooter();
  return doc.output('blob');
}

// ---------------------------------------------------------------------------
// PDF -> images
// ---------------------------------------------------------------------------

export async function convertPdfToImages(
  file: File,
  targetFormat: string,
  options: ConversionOptions
): Promise<{ blob: Blob; filename: string }> {
  const pdfDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const baseName = getBaseName(file.name);
  const numPages = pdfDoc.numPages;
  const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
  const mimeType = targetFormat === 'png' ? 'image/png' : targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
  const quality = options.imageQuality ?? 0.92;

  const renderPage = async (n: number): Promise<Blob> => {
    const page = await pdfDoc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // ~150-200 DPI but keep canvas within browser limits
    const scale = Math.min(2.5, 4096 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    // Always paint white: PDFs assume a white page, transparent PNGs look broken
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error(`Falha ao renderizar página ${n}`))), mimeType, quality)
    );
    canvas.width = canvas.height = 0;
    page.cleanup();
    return blob;
  };

  if (numPages === 1) {
    return { blob: await renderPage(1), filename: `${baseName}.${ext}` };
  }

  const zip = new JSZip();
  const digits = String(numPages).length;
  for (let i = 1; i <= numPages; i++) {
    zip.file(`${baseName}_pagina_${String(i).padStart(digits, '0')}.${ext}`, await renderPage(i));
  }
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return { blob: zipBlob, filename: `${baseName}_paginas_${ext}.zip` };
}

