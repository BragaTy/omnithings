import React, { useMemo, useState } from 'react';
import { brl, brlCompact, monthLabel } from '../../finance/analysis';

interface Point {
  month: string;
  income: number;
  expense: number;
}

interface MonthlyChartProps {
  data: Point[];
  selected: string;
  onSelect: (month: string) => void;
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 56 };

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Bar with 4px rounded top corners, square at the baseline
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export const MonthlyChart: React.FC<MonthlyChartProps> = ({ data, selected, onSelect }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const max = useMemo(() => niceMax(Math.max(1, ...data.map(d => Math.max(d.income, d.expense)))), [data]);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(22, (slot - 10) / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  const last = data.length - 1;

  const hovered = hover !== null ? data[hover] : null;

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <ul className="flex items-center gap-4 text-sm text-slate-300" aria-label="Legenda">
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-series-in)' }} aria-hidden="true" />
            Entradas
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-series-out)' }} aria-hidden="true" />
            Saídas
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setShowTable(v => !v)}
          className="text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-4 decoration-indigo-300/40"
        >
          {showTable ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">Mês</th>
                <th className="py-2 pr-4 font-medium text-right">Entradas</th>
                <th className="py-2 pr-4 font-medium text-right">Saídas</th>
                <th className="py-2 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.month} className="border-b border-slate-800/60">
                  <td className="py-2 pr-4 text-slate-200">{monthLabel(d.month)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{brl.format(d.income)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{brl.format(d.expense)}</td>
                  <td className="py-2 text-right text-slate-100">{brl.format(d.income - d.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
            role="img"
            aria-label="Entradas e saídas por mês"
            onMouseLeave={() => setHover(null)}
          >
            {/* Gridlines + y labels */}
            {ticks.map(t => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--color-slate-600)' : 'var(--color-slate-800)'} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-slate-400)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t === 0 ? '0' : brlCompact.format(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const isSel = d.month === selected;
              return (
                <g key={d.month}>
                  {(isSel || hover === i) && (
                    <rect x={PAD.left + slot * i + 2} y={PAD.top} width={slot - 4} height={plotH} rx={6} fill="var(--color-slate-800)" opacity={isSel ? 0.7 : 0.4} />
                  )}
                  <path d={barPath(cx - barW - 1, y(d.income), barW, PAD.top + plotH - y(d.income))} fill="var(--color-series-in)" />
                  <path d={barPath(cx + 1, y(d.expense), barW, PAD.top + plotH - y(d.expense))} fill="var(--color-series-out)" />
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={isSel ? 'var(--color-slate-100)' : 'var(--color-slate-400)'} fontWeight={isSel ? 600 : 400}>
                    {monthLabel(d.month)}
                  </text>
                  {/* Selective direct labels: latest month only */}
                  {i === last && hover === null && (
                    <>
                      <text x={cx - barW / 2 - 1} y={y(d.income) - 5} textAnchor="middle" fontSize="10" fill="var(--color-slate-200)">{brlCompact.format(d.income)}</text>
                      <text x={cx + barW / 2 + 1} y={y(d.expense) - 5} textAnchor="middle" fontSize="10" fill="var(--color-slate-200)">{brlCompact.format(d.expense)}</text>
                    </>
                  )}
                  {/* Hit target larger than the bars */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH + PAD.bottom}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)}
                    onClick={() => onSelect(d.month)}
                  />
                </g>
              );
            })}
          </svg>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm shadow-lg"
              style={{
                left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`,
                transform: hover > data.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
              }}
            >
              <p className="font-semibold text-slate-100 mb-1">{monthLabel(hovered.month, true)}</p>
              <p className="flex items-center gap-2 text-slate-300 tabular-nums">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--color-series-in)' }} />
                Entradas <span className="ml-auto pl-4 text-slate-100">{brl.format(hovered.income)}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-300 tabular-nums">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--color-series-out)' }} />
                Saídas <span className="ml-auto pl-4 text-slate-100">{brl.format(hovered.expense)}</span>
              </p>
              <p className="mt-1 pt-1 border-t border-slate-800 flex text-slate-300 tabular-nums">
                Saldo <span className="ml-auto pl-4 text-slate-100">{brl.format(hovered.income - hovered.expense)}</span>
              </p>
            </div>
          )}
        </div>
      )}
      <figcaption className="sr-only">Clique em um mês para ver os detalhes dele.</figcaption>
    </figure>
  );
};
