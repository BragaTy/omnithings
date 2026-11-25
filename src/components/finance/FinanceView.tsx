import React, { useMemo, useRef, useState } from 'react';
import { Upload, Trash2, Download, Search, ShieldCheck, X } from 'lucide-react';
import { useFinanceStore, toTransactions, sampleTransactions } from '../../finance/store';
import { parseStatementFile } from '../../finance/parsers';
import {
  listMonths, summarizeMonth, spendingByCategory, monthlySeries, detectRecurring, previousMonth,
  brl, monthLabel, formatDate, monthOf,
} from '../../finance/analysis';
import { ALL_CATEGORIES, INTERNAL } from '../../finance/categories';
import { ParsedStatement } from '../../finance/types';
import { MonthlyChart } from './MonthlyChart';
import { downloadBlob } from '../../utils/fileHelpers';

interface PendingImport {
  statement: ParsedStatement;
  invert: boolean;
}

export const FinanceView: React.FC = () => {
  const { data, saveFailed, addTransactions, setCategory, setBudget, removeSource, clearAll } = useFinanceStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const txs = data.transactions;
  const months = useMemo(() => listMonths(txs), [txs]);
  const month = selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[0];

  const summary = useMemo(() => (month ? summarizeMonth(txs, month) : null), [txs, month]);
  const prevSummary = useMemo(() => (month ? summarizeMonth(txs, previousMonth(month)) : null), [txs, month]);
  const categories = useMemo(() => (month ? spendingByCategory(txs, month) : []), [txs, month]);
  const series = useMemo(() => (months[0] ? monthlySeries(txs, months[0], 12) : []), [txs, months]);
  const recurring = useMemo(() => detectRecurring(txs), [txs]);
  const sources = useMemo(() => Array.from(new Set(txs.map(t => t.source))), [txs]);

  const monthTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs.filter(t =>
      monthOf(t.date) === month &&
      (!categoryFilter || t.category === categoryFilter) &&
      (!q || t.description.toLowerCase().includes(q))
    );
  }, [txs, month, search, categoryFilter]);

  // ------------------------------------------------------------------ import
  const handleFiles = async (files: File[]) => {
    setImportErrors([]);
    setNotice(null);
    const errors: string[] = [];
    const parsed: PendingImport[] = [];
    for (const file of files) {
      try {
        const statement = await parseStatementFile(file);
        parsed.push({ statement, invert: statement.looksLikeCardBill });
      } catch (e: any) {
        errors.push(`${file.name}: ${e?.message || 'não foi possível ler o arquivo.'}`);
      }
    }
    setPending(prev => [...prev, ...parsed]);
    setImportErrors(errors);
  };

  const confirmImport = () => {
    let added = 0;
    let skipped = 0;
    for (const p of pending) {
      const res = addTransactions(toTransactions(p.statement.rows, p.statement.source, p.invert, data.rules));
      added += res.added;
      skipped += res.skipped;
    }
    setPending([]);
    setSelectedMonth(null);
    setNotice(
      `${added} lançamento${added === 1 ? '' : 's'} importado${added === 1 ? '' : 's'}` +
      (skipped ? `. ${skipped} já existia${skipped === 1 ? '' : 'm'} e ${skipped === 1 ? 'foi ignorado' : 'foram ignorados'}.` : '.')
    );
  };

  const exportCsv = () => {
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = ['Data;Descrição;Categoria;Valor;Arquivo'];
    for (const t of [...txs].reverse()) {
      lines.push([formatDate(t.date), esc(t.description), esc(t.category), t.amount.toFixed(2).replace('.', ','), esc(t.source)].join(';'));
    }
    downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'omnithings-lancamentos.csv');
  };

  const confirmClear = () => {
    if (window.confirm('Apagar todos os lançamentos, categorias aprendidas e metas deste navegador? Não dá para desfazer.')) {
      clearAll();
      setNotice('Todos os dados foram apagados.');
    }
  };

  const fileInputEl = (
    <input
      ref={fileInput}
      type="file"
      multiple
      accept=".csv,.ofx,.qfx,.xlsx,.xls,.ods,.txt"
      className="hidden"
      onChange={e => {
        if (e.target.files?.length) handleFiles(Array.from(e.target.files));
        e.target.value = '';
      }}
    />
  );

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
    },
  };

  // ------------------------------------------------------------------ render
  return (
    <div className="space-y-10" {...dropProps}>
      {fileInputEl}

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-50 leading-[1.05]">
            {month ? `Suas finanças em ${monthLabel(month, true)}` : 'Para onde vai o seu dinheiro'}
          </h1>
          <p className="mt-3 text-slate-300">
            Importe o extrato da conta ou a fatura do cartão e veja seus gastos organizados por categoria.
          </p>
        </div>
        {txs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="month-select">Mês</label>
            <select
              id="month-select"
              value={month}
              onChange={e => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
            >
              {months.map(m => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Importar extrato
            </button>
          </div>
        )}
      </header>

      {saveFailed && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          O navegador não deixou salvar os dados (modo anônimo ou armazenamento cheio). Eles somem ao fechar a página.
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="text-slate-400 hover:text-slate-100">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}
      {importErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 space-y-1">
          {importErrors.map(e => <p key={e}>{e}</p>)}
        </div>
      )}

      {pending.length > 0 && (
        <ImportReview
          pending={pending}
          onToggle={i => setPending(prev => prev.map((p, idx) => (idx === i ? { ...p, invert: !p.invert } : p)))}
          onRemove={i => setPending(prev => prev.filter((_, idx) => idx !== i))}
          onConfirm={confirmImport}
          onCancel={() => setPending([])}
        />
      )}

      {txs.length === 0 && pending.length === 0 ? (
        <EmptyState
          isDragging={isDragging}
          onPick={() => fileInput.current?.click()}
          onSample={() => addTransactions(sampleTransactions())}
        />
      ) : month && summary && (
        <>
          {/* Stat tiles */}
          <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Entradas" value={summary.income} previous={prevSummary?.income} goodWhenUp />
            <StatTile label="Saídas" value={summary.expense} previous={prevSummary?.expense} goodWhenUp={false} />
            <StatTile label="Saldo do mês" value={summary.net} emphasize />
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
            <section aria-labelledby="cat-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 id="cat-title" className="text-xl font-bold text-slate-50">Gastos por categoria</h2>
              <p className="mt-1 text-sm text-slate-400">Toque em “meta” para definir um limite mensal.</p>
              <CategoryBreakdown
                items={categories}
                budgets={data.budgets}
                onBudget={setBudget}
                onFilter={c => setCategoryFilter(c)}
              />
            </section>

            <section aria-labelledby="trend-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 id="trend-title" className="text-xl font-bold text-slate-50 mb-4">Entradas e saídas por mês</h2>
              <MonthlyChart data={series} selected={month} onSelect={setSelectedMonth} />
            </section>
          </div>

          {recurring.length > 0 && (
            <section aria-labelledby="rec-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="rec-title" className="text-xl font-bold text-slate-50">Contas fixas e assinaturas</h2>
                <p className="text-sm text-slate-400 tabular-nums">
                  {brl.format(recurring.reduce((a, r) => a + r.average, 0))} por mês · {brl.format(recurring.reduce((a, r) => a + r.average, 0) * 12)} por ano
                </p>
              </div>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {recurring.map(r => (
                  <li key={r.key} className="flex items-center justify-between gap-4 border-b border-slate-800 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-100">{r.label}</span>
                      <span className="block text-xs text-slate-400">{r.category} · cobrado em {r.months} meses</span>
                    </span>
                    <span className="tabular-nums text-slate-100">{brl.format(r.average)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TransactionTable
            rows={monthTxs}
            total={txs.filter(t => monthOf(t.date) === month).length}
            search={search}
            onSearch={setSearch}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            onCategory={setCategory}
          />

          <section aria-labelledby="data-title" className="border-t border-slate-800 pt-8">
            <h2 id="data-title" className="text-lg font-bold text-slate-50">Seus dados</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Ficam só neste navegador. Nada é enviado para servidores.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {sources.map(s => (
                <li key={s} className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 pl-3 pr-1 py-1 text-sm text-slate-300">
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSource(s)}
                    aria-label={`Remover os lançamentos de ${s}`}
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900">
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar lançamentos (CSV)
              </button>
              <button type="button" onClick={confirmClear} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Apagar tudo
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ isDragging: boolean; onPick: () => void; onSample: () => void }> = ({ isDragging, onPick, onSample }) => (
  <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
      className={`rounded-xl border-2 border-dashed p-8 sm:p-10 cursor-pointer transition-colors ${
        isDragging ? 'border-indigo-400 bg-indigo-600/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-900'
      }`}
    >
      <Upload className="w-9 h-9 text-slate-400" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-bold text-slate-50">Arraste o extrato para cá</h2>
      <p className="mt-2 text-slate-400">
        Aceita CSV, OFX e Excel exportados pelo app ou site do banco. Pode mandar vários de uma vez.
      </p>
      <span className="mt-6 inline-flex rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Escolher arquivos</span>
    </div>

    <div className="space-y-5 text-sm text-slate-300">
      <div>
        <h3 className="font-semibold text-slate-100">Onde achar o arquivo</h3>
        <ul className="mt-2 space-y-1.5 text-slate-400">
          <li><span className="text-slate-200">Nubank:</span> app › Conta ou Cartão › extrato/fatura › exportar (CSV).</li>
          <li><span className="text-slate-200">Inter, Itaú, Bradesco, Santander, Caixa, BB:</span> internet banking › extrato › salvar em OFX ou Excel.</li>
          <li><span className="text-slate-200">Fatura do cartão:</span> o OmniThings detecta e trata os valores como gastos.</li>
        </ul>
      </div>
      <p className="flex items-start gap-2 text-slate-400">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
        Tudo é lido e guardado só neste navegador. Nenhum dado bancário sai do seu computador.
      </p>
      <button type="button" onClick={onSample} className="text-indigo-300 underline underline-offset-4 decoration-indigo-300/40 hover:text-indigo-200">
        Explorar com dados de exemplo
      </button>
    </div>
  </section>
);

// ---------------------------------------------------------------------------

const ImportReview: React.FC<{
  pending: PendingImport[];
  onToggle: (i: number) => void;
  onRemove: (i: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ pending, onToggle, onRemove, onConfirm, onCancel }) => (
  <section aria-labelledby="review-title" className="rounded-xl border border-indigo-500/40 bg-slate-900 p-5 sm:p-6">
    <h2 id="review-title" className="text-xl font-bold text-slate-50">Confira antes de importar</h2>
    <ul className="mt-4 space-y-4">
      {pending.map((p, i) => {
        const sign = p.invert ? -1 : 1;
        const income = p.statement.rows.reduce((a, r) => a + Math.max(0, sign * r.amount), 0);
        const expense = p.statement.rows.reduce((a, r) => a + Math.max(0, -sign * r.amount), 0);
        const dates = p.statement.rows.map(r => r.date).sort();
        return (
          <li key={`${p.statement.source}-${i}`} className="border-b border-slate-800 pb-4 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate">{p.statement.source}</p>
                <p className="text-sm text-slate-400 tabular-nums">
                  {p.statement.rows.length} lançamentos de {formatDate(dates[0])} a {formatDate(dates[dates.length - 1])} ·
                  entradas {brl.format(income)} · saídas {brl.format(expense)}
                </p>
              </div>
              <button type="button" onClick={() => onRemove(i)} aria-label={`Descartar ${p.statement.source}`} className="p-1 text-slate-500 hover:text-rose-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={p.invert} onChange={() => onToggle(i)} className="h-4 w-4 accent-indigo-500" />
              É fatura de cartão (os valores positivos do arquivo são compras)
            </label>
          </li>
        );
      })}
    </ul>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={onConfirm} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
        Importar {pending.reduce((a, p) => a + p.statement.rows.length, 0)} lançamentos
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
        Cancelar
      </button>
    </div>
  </section>
);

// ---------------------------------------------------------------------------

const StatTile: React.FC<{ label: string; value: number; previous?: number; goodWhenUp?: boolean; emphasize?: boolean }> = ({
  label, value, previous, goodWhenUp, emphasize,
}) => {
  let delta: React.ReactNode = null;
  if (previous !== undefined && previous > 0 && goodWhenUp !== undefined) {
    const pct = ((value - previous) / previous) * 100;
    const up = pct >= 0;
    const good = up === goodWhenUp;
    delta = (
      <p className={`mt-1 text-sm tabular-nums ${Math.abs(pct) < 1 ? 'text-slate-400' : good ? 'text-emerald-300' : 'text-rose-300'}`}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% <span className="text-slate-400">vs. mês anterior</span>
      </p>
    );
  }
  return (
    <div className={`rounded-xl border p-5 ${emphasize ? 'border-slate-700 bg-slate-850' : 'border-slate-800 bg-slate-900'}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${emphasize && value < 0 ? 'text-rose-300' : 'text-slate-50'}`}>
        {brl.format(value)}
      </p>
      {delta}
    </div>
  );
};

// ---------------------------------------------------------------------------

const CategoryBreakdown: React.FC<{
  items: { category: string; total: number; count: number }[];
  budgets: Record<string, number>;
  onBudget: (category: string, value: number | null) => void;
  onFilter: (category: string) => void;
}> = ({ items, budgets, onBudget, onFilter }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (items.length === 0) return <p className="mt-6 text-slate-400">Nenhum gasto neste mês.</p>;
  const total = items.reduce((a, i) => a + i.total, 0);
  const max = Math.max(...items.map(i => Math.max(i.total, budgets[i.category] || 0)));

  return (
    <ul className="mt-5 space-y-4">
      {items.map(item => {
        const budget = budgets[item.category];
        const over = budget !== undefined && item.total > budget;
        const share = (item.total / total) * 100;
        return (
          <li key={item.category}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <button type="button" onClick={() => onFilter(item.category)} className="text-slate-100 hover:underline underline-offset-4 text-left">
                {item.category}
              </button>
              <span className="tabular-nums text-slate-100">
                {brl.format(item.total)} <span className="text-slate-400">· {share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-sm bg-slate-800" title={`${item.category}: ${brl.format(item.total)}`}>
              <div className="h-full rounded-sm" style={{ width: `${(item.total / max) * 100}%`, background: 'var(--color-series-in)' }} />
              {budget !== undefined && (
                <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-slate-100" style={{ left: `${(budget / max) * 100}%` }} aria-hidden="true" />
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs">
              {editing === item.category ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={e => {
                    e.preventDefault();
                    const v = Number(draft.replace(/\./g, '').replace(',', '.'));
                    onBudget(item.category, isFinite(v) && v > 0 ? v : null);
                    setEditing(null);
                  }}
                >
                  <label className="text-slate-400" htmlFor={`budget-${item.category}`}>Meta mensal (R$)</label>
                  <input
                    id={`budget-${item.category}`}
                    autoFocus
                    inputMode="decimal"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  />
                  <button type="submit" className="text-indigo-300 hover:text-indigo-200">Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200">Cancelar</button>
                </form>
              ) : (
                <>
                  {budget !== undefined && (
                    <span className={over ? 'text-rose-300' : 'text-slate-400'}>
                      {over ? `${brl.format(item.total - budget)} acima da meta de ${brl.format(budget)}` : `Meta: ${brl.format(budget)}`}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditing(item.category); setDraft(budget ? String(budget).replace('.', ',') : ''); }}
                    className="text-slate-400 hover:text-slate-100 underline-offset-4 hover:underline"
                  >
                    {budget !== undefined ? 'alterar meta' : 'meta'}
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------------------

const TransactionTable: React.FC<{
  rows: { id: string; date: string; description: string; amount: number; category: string; manual?: boolean }[];
  total: number;
  search: string;
  onSearch: (v: string) => void;
  categoryFilter: string;
  onCategoryFilter: (v: string) => void;
  onCategory: (id: string, category: string) => void;
}> = ({ rows, total, search, onSearch, categoryFilter, onCategoryFilter, onCategory }) => (
  <section aria-labelledby="tx-title">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h2 id="tx-title" className="text-xl font-bold text-slate-50">Lançamentos</h2>
        <p className="text-sm text-slate-400">
          Mudou a categoria de um? Os parecidos mudam junto, e os próximos extratos já vêm certos.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar lançamento"
            className="w-44 rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => onCategoryFilter(e.target.value)}
          aria-label="Filtrar por categoria"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Todas as categorias</option>
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>

    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-slate-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">Data</th>
            <th className="px-4 py-2.5 font-medium">Descrição</th>
            <th className="px-4 py-2.5 font-medium">Categoria</th>
            <th className="px-4 py-2.5 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className="border-t border-slate-800">
              <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">{formatDate(t.date)}</td>
              <td className="px-4 py-2.5 text-slate-100 max-w-[22rem] truncate" title={t.description}>{t.description}</td>
              <td className="px-4 py-2">
                <select
                  value={t.category}
                  onChange={e => onCategory(t.id, e.target.value)}
                  aria-label={`Categoria de ${t.description}`}
                  className={`rounded-md border bg-slate-950 px-2 py-1 text-sm ${
                    t.category === INTERNAL ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${t.amount > 0 ? 'text-emerald-300' : 'text-slate-100'}`}>
                {t.amount > 0 ? '+' : '−'} {brl.format(Math.abs(t.amount))}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                {total === 0 ? 'Nenhum lançamento neste mês.' : 'Nada encontrado com esses filtros.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {rows.some(t => t.category === INTERNAL) && (
      <p className="mt-2 text-xs text-slate-500">
        “{INTERNAL}” (pagamento de fatura, aplicações, resgates) não conta como gasto nem como entrada, para não contar duas vezes.
      </p>
    )}
  </section>
);
