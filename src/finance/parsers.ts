// Reads bank statements exported by Brazilian banks (CSV, OFX, XLS/XLSX)
// into a uniform list of transactions.
import * as XLSX from 'xlsx';
import { readTextSmart, getExtension } from '../converters/textUtils';
import { parseCsv, detectCsvDelimiter } from '../converters/dataConverter';
import { ParsedStatement, RawTransaction } from './types';
import { normalizeText } from './categories';

type Cell = string | number | Date | null | undefined;

export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const ext = getExtension(file.name);

  if (ext === 'ofx' || ext === 'qfx') {
    return { source: file.name, rows: parseOfx(await readTextSmart(file)), looksLikeCardBill: false };
  }

  let table: Cell[][];
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    table = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: '' });
  } else {
    const text = (await readTextSmart(file)).replace(/^﻿/, '');
    if (/<OFX>|<STMTTRN>/i.test(text.slice(0, 5000))) {
      return { source: file.name, rows: parseOfx(text), looksLikeCardBill: false };
    }
    table = parseCsv(text, detectCsvDelimiter(text));
  }

  const result = parseTable(table);
  if (result.rows.length === 0) {
    throw new Error(
      'Não encontramos lançamentos neste arquivo. Ele precisa ter colunas de data, descrição e valor ' +
      '(exporte o extrato como CSV, OFX ou Excel no app ou site do banco).'
    );
  }
  const nameHint = /fatura|cartao|cartão|credit|nubank_\d{4}-\d{2}-\d{2}/i.test(file.name);
  return { source: file.name, rows: result.rows, looksLikeCardBill: result.looksLikeCardBill || nameHint };
}

// ---------------------------------------------------------------------------
// OFX (Money/Quicken format offered by most Brazilian banks)
// ---------------------------------------------------------------------------

export function parseOfx(text: string): RawTransaction[] {
  const rows: RawTransaction[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  };
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const dt = tag(block, 'DTPOSTED');
    const amount = parseAmount(tag(block, 'TRNAMT'));
    if (!/^\d{8}/.test(dt) || amount === null) continue;
    const description = [tag(block, 'NAME'), tag(block, 'MEMO')]
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(' - ') || tag(block, 'TRNTYPE') || 'Lançamento';
    rows.push({
      date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
      description: decodeEntities(description),
      amount,
      fitid: tag(block, 'FITID') || undefined,
    });
  }
  return rows;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---------------------------------------------------------------------------
// Tables (CSV / spreadsheets)
// ---------------------------------------------------------------------------

const DATE_HEADER = /^(data|date|dt|dia)\b|data (de )?(lancamento|movimentacao|transacao|compra)/;
const AMOUNT_HEADER = /^(valor|value|amount|quantia|montante|vlr|valor \(?r\)?)\b|valor (r|em r|do lancamento|lancamento)/;
const DEBIT_HEADER = /debito|saida|saidas|retirada/;
const CREDIT_HEADER = /credito|entrada|entradas|deposito/;
const DESC_HEADER = /descri|historico|title|titulo|estabelecimento|memo|detalhe|lancamento|transacao|identificacao|nome/;
const BALANCE_HEADER = /saldo|balance/;

