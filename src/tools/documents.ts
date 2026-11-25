// CPF and CNPJ: generate valid test numbers and validate check digits.

const digitsOnly = (s: string) => s.replace(/\D/g, '');

function randomDigits(n: number): number[] {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b % 10);
}

function cpfCheckDigit(nums: number[]): number {
  const factor = nums.length + 1;
  const sum = nums.reduce((acc, n, i) => acc + n * (factor - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function formatCpf(d: string): string {
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function generateCpf(formatted = true): string {
  let base: number[];
  do {
    base = randomDigits(9);
  } while (base.every(n => n === base[0]));
  const d1 = cpfCheckDigit(base);
  const d2 = cpfCheckDigit([...base, d1]);
  const cpf = [...base, d1, d2].join('');
  return formatted ? formatCpf(cpf) : cpf;
}

export function validateCpf(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const nums = d.split('').map(Number);
  return cpfCheckDigit(nums.slice(0, 9)) === nums[9] && cpfCheckDigit(nums.slice(0, 10)) === nums[10];
}

function cnpjCheckDigit(nums: number[]): number {
  const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function formatCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function generateCnpj(formatted = true): string {
  const base = [...randomDigits(8), 0, 0, 0, 1];
  const d1 = cnpjCheckDigit(base);
  const d2 = cnpjCheckDigit([...base, d1]);
  const cnpj = [...base, d1, d2].join('');
  return formatted ? formatCnpj(cnpj) : cnpj;
}

export function validateCnpj(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const nums = d.split('').map(Number);
  return cnpjCheckDigit(nums.slice(0, 12)) === nums[12] && cnpjCheckDigit(nums.slice(0, 13)) === nums[13];
}
