import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder:text-slate-600';
export const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';
export const primaryBtn = 'inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500';
export const secondaryBtn = 'inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const CopyButton: React.FC<{ value: string; label?: string; compact?: boolean }> = ({ value, label = 'Copiar', compact }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      aria-label={compact ? `${label}: ${value}` : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40 ${compact ? 'p-2' : 'px-3 py-2'}`}
    >
      {done ? <Check className="w-4 h-4 text-emerald-300" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      {!compact && (done ? 'Copiado' : label)}
    </button>
  );
};

export const OutputRow: React.FC<{ label?: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center gap-2 border-b border-slate-800 py-2.5 last:border-0">
    <div className="min-w-0 flex-1">
      {label && <p className="text-xs text-slate-400">{label}</p>}
      <p className={`break-all text-slate-100 ${mono ? 'font-mono text-sm' : ''}`}>{value || '—'}</p>
    </div>
    <CopyButton value={value} compact />
  </div>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
    {children}
  </label>
);

// T is inferred from `value` only (NoInfer), so literal unions like 'a' | 'b'
// aren't widened to string by the options array
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: NoInfer<T>; label: string }[];
  onChange: (v: NoInfer<T>) => void;
  label: string;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-700 p-0.5" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${value === o.value ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Field: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; type?: string; className?: string }> = ({
  id, label, value, onChange, placeholder, inputMode, type = 'text', className,
}) => (
  <div className={className}>
    <label htmlFor={id} className={labelCls}>{label}</label>
    <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className={inputCls} />
  </div>
);

export const Result: React.FC<{ children: React.ReactNode; tone?: 'ok' | 'error' | 'neutral' }> = ({ children, tone = 'neutral' }) => (
  <p role="status" className={`text-sm ${tone === 'ok' ? 'text-emerald-300' : tone === 'error' ? 'text-rose-300' : 'text-slate-300'}`}>
    {children}
  </p>
);

export const BigResult: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4">
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 break-words font-display text-2xl font-bold text-slate-50 tabular-nums">{value}</p>
    </div>
    <CopyButton value={value} compact />
  </div>
);
