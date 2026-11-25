// Categories and the keyword rules used to auto-categorize bank transactions.

export const INCOME = 'Entradas';
/** Money moving between your own accounts: card bill payments, investments. Not counted as spending. */
export const INTERNAL = 'Movimentação interna';
export const OTHER = 'Outros';

export const EXPENSE_CATEGORIES = [
  'Mercado',
  'Alimentação',
  'Transporte',
  'Moradia e contas',
  'Assinaturas',
  'Saúde',
  'Compras',
  'Lazer',
  'Educação',
  'Pix e transferências',
  'Impostos e taxas',
  OTHER,
] as const;

export const ALL_CATEGORIES: string[] = [INCOME, ...EXPENSE_CATEGORIES, INTERNAL];

// Order matters: the first match wins
const RULES: [string, string[]][] = [
  [INTERNAL, [
    'pagamento de fatura', 'pagamento fatura', 'pgto fatura', 'pagto fatura', 'pag fatura', 'fatura cartao',
    'pagamento recebido', 'aplicacao', 'resgate', 'rdb', 'cdb', 'tesouro direto', 'poupanca',
    'transferencia entre contas', 'mesma titularidade', 'guardar dinheiro', 'dinheiro guardado', 'caixinha',
  ]],
  // Marketplaces before "Mercado" so "Mercado Livre" isn't groceries
  ['Compras', ['mercado livre', 'mercadolivre', 'mercadopago', 'mercado pago']],
  ['Mercado', [
    'supermercado', 'mercado','carrefour', 'assai', 'atacadao', 'pao de acucar', 'extra hiper', 'big bompreco',
    'hortifruti', 'sams club', 'makro', 'dia brasil', 'oba hortifruti', 'st marche', 'zaffari', 'condor', 'savegnago',
    'guanabara', 'mambo', 'tenda atacado', 'atacadista', 'sacolao', 'quitanda',
  ]],
  ['Alimentação', [
    'ifood', 'rappi', 'restaurante', 'lanchonete', 'padaria', 'pizzaria', 'burger', 'mcdonald', 'bk brasil',
    'subway', 'outback', 'starbucks', 'cafe', 'cafeteria', 'acougue', 'sorveteria', 'doceria', 'bar e restaurante',
    'churrascaria', 'habibs', 'spoleto', 'giraffas', 'coco bambu', 'ze delivery', 'aiqfome', 'delivery',
  ]],
  ['Transporte', [
    'uber', '99 app', '99app', '99 pop', 'cabify', 'posto', 'combustivel', 'shell', 'ipiranga', 'petrobras', 'br mania',
    'estacionamento', 'estapar', 'sem parar', 'conectcar', 'veloe', 'pedagio', 'metro', 'cptm', 'bilhete unico',
    'onibus', 'passagem', 'latam', 'gol linhas', 'azul linhas', 'buser', 'clickbus', 'detran', 'ipva', 'oficina',
  ]],
  ['Moradia e contas', [
    'aluguel', 'condominio', 'enel', 'sabesp', 'copel', 'cemig', 'light s a', 'light sa', 'celesc', 'coelba', 'cpfl',
    'energisa', 'equatorial', 'neoenergia', 'comgas', 'naturgy', 'sanepar', 'embasa', 'cedae', 'agua e esgoto',
    'vivo', 'claro', 'tim celular', 'tim s a', 'oi fibra', 'net servicos', 'internet', 'iptu', 'seguro residencial',
  ]],
  ['Assinaturas', [
    'netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'max com', 'globoplay', 'paramount',
    'youtube', 'google one', 'google storage', 'icloud', 'apple com', 'apple music', 'deezer', 'crunchyroll',
    'chatgpt', 'openai', 'anthropic', 'claude ai', 'microsoft 365', 'office 365', 'adobe', 'canva', 'notion',
    'xbox game pass', 'playstation plus', 'psn', 'twitch', 'patreon', 'smart fit', 'smartfit', 'bluefit', 'gympass',
    'wellhub', 'totalpass', 'assinatura', 'mensalidade',
  ]],
  ['Saúde', [
    'farmacia', 'drogaria', 'drogasil', 'droga raia', 'raia', 'pague menos', 'panvel', 'drogao', 'ultrafarma',
    'hospital', 'clinica', 'laboratorio', 'medico', 'odonto', 'dentista', 'unimed', 'amil', 'bradesco saude',
    'sulamerica', 'hapvida', 'notredame', 'psicolog', 'fisioterapia', 'otica',
  ]],
  ['Compras', [
    'amazon', 'mercado livre', 'mercadolivre', 'mercadopago', 'shopee', 'magalu', 'magazine luiza', 'americanas',
    'aliexpress', 'shein', 'temu', 'casas bahia', 'ponto frio', 'kabum', 'renner', 'riachuelo', 'c a modas', 'cea',
    'zara', 'centauro', 'netshoes', 'decathlon', 'leroy merlin', 'tok stok', 'havan', 'boticario', 'natura', 'sephora',
    'shopping', 'loja', 'store',
  ]],
  ['Lazer', [
    'cinema', 'cinemark', 'kinoplex', 'ingresso', 'sympla', 'eventim', 'ticket', 'steam', 'playstation', 'nintendo',
    'epic games', 'riot', 'bar ', 'boteco', 'cervejaria', 'balada', 'show', 'teatro', 'museu', 'parque', 'hotel',
    'airbnb', 'booking', 'decolar', 'viagem',
  ]],
  ['Educação', [
    'curso', 'udemy', 'alura', 'coursera', 'escola', 'colegio', 'faculdade', 'universidade', 'livraria', 'saraiva',
    'estante virtual', 'kindle', 'duolingo', 'material escolar', 'papelaria',
  ]],
  ['Impostos e taxas', [
    'iof', 'tarifa', 'anuidade', 'juros', 'multa', 'darf', 'das simples', 'imposto', 'taxa', 'encargos', 'mora',
  ]],
  ['Pix e transferências', [
    'pix enviado', 'transferencia enviada', 'transferencia pix', 'pix', 'ted', 'doc', 'transferencia',
  ]],
];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NOISE = new Set([
  'compra', 'compras', 'debito', 'credito', 'cartao', 'pagamento', 'pagto', 'pgto', 'parcela', 'parc', 'no',
  'em', 'de', 'da', 'do', 'para', 'com', 'cp', 'deb', 'cred', 'visa', 'master', 'elo', 'int', 'nac', 'br', 'ltda', 'sa',
  'me', 'eireli', 'epp', 'online', 'www', 'com br',
]);

/** Short key that groups "UBER *TRIP 1234" and "UBER *TRIP 5678" together. */
export function merchantKey(description: string): string {
  const words = normalizeText(description)
    .split(' ')
    .filter(w => w && !NOISE.has(w) && !/^\d+$/.test(w) && w.length > 1);
  return words.slice(0, 3).join(' ') || normalizeText(description);
}

function matches(norm: string, keyword: string): boolean {
  // Short keywords must be whole words ("pix" must not hit "pixel", "bar" not "barbearia");
  // longer ones may be a word prefix ("farmacia" hits "farmacias")
  const k = keyword.trim();
  return k.length < 5 ? (` ${norm} `).includes(` ${k} `) : (` ${norm}`).includes(` ${k}`);
}

export function categorize(description: string, amount: number, userRules: Record<string, string>): string {
  const key = merchantKey(description);
  if (userRules[key]) return userRules[key];

  const norm = normalizeText(description);
  const internal = RULES[0][1];
  if (internal.some(k => matches(norm, k))) return INTERNAL;
  if (amount > 0) return INCOME;

  for (const [category, keywords] of RULES.slice(1)) {
    if (keywords.some(k => matches(norm, k))) return category;
  }
  return OTHER;
}
