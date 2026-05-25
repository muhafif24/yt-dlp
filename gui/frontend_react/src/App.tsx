import { useState, useEffect, useRef } from 'react';
import { usePyApi } from './hooks/usePyApi';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Progress } from './components/ui/progress';
import { Alert, AlertDescription } from './components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Download, FolderOpen, Play, AlertCircle, RefreshCw, ChevronDown, Trash2, X, ListVideo } from 'lucide-react';

interface ActiveDownload {
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

interface PlaylistEntry {
  index: number;
  id: string;
  title: string;
  url: string;
  duration: string;
}

interface PlaylistInfo {
  title: string;
  uploader: string;
  count: number;
  entries: PlaylistEntry[];
}

interface QueueItem {
  id: string;
  url: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  title?: string;
  downloadId?: string;
  error?: string;
}

interface HistoryItem {
  title: string;
  url: string;
  format: string;
  date: string;
  folder: string;
  filename: string;
}

export default function App() {
  const { api, isReady } = usePyApi();
  
  // App State
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState('best');
  const [outputDir, setOutputDir] = useState('');
  const [subtitleEnabled, setSubtitleEnabled] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState('en');
  const [embedSubs, setEmbedSubs] = useState(true);
  
  const [activeDownloads, setActiveDownloads] = useState<{ [id: string]: ActiveDownload }>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Queue State
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [batchInput, setBatchInput] = useState('');

  // Update State
  const [updateInfo, setUpdateInfo] = useState<{ version: string; name: string; url: string } | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Playlist State
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; title: string } | null>(null);
  const [deleteFileAlso, setDeleteFileAlso] = useState(false);
  
  // System Dependencies Status
  const [ffmpegStatus, setFfmpegStatus] = useState<{ available: boolean; source: string | null }>({ available: false, source: null });
  const [jsStatus, setJsStatus] = useState<{ available: boolean; name: string | null }>({ available: false, name: null });

  // Store active downloads in state reference for callback function accessibility
  const activeDownloadsRef = useRef(activeDownloads);
  useEffect(() => {
    activeDownloadsRef.current = activeDownloads;
  }, [activeDownloads]);

  // Handle Initial Load & System Checks
  useEffect(() => {
    if (isReady && api) {
      checkSystemDependencies();
      loadHistory();
      checkForUpdate();
      
      // Bind global callbacks to window so Python downloader can call them
      (window as any).updateDownloadProgress = (payload: any) => {
        handleProgressUpdate(payload);
      };

      (window as any).onDownloadStarted = (downloadId: string, title: string) => {
        setActiveDownloads(prev => {
          const item = prev[downloadId];
          if (!item) return prev;
          return { ...prev, [downloadId]: { ...item, title } };
        });
        setQueueItems(prev => prev.map(q =>
          q.downloadId === downloadId ? { ...q, title } : q
        ));
      };

      (window as any).onDownloadComplete = (downloadId: string, filename: string) => {
        handleDownloadComplete(downloadId, filename);
      };

      (window as any).onDownloadError = (downloadId: string, errorMsg: string) => {
        handleDownloadError(downloadId, errorMsg);
      };
    }
  }, [isReady, api]);

  const checkSystemDependencies = async () => {
    if (!api) return;
    try {
      const status = await api.check_system_status();
      setFfmpegStatus({ available: status.ffmpeg.available, source: status.ffmpeg.source });
      setJsStatus({ available: status.js_runtime.available, name: status.js_runtime.name });
      setOutputDir(status.default_dir);
    } catch (err) {
      console.error("Failed to fetch system dependencies:", err);
    }
  };

