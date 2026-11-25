// Unit and number-base conversions.

export interface UnitGroup {
  id: string;
  label: string;
  units: { id: string; label: string; factor?: number }[];
}

// factor = how many base units one of this unit is
export const UNIT_GROUPS: UnitGroup[] = [
  { id: 'length', label: 'Comprimento', units: [
    { id: 'mm', label: 'Milímetro (mm)', factor: 0.001 }, { id: 'cm', label: 'Centímetro (cm)', factor: 0.01 },
    { id: 'm', label: 'Metro (m)', factor: 1 }, { id: 'km', label: 'Quilômetro (km)', factor: 1000 },
    { id: 'in', label: 'Polegada (in)', factor: 0.0254 }, { id: 'ft', label: 'Pé (ft)', factor: 0.3048 },
    { id: 'yd', label: 'Jarda (yd)', factor: 0.9144 }, { id: 'mi', label: 'Milha (mi)', factor: 1609.344 },
  ] },
  { id: 'mass', label: 'Massa', units: [
    { id: 'mg', label: 'Miligrama (mg)', factor: 0.000001 }, { id: 'g', label: 'Grama (g)', factor: 0.001 },
    { id: 'kg', label: 'Quilograma (kg)', factor: 1 }, { id: 't', label: 'Tonelada (t)', factor: 1000 },
    { id: 'oz', label: 'Onça (oz)', factor: 0.028349523125 }, { id: 'lb', label: 'Libra (lb)', factor: 0.45359237 },
  ] },
  { id: 'temperature', label: 'Temperatura', units: [
    { id: 'c', label: 'Celsius (°C)' }, { id: 'f', label: 'Fahrenheit (°F)' }, { id: 'k', label: 'Kelvin (K)' },
  ] },
  { id: 'area', label: 'Área', units: [
    { id: 'cm2', label: 'cm²', factor: 0.0001 }, { id: 'm2', label: 'm²', factor: 1 },
    { id: 'ha', label: 'Hectare (ha)', factor: 10000 }, { id: 'km2', label: 'km²', factor: 1e6 },
    { id: 'alq', label: 'Alqueire paulista', factor: 24200 }, { id: 'ft2', label: 'ft²', factor: 0.09290304 },
    { id: 'ac', label: 'Acre', factor: 4046.8564224 },
  ] },
  { id: 'volume', label: 'Volume', units: [
    { id: 'ml', label: 'Mililitro (ml)', factor: 0.001 }, { id: 'l', label: 'Litro (l)', factor: 1 },
    { id: 'm3', label: 'Metro cúbico (m³)', factor: 1000 }, { id: 'cup', label: 'Xícara (240 ml)', factor: 0.24 },
    { id: 'galus', label: 'Galão americano', factor: 3.785411784 },
  ] },
  { id: 'speed', label: 'Velocidade', units: [
    { id: 'kmh', label: 'km/h', factor: 1 / 3.6 }, { id: 'ms', label: 'm/s', factor: 1 },
    { id: 'mph', label: 'mph', factor: 0.44704 }, { id: 'kn', label: 'Nó', factor: 0.514444 },
  ] },
  { id: 'data', label: 'Dados', units: [
    { id: 'b', label: 'Byte (B)', factor: 1 }, { id: 'kb', label: 'Kilobyte (KB)', factor: 1024 },
    { id: 'mb', label: 'Megabyte (MB)', factor: 1024 ** 2 }, { id: 'gb', label: 'Gigabyte (GB)', factor: 1024 ** 3 },
    { id: 'tb', label: 'Terabyte (TB)', factor: 1024 ** 4 }, { id: 'mbit', label: 'Megabit (Mb)', factor: 125000 },
  ] },
];

export function convertUnit(groupId: string, from: string, to: string, value: number): number {
  if (groupId === 'temperature') {
    const c = from === 'c' ? value : from === 'f' ? (value - 32) * (5 / 9) : value - 273.15;
    return to === 'c' ? c : to === 'f' ? c * (9 / 5) + 32 : c + 273.15;
  }
  const group = UNIT_GROUPS.find(g => g.id === groupId);
  const f = group?.units.find(u => u.id === from)?.factor;
  const t = group?.units.find(u => u.id === to)?.factor;
  if (!f || !t) return NaN;
  return (value * f) / t;
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return n.toExponential(6).replace('.', ',');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: abs < 1 ? 8 : 6 });
}

/** Parses a number written in base 2..36 (BigInt, so long binary strings work) */
export function convertBase(value: string, fromBase: number): { bin: string; oct: string; dec: string; hex: string } | null {
  const clean = value.trim().toLowerCase().replace(/^0[bxo]/, '').replace(/[\s_]/g, '');
  if (!clean) return null;
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, fromBase);
  if (![...clean].every(ch => digits.includes(ch))) return null;
  let n = 0n;
  for (const ch of clean) n = n * BigInt(fromBase) + BigInt(digits.indexOf(ch));
  return { bin: n.toString(2), oct: n.toString(8), dec: n.toString(10), hex: n.toString(16).toUpperCase() };
}
