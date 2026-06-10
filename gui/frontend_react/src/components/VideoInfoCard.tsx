import { Download, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  uploader: string;
  formats: Array<{ id: string; label: string; ext: string; size: string }>;
  subtitles: Array<{ code: string; name: string; auto: boolean }>;
}

interface Props {
  video: VideoInfo;
  selectedFormat: string;
  outputDir: string;
  subtitleEnabled: boolean;
  subtitleLang: string;
  embedSubs: boolean;
  onFormatChange: (id: string) => void;
  onBrowseFolder: () => void;
  onSubtitleToggle: (v: boolean) => void;
  onSubtitleLangChange: (lang: string) => void;
  onEmbedSubsChange: (v: boolean) => void;
  onStartDownload: () => void;
}

export function VideoInfoCard({
  video, selectedFormat, outputDir, subtitleEnabled, subtitleLang, embedSubs,
  onFormatChange, onBrowseFolder, onSubtitleToggle, onSubtitleLangChange, onEmbedSubsChange, onStartDownload,
}: Props) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Thumbnail + meta */}
      <div className="flex gap-4 p-4 border-b border-zinc-800/60">
        <div className="relative w-36 aspect-video rounded-md overflow-hidden shrink-0 bg-zinc-900">
          <img src={video.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-px rounded font-medium">
            {video.duration}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <p className="font-semibold text-zinc-100 text-sm leading-snug line-clamp-2" title={video.title}>
            {video.title}
          </p>
          <p className="text-xs text-zinc-500">{video.uploader}</p>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Format selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Format</label>
            <div className="relative">
              <select
                value={selectedFormat}
                onChange={(e) => onFormatChange(e.target.value)}
                className={cn(
                  'w-full h-9 pl-3 pr-8 text-sm bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-md',
                  'focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer transition-colors'
                )}
              >
                {video.formats.map((f) => (
                  <option key={f.id} value={f.id} className="bg-zinc-900 text-zinc-200">
                    {f.id === 'best' ? 'Best Quality (Auto)' : f.id === 'bestaudio' ? 'Audio Only (MP3)' : f.label}
                    {f.size !== 'Otomatis' && f.size !== 'Bervariasi' ? ` · ${f.size}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            </div>
          </div>

          {/* Output folder */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Save to</label>
            <div className="flex gap-1.5">
              <Input
                value={outputDir}
                readOnly
                className="bg-zinc-900 border-zinc-800 text-zinc-400 text-xs h-9 min-w-0"
              />
              <Button
                variant="outline"
                onClick={onBrowseFolder}
                className="h-9 px-3 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs shrink-0"
              >
                Browse
              </Button>
            </div>
          </div>
        </div>

        {/* Subtitles */}
        {video.subtitles?.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={subtitleEnabled}
                onChange={(e) => onSubtitleToggle(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-violet-600 cursor-pointer"
              />
              <span className="text-xs text-zinc-400">Download subtitles</span>
            </label>
            {subtitleEnabled && (
              <>
                <div className="relative">
                  <select
                    value={subtitleLang}
                    onChange={(e) => onSubtitleLangChange(e.target.value)}
                    className="h-7 pl-2 pr-6 text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-md focus:outline-none appearance-none cursor-pointer"
                  >
                    {video.subtitles.map((s) => (
                      <option key={s.code} value={s.code} className="bg-zinc-900">{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={embedSubs}
                    onChange={(e) => onEmbedSubsChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-violet-600 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-400">Embed in video</span>
                </label>
                {!embedSubs && (
                  <span className="text-[11px] text-zinc-600">Saved as .srt alongside video</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Download button */}
        <Button
          onClick={onStartDownload}
          className="w-full h-9 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium"
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          Start Download
        </Button>
      </div>
    </div>
  );
}
