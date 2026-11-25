import React, { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Search, RefreshCw, Download } from 'lucide-react';
import { buildPixPayload, PixKeyType } from '../../tools/pix';
import {
  generatePassword, passwordStrength, caesar, fancyVariants, generateNicks, stripHtml,
  textStats, toTitleCase, removeAccents, md5, shaHex,
} from '../../tools/text';
import { UNIT_GROUPS, convertUnit, formatNumber, convertBase } from '../../tools/units';
import { inputCls, labelCls, primaryBtn, CopyButton, OutputRow, Toggle } from './shared';
import { DocumentsTool, CardTool, BankTool, PersonTool, CompanyTool, LoremTool, DrawTool } from './DevTools';
import { SortTool, ReverseTool, SplitCutTool, TextToHtmlTool, FrequencyTool, ExtensoTool, SymbolsTool } from './TextTools';
import { PercentTool, RuleOfThreeTool, RomanTool, NumberTheoryTool, AreaTool, DatesTool } from './MathTools';

type ToolId =
  | 'documents' | 'person' | 'company' | 'card' | 'bank'
  | 'password' | 'pix' | 'nicks' | 'links' | 'lorem' | 'draw'
  | 'fancy' | 'text' | 'sort' | 'reverse' | 'split' | 'extenso' | 'frequency' | 'html' | 'text2html' | 'symbols' | 'caesar' | 'hash'
  | 'percent' | 'rule3' | 'roman' | 'numbers' | 'area' | 'dates'
  | 'units' | 'bases';

const TOOLS: { id: ToolId; group: string; name: string; description: string; keywords?: string }[] = [
  { id: 'documents', group: 'Documentos e dados de teste', name: 'Gerar e validar documentos', description: 'CPF, CNPJ, RG, CNH, PIS, RENAVAM, título, IE, CEP, placa', keywords: 'cpf cnpj rg cnh pis pasep nit renavam titulo eleitor inscricao estadual cep placa validador gerador' },
  { id: 'person', group: 'Documentos e dados de teste', name: 'Pessoa fictícia', description: 'Nome, documentos, endereço e contato para testes', keywords: 'gerador de pessoas nomes' },
  { id: 'company', group: 'Documentos e dados de teste', name: 'Empresa fictícia', description: 'Razão social, CNPJ, IE e endereço para testes', keywords: 'gerador de empresas' },
  { id: 'card', group: 'Documentos e dados de teste', name: 'Cartão de crédito de teste', description: 'Números para testar formulários e validar (Luhn)', keywords: 'gerador validador cartao credito visa mastercard elo' },
  { id: 'bank', group: 'Documentos e dados de teste', name: 'Conta bancária de teste', description: 'BB, Itaú e Bradesco com dígito correto', keywords: 'gerador validador conta agencia banco' },
  { id: 'password', group: 'Gerar', name: 'Gerador de senha', description: 'Senhas fortes e aleatórias' },
  { id: 'pix', group: 'Gerar', name: 'QR Code Pix', description: 'Cobrança Pix com QR e copia e cola' },
  { id: 'nicks', group: 'Gerar', name: 'Gerador de nicks', description: 'Nomes para jogos e redes' },
  { id: 'links', group: 'Gerar', name: 'Link de WhatsApp e Telegram', description: 'Link direto para conversa' },
  { id: 'lorem', group: 'Gerar', name: 'Lorem Ipsum', description: 'Texto de preenchimento' },
  { id: 'draw', group: 'Gerar', name: 'Sorteador', description: 'Números aleatórios ou nomes de uma lista', keywords: 'numeros aleatorios sorteio' },
  { id: 'fancy', group: 'Texto', name: 'Letras diferentes', description: 'Estilos de texto para copiar' },
  { id: 'symbols', group: 'Texto', name: 'Símbolos para copiar', description: 'Setas, marcas, matemática, moedas…' },
  { id: 'text', group: 'Texto', name: 'Contador e maiúsculas', description: 'Caracteres, palavras, maiúsculas, sem acentos', keywords: 'contador de caracteres remover acentos' },
  { id: 'extenso', group: 'Texto', name: 'Número por extenso', description: 'Números e valores em reais por extenso' },
  { id: 'sort', group: 'Texto', name: 'Ordem alfabética', description: 'Ordenar linhas e remover repetidas' },
  { id: 'frequency', group: 'Texto', name: 'Ocorrência de palavras', description: 'Quais palavras mais aparecem' },
  { id: 'split', group: 'Texto', name: 'Dividir, juntar e cortar', description: 'Separar por vírgula, juntar linhas, limitar tamanho', keywords: 'dividir string cortar textos remover quebra de linha \\n' },
  { id: 'reverse', group: 'Texto', name: 'Inverter texto', description: 'Letras, palavras ou linhas ao contrário' },
  { id: 'html', group: 'Texto', name: 'Remover HTML', description: 'Extrai o texto puro de um HTML' },
  { id: 'text2html', group: 'Texto', name: 'Texto para HTML', description: 'Parágrafos e quebras em HTML' },
  { id: 'caesar', group: 'Texto', name: 'Cifra de César', description: 'Codificar e decodificar' },
  { id: 'hash', group: 'Texto', name: 'Hash MD5 e SHA', description: 'MD5, SHA-1, SHA-256, SHA-512' },
  { id: 'percent', group: 'Matemática', name: 'Porcentagem', description: 'X% de Y, variação, aumento e desconto' },
  { id: 'rule3', group: 'Matemática', name: 'Regra de três', description: 'Direta e inversa' },
  { id: 'dates', group: 'Matemática', name: 'Calcular datas', description: 'Dias entre datas, dias úteis, somar dias', keywords: 'contador de dias somar subtrair' },
  { id: 'area', group: 'Matemática', name: 'Área de figuras', description: 'Círculo, triângulo, trapézio, polígonos…' },
  { id: 'numbers', group: 'Matemática', name: 'MDC, MMC e fatoração', description: 'Também resto da divisão', keywords: 'mdc mmc fatorar primos resto divisao' },
  { id: 'roman', group: 'Matemática', name: 'Números romanos', description: 'Converter nos dois sentidos' },
  { id: 'units', group: 'Converter', name: 'Unidades de medida', description: 'Comprimento, massa, temperatura…' },
  { id: 'bases', group: 'Converter', name: 'Bases numéricas', description: 'Binário, octal, decimal, hexa' },
];

