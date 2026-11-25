// Calculators: percentages, rule of three, Roman numerals, GCD/LCM, factoring, areas, dates.

/** Accepts "1.234,5", "1234.5", "1,5" */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) {
    return t.lastIndexOf(',') > t.lastIndexOf('.') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, ''));
  }
  return Number(t.replace(',', '.'));
}

export function fmt(n: number, digits = 6): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

// ----------------------------------------------------------------- percentages
export const percentOf = (p: number, v: number) => (p / 100) * v;
export const whatPercent = (part: number, whole: number) => (part / whole) * 100;
export const percentChange = (from: number, to: number) => ((to - from) / Math.abs(from)) * 100;
export const applyPercent = (v: number, p: number) => v * (1 + p / 100);

// ----------------------------------------------------------------- rule of three
/** a está para b assim como c está para x */
export function ruleOfThree(a: number, b: number, c: number, inverse = false): number {
  return inverse ? (a * b) / c : (b * c) / a;
}

// ----------------------------------------------------------------- Roman numerals
const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Números romanos vão de 1 a 3999.');
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
export function fromRoman(s: string): number {
  const r = s.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(r)) throw new Error('Use apenas as letras I, V, X, L, C, D e M.');
  const val: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const cur = val[r[i]];
    const next = val[r[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  if (toRoman(total) !== r) throw new Error(`"${r}" não é um número romano bem escrito (o correto seria ${toRoman(total)}).`);
  return total;
}

// ----------------------------------------------------------------- GCD / LCM / factoring / division
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const gcdAll = (nums: number[]) => nums.reduce((acc, n) => gcd(acc, n));
export const lcmAll = (nums: number[]) => nums.reduce((acc, n) => (acc === 0 || n === 0 ? 0 : Math.abs(acc * n) / gcd(acc, n)));

export function parseIntList(s: string): number[] {
  return (s.match(/-?\d+/g) || []).map(Number).filter(n => Number.isSafeInteger(n));
}

export function factorize(n: number): { prime: number; power: number }[] {
  if (!Number.isSafeInteger(n) || n < 2) throw new Error('Informe um número inteiro maior que 1.');
  const out: { prime: number; power: number }[] = [];
  for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
    let k = 0;
    while (n % p === 0) { n /= p; k++; }
    if (k) out.push({ prime: p, power: k });
  }
  if (n > 1) out.push({ prime: n, power: 1 });
  return out;
}

export function divide(a: number, b: number): { quotient: number; remainder: number } {
  if (b === 0) throw new Error('Não existe divisão por zero.');
  const quotient = Math.trunc(a / b);
  return { quotient, remainder: a - quotient * b };
}

// ----------------------------------------------------------------- areas
export interface Shape {
  id: string;
  name: string;
  fields: { id: string; label: string }[];
  area: (v: Record<string, number>) => number;
}
export const SHAPES: Shape[] = [
  { id: 'square', name: 'Quadrado', fields: [{ id: 'l', label: 'Lado' }], area: v => v.l ** 2 },
  { id: 'rect', name: 'Retângulo', fields: [{ id: 'b', label: 'Base' }, { id: 'h', label: 'Altura' }], area: v => v.b * v.h },
  { id: 'triangle', name: 'Triângulo', fields: [{ id: 'b', label: 'Base' }, { id: 'h', label: 'Altura' }], area: v => (v.b * v.h) / 2 },
  { id: 'circle', name: 'Círculo', fields: [{ id: 'r', label: 'Raio' }], area: v => Math.PI * v.r ** 2 },
  { id: 'trapezoid', name: 'Trapézio', fields: [{ id: 'B', label: 'Base maior' }, { id: 'b', label: 'Base menor' }, { id: 'h', label: 'Altura' }], area: v => ((v.B + v.b) * v.h) / 2 },
  { id: 'rhombus', name: 'Losango', fields: [{ id: 'D', label: 'Diagonal maior' }, { id: 'd', label: 'Diagonal menor' }], area: v => (v.D * v.d) / 2 },
  { id: 'parallelogram', name: 'Paralelogramo', fields: [{ id: 'b', label: 'Base' }, { id: 'h', label: 'Altura' }], area: v => v.b * v.h },
  { id: 'ellipse', name: 'Elipse', fields: [{ id: 'a', label: 'Semieixo maior' }, { id: 'b', label: 'Semieixo menor' }], area: v => Math.PI * v.a * v.b },
  { id: 'polygon', name: 'Polígono regular', fields: [{ id: 'n', label: 'Número de lados' }, { id: 'l', label: 'Lado' }], area: v => (v.n * v.l ** 2) / (4 * Math.tan(Math.PI / v.n)) },
  { id: 'ring', name: 'Coroa circular', fields: [{ id: 'R', label: 'Raio maior' }, { id: 'r', label: 'Raio menor' }], area: v => Math.PI * (v.R ** 2 - v.r ** 2) },
  { id: 'sector', name: 'Setor circular', fields: [{ id: 'r', label: 'Raio' }, { id: 'a', label: 'Ângulo (graus)' }], area: v => (Math.PI * v.r ** 2 * v.a) / 360 },
];

// ----------------------------------------------------------------- dates
const MS_DAY = 86400000;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Fixed national holidays + Easter-based ones (Carnaval, Sexta-feira Santa, Corpus Christi) */
export function brazilianHolidays(year: number): Set<string> {
  // Easter (Meeus/Jones/Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = Date.UTC(year, month - 1, day);
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(md => `${year}-${md}`);
  const moving = [-48, -47, -2, 60].map(off => fromUtc(easter + off * MS_DAY));
  return new Set([...fixed, ...moving]);
}

export function daysBetween(fromIso: string, toIso: string): { days: number; businessDays: number; weeks: number; months: number; years: number } {
  const a = toUtc(fromIso), b = toUtc(toIso);
  const sign = b >= a ? 1 : -1;
  const [start, end] = sign > 0 ? [a, b] : [b, a];
  const days = Math.round((end - start) / MS_DAY);
  const holidays = new Map<number, Set<string>>();
  let business = 0;
  for (let t = start + MS_DAY; t <= end && days <= 40000; t += MS_DAY) {
    const dt = new Date(t);
    const wd = dt.getUTCDay();
    const y = dt.getUTCFullYear();
    if (!holidays.has(y)) holidays.set(y, brazilianHolidays(y));
    if (wd !== 0 && wd !== 6 && !holidays.get(y)!.has(fromUtc(t))) business++;
  }
  const s = new Date(start), e2 = new Date(end);
  let months = (e2.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e2.getUTCMonth() - s.getUTCMonth());
  if (e2.getUTCDate() < s.getUTCDate()) months--;
  return { days: sign * days, businessDays: sign * business, weeks: sign * Math.floor(days / 7), months: sign * months, years: sign * Math.floor(months / 12) };
}

export function addDays(iso: string, amount: number, businessOnly = false): string {
  let t = toUtc(iso);
  if (!businessOnly) return fromUtc(t + amount * MS_DAY);
  const step = amount >= 0 ? 1 : -1;
  let left = Math.abs(amount);
  const holidays = new Map<number, Set<string>>();
  while (left > 0) {
    t += step * MS_DAY;
    const dt = new Date(t);
    const y = dt.getUTCFullYear();
    if (!holidays.has(y)) holidays.set(y, brazilianHolidays(y));
    if (dt.getUTCDay() !== 0 && dt.getUTCDay() !== 6 && !holidays.get(y)!.has(fromUtc(t))) left--;
  }
  return fromUtc(t);
}

export function addMonths(iso: string, amount: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target.getTime());
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export function describeDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${wd})`;
}
