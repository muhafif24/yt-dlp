import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

export interface ActiveDownload {
  id: string;
  title: string;
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
  eta: string;
  status: string;
  phase: number;
  formatLabel: string;
  url: string;
  folder: string;
  error?: string;
}

interface Props {
  downloads: ActiveDownload[];
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function ActiveDownloads({ downloads, onCancel, onDismiss }: Props) {
  if (downloads.length === 0) return null;

  return (
    <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
      <CardHeader className="py-4">
        <CardTitle className="text-sm font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-2">
          Active Downloads
          <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            {downloads.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {downloads.map((item) => (
          <div
            key={item.id}
            className={`border rounded-xl p-4 flex flex-col gap-2.5 transition-colors ${
              item.status === 'error'
                ? 'bg-red-950/10 border-red-900/20'
                : item.status === 'finished'
                ? 'bg-violet-950/10 border-violet-900/20'
                : 'bg-white/[0.01] border-white/[0.04]'
            }`}
          >
            {/* Title + cancel/close */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-slate-200 truncate flex-1" title={item.title}>
                {item.title}
              </span>
              {item.status !== 'finished' && item.status !== 'error' ? (
                <button
                  onClick={() => onCancel(item.id)}
                  title="Cancel download"
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/30 bg-red-950/30 hover:bg-red-900/40 px-2.5 py-1 rounded-lg transition-all shrink-0"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              ) : (
                <button
                  onClick={() => onDismiss(item.id)}
                  title="Dismiss"
                  className="text-zinc-600 hover:text-zinc-400 shrink-0 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {item.status === 'finished' ? (
              <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-600 to-pink-500 animate-pulse rounded-full w-full" />
              </div>
            ) : (
              <Progress
                value={item.progress}
                className="h-1.5 bg-zinc-950"
                style={{ backgroundColor: item.status === 'error' ? 'rgba(239,68,68,0.12)' : undefined }}
              />
            )}

            {/* Stats row */}
            <div className="flex justify-between items-center text-xs">
              <span
                className={`font-medium ${
                  item.status === 'error'
                    ? 'text-red-400'
                    : item.status === 'finished'
                    ? 'text-violet-400'
                    : 'text-zinc-400'
                }`}
              >
                {item.status === 'finished'
                  ? 'Merging with FFmpeg...'
                  : item.status === 'error'
                  ? 'Download failed'
                  : item.status === 'starting'
                  ? 'Fetching video info...'
                  : item.phase >= 2
                  ? `Downloading audio stream · ${item.speed}`
                  : `Downloading video · ${item.speed}`}
              </span>
              {item.status === 'downloading' && (
                <div className="flex items-center gap-3 text-zinc-500 shrink-0">
                  <span>
                    {item.total !== '—' ? `${item.downloaded} / ${item.total}` : item.downloaded}
                  </span>
                  <span>ETA {item.eta}</span>
                  <span className="text-zinc-200 font-bold tabular-nums">{item.progress}%</span>
                </div>
              )}
            </div>

            {item.status === 'error' && item.error && (
              <p className="text-[11px] text-red-400 bg-red-950/20 border border-red-900/30 px-2.5 py-1.5 rounded-lg leading-snug">
                {item.error}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
