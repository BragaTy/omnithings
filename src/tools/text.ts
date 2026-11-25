// Text utilities: password, Caesar cipher, fancy letters, nicks, HTML stripping, MD5, counters.

// ----------------------------------------------------------------- password
export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export function generatePassword(o: PasswordOptions): string {
  const ambiguous = /[O0Il1|`'"]/g;
  const sets = [
    o.lower ? 'abcdefghijklmnopqrstuvwxyz' : '',
    o.upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
    o.numbers ? '0123456789' : '',
    o.symbols ? '!@#$%&*()-_=+[]{};:,.?/' : '',
  ]
    .map(s => (o.avoidAmbiguous ? s.replace(ambiguous, '') : s))
    .filter(Boolean);
  if (sets.length === 0) return '';
  const all = sets.join('');
  const length = Math.max(4, Math.min(128, o.length));
  const rand = (max: number) => {
    // rejection sampling: no modulo bias
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf); while (buf[0] >= limit);
    return buf[0] % max;
  };
  // guarantee one char of each chosen set, then shuffle
  const chars = sets.map(s => s[rand(s.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function passwordStrength(pw: string): { bits: number; label: string } {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 23;
  const bits = Math.round(pw.length * Math.log2(Math.max(pool, 1)));
  const label = bits < 40 ? 'Fraca' : bits < 60 ? 'Razoável' : bits < 80 ? 'Forte' : 'Muito forte';
  return { bits, label };
}

// ----------------------------------------------------------------- Caesar
export function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + s) % 26) + base);
  });
}

// ----------------------------------------------------------------- fancy letters
const STYLES: { name: string; upper: number; lower: number; digit?: number; exceptions?: Record<string, string> }[] = [
  { name: 'Negrito', upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  { name: 'Itálico', upper: 0x1d434, lower: 0x1d44e, exceptions: { h: 'ℎ' } },
  { name: 'Negrito itálico', upper: 0x1d468, lower: 0x1d482 },
  { name: 'Cursiva', upper: 0x1d4d0, lower: 0x1d4ea },
  { name: 'Gótica', upper: 0x1d56c, lower: 0x1d586 },
  { name: 'Contorno', upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8,
    exceptions: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' } },
  { name: 'Sem serifa negrito', upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  { name: 'Monoespaçada', upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
];

const CIRCLED_UPPER = 0x24b6;
const CIRCLED_LOWER = 0x24d0;
const SMALL_CAPS: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ',
  n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};
const UPSIDE: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ',
  n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  '.': '˙', ',': "'", '?': '¿', '!': '¡', '(': ')', ')': '(', '1': 'Ɩ', '3': 'Ɛ', '4': 'ㄣ', '6': '9', '9': '6', '7': 'ㄥ',
};

/** Accents can't be styled: "ação" becomes "acao" in the styled alphabets */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function fancyVariants(text: string): { name: string; value: string }[] {
  const src = plain(text);
  const out = STYLES.map(st => ({
    name: st.name,
    value: Array.from(src).map(ch => {
      if (st.exceptions?.[ch]) return st.exceptions[ch];
      if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(st.upper + ch.charCodeAt(0) - 65);
      if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(st.lower + ch.charCodeAt(0) - 97);
      if (st.digit && ch >= '0' && ch <= '9') return String.fromCodePoint(st.digit + ch.charCodeAt(0) - 48);
      return ch;
    }).join(''),
  }));
  out.push({
    name: 'Círculos',
    value: Array.from(src).map(ch =>
      ch >= 'A' && ch <= 'Z' ? String.fromCodePoint(CIRCLED_UPPER + ch.charCodeAt(0) - 65)
      : ch >= 'a' && ch <= 'z' ? String.fromCodePoint(CIRCLED_LOWER + ch.charCodeAt(0) - 97)
      : ch).join(''),
  });
  out.push({ name: 'Versalete', value: Array.from(src.toLowerCase()).map(ch => SMALL_CAPS[ch] || ch).join('') });
  out.push({ name: 'De cabeça para baixo', value: Array.from(src.toLowerCase()).reverse().map(ch => UPSIDE[ch] || ch).join('') });
  out.push({ name: 'Riscado', value: Array.from(text).map(ch => (ch === ' ' ? ch : ch + '̶')).join('') });
  out.push({ name: 'Sublinhado', value: Array.from(text).map(ch => ch + '̲').join('') });
  out.push({ name: 'Espaçado', value: Array.from(text).join(' ') });
  return out;
}

// ----------------------------------------------------------------- nicks
const NICK_A = ['Shadow', 'Neon', 'Lunar', 'Pixel', 'Storm', 'Frost', 'Blaze', 'Ghost', 'Cyber', 'Nova', 'Rogue', 'Silent', 'Iron', 'Crimson', 'Atomic', 'Turbo', 'Mystic', 'Wild', 'Dark', 'Golden'];
const NICK_B = ['Wolf', 'Fox', 'Hawk', 'Ninja', 'Viper', 'Rider', 'Knight', 'Dragon', 'Falcon', 'Tiger', 'Hunter', 'Panda', 'Raven', 'Samurai', 'Bear', 'Phoenix', 'Shark', 'Lynx', 'Cobra', 'Owl'];
const NICK_BR = ['Capivara', 'Jabuti', 'Saci', 'Curupira', 'Tatu', 'Mico', 'Arara', 'Boto', 'Onça', 'Sabiá', 'Tucano', 'Jacaré', 'Lobo', 'Gato', 'Tubarão', 'Falcão', 'Coruja', 'Pantera', 'Raposa', 'Tigre'];
const NICK_BR_ADJ = ['Sombrio', 'Veloz', 'Lendário', 'Brabo', 'Furioso', 'Místico', 'Sinistro', 'Dourado', 'Noturno', 'Supremo', 'Calado', 'Insano', 'Elétrico', 'Gelado', 'Feroz'];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateNicks(base: string, count = 12): string[] {
  const seed = plain(base.trim()).replace(/[^a-zA-Z0-9]/g, '');
  const set = new Set<string>();
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const n = Math.floor(Math.random() * 99) + 1;
    const variants = [
      `${pick(NICK_A)}${pick(NICK_B)}`,
      `${pick(NICK_BR)}${pick(NICK_BR_ADJ)}`,
      `${pick(NICK_A)}_${pick(NICK_B)}${n}`,
      `x${pick(NICK_B)}${pick(NICK_A)}x`,
    ];
    if (seed) {
      variants.push(`${seed}${pick(NICK_B)}`, `${pick(NICK_A)}${seed}`, `${seed}_${n}`, `${seed}${pick(NICK_BR_ADJ)}`, `xX${seed}Xx`);
    }
    set.add(pick(variants));
  }
  return Array.from(set);
}

// ----------------------------------------------------------------- HTML
export function stripHtml(html: string, keepLineBreaks = true): string {
  const prepared = keepLineBreaks
    ? html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    : html;
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  doc.querySelectorAll('script, style, noscript, template').forEach(el => el.remove());
  return (doc.body.textContent || '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ----------------------------------------------------------------- counters & case
export function textStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return {
    characters: Array.from(text).length,
    charactersNoSpaces: Array.from(text.replace(/\s/g, '')).length,
    words,
    lines: text ? text.split(/\r?\n/).length : 0,
    paragraphs: text.trim() ? text.trim().split(/\n\s*\n/).length : 0,
    readingMinutes: Math.max(words ? 1 : 0, Math.round(words / 200)),
  };
}

export function toTitleCase(text: string): string {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'por', 'com']);
  return text.toLowerCase().replace(/\p{L}+/gu, (w, offset: number) =>
    offset > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  );
}

export const removeAccents = plain;

// ----------------------------------------------------------------- MD5 (Web Crypto has no MD5)
export function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  const bitLen = bytes.length * 8;
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) << 4) + 14] = bitLen;

  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0);
  const R = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  const total = ((((bytes.length + 8) >> 6) + 1) << 4);

  for (let chunk = 0; chunk < total; chunk += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      const sum = (a + f + K[i] + (words[chunk + g] | 0)) | 0;
      const s = R[(i >> 4) * 4 + (i % 4)];
      b = (b + ((sum << s) | (sum >>> (32 - s)))) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  return [a0, b0, c0, d0]
    .map(n => Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')).join(''))
    .join('');
}

export async function shaHex(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512', input: string): Promise<string> {
  const buf = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
