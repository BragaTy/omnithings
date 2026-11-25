import React, { useState } from 'react';
import {
  parseNum, fmt, percentOf, whatPercent, percentChange, applyPercent, ruleOfThree, toRoman, fromRoman,
  gcdAll, lcmAll, parseIntList, factorize, divide, SHAPES, daysBetween, addDays, addMonths, describeDate,
} from '../../tools/math';
import { Field, BigResult, Result, Segmented, Toggle, labelCls, inputCls } from './shared';

const valid = (...ns: number[]) => ns.every(n => isFinite(n));

export const PercentTool: React.FC = () => {
  const [a, setA] = useState('15');
  const [b, setB] = useState('200');
  const [c, setC] = useState('50');
  const [d, setD] = useState('80');
  const [e, setE] = useState('120');
  const [f, setF] = useState('10');
  const [g, setG] = useState('100');
  const [h, setH] = useState('-10');
  const A = parseNum(a), B = parseNum(b), C = parseNum(c), D = parseNum(d), E = parseNum(e), F = parseNum(f), G = parseNum(g), H = parseNum(h);
  const rows: { q: React.ReactNode; r: string }[] = [
    {
      q: <><Inline id="p1" v={a} s={setA} />% de <Inline id="p2" v={b} s={setB} /></>,
      r: valid(A, B) ? fmt(percentOf(A, B), 4) : '—',
    },
    {
      q: <><Inline id="p3" v={c} s={setC} /> é quantos % de <Inline id="p4" v={d} s={setD} />?</>,
      r: valid(C, D) && D !== 0 ? `${fmt(whatPercent(C, D), 4)}%` : '—',
    },
    {
      q: <>De <Inline id="p5" v={e} s={setE} /> para <Inline id="p6" v={f} s={setF} /> variou</>,
      r: valid(E, F) && E !== 0 ? `${percentChange(E, F) >= 0 ? '+' : ''}${fmt(percentChange(E, F), 4)}%` : '—',
    },
    {
      q: <><Inline id="p7" v={g} s={setG} /> com <Inline id="p8" v={h} s={setH} />% (aumento ou desconto)</>,
      r: valid(G, H) ? fmt(applyPercent(G, H), 4) : '—',
    },
  ];
  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
          <span className="flex flex-wrap items-center gap-2 text-slate-300">{row.q}</span>
          <span className="font-display text-xl font-bold text-slate-50 tabular-nums">= {row.r}</span>
        </li>
      ))}
    </ul>
  );
};

const Inline: React.FC<{ id: string; v: string; s: (v: string) => void }> = ({ id, v, s }) => (
  <input id={id} aria-label="Valor" value={v} onChange={ev => s(ev.target.value)} inputMode="decimal"
    className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 tabular-nums" />
);

export const RuleOfThreeTool: React.FC = () => {
  const [a, setA] = useState('2');
  const [b, setB] = useState('10');
  const [c, setC] = useState('5');
  const [inverse, setInverse] = useState(false);
  const A = parseNum(a), B = parseNum(b), C = parseNum(c);
  const ok = valid(A, B, C) && (inverse ? C !== 0 : A !== 0);
  return (
    <div className="space-y-5">
      <Segmented label="Proporção" value={inverse ? 'inv' : 'dir'} onChange={v => setInverse(v === 'inv')}
        options={[{ value: 'dir', label: 'Diretamente proporcional' }, { value: 'inv', label: 'Inversamente proporcional' }]} />
      <div className="grid max-w-md grid-cols-[1fr_auto_1fr] items-end gap-3">
        <Field id="r3a" label="Se" value={a} onChange={setA} inputMode="decimal" />
        <span className="pb-3 text-slate-400">→</span>
        <Field id="r3b" label="corresponde a" value={b} onChange={setB} inputMode="decimal" />
        <Field id="r3c" label="então" value={c} onChange={setC} inputMode="decimal" />
        <span className="pb-3 text-slate-400">→</span>
        <div>
          <p className={labelCls}>corresponde a</p>
          <p className="rounded-lg border border-indigo-500/50 bg-slate-950 px-3 py-2.5 font-semibold text-slate-50 tabular-nums">{ok ? fmt(ruleOfThree(A, B, C, inverse)) : '—'}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {inverse ? 'Inversa: quando um aumenta, o outro diminui (ex.: mais pedreiros, menos dias de obra).' : 'Direta: os dois aumentam juntos (ex.: mais quilos, maior preço).'}
      </p>
    </div>
  );
};

export const RomanTool: React.FC = () => {
  const [value, setValue] = useState('2026');
  let label = '';
  let out = '';
  let error = '';
  const v = value.trim();
  try {
    if (/^\d+$/.test(v)) { label = 'Em romanos'; out = toRoman(Number(v)); }
    else if (v) { label = 'Em números'; out = String(fromRoman(v)); }
  } catch (e: any) { error = e?.message || 'Valor inválido.'; }
  return (
    <div className="space-y-5">
      <Field id="roman" label="Número ou romano (converte nos dois sentidos)" value={value} onChange={setValue} className="max-w-sm" />
      {error ? <Result tone="error">{error}</Result> : out && <BigResult label={label} value={out} />}
    </div>
  );
};

