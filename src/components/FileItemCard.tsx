import React from 'react';
import { 
  FileText, Image as ImageIcon, FileSpreadsheet, Music, Archive, FileQuestion, Film,
  ArrowRight, Settings2, Download, Trash2, Eye, CheckCircle2, AlertCircle, Loader2 
} from 'lucide-react';
import { FileItem, FileCategory } from '../types';
import { getCompatibleTargets } from '../constants/formats';
import { formatBytes } from '../utils/fileHelpers';

interface FileItemCardProps {
  item: FileItem;
  onUpdateTarget: (id: string, target: string) => void;
  onConvert: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenSettings: (item: FileItem) => void;
  onOpenPreview: (item: FileItem) => void;
}

export const FileItemCard: React.FC<FileItemCardProps> = ({
  item,
  onUpdateTarget,
  onConvert,
  onDownload,
  onRemove,
  onOpenSettings,
  onOpenPreview
}) => {
  const compatibleTargets = getCompatibleTargets(item.extension, item.category);

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'image': return <ImageIcon className="w-5 h-5 text-pink-400" />;
      case 'data': return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'document': return <FileText className="w-5 h-5 text-sky-400" />;
      case 'audio': return <Music className="w-5 h-5 text-purple-400" />;
      case 'video': return <Film className="w-5 h-5 text-orange-400" />;
      case 'archive': return <Archive className="w-5 h-5 text-amber-400" />;
      default: return <FileQuestion className="w-5 h-5 text-slate-400" />;
    }
  };

  const getBadgeColor = (category: FileCategory) => {
    switch (category) {
      case 'image': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'data': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'document': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'audio': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'video': return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      case 'archive': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  // Calculate size change percentage if converted
  const sizeDiff = item.resultSize && item.size
    ? Math.round(((item.resultSize - item.size) / item.size) * 100)
    : null;

  return (
    <div className={`rounded-xl border border-l-4 transition-colors p-4 sm:p-5 bg-slate-900 ${
      item.status === 'success'
        ? 'border-slate-800 border-l-emerald-400'
        : item.status === 'error'
        ? 'border-slate-800 border-l-rose-400'
        : item.status === 'converting'
        ? 'border-slate-800 border-l-indigo-400'
        : 'border-slate-800 border-l-slate-700'
    }`}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Thumbnail & File Info */}
        <div className="flex items-center gap-3.5 min-w-0 max-w-full lg:max-w-md">
          {item.previewUrl ? (
            <button
              type="button"
              onClick={() => onOpenPreview(item)}
              aria-label={`Visualizar ${item.name}`}
              className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 cursor-pointer border border-slate-700 hover:opacity-80 transition-opacity"
            >
              <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0">
              {getCategoryIcon(item.category)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-100 truncate" title={item.name}>
                {item.name}
              </span>
              <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(item.category)}`}>
                .{item.extension || '?'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{formatBytes(item.size)}</span>
              {item.status === 'success' && item.resultSize && (
                <>
                  <ArrowRight className="w-3 h-3 text-slate-500" aria-hidden="true" />
                  <span className="text-emerald-300 font-medium">{formatBytes(item.resultSize)}</span>
                  {sizeDiff !== null && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      sizeDiff <= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {sizeDiff <= 0 ? `${sizeDiff}%` : `+${sizeDiff}%`}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Conversion Format Selector */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-400">
            <span className="text-xs text-slate-400 font-mono">.{item.extension || '?'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />

            <select
              value={item.targetFormat}
              disabled={item.status === 'converting'}
              onChange={(e) => onUpdateTarget(item.id, e.target.value)}
              aria-label={`Formato de destino para ${item.name}`}
              className="bg-transparent text-indigo-200 font-semibold text-sm outline-none cursor-pointer focus:ring-0"
            >
              {compatibleTargets.map((opt) => (
                <option key={opt.extension} value={opt.extension} className="bg-slate-900 text-slate-100">
                  {opt.label} ({opt.extension.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Settings Icon */}
          <button
            type="button"
            onClick={() => onOpenSettings(item)}
            title="Ajustes de conversão (qualidade, tamanho, layout)"
            aria-label="Ajustes de conversão"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Preview button */}
          <button
            type="button"
            onClick={() => onOpenPreview(item)}
            title="Visualizar arquivo"
            aria-label="Visualizar arquivo"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          {item.status === 'idle' && (
            <button
              type="button"
              onClick={() => onConvert(item.id)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              Converter
            </button>
          )}

          {item.status === 'converting' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Convertendo...</span>
            </div>
          )}

          {item.status === 'success' && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400 text-xs font-medium mr-1">
                <CheckCircle2 className="w-4 h-4" />
                Concluído
              </span>
              <button
                type="button"
                onClick={() => onDownload(item.id)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
              </button>
            </div>
          )}

          {item.status === 'error' && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-rose-400 text-xs font-medium" title={item.errorMessage}>
                <AlertCircle className="w-4 h-4" />
                Erro
              </span>
              <button
                type="button"
                onClick={() => onConvert(item.id)}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium transition-colors"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {/* Remove item */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            title="Remover da lista"
            aria-label={`Remover ${item.name} da lista`}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error message detailed */}
      {item.status === 'error' && item.errorMessage && (
        <p role="alert" className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-sm">
          {item.errorMessage}
        </p>
      )}
    </div>
  );
};