const TOOL_KEY = 'omnithings.tool';

export const ToolsView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ToolId>(() => {
    try {
      const saved = localStorage.getItem(TOOL_KEY) as ToolId | null;
      if (saved && TOOLS.some(t => t.id === saved)) return saved;
    } catch { /* ignore */ }
    return 'documents';
  });

  const select = (id: ToolId) => {
    setActive(id);
    try { localStorage.setItem(TOOL_KEY, id); } catch { /* ignore */ }
    if (window.innerWidth < 1024) document.getElementById('tool-panel')?.scrollIntoView({ behavior: 'smooth' });
  };

  const filtered = useMemo(() => {
    const q = removeAccents(query.toLowerCase().trim());
    return TOOLS.filter(t => !q || removeAccents(`${t.name} ${t.description} ${t.keywords || ''}`.toLowerCase()).includes(q));
  }, [query]);
  const groups = Array.from(new Set(filtered.map(t => t.group)));
  const tool = TOOLS.find(t => t.id === active)!;

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-50 leading-[1.05]">Utilitários</h1>
        <p className="mt-3 text-slate-300">Pequenas ferramentas do dia a dia. Tudo é calculado no seu navegador.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr] lg:items-start">
        <nav aria-label="Ferramentas" className="lg:sticky lg:top-24">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar ferramenta"
              aria-label="Buscar ferramenta"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          {groups.map(group => (
            <div key={group} className="mt-5">
              <h2 className="px-3 text-sm font-semibold text-slate-400">{group}</h2>
              <ul className="mt-1.5 space-y-0.5">
                {filtered.filter(t => t.group === group).map(t => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => select(t.id)}
                      aria-current={active === t.id ? 'page' : undefined}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        active === t.id ? 'bg-slate-800 text-slate-50' : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                      }`}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {filtered.length === 0 && <p className="mt-4 px-3 text-sm text-slate-400">Nenhuma ferramenta com esse nome.</p>}
        </nav>

        <section id="tool-panel" aria-labelledby="tool-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-7 min-w-0">
          <h2 id="tool-title" className="text-2xl font-bold text-slate-50">{tool.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
          <div className="mt-6">
            {active === 'documents' && <DocumentsTool />}
            {active === 'person' && <PersonTool />}
            {active === 'company' && <CompanyTool />}
            {active === 'card' && <CardTool />}
            {active === 'bank' && <BankTool />}
            {active === 'lorem' && <LoremTool />}
            {active === 'draw' && <DrawTool />}
            {active === 'symbols' && <SymbolsTool />}
            {active === 'extenso' && <ExtensoTool />}
            {active === 'sort' && <SortTool />}
            {active === 'frequency' && <FrequencyTool />}
            {active === 'split' && <SplitCutTool />}
            {active === 'reverse' && <ReverseTool />}
            {active === 'text2html' && <TextToHtmlTool />}
            {active === 'percent' && <PercentTool />}
            {active === 'rule3' && <RuleOfThreeTool />}
            {active === 'dates' && <DatesTool />}
            {active === 'area' && <AreaTool />}
            {active === 'numbers' && <NumberTheoryTool />}
            {active === 'roman' && <RomanTool />}
            {active === 'password' && <PasswordTool />}
            {active === 'pix' && <PixTool />}
            {active === 'nicks' && <NickTool />}
            {active === 'links' && <LinksTool />}
            {active === 'fancy' && <FancyTool />}
            {active === 'text' && <TextTool />}
            {active === 'html' && <HtmlTool />}
            {active === 'caesar' && <CaesarTool />}
            {active === 'hash' && <HashTool />}
            {active === 'units' && <UnitsTool />}
            {active === 'bases' && <BasesTool />}
          </div>
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tools

const PasswordTool: React.FC = () => {
  const [opts, setOpts] = useState({ length: 16, lower: true, upper: true, numbers: true, symbols: true, avoidAmbiguous: false });
  const [pw, setPw] = useState('');
  const regen = () => setPw(generatePassword(opts));
  useEffect(regen, [opts]); // eslint-disable-line react-hooks/exhaustive-deps
  const strength = passwordStrength(pw);
  const set = (k: keyof typeof opts) => (v: boolean) => setOpts(o => ({ ...o, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 pl-4">
        <p className="flex-1 break-all font-mono text-lg text-slate-50" aria-live="polite">{pw || 'Escolha ao menos um tipo de caractere'}</p>
        <button type="button" onClick={regen} aria-label="Gerar outra senha" className="rounded-md p-2 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="w-4 h-4" />
        </button>
        <CopyButton value={pw} />
      </div>
      {pw && (
        <p className="text-sm text-slate-400">
          Força: <span className="text-slate-100">{strength.label}</span> ({strength.bits} bits de entropia)
        </p>
      )}
      <div>
        <label htmlFor="pw-len" className={labelCls}>Tamanho: {opts.length}</label>
        <input id="pw-len" type="range" min={6} max={64} value={opts.length} onChange={e => setOpts(o => ({ ...o, length: +e.target.value }))} className="w-full accent-indigo-500" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Toggle checked={opts.lower} onChange={set('lower')}>Minúsculas</Toggle>
        <Toggle checked={opts.upper} onChange={set('upper')}>Maiúsculas</Toggle>
        <Toggle checked={opts.numbers} onChange={set('numbers')}>Números</Toggle>
        <Toggle checked={opts.symbols} onChange={set('symbols')}>Símbolos</Toggle>
        <Toggle checked={opts.avoidAmbiguous} onChange={set('avoidAmbiguous')}>Evitar parecidos (0/O, l/1)</Toggle>
      </div>
    </div>
  );
};

const PixTool: React.FC = () => {
  const [keyType, setKeyType] = useState<PixKeyType>('cpf');
  const [form, setForm] = useState({ key: '', name: '', city: '', amount: '', message: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const result = useMemo(() => {
    if (!form.key.trim()) return { payload: '', error: '' };
    try {
      const amount = Number(form.amount.replace(/\./g, '').replace(',', '.'));
      const payload = buildPixPayload({ ...form, keyType, amount: isFinite(amount) ? amount : 0 });
      return { payload, error: '' };
    } catch (e: any) {
      return { payload: '', error: e?.message || 'Dados inválidos.' };
    }
  }, [form, keyType]);

  const qr = useMemo(() => {
    if (!result.payload) return null;
    const q = qrcode(0, 'M');
    q.addData(result.payload);
    q.make();
    return q;
  }, [result.payload]);

  const downloadPng = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.createDataURL(10, 4);
    a.download = 'pix-qrcode.gif';
    a.click();
  };

  const placeholders: Record<PixKeyType, string> = {
    cpf: '000.000.000-00', phone: '(11) 91234-5678', email: 'voce@email.com', random: '1234abcd-12ab-12ab-12ab-123456abcdef',
  };

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="pix-type" className={labelCls}>Tipo de chave</label>
            <select id="pix-type" value={keyType} onChange={e => setKeyType(e.target.value as PixKeyType)} className={inputCls}>
              <option value="cpf">CPF/CNPJ</option>
              <option value="phone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="random">Aleatória</option>
            </select>
          </div>
          <div>
            <label htmlFor="pix-key" className={labelCls}>Chave Pix</label>
            <input id="pix-key" value={form.key} onChange={set('key')} placeholder={placeholders[keyType]} className={inputCls} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pix-name" className={labelCls}>Nome de quem recebe</label>
            <input id="pix-name" value={form.name} onChange={set('name')} placeholder="Maria Silva" className={inputCls} />
          </div>
          <div>
            <label htmlFor="pix-city" className={labelCls}>Cidade</label>
            <input id="pix-city" value={form.city} onChange={set('city')} placeholder="São Paulo" className={inputCls} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pix-amount" className={labelCls}>Valor (opcional)</label>
            <input id="pix-amount" value={form.amount} onChange={set('amount')} placeholder="0,00" inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label htmlFor="pix-msg" className={labelCls}>Mensagem (opcional)</label>
            <input id="pix-msg" value={form.message} onChange={set('message')} placeholder="Almoço de sábado" className={inputCls} />
          </div>
        </div>
        {result.error && <p role="alert" className="text-sm text-rose-300">{result.error}</p>}
        {result.payload && (
          <div>
            <p className={labelCls}>Pix copia e cola</p>
            <div className="flex items-start gap-2">
              <p className="flex-1 break-all rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200">{result.payload}</p>
              <CopyButton value={result.payload} />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-white p-3">
          {qr ? (
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ margin: 0, scalable: true }) }} />
          ) : (
            <p className="px-4 text-center text-sm text-slate-500">Preencha a chave para gerar o QR Code</p>
          )}
        </div>
        {qr && (
          <button type="button" onClick={downloadPng} className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200">
            <Download className="w-4 h-4" aria-hidden="true" /> Baixar imagem
          </button>
        )}
      </div>
    </div>
  );
};

const NickTool: React.FC = () => {
  const [base, setBase] = useState('');
  const [nicks, setNicks] = useState<string[]>(() => generateNicks(''));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="nick-base" className={labelCls}>Palavra base (opcional)</label>
          <input id="nick-base" value={base} onChange={e => setBase(e.target.value)} placeholder="Seu nome ou apelido" className={inputCls} />
        </div>
        <button type="button" onClick={() => setNicks(generateNicks(base))} className={primaryBtn}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Gerar nicks
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6">{nicks.map(n => <OutputRow key={n} value={n} />)}</div>
    </div>
  );
};

const LinksTool: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [tgUser, setTgUser] = useState('');
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  const wa = intl.length >= 12 ? `https://wa.me/${intl}${message ? `?text=${encodeURIComponent(message)}` : ''}` : '';
  const user = tgUser.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
  const tg = /^[A-Za-z0-9_]{5,32}$/.test(user) ? `https://t.me/${user}` : '';

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-100">WhatsApp</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="wa-phone" className={labelCls}>Número com DDD</label>
            <input id="wa-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 91234-5678" inputMode="tel" className={inputCls} />
          </div>
          <div>
            <label htmlFor="wa-msg" className={labelCls}>Mensagem pronta (opcional)</label>
            <input id="wa-msg" value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá! Vi seu anúncio…" className={inputCls} />
          </div>
        </div>
        {wa && <OutputRow label="Link" value={wa} mono />}
      </div>
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-100">Telegram</h3>
        <div>
          <label htmlFor="tg-user" className={labelCls}>Usuário</label>
          <input id="tg-user" value={tgUser} onChange={e => setTgUser(e.target.value)} placeholder="@seuusuario" className={inputCls} />
        </div>
        {tg && <OutputRow label="Link" value={tg} mono />}
        {tgUser && !tg && <p className="text-sm text-rose-300">Usuário do Telegram tem de 5 a 32 letras, números ou _.</p>}
      </div>
    </div>
  );
};

const FancyTool: React.FC = () => {
  const [text, setText] = useState('OmniThings');
  const variants = useMemo(() => fancyVariants(text), [text]);
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="fancy-in" className={labelCls}>Seu texto</label>
        <input id="fancy-in" value={text} onChange={e => setText(e.target.value)} className={inputCls} />
      </div>
      <div>{variants.map(v => <OutputRow key={v.name} label={v.name} value={v.value} />)}</div>
      <p className="text-xs text-slate-500">Acentos não existem nesses alfabetos especiais e são removidos.</p>
    </div>
  );
};

