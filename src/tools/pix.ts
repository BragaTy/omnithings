// Static Pix "copia e cola" (BR Code / EMV QRCPS) payload, as specified by the Banco Central.

export interface PixInput {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
  message?: string;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Pix only accepts plain ASCII in name/city */
function ascii(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .slice(0, max);
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

/** Puts the key in the exact form the Pix directory stores it. */
export function normalizePixKey(raw: string, type: PixKeyType): string {
  const key = raw.trim();
  const digits = key.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      if (digits.length !== 11 && digits.length !== 14) throw new Error('CPF deve ter 11 dígitos e CNPJ, 14.');
      return digits;
    case 'phone': {
      // +55 + DDD + number; accepts "(11) 91234-5678", "11912345678", "+5511912345678"
      const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
      if (local.length !== 10 && local.length !== 11) throw new Error('Telefone deve ter DDD + número.');
      return `+55${local}`;
    }
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error('E-mail inválido.');
      return key.toLowerCase();
    case 'random':
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
        throw new Error('Chave aleatória deve ter o formato 1234abcd-12ab-12ab-12ab-123456abcdef.');
      }
      return key.toLowerCase();
  }
}

export function buildPixPayload(input: PixInput & { keyType: PixKeyType }): string {
  if (!input.key.trim()) throw new Error('Informe a chave Pix.');
  const key = normalizePixKey(input.key, input.keyType);
  const name = ascii(input.name, 25) || 'RECEBEDOR';
  const city = ascii(input.city, 15) || 'BRASIL';
  const txid = (input.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let account = field('00', 'br.gov.bcb.pix') + field('01', key);
  const message = ascii(input.message || '', 72);
  if (message) account += field('02', message);
  if (account.length > 99) throw new Error('Chave + mensagem passam do limite do Pix. Encurte a mensagem.');

  let payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986');
  if (input.amount && input.amount > 0) payload += field('54', input.amount.toFixed(2));
  payload +=
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
