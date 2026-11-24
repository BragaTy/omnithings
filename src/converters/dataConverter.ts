import * as XLSX from 'xlsx';
import * as yaml from 'js-yaml';
import { jsPDF } from 'jspdf';
import { ConversionOptions } from '../types';
import { readTextSmart, toPdfSafeText, escapeHtml, getBaseName, getExtension } from './textUtils';

type Row = Record<string, any>;

export async function convertData(
  file: File,
  targetFormat: string,
  options: ConversionOptions
): Promise<{ blob: Blob; filename: string }> {
  const baseName = getBaseName(file.name);
  const inputExt = getExtension(file.name);
  const target = targetFormat.toLowerCase();

  // 1. Parse input into a JS structure (kept as close to the original as possible)
  let data: any = null;

  if (inputExt === 'xlsx' || inputExt === 'xls' || inputExt === 'ods') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('A planilha não contém nenhuma aba.');
    const sheet = workbook.Sheets[sheetName];
    // defval keeps empty cells so every row has every column
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: true });
    data = rows.map(r => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) out[k] = v instanceof Date ? formatDate(v) : v;
      return out;
    });
  } else if (inputExt === 'csv' || inputExt === 'tsv' || inputExt === 'txt') {
    const text = (await readTextSmart(file)).replace(/^﻿/, '');
    const delimiter = inputExt === 'tsv' ? '\t' : detectCsvDelimiter(text);
    data = csvToObjects(parseCsv(text, delimiter));
  } else if (inputExt === 'json') {
    const text = (await readTextSmart(file)).replace(/^﻿/, '');
    try {
      data = JSON.parse(text);
    } catch {
      // JSON Lines (one object per line)
      try {
        data = text.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
      } catch {
        throw new Error('Arquivo JSON inválido ou mal formatado.');
      }
    }
  } else if (inputExt === 'yaml' || inputExt === 'yml') {
    const text = await readTextSmart(file);
    try {
      try {
        data = yaml.load(text);
      } catch (single) {
        // Files with several "---" documents
        const loadAll = (yaml as any).loadAll;
        if (typeof loadAll !== 'function') throw single;
        data = (loadAll(text) as unknown[]).filter(d => d !== undefined);
      }
    } catch (e: any) {
      throw new Error(`Arquivo YAML inválido: ${e?.message || 'erro de sintaxe'}`);
    }
  } else if (inputExt === 'xml') {
    data = parseXmlToJson(await readTextSmart(file));
  } else {
    const text = await readTextSmart(file);
    try {
      data = JSON.parse(text);
    } catch {
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      data = lines.map((l, i) => ({ linha: i + 1, conteudo: l }));
    }
  }

  // 2. Serialize
  switch (target) {
    case 'json': {
      const jsonStr = JSON.stringify(data, null, options.jsonIndent ?? 2);
      return { blob: new Blob([jsonStr], { type: 'application/json;charset=utf-8' }), filename: `${baseName}.json` };
    }

    case 'xlsx': {
      const { headers, rows } = toTable(data);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      ws['!cols'] = headers.map(h => ({
        wch: Math.min(60, Math.max(h.length, ...rows.slice(0, 200).map(r => String(r[h] ?? '').length)) + 2),
      }));
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return {
        blob: new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        filename: `${baseName}.xlsx`,
      };
    }

    case 'csv': {
      const csvStr = tableToCsv(toTable(data), options.csvDelimiter || ',');
      return { blob: new Blob(['﻿' + csvStr], { type: 'text/csv;charset=utf-8' }), filename: `${baseName}.csv` };
    }

    case 'tsv': {
      const tsvStr = tableToCsv(toTable(data), '\t');
      return { blob: new Blob(['﻿' + tsvStr], { type: 'text/tab-separated-values;charset=utf-8' }), filename: `${baseName}.tsv` };
    }

    case 'yaml':
    case 'yml': {
      const yamlStr = yaml.dump(data, { indent: options.yamlIndent ?? 2, lineWidth: -1, noRefs: true });
      return { blob: new Blob([yamlStr], { type: 'application/x-yaml;charset=utf-8' }), filename: `${baseName}.${target}` };
    }

    case 'xml': {
      return { blob: new Blob([jsonToXml(data)], { type: 'application/xml;charset=utf-8' }), filename: `${baseName}.xml` };
    }

    case 'html': {
      const html = tableToHtml(toTable(data), baseName);
      return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: `${baseName}.html` };
    }

    case 'pdf': {
      return { blob: generateTablePdf(toTable(data), baseName, options), filename: `${baseName}.pdf` };
    }

    case 'txt': {
      const txt = typeof data === 'string' ? data : tableToText(toTable(data));
      return { blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }), filename: `${baseName}.txt` };
    }

    default:
      throw new Error(`Formato de destino não suportado para dados: ${targetFormat}`);
  }
}