export const NumberTheoryTool: React.FC = () => {
  const [mode, setMode] = useState<'mdc' | 'fatorar' | 'divisao'>('mdc');
  const [list, setList] = useState('12, 18, 30');
  const [n, setN] = useState('360');
  const [a, setA] = useState('17');
  const [b, setB] = useState('5');
  const nums = parseIntList(list);
  let content: React.ReactNode = null;
  try {
    if (mode === 'mdc') {
      content = nums.length >= 2
        ? <div className="grid gap-3 sm:grid-cols-2"><BigResult label="MDC" value={String(gcdAll(nums))} /><BigResult label="MMC" value={String(lcmAll(nums))} /></div>
        : <Result>Digite pelo menos dois números inteiros.</Result>;
    } else if (mode === 'fatorar') {
      const f = factorize(Number(n.replace(/\D/g, '')));
      const sup = (p: number) => String(p).split('').map(ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(ch)]).join('');
      content = <BigResult label={f.length === 1 && f[0].power === 1 ? 'É primo' : 'Fatores primos'} value={f.map(x => (x.power > 1 ? `${x.prime}${sup(x.power)}` : String(x.prime))).join(' × ')} />;
    } else {
      const r = divide(parseInt(a, 10), parseInt(b, 10));
      content = <div className="grid gap-3 sm:grid-cols-2"><BigResult label="Quociente" value={String(r.quotient)} /><BigResult label="Resto" value={String(r.remainder)} /></div>;
    }
  } catch (e: any) {
    content = <Result tone="error">{e?.message || 'Valor inválido.'}</Result>;
  }
  return (
    <div className="space-y-5">
      <Segmented label="Cálculo" value={mode} onChange={setMode} options={[{ value: 'mdc', label: 'MDC e MMC' }, { value: 'fatorar', label: 'Fatorar' }, { value: 'divisao', label: 'Resto da divisão' }]} />
      {mode === 'mdc' && <Field id="nt-list" label="Números (separados por vírgula ou espaço)" value={list} onChange={setList} className="max-w-md" />}
      {mode === 'fatorar' && <Field id="nt-n" label="Número" value={n} onChange={setN} inputMode="numeric" className="max-w-xs" />}
      {mode === 'divisao' && (
        <div className="flex flex-wrap gap-4">
          <Field id="nt-a" label="Dividendo" value={a} onChange={setA} inputMode="numeric" className="w-36" />
          <Field id="nt-b" label="Divisor" value={b} onChange={setB} inputMode="numeric" className="w-36" />
        </div>
      )}
      {content}
    </div>
  );
};

export const AreaTool: React.FC = () => {
  const [shapeId, setShapeId] = useState(SHAPES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const shape = SHAPES.find(s => s.id === shapeId)!;
  const parsed: Record<string, number> = {};
  shape.fields.forEach(f => (parsed[f.id] = parseNum(values[f.id] ?? '')));
  const allFilled = shape.fields.every(f => isFinite(parsed[f.id]) && parsed[f.id] > 0);
  const area = allFilled ? shape.area(parsed) : NaN;
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="shape" className={labelCls}>Figura</label>
        <select id="shape" value={shapeId} onChange={e => setShapeId(e.target.value)} className={`${inputCls} sm:w-72`}>
          {SHAPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        {shape.fields.map(f => (
          <Field key={`${shapeId}-${f.id}`} id={`area-${f.id}`} label={f.label} value={values[f.id] ?? ''} inputMode="decimal"
            onChange={v => setValues(x => ({ ...x, [f.id]: v }))} className="w-40" />
        ))}
      </div>
      {allFilled && isFinite(area) && area >= 0 ? <BigResult label="Área (na unidade usada, ao quadrado)" value={fmt(area, 4)} /> : <Result>Preencha os campos com valores positivos.</Result>}
    </div>
  );
};

export const DatesTool: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<'between' | 'add'>('between');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today.slice(0, 4) + '-12-31');
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState<'days' | 'business' | 'months'>('days');
  const [subtract, setSubtract] = useState(false);

  let content: React.ReactNode = null;
  if (mode === 'between' && from && to) {
    const r = daysBetween(from, to);
    content = (
      <div className="grid gap-3 sm:grid-cols-3">
        <BigResult label="Dias corridos" value={fmt(r.days)} />
        <BigResult label="Dias úteis" value={fmt(r.businessDays)} />
        <BigResult label="Semanas / meses" value={`${fmt(r.weeks)} sem. · ${fmt(r.months)} meses`} />
      </div>
    );
  } else if (mode === 'add' && from) {
    const n = (parseInt(amount, 10) || 0) * (subtract ? -1 : 1);
    const result = unit === 'months' ? addMonths(from, n) : addDays(from, n, unit === 'business');
    content = <BigResult label="Resultado" value={describeDate(result)} />;
  }

  return (
    <div className="space-y-5">
      <Segmented label="Cálculo" value={mode} onChange={setMode} options={[{ value: 'between', label: 'Dias entre datas' }, { value: 'add', label: 'Somar ou subtrair' }]} />
      <div className="flex flex-wrap items-end gap-4">
        <Field id="dt-from" type="date" label={mode === 'between' ? 'De' : 'Data'} value={from} onChange={setFrom} className="w-48" />
        {mode === 'between' ? (
          <Field id="dt-to" type="date" label="Até" value={to} onChange={setTo} className="w-48" />
        ) : (
          <>
            <Field id="dt-n" label="Quantidade" value={amount} onChange={setAmount} inputMode="numeric" className="w-28" />
            <Segmented label="Unidade" value={unit} onChange={setUnit} options={[{ value: 'days', label: 'Dias' }, { value: 'business', label: 'Dias úteis' }, { value: 'months', label: 'Meses' }]} />
            <Toggle checked={subtract} onChange={setSubtract}>Subtrair</Toggle>
          </>
        )}
      </div>
      {content}
      <p className="text-xs text-slate-500">Dias úteis descontam fins de semana e feriados nacionais (incluindo Carnaval, Sexta-feira Santa e Corpus Christi). Feriados municipais não entram.</p>
    </div>
  );
};
