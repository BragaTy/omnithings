import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-8 border-t border-slate-800 py-8 text-sm text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p>
          <span className="font-display font-bold text-slate-200">OmniConvert</span>
          <span className="mx-2 text-slate-600" aria-hidden="true">/</span>
          Conversão de arquivos que roda no seu navegador.
        </p>
        <p className="text-slate-500">Nenhum arquivo é enviado, salvo ou compartilhado.</p>
      </div>
    </footer>
  );
};