function formatDate(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) return date;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Tabular normalization
// ---------------------------------------------------------------------------

/**
 * Turns any parsed structure into rows + columns:
 * - finds the main array inside wrapper objects ({ data: [...] }, XML roots, …)
 * - flattens nested objects using dot notation (endereco.cidade)
 * - uses the union of keys of all rows as columns (not just the first row)
 */
export function toTable(data: any): { headers: string[]; rows: Row[] } {
  const records = findRecords(data);
  const rows: Row[] = records.map(r => {
    if (r === null || typeof r !== 'object') return { valor: r ?? '' };
    if (Array.isArray(r)) {
      const o: Row = {};
      r.forEach((v, i) => (o[`col_${i + 1}`] = v));
      return flattenObject(o);
    }
    return flattenObject(r);
  });

  const headers: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  return { headers, rows };
}

function findRecords(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data === null || typeof data !== 'object') return data === null || data === undefined ? [] : [data];

  // Walk down single-key wrappers and look for the largest array of objects
  let current = data;
  for (let depth = 0; depth < 5; depth++) {
    if (Array.isArray(current)) return current;
    if (current === null || typeof current !== 'object') break;
    const entries = Object.entries(current);
    const arrays = entries.filter(([, v]) => Array.isArray(v) && (v as any[]).length > 0);
    if (arrays.length > 0) {
      arrays.sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length);
      const [, arr] = arrays[0];
      const others = entries.filter(([, v]) => !Array.isArray(v) && (v === null || typeof v !== 'object'));
      // Only unwrap if the array is clearly the "content" of the object
      if (arrays.length === 1 && others.length <= 3) return arr as any[];
      if (arrays.length > 1) return arr as any[];
    }
    const objectChildren = entries.filter(([, v]) => v !== null && typeof v === 'object');
    if (entries.length === 1 && objectChildren.length === 1) {
      current = objectChildren[0][1];
      continue;
    }
    break;
  }
  return [data];
}

