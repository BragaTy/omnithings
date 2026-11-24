import React from 'react';
import { ArrowLeftRight, FileText, Video } from 'lucide-react';

export type AppViewMode = 'converter' | 'pdf' | 'media';

interface HeaderProps {
  currentView: AppViewMode;
  onSelectView: (view: AppViewMode) => void;
}

const TABS: { id: AppViewMode; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'converter', label: 'Converter', short: 'Converter', icon: <ArrowLeftRight className="w-4 h-4 shrink-0" /> },
  { id: 'pdf', label: 'Ferramentas PDF', short: 'PDF', icon: <FileText className="w-4 h-4 shrink-0" /> },
  { id: 'media', label: 'Vídeo e áudio', short: 'Mídia', icon: <Video className="w-4 h-4 shrink-0" /> },
];

export const Header: React.FC<HeaderProps> = ({ currentView, onSelectView }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <a href="./" className="flex items-center gap-2.5 self-start md:self-auto" aria-label="OmniConvert, página inicial">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--color-indigo-600)" />
            <path d="M8 12h14l-4-4M24 20H10l4 4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-slate-50">OmniConvert</span>
        </a>

        <nav aria-label="Seções" className="grid grid-cols-3 gap-1 md:flex md:items-center">
          {TABS.map(tab => {
            const active = currentView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'text-slate-50 bg-slate-900 md:bg-transparent'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                {tab.icon}
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] hidden md:block h-0.5 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
