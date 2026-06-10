import { Download, X, ChevronDown, ListVideo, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import type { ActiveDownload } from './ActiveDownloads';

export interface QueueItem {
  id: string;
  url: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  title?: string;
  downloadId?: string;
  error?: string;
}

const QUEUE_FORMATS = [
  { id: 'best',      label: 'Best Quality (Auto)' },
  { id: 'bestaudio', label: 'Audio Only (MP3)' },
  { id: '1080',      label: '1080p Full HD' },
  { id: '720',       label: '720p HD' },
  { id: '480',       label: '480p' },
  { id: '360',       label: '360p' },
];

interface Props {
  queueItems: QueueItem[];
  batchInput: string;
  activeDownloads: { [id: string]: ActiveDownload };
  queueFormat: string;
  onBatchInputChange: (v: string) => void;
  onAddToQueue: () => void;
  onDownloadQueue: () => void;
  onCancelQueueItem: (downloadId: string) => void;
  onCancelAll: () => void;
  onClearDone: () => void;
  onClearAll: () => void;
  onRemoveFromQueue: (id: string) => void;
  onQueueFormatChange: (format: string) => void;
}

const STATUS_STYLE: Record<QueueItem['status'], string> = {
  pending:     'bg-zinc-800 text-zinc-400',
  downloading: 'bg-blue-950/60 text-blue-300',
  done:        'bg-emerald-950/60 text-emerald-400',
  error:       'bg-red-950/60 text-red-400',
};

const STATUS_LABEL: Record<QueueItem['status'], string> = {
  pending: 'Pending', downloading: 'Downloading', done: 'Done', error: 'Error',
};

export function QueueSection({
  queueItems, batchInput, activeDownloads, queueFormat,
  onBatchInputChange, onAddToQueue, onDownloadQueue,
  onCancelQueueItem, onCancelAll, onClearDone, onClearAll,
  onRemoveFromQueue, onQueueFormatChange,
}: Props) {
  const pendingCount     = queueItems.filter((i) => i.status === 'pending').length;
  const downloadingCount = queueItems.filter((i) => i.status === 'downloading').length;
  const doneOrErrorCount = queueItems.filter((i) => i.status === 'done' || i.status === 'error').length;

  return (
    <div className="space-y-5">

      {/* Add to Queue */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListVideo className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-300">Add URLs</span>
          </div>
          {/* Format selector */}
          <div className="relative">
            <select
              value={queueFormat}
              onChange={(e) => onQueueFormatChange(e.target.value)}
              className="h-8 pl-2.5 pr-7 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
            >
              {QUEUE_FORMATS.map((f) => (
                <option key={f.id} value={f.id} className="bg-zinc-900">{f.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          </div>
        </div>

        <textarea
          placeholder={"Paste one or more URLs, one per line...\nhttps://youtube.com/watch?v=..."}
          value={batchInput}
          onChange={(e) => onBatchInputChange(e.target.value)}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder:text-zinc-700 text-sm rounded-md p-3 focus:outline-none focus:border-violet-500/50 resize-none transition-colors"
        />

        <Button
          onClick={onAddToQueue}
          disabled={!batchInput.trim()}
          variant="outline"
          className="w-full h-9 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm"
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add to Queue
        </Button>
      </div>

      {/* Queue list */}
      {queueItems.length > 0 && (
        <div className="space-y-3">
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{queueItems.length} item{queueItems.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3">
              {doneOrErrorCount > 0 && (
                <button onClick={onClearDone} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Clear done
                </button>
              )}
              {downloadingCount > 0 && (
                <button onClick={onCancelAll} className="text-xs text-red-500 hover:text-red-400 transition-colors">
                  Cancel all
                </button>
              )}
              {queueItems.length > 0 && (
                <button onClick={onClearAll} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {queueItems.map((item) => {
              const live = item.downloadId ? activeDownloads[item.downloadId] : null;
              const isMerging = live?.status === 'finished';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 space-y-2',
                    item.status === 'done'        ? 'bg-emerald-950/10 border-emerald-900/20' :
                    item.status === 'error'       ? 'bg-red-950/10 border-red-900/20' :
                    item.status === 'downloading' ? 'bg-zinc-900/60 border-zinc-800' :
                    'bg-zinc-900/30 border-zinc-800/60'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="flex-1 text-sm text-zinc-200 truncate" title={item.title || item.url}>
                      {item.title || item.url}
                    </p>
                    <span className={cn('text-[10px] font-semibold px-2 py-px rounded-full shrink-0', STATUS_STYLE[item.status])}>
                      {isMerging ? 'Merging' : STATUS_LABEL[item.status]}
                    </span>
                    <button
                      onClick={() => {
                        if (item.status === 'downloading' && item.downloadId) onCancelQueueItem(item.downloadId);
                        else onRemoveFromQueue(item.id);
                      }}
                      className="text-zinc-700 hover:text-zinc-400 shrink-0 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {live && item.status === 'downloading' && (
                    <div className="space-y-1">
                      {isMerging ? (
                        <div className="h-1 w-full rounded-full bg-zinc-950 overflow-hidden">
                          <div className="h-full bg-violet-600 animate-pulse rounded-full w-full" />
                        </div>
                      ) : (
                        <Progress value={live.progress} className="h-1 bg-zinc-950" />
                      )}
                      <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>{isMerging ? 'Merging with FFmpeg…' : live.phase >= 2 ? `Audio · ${live.speed}` : `Video · ${live.speed}`}</span>
                        {!isMerging && (
                          <span className="text-zinc-400 tabular-nums">{live.progress}%</span>
                        )}
                      </div>
                    </div>
                  )}

                  {item.status === 'error' && item.error && (
                    <p className="text-[10px] text-red-400 leading-snug">{item.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Download all button */}
          <Button
            onClick={onDownloadQueue}
            disabled={pendingCount === 0}
            className="w-full h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {pendingCount > 0
              ? `Download ${pendingCount} pending`
              : downloadingCount > 0
              ? `${downloadingCount} downloading…`
              : 'Queue empty'}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {queueItems.length === 0 && (
        <div className="text-center py-12 text-zinc-700 text-sm select-none">
          No items in queue. Add URLs above or use the Download tab.
        </div>
      )}
    </div>
  );
}
