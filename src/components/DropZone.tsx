import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, Image as ImageIcon, FileText, Music, Archive, Plus } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isCompact?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected, isCompact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allow pasting files from clipboard (e.g. screenshots or copied files)
  useEffect(() => {
    // Only the main drop zone listens; otherwise each paste adds the files twice
    if (isCompact) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const pastedFiles = Array.from(e.clipboardData.files);
        onFilesSelected(pastedFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected, isCompact]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      // reset so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  if (isCompact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-indigo-400 bg-indigo-500/10'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="flex items-center justify-center gap-3 text-slate-300">
          <Plus className="w-5 h-5 text-indigo-300" aria-hidden="true" />
          <span className="font-medium text-sm">
            Adicionar mais arquivos
          </span>
        </div>
      </div>
    );
  }

  const groups: { label: string; icon: React.ReactNode; exts: string }[] = [
    { label: 'Imagens', icon: <ImageIcon className="w-4 h-4 text-pink-300" />, exts: 'png jpg webp svg ico bmp gif' },
    { label: 'Documentos', icon: <FileText className="w-4 h-4 text-sky-300" />, exts: 'pdf docx doc odt rtf md html txt' },
    { label: 'Dados', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-300" />, exts: 'csv xlsx xls json yaml xml' },
    { label: 'Áudio', icon: <Music className="w-4 h-4 text-purple-300" />, exts: 'mp3 wav ogg m4a flac' },
    { label: 'Arquivos', icon: <Archive className="w-4 h-4 text-amber-300" />, exts: 'zip' },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Selecionar arquivos para converter"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      className={`rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
        isDragging
          ? 'border-indigo-400 bg-indigo-600/10'
          : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-900'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="grid gap-8 px-6 py-10 sm:px-10 sm:py-12 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-5">
          <UploadCloud className={`w-10 h-10 shrink-0 ${isDragging ? 'text-indigo-300' : 'text-slate-400'}`} aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-bold text-slate-50">
              {isDragging ? 'Pode soltar' : 'Arraste arquivos para cá'}
            </h2>
            <p className="mt-1.5 text-slate-400">
              Ou clique para escolher no computador. Também dá para colar com{' '}
              <kbd className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-xs text-slate-200">Ctrl</kbd>
              {' + '}
              <kbd className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-xs text-slate-200">V</kbd>.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center justify-center gap-2 self-start md:self-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
          Escolher arquivos
        </span>
      </div>

      <ul className="grid gap-x-8 gap-y-2 border-t border-slate-800 px-6 py-5 sm:px-10 sm:grid-cols-2 lg:grid-cols-5 text-sm">
        {groups.map(g => (
          <li key={g.label} className="flex items-start gap-2">
            <span className="mt-0.5" aria-hidden="true">{g.icon}</span>
            <span>
              <span className="text-slate-200">{g.label}</span>
              <span className="block font-mono text-xs text-slate-500">{g.exts}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