const TextTool: React.FC = () => {
  const [text, setText] = useState('');
  const s = textStats(text);
  const actions: [string, (t: string) => string][] = [
    ['MAIÚSCULAS', t => t.toUpperCase()],
    ['minúsculas', t => t.toLowerCase()],
    ['Título', toTitleCase],
    ['Primeira maiúscula', t => t.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, m => m.toUpperCase())],
    ['Sem acentos', removeAccents],
    ['Remover espaços extras', t => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()],
  ];
  const stats: [string, number][] = [
    ['Caracteres', s.characters], ['Sem espaços', s.charactersNoSpaces], ['Palavras', s.words],
    ['Linhas', s.lines], ['Parágrafos', s.paragraphs], ['Min. de leitura', s.readingMinutes],
  ];
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <dt className="text-xs text-slate-400">{k}</dt>
            <dd className="mt-0.5 text-xl font-semibold text-slate-50 tabular-nums">{v.toLocaleString('pt-BR')}</dd>
          </div>
        ))}
      </dl>
      <label htmlFor="text-in" className="sr-only">Texto</label>
      <textarea id="text-in" value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="Cole ou digite seu texto aqui" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        {actions.map(([label, fn]) => (
          <button key={label} type="button" onClick={() => setText(fn(text))} disabled={!text}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40">
            {label}
          </button>
        ))}
        <CopyButton value={text} />
      </div>
    </div>
  );
};

