import React, { useEffect, useState } from 'react';

// Real conversions the app supports — the page opens with the product itself
const PAIRS: [string, string][] = [
  ['csv', 'xlsx'],
  ['pdf', 'docx'],
  ['png', 'webp'],
  ['json', 'yaml'],
  ['docx', 'pdf'],
  ['mov', 'mp4'],
  ['md', 'html'],
  ['mp4', 'mp3'],
  ['xml', 'csv'],
  ['jpg', 'ico'],
];

interface ConversionHeroProps {
  onTrySample: (type: 'csv' | 'json' | 'image' | 'markdown') => void;
}

export const ConversionHero: React.FC<ConversionHeroProps> = ({ onTrySample }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => setIndex(i => (i + 1) % PAIRS.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  const [from, to] = PAIRS[index];

  return (
    <section className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end pt-2">
      <div className="max-w-xl">
        <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.02] text-slate-50">
          Solte o arquivo. Escolha o formato. Pronto.
        </h1>
        <p className="mt-5 text-slate-300 text-base sm:text-lg leading-relaxed max-w-[34rem]">
          Imagens, PDFs, planilhas, documentos, vídeos e áudio convertidos aqui mesmo no seu navegador.
          Nada é enviado para servidor nenhum.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-slate-400">Sem arquivo à mão? Teste com:</span>
          {([
            ['csv', 'uma planilha CSV'],
            ['json', 'um JSON'],
            ['markdown', 'um Markdown'],
            ['image', 'uma imagem SVG'],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => onTrySample(type)}
              className="text-indigo-300 underline decoration-indigo-300/40 underline-offset-4 hover:text-indigo-200 hover:decoration-indigo-200"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The one bold element: a live conversion slip */}
      <div aria-hidden="true" className="select-none font-mono leading-none">
        <div className="flex items-baseline gap-4 sm:gap-6 text-5xl sm:text-7xl font-bold">
          <span key={`f-${index}`} className="ext-swap text-slate-400">.{from}</span>
          <svg viewBox="0 0 48 24" className="w-10 sm:w-14 h-auto text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h42M34 3l10 9-10 9" />
          </svg>
          <span
            key={`t-${index}`}
            className="ext-swap rounded-md bg-highlight px-3 pb-1 pt-2 text-ink"
            style={{ animationDelay: '120ms' }}
          >
            .{to}
          </span>
        </div>
      </div>
      <p className="sr-only">Exemplos de conversões: CSV para XLSX, PDF para DOCX, PNG para WEBP, JSON para YAML.</p>
    </section>
  );
};
