// Brazilian documents: generate valid *test* numbers and validate check digits.
// Generated numbers are mathematically valid but random; they don't belong to anyone.

export const digitsOnly = (s: string) => s.replace(/\D/g, '');

export function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return min + (buf[0] % range);
}

export function randomDigits(n: number): number[] {
  return Array.from({ length: n }, () => randomInt(0, 9));
}

const weighted = (nums: number[], weights: number[]) => nums.reduce((acc, n, i) => acc + n * weights[i], 0);
const notAllSame = (nums: number[]) => !nums.every(n => n === nums[0]);

// ------------------------------------------------------------------ CPF
function cpfCheckDigit(nums: number[]): number {
  const factor = nums.length + 1;
  const sum = nums.reduce((acc, n, i) => acc + n * (factor - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}
export const formatCpf = (d: string) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export function generateCpf(formatted = true): string {
  let base: number[];
  do base = randomDigits(9); while (!notAllSame(base));
  const d1 = cpfCheckDigit(base);
  const cpf = [...base, d1, cpfCheckDigit([...base, d1])].join('');
  return formatted ? formatCpf(cpf) : cpf;
}
export function validateCpf(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const nums = d.split('').map(Number);
  return cpfCheckDigit(nums.slice(0, 9)) === nums[9] && cpfCheckDigit(nums.slice(0, 10)) === nums[10];
}

// ------------------------------------------------------------------ CNPJ
function cnpjCheckDigit(nums: number[]): number {
  const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const rest = weighted(nums, weights) % 11;
  return rest < 2 ? 0 : 11 - rest;
}
export const formatCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
export function generateCnpj(formatted = true): string {
  const base = [...randomDigits(8), 0, 0, 0, 1];
  const d1 = cnpjCheckDigit(base);
  const cnpj = [...base, d1, cnpjCheckDigit([...base, d1])].join('');
  return formatted ? formatCnpj(cnpj) : cnpj;
}
export function validateCnpj(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const nums = d.split('').map(Number);
  return cnpjCheckDigit(nums.slice(0, 12)) === nums[12] && cnpjCheckDigit(nums.slice(0, 13)) === nums[13];
}

// ------------------------------------------------------------------ RG (SP)
function rgDigit(nums: number[]): string {
  const rest = weighted(nums, [2, 3, 4, 5, 6, 7, 8, 9]) % 11;
  const dv = 11 - rest;
  return dv === 10 ? 'X' : dv === 11 ? '0' : String(dv);
}
export function generateRg(formatted = true): string {
  const base = randomDigits(8);
  const rg = base.join('') + rgDigit(base);
  return formatted ? rg.replace(/^(\d{2})(\d{3})(\d{3})(\w)$/, '$1.$2.$3-$4') : rg;
}
export function validateRg(input: string): boolean {
  const clean = input.toUpperCase().replace(/[^0-9X]/g, '');
  if (!/^\d{8}[\dX]$/.test(clean)) return false;
  return rgDigit(clean.slice(0, 8).split('').map(Number)) === clean[8];
}

// ------------------------------------------------------------------ CNH
function cnhDigits(base: number[]): [number, number] | null {
  let dsc = 0;
  let d1 = base.reduce((acc, n, i) => acc + n * (9 - i), 0) % 11;
  if (d1 >= 10) { d1 = 0; dsc = 2; }
  const x = base.reduce((acc, n, i) => acc + n * (1 + i), 0) % 11;
  const d2 = x >= 10 ? 0 : x - dsc;
  return d2 < 0 ? null : [d1, d2];
}
export function generateCnh(): string {
  for (;;) {
    const base = randomDigits(9);
    const dv = notAllSame(base) ? cnhDigits(base) : null;
    if (dv) return base.join('') + dv.join('');
  }
}
export function validateCnh(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = cnhDigits(d.slice(0, 9).split('').map(Number));
  return !!dv && dv.join('') === d.slice(9);
}

// ------------------------------------------------------------------ PIS/PASEP/NIT
function pisDigit(nums: number[]): number {
  const rest = weighted(nums, [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11;
  return rest < 2 ? 0 : 11 - rest;
}
export function generatePis(formatted = true): string {
  const base = randomDigits(10);
  const pis = base.join('') + pisDigit(base);
  return formatted ? pis.replace(/^(\d{3})(\d{5})(\d{2})(\d)$/, '$1.$2.$3-$4') : pis;
}
export function validatePis(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return pisDigit(d.slice(0, 10).split('').map(Number)) === Number(d[10]);
}

// ------------------------------------------------------------------ RENAVAM
function renavamDigit(nums: number[]): number {
  const sum = weighted(nums, [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv = (sum * 10) % 11;
  return dv === 10 ? 0 : dv;
}
export function generateRenavam(): string {
  const base = randomDigits(10);
  return base.join('') + renavamDigit(base);
}
export function validateRenavam(input: string): boolean {
  let d = digitsOnly(input);
  if (d.length === 9) d = '00' + d; // old 9-digit format
  if (d.length !== 11) return false;
  return renavamDigit(d.slice(0, 10).split('').map(Number)) === Number(d[10]);
}

// ------------------------------------------------------------------ Título de eleitor
export const UF_CODES: Record<string, string> = {
  SP: '01', MG: '02', RJ: '03', RS: '04', BA: '05', PR: '06', CE: '07', PE: '08', SC: '09', GO: '10', MA: '11',
  PB: '12', PA: '13', ES: '14', PI: '15', RN: '16', AL: '17', MT: '18', MS: '19', DF: '20', SE: '21', AM: '22',
  RO: '23', AC: '24', AP: '25', RR: '26', TO: '27',
};
function tituloDigits(seq: number[], uf: string): [number, number] {
  const spMg = uf === '01' || uf === '02';
  let r1 = weighted(seq, [2, 3, 4, 5, 6, 7, 8, 9]) % 11;
  if (r1 === 10) r1 = 0;
  else if (r1 === 0 && spMg) r1 = 1;
  let r2 = (Number(uf[0]) * 7 + Number(uf[1]) * 8 + r1 * 9) % 11;
  if (r2 === 10) r2 = 0;
  else if (r2 === 0 && spMg) r2 = 1;
  return [r1, r2];
}
export function generateTitulo(uf = 'SP', formatted = true): string {
  const code = UF_CODES[uf] || '01';
  const seq = randomDigits(8);
  const t = seq.join('') + code + tituloDigits(seq, code).join('');
  return formatted ? t.replace(/^(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3') : t;
}
export function validateTitulo(input: string): boolean {
  const d = digitsOnly(input).padStart(12, '0');
  if (d.length !== 12) return false;
  const uf = d.slice(8, 10);
  if (!Object.values(UF_CODES).includes(uf) && uf !== '28') return false;
  return tituloDigits(d.slice(0, 8).split('').map(Number), uf).join('') === d.slice(10);
}

// ------------------------------------------------------------------ Inscrição estadual (some states)
export const IE_STATES = ['SP', 'RJ', 'PR', 'RS'] as const;
export type IeState = (typeof IE_STATES)[number];

const mod11 = (sum: number) => { const r = sum % 11; return r < 2 ? 0 : 11 - r; };

function ieDigits(state: IeState, base: number[]): number[] {
  switch (state) {
    case 'SP': {
      const d9 = (weighted(base.slice(0, 8), [1, 3, 4, 5, 6, 7, 8, 10]) % 11) % 10;
      const first11 = [...base.slice(0, 8), d9, ...base.slice(8, 10)];
      const d12 = (weighted(first11, [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2]) % 11) % 10;
      return [...first11, d12];
    }
    case 'RJ': return [...base, mod11(weighted(base, [2, 7, 6, 5, 4, 3, 2]))];
    case 'RS': {
      const r = 11 - (weighted(base, [2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
      return [...base, r >= 10 ? 0 : r];
    }
    case 'PR': {
      const d9 = mod11(weighted(base, [3, 2, 7, 6, 5, 4, 3, 2]));
      const d10 = mod11(weighted([...base, d9], [4, 3, 2, 7, 6, 5, 4, 3, 2]));
      return [...base, d9, d10];
    }
  }
}
const IE_BASE_LEN: Record<IeState, number> = { SP: 10, RJ: 7, RS: 9, PR: 8 };
const IE_FORMAT: Record<IeState, [RegExp, string]> = {
  SP: [/^(\d{3})(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3.$4'],
  RJ: [/^(\d{2})(\d{3})(\d{2})(\d)$/, '$1.$2.$3-$4'],
  RS: [/^(\d{3})(\d{7})$/, '$1/$2'],
  PR: [/^(\d{8})(\d{2})$/, '$1-$2'],
};
export function generateIe(state: IeState, formatted = true): string {
  const base = randomDigits(IE_BASE_LEN[state]);
  if (state === 'RS') base[0] = randomInt(0, 4); // RS municipality codes start 0-4
  const ie = ieDigits(state, base).join('');
  return formatted ? ie.replace(IE_FORMAT[state][0], IE_FORMAT[state][1]) : ie;
}
export function validateIe(state: IeState, input: string): boolean {
  const d = digitsOnly(input);
  const total = { SP: 12, RJ: 8, RS: 10, PR: 10 }[state];
  if (d.length !== total) return false;
  const nums = d.split('').map(Number);
  const base = state === 'SP' ? [...nums.slice(0, 8), ...nums.slice(9, 11)] : nums.slice(0, IE_BASE_LEN[state]);
  return ieDigits(state, base).join('') === d;
}

// ------------------------------------------------------------------ Credit card (test numbers, Luhn)
export const CARD_BRANDS = {
  Visa: { prefixes: ['4'], length: 16 },
  Mastercard: { prefixes: ['51', '52', '53', '54', '55', '2221', '2720'], length: 16 },
  Elo: { prefixes: ['636368', '438935', '504175', '451416', '509048', '509067'], length: 16 },
  'American Express': { prefixes: ['34', '37'], length: 15 },
  Hipercard: { prefixes: ['606282'], length: 16 },
  Diners: { prefixes: ['36', '38'], length: 14 },
} as const;
export type CardBrand = keyof typeof CARD_BRANDS;

function luhnDigit(partial: string): number {
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    let n = Number(partial[partial.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}
export function luhnValid(input: string): boolean {
  const d = digitsOnly(input);
  return d.length >= 12 && d.length <= 19 && luhnDigit(d.slice(0, -1)) === Number(d[d.length - 1]);
}
export function detectCardBrand(input: string): CardBrand | null {
  const d = digitsOnly(input);
  // longest matching prefix wins (Elo/Hipercard before Visa/Diners)
  let best: { brand: CardBrand; len: number } | null = null;
  for (const [brand, info] of Object.entries(CARD_BRANDS) as [CardBrand, (typeof CARD_BRANDS)[CardBrand]][]) {
    for (const p of info.prefixes) {
      if (d.startsWith(p) && (!best || p.length > best.len)) best = { brand, len: p.length };
    }
  }
  if (!best && /^2(2[2-9]|[3-6]\d|7[01])/.test(d)) return 'Mastercard';
  return best?.brand ?? null;
}
export function generateCard(brand: CardBrand): { number: string; expiry: string; cvv: string } {
  const info = CARD_BRANDS[brand];
  const prefix = info.prefixes[randomInt(0, info.prefixes.length - 1)];
  let partial = prefix;
  while (partial.length < info.length - 1) partial += randomInt(0, 9);
  const number = partial + luhnDigit(partial);
  const now = new Date();
  const month = String(randomInt(1, 12)).padStart(2, '0');
  const year = String((now.getFullYear() + randomInt(1, 5)) % 100).padStart(2, '0');
  const cvv = Array.from({ length: brand === 'American Express' ? 4 : 3 }, () => randomInt(0, 9)).join('');
  const grouped = info.length === 15 ? number.replace(/^(\d{4})(\d{6})(\d{5})$/, '$1 $2 $3')
    : info.length === 14 ? number.replace(/^(\d{4})(\d{6})(\d{4})$/, '$1 $2 $3')
    : number.replace(/(\d{4})(?=\d)/g, '$1 ');
  return { number: grouped, expiry: `${month}/${year}`, cvv };
}

// ------------------------------------------------------------------ Bank account (test)
export const BANKS = ['Banco do Brasil', 'Itaú', 'Bradesco'] as const;
export type Bank = (typeof BANKS)[number];

function bbDigit(nums: number[]): string {
  const weights = Array.from({ length: nums.length }, (_, i) => nums.length + 1 - i);
  const dv = 11 - (weighted(nums, weights) % 11);
  return dv === 10 ? 'X' : dv === 11 ? '0' : String(dv);
}
function bradescoDigit(nums: number[], weights: number[]): string {
  const rest = weighted(nums, weights) % 11;
  const dv = 11 - rest;
  return dv === 10 ? 'P' : dv === 11 ? '0' : String(dv);
}
function itauDac(agency: number[], account: number[]): string {
  const all = [...agency, ...account];
  let sum = 0;
  all.forEach((n, i) => {
    const p = n * (i % 2 === 0 ? 2 : 1);
    sum += Math.floor(p / 10) + (p % 10);
  });
  return String((10 - (sum % 10)) % 10);
}

export function generateBankAccount(bank: Bank): { agency: string; account: string } {
  const ag = randomDigits(4);
  if (bank === 'Banco do Brasil') {
    const acc = randomDigits(8);
    return { agency: `${ag.join('')}-${bbDigit(ag)}`, account: `${acc.join('')}-${bbDigit(acc)}` };
  }
  if (bank === 'Bradesco') {
    const acc = randomDigits(7);
    return {
      agency: `${ag.join('')}-${bradescoDigit(ag, [5, 4, 3, 2])}`,
      account: `${acc.join('')}-${bradescoDigit(acc, [2, 7, 6, 5, 4, 3, 2])}`,
    };
  }
  const acc = randomDigits(5);
  return { agency: ag.join(''), account: `${acc.join('')}-${itauDac(ag, acc)}` };
}

export function validateBankAccount(bank: Bank, agency: string, account: string): boolean {
  const ag = agency.toUpperCase().replace(/[^0-9XP]/g, '');
  const acc = account.toUpperCase().replace(/[^0-9XP]/g, '');
  const nums = (s: string) => s.split('').map(Number);
  if (bank === 'Banco do Brasil') {
    if (ag.length !== 5 || acc.length < 2) return false;
    const accBase = acc.slice(0, -1).padStart(8, '0');
    return bbDigit(nums(ag.slice(0, 4))) === ag[4] && bbDigit(nums(accBase)) === acc[acc.length - 1];
  }
  if (bank === 'Bradesco') {
    if (ag.length !== 5 || acc.length < 2) return false;
    const accBase = acc.slice(0, -1).padStart(7, '0');
    return bradescoDigit(nums(ag.slice(0, 4)), [5, 4, 3, 2]) === ag[4] &&
      bradescoDigit(nums(accBase), [2, 7, 6, 5, 4, 3, 2]) === acc[acc.length - 1];
  }
  if (ag.length !== 4 || acc.length !== 6) return false;
  return itauDac(nums(ag), nums(acc.slice(0, 5))) === acc[5];
}

// ------------------------------------------------------------------ CEP & plates
export const CEP_RANGES: Record<string, [number, number][]> = {
  SP: [[1000, 19999]], RJ: [[20000, 28999]], ES: [[29000, 29999]], MG: [[30000, 39999]], BA: [[40000, 48999]],
  SE: [[49000, 49999]], PE: [[50000, 56999]], AL: [[57000, 57999]], PB: [[58000, 58999]], RN: [[59000, 59999]],
  CE: [[60000, 63999]], PI: [[64000, 64999]], MA: [[65000, 65999]], PA: [[66000, 68899]], AP: [[68900, 68999]],
  AM: [[69000, 69299], [69400, 69899]], RR: [[69300, 69399]], AC: [[69900, 69999]], DF: [[70000, 72799]],
  GO: [[72800, 76799]], RO: [[76800, 76999]], TO: [[77000, 77999]], MT: [[78000, 78899]], MS: [[79000, 79999]],
  PR: [[80000, 87999]], SC: [[88000, 89999]], RS: [[90000, 99999]],
};
export function generateCep(uf: string, formatted = true): string {
  const ranges = CEP_RANGES[uf] || CEP_RANGES.SP;
  const [min, max] = ranges[randomInt(0, ranges.length - 1)];
  const prefix = String(randomInt(min, max)).padStart(5, '0');
  const suffix = String(randomInt(0, 999)).padStart(3, '0');
  return formatted ? `${prefix}-${suffix}` : prefix + suffix;
}
export function cepState(input: string): string | null {
  const d = digitsOnly(input);
  if (d.length !== 8) return null;
  const p = Number(d.slice(0, 5));
  for (const [uf, ranges] of Object.entries(CEP_RANGES)) {
    if (ranges.some(([a, b]) => p >= a && p <= b)) return uf;
  }
  return null;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function generatePlate(mercosul = true): string {
  const l = () => LETTERS[randomInt(0, 25)];
  const n = () => String(randomInt(0, 9));
  return mercosul ? `${l()}${l()}${l()}${n()}${l()}${n()}${n()}` : `${l()}${l()}${l()}-${n()}${n()}${n()}${n()}`;
}
export function validatePlate(input: string): 'mercosul' | 'antiga' | null {
  const p = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(p)) return 'mercosul';
  if (/^[A-Z]{3}\d{4}$/.test(p)) return 'antiga';
  return null;
}
