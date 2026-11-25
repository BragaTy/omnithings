// Finance data lives only in this browser (localStorage). Nothing is uploaded.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FinanceData, RawTransaction, Transaction } from './types';
import { categorize, merchantKey, normalizeText, INCOME, INTERNAL } from './categories';

const STORAGE_KEY = 'omnithings.finance.v1';
const EMPTY: FinanceData = { transactions: [], rules: {}, budgets: {} };

function load(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      rules: parsed.rules && typeof parsed.rules === 'object' ? parsed.rules : {},
      budgets: parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : {},
    };
  } catch {
    return EMPTY;
  }
}

function save(data: FinanceData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Builds stable ids so re-importing the same statement doesn't duplicate anything. */
export function toTransactions(rows: RawTransaction[], source: string, invertSign: boolean, rules: Record<string, string>): Transaction[] {
  const seen = new Map<string, number>();
  return rows.map(r => {
    const amount = Math.round((invertSign ? -r.amount : r.amount) * 100) / 100;
    const base = r.fitid
      ? `fit:${r.fitid}|${r.date}|${amount.toFixed(2)}`
      : `${r.date}|${amount.toFixed(2)}|${normalizeText(r.description)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return {
      id: `${base}|${n}`,
      date: r.date,
      description: r.description,
      amount,
      category: categorize(r.description, amount, rules),
      source,
    };
  });
}

export function useFinanceStore() {
  const [data, setData] = useState<FinanceData>(load);
  const [saveFailed, setSaveFailed] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setSaveFailed(!save(data));
  }, [data]);

  const addTransactions = useCallback((incoming: Transaction[]): { added: number; skipped: number } => {
    // Count against the current data (React may run updaters later or twice)
    const existing = new Set(dataRef.current.transactions.map(t => t.id));
    const unique = new Set<string>();
    const fresh = incoming.filter(t => {
      if (existing.has(t.id) || unique.has(t.id)) return false;
      unique.add(t.id);
      return true;
    });
    setData(prev => {
      const ids = new Set(prev.transactions.map(t => t.id));
      const toAdd = fresh.filter(t => !ids.has(t.id));
      const transactions = [...prev.transactions, ...toAdd].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return { ...prev, transactions };
    });
    return { added: fresh.length, skipped: incoming.length - fresh.length };
  }, []);

  /** Changes one transaction and teaches the rule to every similar one not set by hand. */
  const setCategory = useCallback((id: string, category: string) => {
    setData(prev => {
      const target = prev.transactions.find(t => t.id === id);
      if (!target) return prev;
      const key = merchantKey(target.description);
      const sameSign = (t: Transaction) => Math.sign(t.amount) === Math.sign(target.amount);
      const transactions = prev.transactions.map(t => {
        if (t.id === id) return { ...t, category, manual: true };
        if (!t.manual && sameSign(t) && merchantKey(t.description) === key) return { ...t, category };
        return t;
      });
      return { ...prev, transactions, rules: { ...prev.rules, [key]: category } };
    });
  }, []);

  const setBudget = useCallback((category: string, value: number | null) => {
    setData(prev => {
      const budgets = { ...prev.budgets };
      if (value && value > 0) budgets[category] = value;
      else delete budgets[category];
      return { ...prev, budgets };
    });
  }, []);

  const removeSource = useCallback((source: string) => {
    setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.source !== source) }));
  }, []);

  const clearAll = useCallback(() => setData(EMPTY), []);

  return { data, saveFailed, addTransactions, setCategory, setBudget, removeSource, clearAll };
}

/** Four months of believable sample data to explore the dashboard. */
export function sampleTransactions(): Transaction[] {
  const today = new Date();
  const rows: RawTransaction[] = [];
  const day = (monthsAgo: number, d: number) => {
    const dt = new Date(today.getFullYear(), today.getMonth() - monthsAgo, d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  for (let m = 3; m >= 0; m--) {
    const v = (base: number, spread: number) => Math.round((base + (Math.sin(m * 7 + base) * spread)) * 100) / 100;
    rows.push(
      { date: day(m, 5), description: 'SALARIO EMPRESA EXEMPLO LTDA', amount: 6200 },
      { date: day(m, 6), description: 'Aluguel apartamento', amount: -1850 },
      { date: day(m, 8), description: 'ENEL DISTRIBUICAO', amount: -v(168, 30) },
      { date: day(m, 9), description: 'SABESP', amount: -v(92, 12) },
      { date: day(m, 10), description: 'VIVO FIBRA', amount: -119.9 },
      { date: day(m, 11), description: 'NETFLIX.COM', amount: -44.9 },
      { date: day(m, 11), description: 'SPOTIFY', amount: -21.9 },
      { date: day(m, 12), description: 'SMART FIT', amount: -119.9 },
      { date: day(m, 7), description: 'CARREFOUR SUPERMERCADO', amount: -v(420, 80) },
      { date: day(m, 21), description: 'ASSAI ATACADISTA', amount: -v(310, 60) },
      { date: day(m, 13), description: 'IFOOD *RESTAURANTE', amount: -v(68, 20) },
      { date: day(m, 19), description: 'IFOOD *PIZZARIA', amount: -v(84, 20) },
      { date: day(m, 24), description: 'PADARIA PAO QUENTE', amount: -v(32, 8) },
      { date: day(m, 14), description: 'UBER *TRIP', amount: -v(27, 9) },
      { date: day(m, 22), description: 'UBER *TRIP', amount: -v(34, 9) },
      { date: day(m, 16), description: 'POSTO IPIRANGA', amount: -v(210, 40) },
      { date: day(m, 18), description: 'DROGASIL', amount: -v(56, 25) },
      { date: day(m, 20), description: 'MERCADO LIVRE', amount: -v(140, 90) },
      { date: day(m, 26), description: 'Pix enviado - Maria Souza', amount: -v(150, 50) },
      { date: day(m, 27), description: 'Aplicacao RDB', amount: -500 },
    );
    if (m % 2 === 0) rows.push({ date: day(m, 15), description: 'CINEMARK', amount: -v(64, 10) });
    if (m === 1) rows.push({ date: day(m, 17), description: 'Pix recebido - freela site', amount: 1200 });
  }
  return toTransactions(rows, 'Dados de exemplo', false, {});
}

export { INCOME, INTERNAL };
