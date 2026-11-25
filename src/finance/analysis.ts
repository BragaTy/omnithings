import { Transaction } from './types';
import { INTERNAL, INCOME, merchantKey } from './categories';

export const monthOf = (date: string) => date.slice(0, 7);

const counted = (t: Transaction) => t.category !== INTERNAL;

export function listMonths(txs: Transaction[]): string[] {
  return Array.from(new Set(txs.map(t => monthOf(t.date)))).sort().reverse();
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function summarizeMonth(txs: Transaction[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txs) {
    if (monthOf(t.date) !== month || !counted(t)) continue;
    count++;
    if (t.amount > 0) income += t.amount;
    else expense += -t.amount;
  }
  return { income, expense, net: income - expense, count };
}

export function spendingByCategory(txs: Transaction[], month: string): { category: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    if (monthOf(t.date) !== month || !counted(t) || t.category === INCOME) continue;
    // refunds inside an expense category reduce that category
    const entry = map.get(t.category) || { total: 0, count: 0 };
    entry.total += -t.amount;
    entry.count++;
    map.set(t.category, entry);
  }
  return Array.from(map, ([category, v]) => ({ category, ...v }))
    .filter(c => c.total > 0.005)
    .sort((a, b) => b.total - a.total);
}

export function monthlySeries(txs: Transaction[], endMonth: string, count = 12): { month: string; income: number; expense: number }[] {
  const months: string[] = [];
  let m = endMonth;
  for (let i = 0; i < count; i++) {
    months.unshift(m);
    m = previousMonth(m);
  }
  const firstWithData = listMonths(txs).slice(-1)[0];
  return months
    .filter(month => !firstWithData || month >= firstWithData)
    .map(month => {
      const s = summarizeMonth(txs, month);
      return { month, income: s.income, expense: s.expense };
    });
}

export interface Recurring {
  key: string;
  label: string;
  category: string;
  average: number;
  months: number;
  lastDate: string;
}

/** Same merchant, similar value, in 3+ different months = fixed bill or subscription. */
export function detectRecurring(txs: Transaction[]): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0 || !counted(t)) continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(t);
    groups.set(key, list);
  }

  const result: Recurring[] = [];
  groups.forEach((list, key) => {
    // one value per month (sum if charged twice in the same month)
    const perMonth = new Map<string, number>();
    for (const t of list) perMonth.set(monthOf(t.date), (perMonth.get(monthOf(t.date)) || 0) - t.amount);
    if (perMonth.size < 3) return;
    const values = Array.from(perMonth.values());
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const spread = Math.sqrt(values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length) / avg;
    if (spread > 0.2) return;
    const last = list.reduce((a, b) => (a.date > b.date ? a : b));
    result.push({ key, label: last.description, category: last.category, average: avg, months: perMonth.size, lastDate: last.date });
  });
  return result.sort((a, b) => b.average - a.average);
}

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function monthLabel(month: string, long = false): string {
  const [y, m] = month.split('-').map(Number);
  return long ? `${MONTHS_LONG[m - 1]} de ${y}` : `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
