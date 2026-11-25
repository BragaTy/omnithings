import React, { useMemo, useState } from 'react';
import {
  sortLines, reverseText, splitText, truncateText, joinLines, textToHtml, wordFrequency,
  numberToWords, moneyToWords, SYMBOL_GROUPS,
} from '../../tools/text';
import { parseNum } from '../../tools/math';
import { inputCls, labelCls, CopyButton, Toggle, Segmented, Field, BigResult, Result, copyText } from './shared';

const InOut: React.FC<{ input: string; onInput: (v: string) => void; output: string; inputLabel?: string; outputLabel?: string; rows?: number }> = ({
  input, onInput, output, inputLabel = 'Texto', outputLabel = 'Resultado', rows = 10,
}) => (
  <div className="grid gap-5 lg:grid-cols-2">
    <div>
      <label htmlFor="io-in" className={labelCls}>{inputLabel}</label>
      <textarea id="io-in" value={input} onChange={e => onInput(e.target.value)} rows={rows} className={inputCls} />
    </div>
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-medium text-slate-300">{outputLabel}</p>
        <CopyButton value={output} />
      </div>
      <textarea readOnly value={output} rows={rows} aria-label={outputLabel} className={inputCls} />
    </div>
  </div>
);

export const SortTool: React.FC = () => {
  const [text, setText] = useState('');
  const [o, setO] = useState({ desc: false, unique: false, ignoreCase: true, removeEmpty: true, numeric: true });
  const set = (k: keyof typeof o) => (v: boolean) => setO(x => ({ ...x, [k]: v }));
  const out = useMemo(() => sortLines(text, o), [text, o]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Toggle checked={o.desc} onChange={set('desc')}>De Z a A</Toggle>
        <Toggle checked={o.unique} onChange={set('unique')}>Remover repetidos</Toggle>
        <Toggle checked={o.ignoreCase} onChange={set('ignoreCase')}>Ignorar maiúsculas e acentos</Toggle>
        <Toggle checked={o.numeric} onChange={set('numeric')}>Números em ordem natural (2 antes de 10)</Toggle>
        <Toggle checked={o.removeEmpty} onChange={set('removeEmpty')}>Remover linhas vazias</Toggle>
      </div>
      <InOut input={text} onInput={setText} output={out} inputLabel="Uma linha por item" />
    </div>
  );
};

export const ReverseTool: React.FC = () => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'chars' | 'words' | 'lines'>('chars');
  return (
    <div className="space-y-4">
      <Segmented label="Inverter" value={mode} onChange={setMode} options={[{ value: 'chars', label: 'Letras' }, { value: 'words', label: 'Palavras' }, { value: 'lines', label: 'Linhas' }]} />
      <InOut input={text} onInput={setText} output={reverseText(text, mode)} rows={6} />
    </div>
  );
};

export const SplitCutTool: React.FC = () => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'split' | 'cut' | 'join'>('split');
  const [delimiter, setDelimiter] = useState(',');
  const [max, setMax] = useState('100');
  const [by, setBy] = useState<'chars' | 'words'>('chars');
  const [ellipsis, setEllipsis] = useState(true);
  const [joiner, setJoiner] = useState(', ');
  const out = mode === 'split'
    ? splitText(text, delimiter).join('\n')
    : mode === 'cut'
    ? truncateText(text, parseInt(max, 10) || 0, by, ellipsis)
    : joinLines(text, joiner.replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
  return (
    <div className="space-y-4">
      <Segmented label="Operação" value={mode} onChange={setMode} options={[{ value: 'split', label: 'Dividir' }, { value: 'join', label: 'Juntar linhas' }, { value: 'cut', label: 'Cortar' }]} />
      <div className="flex flex-wrap items-end gap-4">
        {mode === 'split' && <Field id="sc-del" label="Separador (\n = quebra, \t = tab)" value={delimiter} onChange={setDelimiter} className="w-64" />}
        {mode === 'join' && <Field id="sc-join" label="Juntar com" value={joiner} onChange={setJoiner} className="w-40" />}
        {mode === 'cut' && (
          <>
            <Field id="sc-max" label="Limite" value={max} onChange={setMax} inputMode="numeric" className="w-28" />
            <Segmented label="Contar" value={by} onChange={setBy} options={[{ value: 'chars', label: 'Caracteres' }, { value: 'words', label: 'Palavras' }]} />
            <Toggle checked={ellipsis} onChange={setEllipsis}>Terminar com “…”</Toggle>
          </>
        )}
      </div>
      <InOut input={text} onInput={setText} output={out} rows={8} />
    </div>
  );
};

