import { Download, ListVideo, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueueItem } from './QueueSection';

export type Tab = 'download' | 'queue' | 'history';

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'download', label: 'Download', icon: Download },
  { id: 'queue',    label: 'Queue',    icon: ListVideo },
  { id: 'history',  label: 'History',  icon: Clock },
];


interface Props {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  queueItems: QueueItem[];
  activeDownloadCount: number;
  ffmpegReady: boolean;
  ffmpegSource: string | null;
  jsReady: boolean;
  jsName: string | null;
}

export function Sidebar({
  activeTab,
  onTabChange,
  queueItems,
  activeDownloadCount,
  ffmpegReady,
  ffmpegSource,
  jsReady,
  jsName,
}: Props) {
  const pendingOrActive = queueItems.filter(
    (i) => i.status === 'pending' || i.status === 'downloading'
  ).length + activeDownloadCount;

  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen bg-[#0c0c0e] border-r border-zinc-800/50">
      {/* Brand */}
      <div className="h-12 flex items-center gap-3 px-4 border-b border-zinc-800/50">
        <img src="/favicon.png" alt="Fetchr" className="w-7 h-7 shrink-0 rounded-lg" />
        <div>
          <p className="text-sm font-semibold text-zinc-100 leading-tight">Fetchr</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Downloader</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
              activeTab === id
                ? 'bg-zinc-800 text-zinc-100 font-medium'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
            {id === 'queue' && pendingOrActive > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-violet-500/20 text-violet-300 px-1.5 py-px rounded-full tabular-nums">
                {pendingOrActive}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div className="p-3 pt-3 border-t border-zinc-800/50 space-y-1.5">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-1 pb-0.5">
          System
        </p>
        <StatusRow ok={ffmpegReady} label={ffmpegReady ? `FFmpeg · ${ffmpegSource}` : 'FFmpeg not found'} />
        <StatusRow ok={jsReady}     label={jsReady ? (jsName ?? 'JS engine') : 'JS engine missing'} />
        <p className="text-[10px] text-zinc-700 px-1 pt-1">v1.2.0</p>
      </div>
    </aside>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', ok ? 'bg-emerald-500' : 'bg-zinc-600')} />
      <span className="text-xs text-zinc-500 truncate">{label}</span>
    </div>
  );
}
