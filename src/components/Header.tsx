import React from 'react';
import { ArrowLeftRight, FileText, Video, Wallet, Wrench } from 'lucide-react';

export type AppViewMode = 'finance' | 'converter' | 'pdf' | 'media' | 'tools';

interface HeaderProps {
  currentView: AppViewMode;
  onSelectView: (view: AppViewMode) => void;
}

const TABS: { id: AppViewMode; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'finance', label: 'Finanças', short: 'Finanças', icon: <Wallet className="w-4 h-4 shrink-0" /> },
  { id: 'converter', label: 'Converter', short: 'Converter', icon: <ArrowLeftRight className="w-4 h-4 shrink-0" /> },
  { id: 'pdf', label: 'Ferramentas PDF', short: 'PDF', icon: <FileText className="w-4 h-4 shrink-0" /> },
  { id: 'media', label: 'Vídeo e áudio', short: 'Mídia', icon: <Video className="w-4 h-4 shrink-0" /> },
  { id: 'tools', label: 'Utilitários', short: 'Úteis', icon: <Wrench className="w-4 h-4 shrink-0" /> },
];

export const Header: React.FC<HeaderProps> = ({ currentView, onSelectView }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto lg:h-16 py-3 lg:py-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectView('finance')}
          className="flex items-center gap-2.5 self-start lg:self-auto"
          aria-label="OmniThings, página inicial"
        >
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--color-indigo-600)" />
            <circle cx="11" cy="11" r="3.2" fill="#fff" />
            <circle cx="21" cy="11" r="3.2" fill="none" stroke="#fff" strokeWidth="2.2" />
            <rect x="7.8" y="18" width="6.4" height="6.4" rx="1.6" fill="none" stroke="#fff" strokeWidth="2.2" />
            <rect x="17.8" y="18" width="6.4" height="6.4" rx="1.6" fill="#f4c247" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-slate-50">OmniThings</span>
        </button>

        <nav aria-label="Seções" className="grid grid-cols-5 gap-1 lg:flex lg:items-center">
          {TABS.map(tab => {
            const active = currentView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'text-slate-50 bg-slate-900 lg:bg-transparent'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                {tab.icon}
                <span className="md:hidden">{tab.short}</span>
                <span className="hidden md:inline">{tab.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] hidden lg:block h-0.5 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