function flattenObject(obj: any, prefix = '', out: Row = {}): Row {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value instanceof Date) {
      out[path] = formatDate(value);
    } else if (Array.isArray(value)) {
      if (value.every(v => v === null || typeof v !== 'object')) {
        out[path] = value.join(', ');
      } else {
        out[path] = JSON.stringify(value);
      }
    } else if (value !== null && typeof value === 'object') {
      if (Object.keys(value).length === 0) out[path] = '';
      else flattenObject(value, path, out);
    } else {
      out[path] = value ?? '';
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

// Pick the delimiter that produces the most consistent column count
function detectCsvDelimiter(text: string): string {
  const sample = text.slice(0, 20000);
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = 0;
  for (const d of candidates) {
    const rows = parseCsv(sample, d).slice(0, 20);
    if (rows.length === 0) continue;
    const cols = rows[0].length;
    if (cols < 2) continue;
    const consistent = rows.filter(r => r.length === cols).length;
    const score = consistent * cols;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** RFC 4180 parser: handles quotes, escaped quotes and line breaks inside fields. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  row.push(field);
  if (!(row.length === 1 && row[0] === '')) rows.push(row);
  return rows;
}

function csvToObjects(rows: string[][]): Row[] {
  if (rows.length === 0) return [];
  const rawHeaders = rows[0].map(h => h.trim());
  const maxCols = Math.max(...rows.map(r => r.length));
  // Make headers unique and non-empty
  const headers: string[] = [];
  const used = new Map<string, number>();
  for (let i = 0; i < maxCols; i++) {
    let h = rawHeaders[i] || `coluna_${i + 1}`;
    const count = used.get(h) || 0;
    used.set(h, count + 1);
    if (count > 0) h = `${h}_${count + 1}`;
    headers.push(h);
  }
  return rows.slice(1).map(values => {
    const obj: Row = {};
    headers.forEach((h, idx) => (obj[h] = values[idx] ?? ''));
    return obj;
  });
}

function cellToString(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return formatDate(val);
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function tableToCsv({ headers, rows }: { headers: string[]; rows: Row[] }, delimiter: string): string {
  if (headers.length === 0) return '';
  const esc = (val: any) => {
    const str = cellToString(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r') || /^\s|\s$/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(esc).join(delimiter)];
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(delimiter));
  return lines.join('\r\n');
}

function tableToText({ headers, rows }: { headers: string[]; rows: Row[] }): string {
  if (headers.length === 0) return '';
  const widths = headers.map(h =>
    Math.min(40, Math.max(h.length, ...rows.map(r => cellToString(r[h]).length)))
  );
  const fmt = (vals: string[]) =>
    vals.map((v, i) => (v.length > widths[i] ? v.slice(0, widths[i] - 1) + '…' : v.padEnd(widths[i]))).join(' | ').trimEnd();
  const out = [fmt(headers), widths.map(w => '-'.repeat(w)).join('-+-')];
  for (const r of rows) out.push(fmt(headers.map(h => cellToString(r[h]).replace(/\r?\n/g, ' '))));
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

function parseXmlToJson(xmlText: string): any {
  const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const err = xmlDoc.getElementsByTagName('parsererror')[0];
  if (err) {
    throw new Error('Arquivo XML inválido ou mal formatado.');
  }

  const parseElement = (el: Element): any => {
    const obj: Row = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('xmlns')) continue;
      obj[`@${attr.name}`] = attr.value;
    }

    let text = '';
    let hasElementChildren = false;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        hasElementChildren = true;
        const name = (child as Element).nodeName;
        const value = parseElement(child as Element);
        if (name in obj) {
          if (!Array.isArray(obj[name])) obj[name] = [obj[name]];
          obj[name].push(value);
        } else {
          obj[name] = value;
        }
      } else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
        text += child.nodeValue || '';
      }
    }

    text = text.trim();
    const hasAttrs = Object.keys(obj).some(k => k.startsWith('@'));
    if (!hasElementChildren && !hasAttrs) return text;
    if (text) obj['#text'] = text;
    return obj;
  };

  const root = xmlDoc.documentElement;
  return { [root.nodeName]: parseElement(root) };
}