const HtmlTool: React.FC = () => {
  const [html, setHtml] = useState('');
  const [breaks, setBreaks] = useState(true);
  const out = useMemo(() => (html ? stripHtml(html, breaks) : ''), [html, breaks]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <label htmlFor="html-in" className={labelCls}>HTML</label>
        <textarea id="html-in" value={html} onChange={e => setHtml(e.target.value)} rows={12} placeholder="<p>Cole o HTML aqui</p>" className={`${inputCls} font-mono text-sm`} />
        <div className="mt-2"><Toggle checked={breaks} onChange={setBreaks}>Manter quebras de parágrafo</Toggle></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-medium text-slate-300">Texto puro</p>
          <CopyButton value={out} />
        </div>
        <textarea readOnly value={out} rows={12} aria-label="Texto puro" className={inputCls} />
      </div>
    </div>
  );
};

const CaesarTool: React.FC = () => {
  const [text, setText] = useState('');
  const [shift, setShift] = useState(3);
  const [decode, setDecode] = useState(false);
  const out = caesar(text, decode ? -shift : shift);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="caesar-shift" className={labelCls}>Deslocamento</label>
          <input id="caesar-shift" type="number" min={1} max={25} value={shift} onChange={e => setShift(Math.max(1, Math.min(25, +e.target.value || 1)))} className={`${inputCls} w-24`} />
        </div>
        <div className="inline-flex rounded-lg border border-slate-700 p-0.5" role="group" aria-label="Direção">
          {[false, true].map(d => (
            <button key={String(d)} type="button" onClick={() => setDecode(d)} aria-pressed={decode === d}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${decode === d ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-100'}`}>
              {d ? 'Decodificar' : 'Codificar'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="caesar-in" className={labelCls}>Texto</label>
        <textarea id="caesar-in" value={text} onChange={e => setText(e.target.value)} rows={4} className={inputCls} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-medium text-slate-300">Resultado</p>
          <CopyButton value={out} />
        </div>
        <p className="min-h-[3rem] whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100">{out}</p>
      </div>
    </div>
  );
};

const HashTool: React.FC = () => {
  const [text, setText] = useState('');
  const [sha, setSha] = useState({ s1: '', s256: '', s512: '' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([shaHex('SHA-1', text), shaHex('SHA-256', text), shaHex('SHA-512', text)]).then(([s1, s256, s512]) => {
      if (!cancelled) setSha({ s1, s256, s512 });
    });
    return () => { cancelled = true; };
  }, [text]);
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="hash-in" className={labelCls}>Texto</label>
        <textarea id="hash-in" value={text} onChange={e => setText(e.target.value)} rows={4} className={inputCls} />
      </div>
      <div>
        <OutputRow label="MD5" value={md5(text)} mono />
        <OutputRow label="SHA-1" value={sha.s1} mono />
        <OutputRow label="SHA-256" value={sha.s256} mono />
        <OutputRow label="SHA-512" value={sha.s512} mono />
      </div>
      <p className="text-xs text-slate-500">Para o hash de um arquivo, use “Checksum” na aba Converter.</p>
    </div>
  );
};

const UnitsTool: React.FC = () => {
  const [groupId, setGroupId] = useState(UNIT_GROUPS[0].id);
  const group = UNIT_GROUPS.find(g => g.id === groupId)!;
  const [from, setFrom] = useState(group.units[2]?.id || group.units[0].id);
  const [value, setValue] = useState('1');
  const changeGroup = (id: string) => {
    setGroupId(id);
    const g = UNIT_GROUPS.find(x => x.id === id)!;
    setFrom(g.units[Math.min(2, g.units.length - 1)].id);
  };
  const num = Number(value.replace(/\./g, '').replace(',', '.'));
  const fromId = group.units.some(u => u.id === from) ? from : group.units[0].id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grandeza">
        {UNIT_GROUPS.map(g => (
          <button key={g.id} type="button" onClick={() => changeGroup(g.id)} aria-pressed={g.id === groupId}
            className={`rounded-md px-3 py-1.5 text-sm ${g.id === groupId ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="unit-val" className={labelCls}>Valor</label>
          <input id="unit-val" value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" className={inputCls} />
        </div>
        <div>
          <label htmlFor="unit-from" className={labelCls}>De</label>
          <select id="unit-from" value={fromId} onChange={e => setFrom(e.target.value)} className={inputCls}>
            {group.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        {group.units.filter(u => u.id !== fromId).map(u => (
          <OutputRow key={u.id} label={u.label} value={isFinite(num) && value.trim() ? formatNumber(convertUnit(groupId, fromId, u.id, num)) : ''} />
        ))}
      </div>
    </div>
  );
};

const BasesTool: React.FC = () => {
  const [value, setValue] = useState('255');
  const [base, setBase] = useState(10);
  const out = convertBase(value, base);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor="base-val" className={labelCls}>Número</label>
          <input id="base-val" value={value} onChange={e => setValue(e.target.value)} className={`${inputCls} font-mono`} />
        </div>
        <div>
          <label htmlFor="base-from" className={labelCls}>Está em</label>
          <select id="base-from" value={base} onChange={e => setBase(+e.target.value)} className={inputCls}>
            <option value={2}>Binário (base 2)</option>
            <option value={8}>Octal (base 8)</option>
            <option value={10}>Decimal (base 10)</option>
            <option value={16}>Hexadecimal (base 16)</option>
          </select>
        </div>
      </div>
      {value.trim() && !out && <p role="alert" className="text-sm text-rose-300">Esse número tem dígitos que não existem na base {base}.</p>}
      <div>
        <OutputRow label="Binário" value={out?.bin || ''} mono />
        <OutputRow label="Octal" value={out?.oct || ''} mono />
        <OutputRow label="Decimal" value={out?.dec || ''} mono />
        <OutputRow label="Hexadecimal" value={out?.hex || ''} mono />
      </div>
    </div>
  );
};
