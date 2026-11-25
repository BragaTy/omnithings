import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import * as D from '../../tools/documents';
import { generatePerson, generateCompany, PERSON_STATES, lorem, drawNumbers, drawItems } from '../../tools/fake';
import { downloadBlob } from '../../utils/fileHelpers';
import { inputCls, labelCls, primaryBtn, secondaryBtn, CopyButton, OutputRow, Toggle, Segmented, Field, Result } from './shared';

// ---------------------------------------------------------------------------
// Documents: one tool, a selector for the type, generate + validate side by side

type DocType = 'cpf' | 'cnpj' | 'rg' | 'cnh' | 'pis' | 'renavam' | 'titulo' | 'ie' | 'cep' | 'placa';

const DOC_TYPES: { id: DocType; label: string; placeholder: string; formattable: boolean }[] = [
  { id: 'cpf', label: 'CPF', placeholder: '000.000.000-00', formattable: true },
  { id: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', formattable: true },
  { id: 'rg', label: 'RG (SP)', placeholder: '00.000.000-0', formattable: true },
  { id: 'cnh', label: 'CNH', placeholder: '00000000000', formattable: false },
  { id: 'pis', label: 'PIS/PASEP/NIT', placeholder: '000.00000.00-0', formattable: true },
  { id: 'renavam', label: 'RENAVAM', placeholder: '00000000000', formattable: false },
  { id: 'titulo', label: 'Título de eleitor', placeholder: '0000 0000 0000', formattable: true },
  { id: 'ie', label: 'Inscrição estadual', placeholder: '', formattable: true },
  { id: 'cep', label: 'CEP', placeholder: '00000-000', formattable: true },
  { id: 'placa', label: 'Placa de veículo', placeholder: 'ABC1D23', formattable: false },
];

export const DocumentsTool: React.FC = () => {
  const [type, setType] = useState<DocType>('cpf');
  const [formatted, setFormatted] = useState(true);
  const [uf, setUf] = useState('SP');
  const [ieState, setIeState] = useState<D.IeState>('SP');
  const [mercosul, setMercosul] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const [check, setCheck] = useState('');
  const info = DOC_TYPES.find(t => t.id === type)!;

  const generateOne = (): string => {
    switch (type) {
      case 'cpf': return D.generateCpf(formatted);
      case 'cnpj': return D.generateCnpj(formatted);
      case 'rg': return D.generateRg(formatted);
      case 'cnh': return D.generateCnh();
      case 'pis': return D.generatePis(formatted);
      case 'renavam': return D.generateRenavam();
      case 'titulo': return D.generateTitulo(uf, formatted);
      case 'ie': return D.generateIe(ieState, formatted);
      case 'cep': return D.generateCep(uf, formatted);
      case 'placa': return D.generatePlate(mercosul);
    }
  };
  const regen = () => setList(Array.from({ length: 6 }, generateOne));
  useEffect(regen, [type, formatted, uf, ieState, mercosul]); // eslint-disable-line react-hooks/exhaustive-deps

  const validation = useMemo((): { ok: boolean; text: string } | null => {
    if (!check.trim()) return null;
    switch (type) {
      case 'cpf': return D.validateCpf(check) ? { ok: true, text: 'CPF válido' } : { ok: false, text: 'CPF inválido' };
      case 'cnpj': return D.validateCnpj(check) ? { ok: true, text: 'CNPJ válido' } : { ok: false, text: 'CNPJ inválido' };
      case 'rg': return D.validateRg(check) ? { ok: true, text: 'RG válido (regra de SP)' } : { ok: false, text: 'RG inválido pela regra de SP (outros estados usam regras próprias)' };
      case 'cnh': return D.validateCnh(check) ? { ok: true, text: 'CNH válida' } : { ok: false, text: 'CNH inválida' };
      case 'pis': return D.validatePis(check) ? { ok: true, text: 'PIS/PASEP válido' } : { ok: false, text: 'PIS/PASEP inválido' };
      case 'renavam': return D.validateRenavam(check) ? { ok: true, text: 'RENAVAM válido' } : { ok: false, text: 'RENAVAM inválido' };
      case 'titulo': {
        if (!D.validateTitulo(check)) return { ok: false, text: 'Título de eleitor inválido' };
        const code = D.digitsOnly(check).padStart(12, '0').slice(8, 10);
        const state = Object.entries(D.UF_CODES).find(([, c]) => c === code)?.[0] || 'exterior';
        return { ok: true, text: `Título válido, emitido em ${state}` };
      }
      case 'ie': return D.validateIe(ieState, check) ? { ok: true, text: `Inscrição estadual de ${ieState} válida` } : { ok: false, text: `Inscrição estadual de ${ieState} inválida` };
      case 'cep': {
        const st = D.cepState(check);
        return st ? { ok: true, text: `Formato válido, faixa de CEP de ${st}` } : { ok: false, text: 'CEP com formato ou faixa inválidos' };
      }
      case 'placa': {
        const p = D.validatePlate(check);
        return p ? { ok: true, text: p === 'mercosul' ? 'Placa no padrão Mercosul' : 'Placa no padrão antigo' } : { ok: false, text: 'Formato de placa inválido' };
      }
    }
  }, [check, type, ieState]);

  const needsUf = type === 'titulo' || type === 'cep';

  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="doc-type" className={labelCls}>Documento</label>
        <select id="doc-type" value={type} onChange={e => { setType(e.target.value as DocType); setCheck(''); }} className={`${inputCls} sm:w-72`}>
          {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {needsUf && (
          <select value={uf} onChange={e => setUf(e.target.value)} aria-label="Estado" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            {Object.keys(D.CEP_RANGES).sort().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {type === 'ie' && (
          <Segmented label="Estado" value={ieState} onChange={setIeState} options={D.IE_STATES.map(s => ({ value: s, label: s }))} />
        )}
        {type === 'placa' && (
          <Segmented label="Padrão" value={mercosul ? 'm' : 'a'} onChange={v => setMercosul(v === 'm')} options={[{ value: 'm', label: 'Mercosul' }, { value: 'a', label: 'Antiga' }]} />
        )}
        {info.formattable && <Toggle checked={formatted} onChange={setFormatted}>Com pontuação</Toggle>}
        <button type="button" onClick={regen} className={primaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Gerar outros</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6">{list.map((v, i) => <OutputRow key={`${v}-${i}`} value={v} mono />)}</div>

      <div className="border-t border-slate-800 pt-6">
        <label htmlFor="doc-check" className={labelCls}>Validar {info.label}{type === 'ie' ? ` de ${ieState}` : ''}</label>
        <input id="doc-check" value={check} onChange={e => setCheck(e.target.value)} placeholder={info.placeholder || 'Digite para validar'} className={inputCls} />
        {validation && <div className="mt-2"><Result tone={validation.ok ? 'ok' : 'error'}>{validation.ok ? '✓' : '✕'} {validation.text}</Result></div>}
      </div>
      <p className="text-xs text-slate-500">
        Números gerados são matematicamente válidos para testar sistemas, mas aleatórios: não pertencem a ninguém e não servem como documento.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------

export const CardTool: React.FC = () => {
  const [brand, setBrand] = useState<D.CardBrand>('Visa');
  const [cards, setCards] = useState<ReturnType<typeof D.generateCard>[]>([]);
  const [check, setCheck] = useState('');
  const regen = () => setCards(Array.from({ length: 4 }, () => D.generateCard(brand)));
  useEffect(regen, [brand]); // eslint-disable-line react-hooks/exhaustive-deps
  const detected = D.detectCardBrand(check);
  const valid = D.luhnValid(check);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="card-brand" className={labelCls}>Bandeira</label>
          <select id="card-brand" value={brand} onChange={e => setBrand(e.target.value as D.CardBrand)} className={inputCls}>
            {(Object.keys(D.CARD_BRANDS) as D.CardBrand[]).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button type="button" onClick={regen} className={primaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Gerar outros</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr><th className="py-2 pr-4 font-medium">Número</th><th className="py-2 pr-4 font-medium">Validade</th><th className="py-2 font-medium">CVV</th><th /></tr>
          </thead>
          <tbody>
            {cards.map(c => (
              <tr key={c.number} className="border-t border-slate-800">
                <td className="py-2.5 pr-4 font-mono text-slate-100 whitespace-nowrap">{c.number}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-300">{c.expiry}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-300">{c.cvv}</td>
                <td className="py-1.5 text-right"><CopyButton value={c.number.replace(/\s/g, '')} compact label="Copiar número" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 pt-6">
        <label htmlFor="card-check" className={labelCls}>Validar número de cartão</label>
        <input id="card-check" value={check} onChange={e => setCheck(e.target.value)} placeholder="0000 0000 0000 0000" inputMode="numeric" className={inputCls} />
        {D.digitsOnly(check).length >= 12 && (
          <div className="mt-2">
            <Result tone={valid ? 'ok' : 'error'}>
              {valid ? '✓ Número passa na verificação (Luhn)' : '✕ Número não passa na verificação (Luhn)'}{detected ? ` · bandeira ${detected}` : ''}
            </Result>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Números fictícios que passam na validação de formato, para testar formulários. Não são cartões reais e não fazem compras.
        Para testar pagamentos, use os cartões de teste do seu gateway (Stripe, Mercado Pago, Pagar.me).
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------

export const BankTool: React.FC = () => {
  const [bank, setBank] = useState<D.Bank>('Banco do Brasil');
  const [items, setItems] = useState<{ agency: string; account: string }[]>([]);
  const [agency, setAgency] = useState('');
  const [account, setAccount] = useState('');
  const regen = () => setItems(Array.from({ length: 4 }, () => D.generateBankAccount(bank)));
  useEffect(regen, [bank]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = agency && account ? D.validateBankAccount(bank, agency, account) : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Banco" value={bank} onChange={setBank} options={D.BANKS.map(b => ({ value: b, label: b }))} />
        <button type="button" onClick={regen} className={primaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Gerar outras</button>
      </div>
      <div>
        {items.map(i => <OutputRow key={i.agency + i.account} label={`Agência ${i.agency}`} value={`Conta ${i.account}`} mono />)}
      </div>
      <div className="border-t border-slate-800 pt-6 grid gap-4 sm:grid-cols-2">
        <Field id="bank-ag" label="Agência (com dígito, se houver)" value={agency} onChange={setAgency} placeholder={bank === 'Itaú' ? '0000' : '0000-0'} />
        <Field id="bank-acc" label="Conta (com dígito)" value={account} onChange={setAccount} placeholder="00000-0" />
        {valid !== null && <div className="sm:col-span-2"><Result tone={valid ? 'ok' : 'error'}>{valid ? '✓ Dígitos conferem' : '✕ Dígitos não conferem'} para {bank}</Result></div>}
      </div>
      <p className="text-xs text-slate-500">Contas fictícias com dígito verificador correto, para testes. Não existem de verdade.</p>
    </div>
  );
};

// ---------------------------------------------------------------------------

function RecordView({ record, filename }: { record: Record<string, string | number>; filename: string }) {
  const json = JSON.stringify(record, null, 2);
  const LABELS: Record<string, string> = {
    nome: 'Nome', sexo: 'Sexo', idade: 'Idade', dataNascimento: 'Nascimento', signo: 'Signo', mae: 'Mãe', pai: 'Pai',
    cpf: 'CPF', rg: 'RG', cnh: 'CNH', pis: 'PIS', tituloEleitor: 'Título de eleitor', email: 'E-mail', senha: 'Senha',
    celular: 'Celular', telefone: 'Telefone', cep: 'CEP', endereco: 'Endereço', numero: 'Número', bairro: 'Bairro',
    cidade: 'Cidade', estado: 'Estado', altura: 'Altura', peso: 'Peso', tipoSanguineo: 'Tipo sanguíneo',
    razaoSocial: 'Razão social', nomeFantasia: 'Nome fantasia', cnpj: 'CNPJ', inscricaoEstadual: 'Inscrição estadual',
    dataAbertura: 'Abertura', site: 'Site',
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-x-6">
        {Object.entries(record).map(([k, v]) => <OutputRow key={k} label={LABELS[k] || k} value={String(v)} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={json} label="Copiar JSON" />
        <button type="button" className={secondaryBtn} onClick={() => downloadBlob(new Blob([json], { type: 'application/json' }), filename)}>
          <Download className="w-4 h-4" aria-hidden="true" /> Baixar JSON
        </button>
      </div>
    </div>
  );
}

export const PersonTool: React.FC = () => {
  const [sex, setSex] = useState<'any' | 'F' | 'M'>('any');
  const [uf, setUf] = useState('');
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('70');
  const make = () => {
    const a = Math.max(0, Math.min(100, parseInt(minAge, 10) || 18));
    const b = Math.max(a, Math.min(100, parseInt(maxAge, 10) || 70));
    return generatePerson({ sex, uf: uf || undefined, minAge: a, maxAge: b });
  };
  const [person, setPerson] = useState(make);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented label="Sexo" value={sex} onChange={setSex} options={[{ value: 'any', label: 'Qualquer' }, { value: 'F', label: 'Feminino' }, { value: 'M', label: 'Masculino' }]} />
        <div>
          <label htmlFor="p-uf" className={labelCls}>Estado</label>
          <select id="p-uf" value={uf} onChange={e => setUf(e.target.value)} className={inputCls}>
            <option value="">Qualquer</option>
            {PERSON_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Field id="p-min" label="Idade de" value={minAge} onChange={setMinAge} inputMode="numeric" className="w-24" />
        <Field id="p-max" label="até" value={maxAge} onChange={setMaxAge} inputMode="numeric" className="w-24" />
        <button type="button" onClick={() => setPerson(make())} className={primaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Gerar pessoa</button>
      </div>
      <RecordView record={person as unknown as Record<string, string | number>} filename="pessoa-ficticia.json" />
      <p className="text-xs text-slate-500">Dados inventados para testes; qualquer semelhança com pessoas reais é coincidência.</p>
    </div>
  );
};

export const CompanyTool: React.FC = () => {
  const [uf, setUf] = useState('');
  const [company, setCompany] = useState(() => generateCompany());
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="c-uf" className={labelCls}>Estado</label>
          <select id="c-uf" value={uf} onChange={e => setUf(e.target.value)} className={inputCls}>
            <option value="">Qualquer</option>
            {PERSON_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => setCompany(generateCompany(uf || undefined))} className={primaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Gerar empresa</button>
      </div>
      <RecordView record={company as unknown as Record<string, string | number>} filename="empresa-ficticia.json" />
      <p className="text-xs text-slate-500">Empresa inventada para testes. CNPJ e inscrição estadual têm dígitos válidos, mas não existem na Receita.</p>
    </div>
  );
};

// ---------------------------------------------------------------------------

export const LoremTool: React.FC = () => {
  const [kind, setKind] = useState<'paragraphs' | 'sentences' | 'words'>('paragraphs');
  const [count, setCount] = useState('3');
  const [classic, setClassic] = useState(true);
  const [text, setText] = useState('');
  const regen = () => setText(lorem(kind, parseInt(count, 10) || 1, classic));
  useEffect(regen, [kind, count, classic]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented label="Gerar" value={kind} onChange={setKind} options={[{ value: 'paragraphs', label: 'Parágrafos' }, { value: 'sentences', label: 'Frases' }, { value: 'words', label: 'Palavras' }]} />
        <Field id="lorem-n" label="Quantidade" value={count} onChange={setCount} inputMode="numeric" className="w-28" />
        <Toggle checked={classic} onChange={setClassic}>Começar com “Lorem ipsum”</Toggle>
        <button type="button" onClick={regen} className={secondaryBtn}><RefreshCw className="w-4 h-4" aria-hidden="true" />Outro</button>
      </div>
      <textarea readOnly value={text} rows={10} aria-label="Texto gerado" className={inputCls} />
      <CopyButton value={text} />
    </div>
  );
};

export const DrawTool: React.FC = () => {
  const [mode, setMode] = useState<'numbers' | 'names'>('numbers');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('60');
  const [count, setCount] = useState('6');
  const [unique, setUnique] = useState(true);
  const [sorted, setSorted] = useState(true);
  const [names, setNames] = useState('');
  const [result, setResult] = useState<string[]>([]);
  const [error, setError] = useState('');

  const draw = () => {
    setError('');
    try {
      if (mode === 'numbers') {
        let nums = drawNumbers(parseInt(min, 10), parseInt(max, 10), parseInt(count, 10) || 1, unique);
        if (sorted) nums = [...nums].sort((a, b) => a - b);
        setResult(nums.map(String));
      } else {
        const items = names.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (items.length === 0) throw new Error('Escreva um nome por linha.');
        setResult(drawItems(items, parseInt(count, 10) || 1));
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível sortear.');
      setResult([]);
    }
  };

  return (
    <div className="space-y-5">
      <Segmented label="Sortear" value={mode} onChange={v => { setMode(v); setResult([]); }} options={[{ value: 'numbers', label: 'Números' }, { value: 'names', label: 'Nomes ou itens' }]} />
      {mode === 'numbers' ? (
        <div className="flex flex-wrap items-end gap-4">
          <Field id="d-min" label="De" value={min} onChange={setMin} inputMode="numeric" className="w-24" />
          <Field id="d-max" label="Até" value={max} onChange={setMax} inputMode="numeric" className="w-24" />
          <Field id="d-n" label="Quantos" value={count} onChange={setCount} inputMode="numeric" className="w-24" />
          <Toggle checked={unique} onChange={setUnique}>Sem repetir</Toggle>
          <Toggle checked={sorted} onChange={setSorted}>Em ordem</Toggle>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor="d-names" className={labelCls}>Um por linha</label>
            <textarea id="d-names" value={names} onChange={e => setNames(e.target.value)} rows={6} className={inputCls} placeholder={'Ana\nBruno\nCarla'} />
          </div>
          <Field id="d-n2" label="Quantos" value={count} onChange={setCount} inputMode="numeric" />
        </div>
      )}
      <button type="button" onClick={draw} className={primaryBtn}>Sortear</button>
      {error && <Result tone="error">{error}</Result>}
      {result.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          {result.map((r, i) => (
            <span key={`${r}-${i}`} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-display text-xl font-bold text-slate-50 tabular-nums">{r}</span>
          ))}
          <CopyButton value={result.join(mode === 'numbers' ? ', ' : '\n')} />
        </div>
      )}
    </div>
  );
};