export const TextToHtmlTool: React.FC = () => {
  const [text, setText] = useState('');
  return <InOut input={text} onInput={setText} output={textToHtml(text)} outputLabel="HTML" />;
};

export const FrequencyTool: React.FC = () => {
  const [text, setText] = useState('');
  const [ignore, setIgnore] = useState(true);
  const [search, setSearch] = useState('');
  const freq = useMemo(() => wordFrequency(text, ignore), [text, ignore]);
  const total = freq.reduce((a, f) => a + f.count, 0);
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const termCount = term ? (text.toLocaleLowerCase('pt-BR').match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="freq-in" className={labelCls}>Texto</label>
        <textarea id="freq-in" value={text} onChange={e => setText(e.target.value)} rows={7} className={inputCls} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Field id="freq-search" label="Contar ocorrências de" value={search} onChange={setSearch} className="w-64" />
        {term && <Result>“{search.trim()}” aparece {termCount} {termCount === 1 ? 'vez' : 'vezes'}</Result>}
      </div>
      <Toggle checked={ignore} onChange={setIgnore}>Ignorar palavras comuns (de, a, o, que…)</Toggle>
      {freq.length > 0 && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
              <tr><th className="px-4 py-2 font-medium">Palavra</th><th className="px-4 py-2 font-medium text-right">Vezes</th><th className="px-4 py-2 font-medium text-right">%</th></tr>
            </thead>
            <tbody>
              {freq.slice(0, 200).map(f => (
                <tr key={f.word} className="border-t border-slate-800">
                  <td className="px-4 py-1.5 text-slate-100">{f.word}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-200">{f.count}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-400">{((f.count / total) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ExtensoTool: React.FC = () => {
  const [value, setValue] = useState('1.234,56');
  const [mode, setMode] = useState<'money' | 'number'>('money');
  const [feminine, setFeminine] = useState(false);
  const n = parseNum(value);
  let out = '';
  let error = '';
  try {
    if (value.trim() && isFinite(n)) {
      out = mode === 'money' ? moneyToWords(n) : numberToWords(Math.trunc(n), feminine);
    } else if (value.trim()) error = 'Digite um número.';
  } catch (e: any) {
    error = e?.message || 'Número inválido.';
  }
  return (
    <div className="space-y-5">
      <Segmented label="Tipo" value={mode} onChange={setMode} options={[{ value: 'money', label: 'Valor em reais' }, { value: 'number', label: 'Número' }]} />
      <div className="flex flex-wrap items-end gap-4">
        <Field id="ext-v" label={mode === 'money' ? 'Valor (R$)' : 'Número inteiro'} value={value} onChange={setValue} inputMode="decimal" className="w-64" />
        {mode === 'number' && <Toggle checked={feminine} onChange={setFeminine}>No feminino (uma, duas, duzentas)</Toggle>}
      </div>
      {error ? <Result tone="error">{error}</Result> : out && <BigResult label="Por extenso" value={out} />}
    </div>
  );
};

export const SymbolsTool: React.FC = () => {
  const [last, setLast] = useState('');
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400" aria-live="polite">{last ? `“${last}” copiado.` : 'Clique em um símbolo para copiar.'}</p>
      {SYMBOL_GROUPS.map(g => (
        <div key={g.name}>
          <h3 className="text-sm font-semibold text-slate-300">{g.name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.symbols.split(' ').map(s => (
              <button
                key={s}
                type="button"
                onClick={async () => { if (await copyText(s)) setLast(s); }}
                aria-label={`Copiar ${s}`}
                className="min-w-[2.75rem] h-11 rounded-md border border-slate-800 bg-slate-950 px-2 text-xl text-slate-100 hover:border-slate-600 hover:bg-slate-800"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