function parseTable(table: Cell[][]): { rows: RawTransaction[]; looksLikeCardBill: boolean } {
  const rows = table.filter(r => r.some(c => String(c ?? '').trim() !== ''));
  if (rows.length < 2) return { rows: [], looksLikeCardBill: false };

  // The header is the first row (within the first 30) without a date whose next
  // rows (up to 3) all have one. Checking several rows skips preamble lines like
  // "Período: 01/11/2025 a 30/11/2025".
  const hasDate = (r: Cell[]) => r.some(c => parseDate(c) !== null);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length - 1, 30); i++) {
    if (hasDate(rows[i])) continue;
    const next = rows.slice(i + 1, i + 4);
    if (next.length > 0 && next.every(hasDate)) {
      headerIdx = i;
      break;
    }
  }
  const header = headerIdx >= 0 ? rows[headerIdx].map(c => normalizeText(String(c ?? ''))) : [];
  const body = rows.slice(headerIdx + 1);
  const width = Math.max(...body.map(r => r.length));
  const sample = body.slice(0, 200);
  const share = (col: number, test: (c: Cell) => boolean) =>
    sample.filter(r => test(r[col])).length / Math.max(1, sample.length);

  const findHeader = (re: RegExp, exclude?: RegExp) =>
    header.findIndex(h => re.test(h) && !(exclude && exclude.test(h)));

  // Date column
  let dateCol = findHeader(DATE_HEADER);
  if (dateCol < 0 || share(dateCol, c => parseDate(c) !== null) < 0.5) {
    dateCol = -1;
    let best = 0;
    for (let c = 0; c < width; c++) {
      const s = share(c, v => parseDate(v) !== null);
      if (s > best) { best = s; dateCol = c; }
    }
    if (best < 0.5) return { rows: [], looksLikeCardBill: false };
  }

  // Amount: a single signed column, or separate debit/credit columns
  let amountCol = findHeader(AMOUNT_HEADER, BALANCE_HEADER);
  const debitCol = findHeader(DEBIT_HEADER, BALANCE_HEADER);
  const creditCol = findHeader(CREDIT_HEADER, BALANCE_HEADER);
  const isNumeric = (c: Cell) => parseAmount(c) !== null;
  if (amountCol >= 0 && share(amountCol, isNumeric) < 0.5) amountCol = -1;
  const useDebitCredit = amountCol < 0 && debitCol >= 0 && creditCol >= 0;
  if (amountCol < 0 && !useDebitCredit) {
    let best = 0;
    for (let c = 0; c < width; c++) {
      if (c === dateCol || BALANCE_HEADER.test(header[c] || '')) continue;
      const s = share(c, isNumeric);
      if (s > best) { best = s; amountCol = c; }
    }
    if (best < 0.5) return { rows: [], looksLikeCardBill: false };
  }

  // Description: named column, otherwise the column with the longest texts
  let descCol = findHeader(DESC_HEADER, DATE_HEADER);
  if (descCol < 0 || descCol === amountCol) {
    let bestLen = 0;
    for (let c = 0; c < width; c++) {
      if (c === dateCol || c === amountCol || c === debitCol || c === creditCol) continue;
      const avg = sample.reduce((a, r) => a + (isNumeric(r[c]) ? 0 : String(r[c] ?? '').length), 0) / Math.max(1, sample.length);
      if (avg > bestLen) { bestLen = avg; descCol = c; }
    }
  }

  const out: RawTransaction[] = [];
  for (const r of body) {
    const date = parseDate(r[dateCol]);
    if (!date) continue;
    let amount: number | null;
    if (useDebitCredit) {
      const d = parseAmount(r[debitCol]) ?? 0;
      const c = parseAmount(r[creditCol]) ?? 0;
      amount = Math.abs(c) - Math.abs(d);
    } else {
      amount = parseAmount(r[amountCol]);
    }
    if (amount === null || amount === 0) continue;
    const description = String(descCol >= 0 ? r[descCol] ?? '' : '').replace(/\s+/g, ' ').trim() || 'Lançamento';
    if (/^saldo\b/i.test(description) || /saldo (anterior|do dia|final)/i.test(normalizeText(description))) continue;
    out.push({ date, description, amount });
  }

  const hasBalance = header.some(h => BALANCE_HEADER.test(h));
  const positives = out.filter(t => t.amount > 0).length;
  const looksLikeCardBill = !hasBalance && !useDebitCredit && out.length >= 3 && positives / out.length >= 0.8;
  return { rows: out, looksLikeCardBill };
}

/** Accepts 31/12/2025, 31/12/25, 2025-12-31, 31-12-2025, 31.12.2025, Date objects and Excel serials. */
export function parseDate(c: Cell): string | null {
  if (c === null || c === undefined || c === '') return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) =>
    y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;

  if (c instanceof Date) return isNaN(c.getTime()) ? null : valid(c.getFullYear(), c.getMonth() + 1, c.getDate());
  if (typeof c === 'number') {
    if (c > 30000 && c < 80000) {
      const d = new Date(Math.round((c - 25569) * 86400 * 1000));
      return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  const s = String(c).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s|$|T)/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

/** Accepts "R$ -1.234,56", "-1234.56", "1.234,56 D", "(50,00)", 12.5 */
export function parseAmount(c: Cell): number | null {
  if (c === null || c === undefined || c === '') return null;
  if (typeof c === 'number') return isFinite(c) ? c : null;
  if (c instanceof Date) return null;
  let s = String(c).trim().replace(/ /g, ' ');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/\s*[Dd]$/.test(s) && !/[a-ce-z]/i.test(s.slice(0, -1))) { negative = true; s = s.replace(/\s*[Dd]$/, ''); }
  else if (/\s*[Cc]$/.test(s) && !/[abd-z]/i.test(s.slice(0, -1))) { s = s.replace(/\s*[Cc]$/, ''); }
  s = s.replace(/R\$|BRL|\s/gi, '');
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  else if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1); }
  else if (s.startsWith('+')) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}
