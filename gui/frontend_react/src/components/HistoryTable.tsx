import { Play, FolderOpen, Trash2, Clock } from 'lucide-react';
import { Button } from './ui/button';

export interface HistoryItem {
  title: string;
  url: string;
  format: string;
  date: string;
  folder: string;
  filename: string;
}

interface Props {
  history: HistoryItem[];
  onPlay: (folder: string, filename: string) => void;
  onOpenFolder: (folder: string) => void;
  onDeleteClick: (index: number, title: string) => void;
}

export function HistoryTable({ history, onPlay, onOpenFolder, onDeleteClick }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
          <Clock className="h-5 w-5 text-zinc-700" />
        </div>
        <p className="text-sm font-medium text-zinc-600">No downloads yet</p>
        <p className="text-xs text-zinc-700">Downloads you complete will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((item, index) => (
        <div
          key={index}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900/40 transition-colors"
        >
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate" title={item.title}>
              {item.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-600 tabular-nums">{item.date.split(' ')[0]}</span>
              <span className="text-zinc-800">·</span>
              <span className="text-[10px] text-zinc-600">{item.format}</span>
            </div>
          </div>

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
              onClick={() => onPlay(item.folder, item.filename)}
              title="Play"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
              onClick={() => onOpenFolder(item.folder)}
              title="Open folder"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/20 text-xs"
              onClick={() => onDeleteClick(index, item.title)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