function toXmlName(key: string): string {
  let name = key.replace(/[^\p{L}\p{N}_.-]/gu, '_');
  if (!/^[\p{L}_]/u.test(name)) name = `_${name}`;
  return name;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonToXml(data: any): string {
  const build = (value: any, name: string, indent: string): string => {
    const tag = toXmlName(name);
    if (value === null || value === undefined) return `${indent}<${tag}/>`;
    if (Array.isArray(value)) {
      // Repeated elements share the parent key name
      return value.map(v => build(v, name, indent)).join('\n');
    }
    if (value instanceof Date) return `${indent}<${tag}>${formatDate(value)}</${tag}>`;
    if (typeof value !== 'object') return `${indent}<${tag}>${escapeXml(String(value))}</${tag}>`;

    let attrs = '';
    let text = '';
    const children: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('@')) attrs += ` ${toXmlName(k.slice(1))}="${escapeXml(String(v ?? ''))}"`;
      else if (k === '#text') text = escapeXml(String(v ?? ''));
      else children.push(build(v, k, indent + '  '));
    }
    if (children.length === 0) {
      return text ? `${indent}<${tag}${attrs}>${text}</${tag}>` : `${indent}<${tag}${attrs}/>`;
    }
    const textLine = text ? `${indent}  ${text}\n` : '';
    return `${indent}<${tag}${attrs}>\n${textLine}${children.join('\n')}\n${indent}</${tag}>`;
  };

  let body: string;
  const keys = data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];
  if (keys.length === 1 && !Array.isArray(data[keys[0]])) {
    // Already has a single root element (e.g. came from XML)
    body = build(data[keys[0]], keys[0], '');
  } else if (Array.isArray(data)) {
    body = `<root>\n${data.map(v => build(v, 'item', '  ')).join('\n')}\n</root>`;
  } else {
    body = build(data, 'root', '');
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

// ---------------------------------------------------------------------------
// HTML & PDF tables
// ---------------------------------------------------------------------------

function tableToHtml({ headers, rows }: { headers: string[]; rows: Row[] }, title: string): string {
  const body = headers.length === 0
    ? '<p>Nenhum dado encontrado.</p>'
    : `<table>
    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>
${rows.map(r => `      <tr>${headers.map(h => `<td>${escapeHtml(cellToString(r[h]))}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; background: #f8fafc; color: #1e293b; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    .wrap { overflow-x: auto; }
    table { border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 100%; }
    th, td { padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; white-space: pre-wrap; }
    th { background: #f1f5f9; font-weight: 600; position: sticky; top: 0; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="wrap">
  ${body}
  </div>
</body>
</html>`;
}

function generateTablePdf({ headers, rows }: { headers: string[]; rows: Row[] }, title: string, options: ConversionOptions): Blob {
  if (headers.length === 0) {
    const doc = new jsPDF({ unit: 'pt', format: options.pdfPageSize || 'a4' });
    doc.text('Nenhum dado tabular para exibir.', 40, 50);
    return doc.output('blob');
  }

  const isLandscape = headers.length > 4 ? true : options.pdfOrientation === 'landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: options.pdfPageSize || 'a4',
  });

  const margin = options.pdfMargin ?? 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = pageWidth - margin * 2;

  // Shrink font when there are many columns so everything fits on the page
  const fontSize = Math.max(5, Math.min(8, (availableWidth / headers.length) / 6));
  const rowH = fontSize * 2;
  const pad = 3;

  // Column widths proportional to content length
  const sampleRows = rows.slice(0, 300);
  const weights = headers.map(h =>
    Math.min(40, Math.max(4, h.length, ...sampleRows.map(r => cellToString(r[h]).length)))
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colWidths = weights.map(w => (w / totalWeight) * availableWidth);
  const colX: number[] = [];
  colWidths.reduce((x, w, i) => ((colX[i] = x), x + w), margin);

  const fit = (raw: string, width: number) => {
    let text = toPdfSafeText(raw.replace(/\s+/g, ' '));
    const max = width - pad * 2;
    if (doc.getTextWidth(text) <= max) return text;
    while (text.length > 1 && doc.getTextWidth(text + '...') > max) text = text.slice(0, -1);
    return text + '...';
  };

  let y = margin + 20;
  let pageNum = 1;

  const drawFooter = (p: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${p}`,pageWidth / 2, pageHeight - 15, { align: 'center' });
  };

  const drawHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, availableWidth, rowH + 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, idx) => doc.text(fit(h, colWidths[idx]), colX[idx] + pad, y + rowH * 0.7));
    y += rowH + 2;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(toPdfSafeText(title), margin, y);
  y += 14;
  drawHeader();

  for (let r = 0; r < rows.length; r++) {
    if (y + rowH > pageHeight - margin - 20) {
      drawFooter(pageNum);
      doc.addPage();
      pageNum++;
      y = margin;
      drawHeader();
    }
    const row = rows[r];
    if (r % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, availableWidth, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y + rowH, margin + availableWidth, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(51, 65, 85);
    headers.forEach((h, idx) => {
      const val = cellToString(row[h]);
      if (val) doc.text(fit(val, colWidths[idx]), colX[idx] + pad, y + rowH * 0.68);
    });
    y += rowH;
  }

  drawFooter(pageNum);
  return doc.output('blob');
}