  const loadHistory = async () => {
    if (!api) return;
    try {
      const data = await api.get_download_history();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const checkForUpdate = async () => {
    if (!api) return;
    try {
      const result = await api.check_for_update();
      if (result.success && result.has_update && result.latest_version && result.release_url) {
        setUpdateInfo({
          version: result.latest_version,
          name: result.release_name || `v${result.latest_version}`,
          url: result.release_url,
        });
      }
    } catch {
      // Silent fail — update check is non-critical
    }
  };

  const handleOpenReleaseUrl = async (url: string) => {
    if (!api) return;
    await api.open_url(url);
  };

  // Python Downloader Callbacks
  const handleProgressUpdate = (payload: any) => {
    const id = payload.id;
    setActiveDownloads(prev => {
      const item = prev[id];
      if (!item) return prev;
      return {
        ...prev,
        [id]: {
          ...item,
          status: payload.status,
          phase: payload.phase ?? item.phase,
          progress: payload.progress,
          speed: payload.speed,
          downloaded: payload.downloaded,
          total: payload.total,
          eta: payload.eta
        }
      };
    });
  };

  const handleDownloadComplete = async (downloadId: string, filename: string) => {
    const activeItem = activeDownloadsRef.current[downloadId];
    if (activeItem && api) {
      try {
        // Save to JSON history backend using stored download settings
        await api.add_to_history(
          activeItem.title, 
          activeItem.url, 
          activeItem.formatLabel, 
          activeItem.folder, 
          filename
        );
        loadHistory();
      } catch (err) {
        console.error("Failed to save download history:", err);
      }
    }

    // Set status to complete
    setActiveDownloads(prev => {
      const item = prev[downloadId];
      if (!item) return prev;
      return {
        ...prev,
        [downloadId]: { ...item, status: 'finished', progress: 100, speed: 'Finished' }
      };
    });

    // Mark queue item as done if applicable
    setQueueItems(prev => prev.map(q =>
      q.downloadId === downloadId ? { ...q, status: 'done' } : q
    ));

    // Remove from queue card after 4 seconds
    setTimeout(() => {
      setActiveDownloads(prev => {
        const copy = { ...prev };
        delete copy[downloadId];
        return copy;
      });
    }, 4000);
  };

  const handleDownloadError = (downloadId: string, errorMsg: string) => {
    const friendlyMsg = errorMsg.includes("cancelled") ? "Download canceled by user." : errorMsg;
    setActiveDownloads(prev => {
      const item = prev[downloadId];
      if (!item) return prev;
      return {
        ...prev,
        [downloadId]: { ...item, status: 'error', speed: 'Failed', error: friendlyMsg }
      };
    });
    setQueueItems(prev => prev.map(q =>
      q.downloadId === downloadId ? { ...q, status: 'error', error: friendlyMsg } : q
    ));
  };

  // UI Event Handlers
  const handleAnalyze = async () => {
    if (!url.trim() || !api) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentVideo(null);

    try {
      const result = await api.get_video_info(url.trim());
      if (result.success) {
        setCurrentVideo(result);
        setSelectedFormat('best');
        setSubtitleEnabled(false);
        const subs = result.subtitles || [];
        const firstManual = subs.find((s: any) => !s.auto);
        setSubtitleLang(firstManual?.code || subs[0]?.code || 'en');
      } else {
        setAnalysisError(result.error || "Analysis failed.");
      }
    } catch (err: any) {
      setAnalysisError(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBrowseFolder = async () => {
    if (!api) return;
    try {
      const selected = await api.select_folder();
      if (selected) {
        setOutputDir(selected);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleStartDownload = async () => {
    if (!currentVideo || !api) return;

    try {
      // Dapatkan label format yang benar-benar dipilih untuk disimpan di riwayat
      const formatObj = currentVideo.formats.find((f: any) => f.id === selectedFormat);
      const formatLabel = formatObj
        ? (formatObj.id === 'best' ? 'Best Quality (Auto)' : 
           formatObj.id === 'bestaudio' ? 'Audio Only (MP3)' : formatObj.label)
        : selectedFormat;

      const currentUrl = url.trim();
      const currentFolder = outputDir;

      const res = await api.start_download(
        currentUrl, selectedFormat, currentFolder,
        subtitleEnabled ? subtitleLang : null,
        embedSubs
      );
      if (res.success && res.download_id) {
        const dId = res.download_id;
        
        // Add to active queue state
        setActiveDownloads(prev => ({
          ...prev,
          [dId]: {
            id: dId,
            title: currentVideo.title,
            progress: 0,
            speed: '—',
            downloaded: '0 B',
            total: '—',
            eta: '—',
            status: 'starting',
            phase: 1,
            formatLabel: formatLabel,
            url: currentUrl,
            folder: currentFolder
          }
        }));

        // Reset inputs
        setCurrentVideo(null);
        setUrl('');
        setSubtitleEnabled(false);
      } else {
        alert(`Failed to start download: ${res.error}`);
      }
    } catch (err: any) {
      alert(`An error occurred: ${err.message}`);
    }
  };

  const isPlaylistUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      const list = parsed.searchParams.get('list');
      // radio/mix playlists (RD...) are not real playlists
      if (list && !list.startsWith('RD') && !list.startsWith('FL')) return true;
      if (parsed.pathname === '/playlist') return true;
    } catch { /* ignore */ }
    return false;
  };

  const handleLoadPlaylist = async () => {
    if (!url.trim() || !api) return;
    setIsLoadingPlaylist(true);
    setPlaylistError(null);
    setPlaylistInfo(null);
    try {
      const result = await api.get_playlist_info(url.trim());
      if (result.success && result.entries) {
        setPlaylistInfo({
          title: result.title || 'Playlist',
          uploader: result.uploader || '',
          count: result.count || result.entries.length,
          entries: result.entries,
        });
        setSelectedEntries(new Set(result.entries.map((e: PlaylistEntry) => e.id)));
      } else {
        setPlaylistError(result.error || 'Failed to load playlist.');
      }
    } catch (err: any) {
      setPlaylistError(err.message || 'An error occurred.');
    } finally {
      setIsLoadingPlaylist(false);
    }
  };

  const handleToggleEntry = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAllEntries = (all: boolean) => {
    if (!playlistInfo) return;
    setSelectedEntries(all ? new Set(playlistInfo.entries.map(e => e.id)) : new Set());
  };

  const handleAddPlaylistToQueue = () => {
    if (!playlistInfo) return;
    const selected = playlistInfo.entries.filter(e => selectedEntries.has(e.id));
    const newItems: QueueItem[] = selected.map(e => ({
      id: crypto.randomUUID(),
      url: e.url,
      status: 'pending',
      title: e.title,
    }));
    setQueueItems(prev => [...prev, ...newItems]);
    setPlaylistInfo(null);
    setUrl('');
  };

  const handleCancelQueueItem = async (downloadId: string) => {
    if (!api) return;
    await api.cancel_download(downloadId);
    // status update propagates via handleDownloadError callback
  };

  const handleCancelAllQueue = async () => {
    if (!api) return;
    const downloading = queueItems.filter(q => q.status === 'downloading' && q.downloadId);
    for (const item of downloading) {
      await api.cancel_download(item.downloadId!);
    }
  };

  const handleClearDoneQueue = () => {
    setQueueItems(prev => prev.filter(i => i.status === 'pending' || i.status === 'downloading'));
  };

  const handleClearAllQueue = async () => {
    if (!api) return;
    const downloading = queueItems.filter(q => q.status === 'downloading' && q.downloadId);
    for (const item of downloading) {
      await api.cancel_download(item.downloadId!);
    }
    setQueueItems([]);
  };

  const handleAddToQueue = () => {
    const urls = batchInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return;
    const newItems: QueueItem[] = urls.map(u => ({
      id: crypto.randomUUID(),
      url: u,
      status: 'pending'
    }));
    setQueueItems(prev => [...prev, ...newItems]);
    setBatchInput('');
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueueItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDownloadQueue = async () => {
    if (!api) return;
    const pending = queueItems.filter(item => item.status === 'pending');
    for (const item of pending) {
      const res = await api.start_download(item.url, 'best', outputDir);
      if (res.success && res.download_id) {
        const dId = res.download_id;
        setQueueItems(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'downloading', downloadId: dId } : q
        ));
        setActiveDownloads(prev => ({
          ...prev,
          [dId]: {
            id: dId,
            title: item.url,
            progress: 0,
            speed: '—',
            downloaded: '0 B',
            total: '—',
            eta: '—',
            status: 'starting',
            phase: 1,
            formatLabel: 'Best Quality (Auto)',
            url: item.url,
            folder: outputDir
          }
        }));
      } else {
        setQueueItems(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error', error: res.error || 'Failed to start.' } : q
        ));
      }
    }
  };

  const handleCancelDownload = async (id: string) => {
    if (!api) return;
    try {
      await api.cancel_download(id);
    } catch (err) {
      console.error("Failed to cancel download:", err);
    }
  };

  const handleRemoveFailedCard = (id: string) => {
    setActiveDownloads(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleOpenFolder = async (folder: string) => {
    if (!folder) {
      alert("Folder path is empty. This item was downloaded before the folder tracking update.");
      return;
    }
    if (!api) return;
    await api.open_folder(folder);
  };

  const handleDeleteItem = async () => {
    if (deleteTarget === null || !api) return;
    try {
      const res = await api.delete_history_item(deleteTarget.index, deleteFileAlso);
      if (res.success) {
        loadHistory();
        setDeleteTarget(null);
        setDeleteFileAlso(false);
      } else {
        alert(`Failed to delete item: ${res.error}`);
      }
    } catch (err: any) {
      alert(`An error occurred: ${err.message}`);
    }
  };

  const handlePlayVideo = async (folder: string, filename: string) => {
    if (!api) return;
    const res = await api.play_video(folder, filename);
    if (!res.success) {
      alert(`Failed to play video: ${res.error}`);
    }
  };

  const queueDownloadIds = new Set(queueItems.map(q => q.downloadId).filter(Boolean) as string[]);
  const standaloneActiveDownloads = Object.values(activeDownloads).filter(d => !queueDownloadIds.has(d.id));
  const hasActiveDownloads = standaloneActiveDownloads.length > 0;
  const pendingQueueCount   = queueItems.filter(i => i.status === 'pending').length;
  const downloadingQueueCount = queueItems.filter(i => i.status === 'downloading').length;
  const doneOrErrorCount    = queueItems.filter(i => i.status === 'done' || i.status === 'error').length;

  const queueStatusStyle: Record<QueueItem['status'], string> = {
    pending:     'bg-zinc-800 text-zinc-400 border border-zinc-700/50',
    downloading: 'bg-blue-950/60 text-blue-300 border border-blue-800/40',
    done:        'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
    error:       'bg-red-950/60 text-red-400 border border-red-900/40',
  };
  const queueStatusLabel: Record<QueueItem['status'], string> = {
    pending: 'Pending', downloading: 'Downloading', done: 'Done', error: 'Error'
  };

  return (
    <div className="w-full min-h-screen bg-[#080b11] text-[#e2e8f0] font-sans antialiased selection:bg-violet-600 selection:text-white p-6 flex flex-col justify-between max-w-5xl mx-auto">
      
      {/* App Header */}
      <header className="flex justify-between items-center mb-6 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Fetchr" className="w-9 h-9 rounded-xl filter drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent font-heading">
              Fetchr
            </h1>
            <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
              Desktop Downloader
            </span>
          </div>
        </div>

        {/* Dependency Status Area */}
        <div className="flex gap-4 bg-white/[0.02] border border-white/[0.04] px-4 py-2 rounded-full text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ffmpegStatus.available ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
            <span>FFmpeg: {ffmpegStatus.available ? `Ready (${ffmpegStatus.source})` : 'Not Found'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${jsStatus.available ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
            <span>JS Engine: {jsStatus.available ? jsStatus.name : 'Missing'}</span>
          </div>
        </div>
      </header>

      {/* Update Banner */}
      {updateInfo && !updateDismissed && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 mb-2 rounded-xl bg-violet-950/40 border border-violet-700/30 text-xs animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-violet-300">
            <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa] shrink-0" />
            <span>
              <span className="font-semibold text-violet-200">New version available:</span>
              {' '}{updateInfo.name}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleOpenReleaseUrl(updateInfo.url)}
              className="text-violet-300 hover:text-white font-semibold underline underline-offset-2 transition-colors"
            >
              Download
            </button>
            <button
              onClick={() => setUpdateDismissed(true)}
              className="text-violet-600 hover:text-violet-400 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* App Main Area */}
      <main className="flex-1 flex flex-col gap-6">
        
        {/* Section: Input URL */}
        <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Paste YouTube URL here (video or playlist)..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (isPlaylistUrl(url) ? handleLoadPlaylist() : handleAnalyze())}
                className="bg-[#0b0e17]/80 border-white/[0.06] text-slate-200 placeholder:text-zinc-500 h-12 focus:border-violet-500/50 focus:ring-violet-500/20"
                disabled={isAnalyzing || isLoadingPlaylist}
              />
              {isPlaylistUrl(url) ? (
                <Button
                  onClick={handleLoadPlaylist}
                  disabled={isLoadingPlaylist || !url.trim()}
                  className="h-12 px-6 font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg transition-all duration-300 active:scale-[0.98] shrink-0"
                >
                  {isLoadingPlaylist ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading...</>
                  ) : (
                    'Load Playlist'
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !url.trim()}
                  className="h-12 px-6 font-semibold bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-500/10 hover:shadow-violet-500/25 transition-all duration-300 active:scale-[0.98] shrink-0"
                >
                  {isAnalyzing ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                  ) : (
                    'Analyze Link'
                  )}
                </Button>
              )}
            </div>
            {playlistError && (
              <Alert variant="destructive" className="mt-4 bg-red-950/20 border-red-900/30 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{playlistError}</AlertDescription>
              </Alert>
            )}
            {analysisError && (
              <Alert variant="destructive" className="mt-4 bg-red-950/20 border-red-900/30 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {analysisError}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Section: Video Info & Download Form */}
        {currentVideo && (
          <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left side: Thumbnail */}
                <div className="md:col-span-4 flex flex-col gap-2">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/[0.05] shadow-xl">
                    <img src={currentVideo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-medium text-white">
                      {currentVideo.duration}
                    </span>
                  </div>
                </div>

                {/* Right side: Form & Actions */}
                <div className="md:col-span-8 flex flex-col justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white leading-snug line-clamp-2" title={currentVideo.title}>
                      {currentVideo.title}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      By: {currentVideo.uploader}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Format Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                        Select Format & Quality:
                      </label>
                      <div className="relative w-full">
                        <select
                          value={selectedFormat}
                          onChange={(e) => setSelectedFormat(e.target.value)}
                          className="w-full h-10 pl-3 pr-10 text-sm bg-[#0b0e17]/80 border border-white/[0.06] text-slate-200 rounded-lg focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 appearance-none cursor-pointer transition-all duration-200"
                        >
                          {currentVideo.formats.map((f: any) => (
                            <option key={f.id} value={f.id} className="bg-[#0f1420] text-slate-300">
                              {f.id === 'best' ? 'Best Quality (Auto)' : 
                               f.id === 'bestaudio' ? 'Audio Only (MP3)' : f.label} [{f.ext}] {f.size !== 'Otomatis' && f.size !== 'Bervariasi' ? `(${f.size})` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    {/* Output Directory Browse */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                        Save To Folder:
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={outputDir}
                          readOnly
                          className="bg-[#0b0e17]/80 border-white/[0.06] text-slate-200 text-xs placeholder:text-zinc-500 truncate h-10"
                        />
                        <Button 
                          variant="secondary" 
                          onClick={handleBrowseFolder} 
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/[0.03] h-10 px-4 shrink-0 transition-all duration-200"
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Subtitle Options */}
                  {currentVideo.subtitles?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-white/[0.04]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={subtitleEnabled}
                          onChange={e => setSubtitleEnabled(e.target.checked)}
                          className="h-4 w-4 rounded accent-violet-600 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-400 font-medium">Download subtitles</span>
                      </label>
                      {subtitleEnabled && (
                        <>
                          <select
                            value={subtitleLang}
                            onChange={e => setSubtitleLang(e.target.value)}
                            className="h-8 pl-2 pr-7 text-xs bg-[#0b0e17]/80 border border-white/[0.06] text-slate-200 rounded-md focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                          >
                            {currentVideo.subtitles.map((s: any) => (
                              <option key={s.code} value={s.code} className="bg-[#0f1420]">
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={embedSubs}
                              onChange={e => setEmbedSubs(e.target.checked)}
                              className="h-4 w-4 rounded accent-violet-600 cursor-pointer"
                            />
                            <span className="text-xs text-zinc-400">Embed in video</span>
                          </label>
                          {!embedSubs && (
                            <span className="text-[11px] text-zinc-500">Saved as .srt file alongside the video</span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    <Button
                      onClick={handleStartDownload}
                      className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold py-6 shadow-lg shadow-violet-500/20 active:scale-[0.99] transition-all duration-200"
                    >
                      <Download className="mr-2 h-5 w-5" /> Start Download
                    </Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        )}

        {/* Section: Download Queue */}
        <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
          <CardHeader className="py-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-2">
                <ListVideo className="h-4 w-4" />
                Download Queue
                {queueItems.length > 0 && (
                  <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                    {queueItems.length}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-3">
                {doneOrErrorCount > 0 && (
                  <button onClick={handleClearDoneQueue} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    Clear Done
                  </button>
                )}
                {downloadingQueueCount > 0 && (
                  <button onClick={handleCancelAllQueue} className="text-xs text-red-500 hover:text-red-400 transition-colors">
                    Cancel All
                  </button>
                )}
                {queueItems.length > 0 && (
                  <button onClick={handleClearAllQueue} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* URL Input */}
            <div className="flex gap-3 items-start">
              <textarea
                placeholder={"Paste multiple URLs here, one per line...\nhttps://youtube.com/watch?v=..."}
                value={batchInput}
                onChange={e => setBatchInput(e.target.value)}
                rows={2}
                className="flex-1 bg-[#0b0e17]/80 border border-white/[0.06] text-slate-200 placeholder:text-zinc-600 text-sm rounded-lg p-3 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all"
              />
              <Button
                onClick={handleAddToQueue}
                disabled={!batchInput.trim()}
                className="h-auto py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/[0.06] text-sm shrink-0"
              >
                Add to Queue
              </Button>
            </div>

            {/* Queue List */}
            {queueItems.length > 0 && (
              <>
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {queueItems.map(item => {
                    const live = item.downloadId ? activeDownloads[item.downloadId] : null;
                    const isMerging = live?.status === 'finished';
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-xl p-3 flex flex-col gap-2 transition-colors ${
                          item.status === 'done'
                            ? 'bg-emerald-950/10 border-emerald-900/20'
                            : item.status === 'error'
                            ? 'bg-red-950/10 border-red-900/20'
                            : item.status === 'downloading'
                            ? 'bg-blue-950/10 border-blue-900/20'
                            : 'bg-white/[0.01] border-white/[0.04]'
                        }`}
                      >
                        {/* Row 1: title + badge + action */}
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="flex-1 text-sm text-slate-200 truncate font-medium" title={item.title || item.url}>
                            {item.title || item.url}
                          </p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${queueStatusStyle[item.status]}`}>
                            {isMerging ? 'Merging' : queueStatusLabel[item.status]}
                          </span>
                          {/* Action button per status */}
                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleRemoveFromQueue(item.id)}
                              title="Remove from queue"
                              className="text-zinc-600 hover:text-red-400 shrink-0 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {item.status === 'downloading' && item.downloadId && (
                            <button
                              onClick={() => handleCancelQueueItem(item.downloadId!)}
                              title="Cancel download"
                              className="text-zinc-500 hover:text-red-400 shrink-0 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {(item.status === 'done' || item.status === 'error') && (
                            <button
                              onClick={() => handleRemoveFromQueue(item.id)}
                              title="Dismiss"
                              className="text-zinc-600 hover:text-zinc-400 shrink-0 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Row 2: progress (only when downloading) */}
                        {live && item.status === 'downloading' && (
                          <div className="flex flex-col gap-1">
                            {isMerging ? (
                              <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-violet-600 to-pink-500 animate-pulse rounded-full w-full" />
                              </div>
                            ) : (
                              <Progress value={live.progress} className="h-1.5 bg-zinc-950" />
                            )}
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-zinc-500">
                                {isMerging ? 'Merging with FFmpeg...' : live.phase >= 2 ? `Audio · ${live.speed}` : `Video · ${live.speed}`}
                              </span>
                              <div className="flex items-center gap-2 text-zinc-500">
                                {!isMerging && <span>ETA {live.eta}</span>}
                                <span className="text-zinc-300 font-bold tabular-nums">{live.progress}%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error message */}
                        {item.status === 'error' && item.error && (
                          <p className="text-[11px] text-red-400 leading-snug">{item.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Row */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadQueue}
                    disabled={pendingQueueCount === 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 text-white font-semibold py-5 shadow-lg shadow-blue-500/10 transition-all duration-200"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {pendingQueueCount > 0
                      ? `Download All (${pendingQueueCount} pending)`
                      : downloadingQueueCount > 0
                      ? `${downloadingQueueCount} downloading...`
                      : 'Queue empty'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section: Active Downloads (single-video, from Analyze flow) */}
        {hasActiveDownloads && (
          <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-2">
                Active Downloads
                <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {standaloneActiveDownloads.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {standaloneActiveDownloads.map(item => (
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
                        onClick={() => handleCancelDownload(item.id)}
                        title="Cancel download"
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/30 bg-red-950/30 hover:bg-red-900/40 px-2.5 py-1 rounded-lg transition-all shrink-0"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveFailedCard(item.id)}
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
                    <span className={`font-medium ${item.status === 'error' ? 'text-red-400' : item.status === 'finished' ? 'text-violet-400' : 'text-zinc-400'}`}>
                      {item.status === 'finished' ? 'Merging with FFmpeg...'
                        : item.status === 'error' ? 'Download failed'
                        : item.status === 'starting' ? 'Fetching video info...'
                        : item.phase >= 2 ? `Downloading audio stream · ${item.speed}`
                        : `Downloading video · ${item.speed}`}
                    </span>
                    {item.status === 'downloading' && (
                      <div className="flex items-center gap-3 text-zinc-500 shrink-0">
                        <span>{item.total !== '—' ? `${item.downloaded} / ${item.total}` : item.downloaded}</span>
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
        )}

        {/* Section: Download History */}
        <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              Download History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {history.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-white/[0.04] rounded-lg">
                No download history yet. Paste a link above to get started.
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.04] overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/[0.01]">
                    <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
                      <TableHead className="text-zinc-400 font-semibold">Video Title</TableHead>
                      <TableHead className="text-zinc-400 font-semibold">Format</TableHead>
                      <TableHead className="text-zinc-400 font-semibold">Date</TableHead>
                      <TableHead className="text-right text-zinc-400 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item, index) => (
                      <TableRow key={index} className="border-b border-white/[0.03] hover:bg-white/[0.005]">
                        <TableCell className="font-medium text-slate-300 max-w-[280px] truncate" title={item.title}>
                          {item.title}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-xs">{item.format}</TableCell>
                        <TableCell className="text-zinc-500 text-xs">{item.date.split(' ')[0]}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="bg-violet-950/40 hover:bg-violet-700 text-violet-300 hover:text-white border border-violet-900/30 text-xs h-8"
                              onClick={() => handlePlayVideo(item.folder, item.filename)}
                            >
                              <Play className="mr-1 h-3.5 w-3.5" /> Play
                            </Button>
                             <Button
                              variant="secondary"
                              size="sm"
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.03] text-xs h-8"
                              onClick={() => handleOpenFolder(item.folder)}
                            >
                              <FolderOpen className="mr-1 h-3.5 w-3.5" /> Open Folder
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="bg-red-950/40 hover:bg-red-700 border border-red-900/30 text-red-300 hover:text-white text-xs h-8 px-2.5"
                              title="Delete from history / computer"
                              onClick={() => setDeleteTarget({ index: index, title: item.title })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Playlist Modal */}
      {playlistInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0f1420] border border-white/[0.08] rounded-xl shadow-2xl flex flex-col mx-4 max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-white/[0.05] flex justify-between items-start gap-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white leading-snug">{playlistInfo.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {playlistInfo.uploader && <span className="mr-3">by {playlistInfo.uploader}</span>}
                  <span>{playlistInfo.count} videos</span>
                </p>
              </div>
              <button onClick={() => setPlaylistInfo(null)} className="text-zinc-500 hover:text-white transition-colors shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Select All / Count */}
            <div className="px-5 py-3 border-b border-white/[0.04] flex justify-between items-center shrink-0">
              <span className="text-xs text-zinc-400">{selectedEntries.size} of {playlistInfo.count} selected</span>
              <div className="flex gap-3">
                <button onClick={() => handleSelectAllEntries(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Select All</button>
                <span className="text-zinc-700">·</span>
                <button onClick={() => handleSelectAllEntries(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Deselect All</button>
              </div>
            </div>

            {/* Entry List */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              {playlistInfo.entries.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => handleToggleEntry(entry.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors select-none ${
                    selectedEntries.has(entry.id)
                      ? 'bg-violet-950/30 border border-violet-800/30'
                      : 'bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.03]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEntries.has(entry.id)}
                    onChange={() => handleToggleEntry(entry.id)}
                    onClick={e => e.stopPropagation()}
                    className="h-4 w-4 rounded accent-violet-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-zinc-600 w-6 text-right shrink-0">{entry.index}</span>
                  <span className="flex-1 text-sm text-slate-300 truncate" title={entry.title}>{entry.title}</span>
                  {entry.duration !== '00:00' && (
                    <span className="text-[11px] text-zinc-500 shrink-0">{entry.duration}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-white/[0.05] flex justify-end gap-3 shrink-0">
              <Button
                variant="secondary"
                onClick={() => setPlaylistInfo(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.03] text-xs h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddPlaylistToQueue}
                disabled={selectedEntries.size === 0}
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 text-white font-semibold text-xs h-9 px-5 transition-all"
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Add {selectedEntries.size} to Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* App Footer */}
      <footer className="flex justify-between items-center text-[10px] text-zinc-600 mt-6 pt-4 border-t border-white/[0.02]">
        <span>Powered by yt-dlp Core & PyWebview</span>
        <span>v1.2.0</span>
      </footer>

      {/* Delete Confirmation Modal */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0f1420] border border-white/[0.08] rounded-xl shadow-2xl p-6 flex flex-col gap-5 mx-4">
            <div>
              <h3 className="text-base font-bold text-white leading-snug">
                Delete History Item
              </h3>
              <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                Are you sure you want to delete <span className="text-slate-200 font-semibold">"{deleteTarget.title}"</span>?
              </p>
            </div>

            <div 
              className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg cursor-pointer select-none" 
              onClick={() => setDeleteFileAlso(!deleteFileAlso)}
            >
              <input
                type="checkbox"
                id="deleteFileCheckbox"
                checked={deleteFileAlso}
                onChange={(e) => setDeleteFileAlso(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 accent-violet-600 cursor-pointer"
              />
              <label htmlFor="deleteFileCheckbox" className="text-xs text-zinc-300 font-medium cursor-pointer">
                Also delete the video file from your computer
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteFileAlso(false);
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.03] text-xs h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteItem}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs h-9 px-4 active:scale-[0.98] transition-all"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
