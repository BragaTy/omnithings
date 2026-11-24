import React from 'react';

// Plain, scannable facts instead of a card grid
const FACTS = [
  {
    title: 'Seus arquivos não saem do computador',
    description: 'A conversão acontece na memória do navegador. Nenhum upload, nenhuma cópia em servidor.',
  },
  {
    title: 'Sem fila, sem limite diário',
    description: 'Não há contador, cadastro ou plano pago. A velocidade depende só do seu aparelho.',
  },
  {
    title: 'Só formatos que fazem sentido',
    description: 'O tipo do arquivo é detectado sozinho e você vê apenas os destinos que funcionam para ele.',
  },
  {
    title: 'Vários de uma vez',
    description: 'Converta dezenas de arquivos juntos e baixe tudo num único .zip.',
  },
];

export const FeaturesBanner: React.FC = () => {
  return (
    <section aria-labelledby="why-title" className="border-t border-slate-800 pt-12">
      <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
        <h2 id="why-title" className="text-2xl sm:text-3xl font-bold text-slate-50 leading-tight">
          Por que converter aqui
        </h2>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {FACTS.map(fact => (
            <div key={fact.title} className="border-l-2 border-slate-700 pl-4">
              <dt className="font-semibold text-slate-100">{fact.title}</dt>
              <dd className="mt-1.5 text-sm text-slate-400 leading-relaxed">{fact.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
