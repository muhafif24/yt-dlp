import { useState, useEffect, useRef } from 'react';
import { usePyApi } from './hooks/usePyApi';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Progress } from './components/ui/progress';
import { Alert, AlertDescription } from './components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Download, FolderOpen, Play, AlertCircle, RefreshCw, ChevronDown, Trash2 } from 'lucide-react';

interface ActiveDownload {
  id: string;
  title: string;
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
  eta: string;
  status: string;
  formatLabel: string;
  url: string;
  folder: string;
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
  
  const [activeDownloads, setActiveDownloads] = useState<{ [id: string]: ActiveDownload }>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
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
      
      // Bind global callbacks to window so Python downloader can call them
      (window as any).updateDownloadProgress = (payload: any) => {
        handleProgressUpdate(payload);
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
    setActiveDownloads(prev => {
      const item = prev[downloadId];
      if (!item) return prev;
      return {
        ...prev,
        [downloadId]: {
          ...item,
          status: 'error',
          speed: 'Failed',
          error: errorMsg.includes("cancelled") ? "Download canceled by user." : errorMsg
        }
      };
    });
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

      const res = await api.start_download(currentUrl, selectedFormat, currentFolder);
      if (res.success && res.download_id) {
        const dId = res.download_id;
        
        // Add to active queue state
        setActiveDownloads(prev => ({
          ...prev,
          [dId]: {
            id: dId,
            title: currentVideo.title,
            progress: 0,
            speed: 'Connecting...',
            downloaded: '0 B',
            total: 'Unknown',
            eta: '--:--',
            status: 'starting',
            formatLabel: formatLabel,
            url: currentUrl,
            folder: currentFolder
          }
        }));

        // Reset inputs
        setCurrentVideo(null);
        setUrl('');
      } else {
        alert(`Failed to start download: ${res.error}`);
      }
    } catch (err: any) {
      alert(`An error occurred: ${err.message}`);
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

  const hasActiveDownloads = Object.keys(activeDownloads).length > 0;

  return (
    <div className="w-full min-h-screen bg-[#080b11] text-[#e2e8f0] font-sans antialiased selection:bg-violet-600 selection:text-white p-6 flex flex-col justify-between max-w-5xl mx-auto">
      
      {/* App Header */}
      <header className="flex justify-between items-center mb-6 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="text-3xl filter drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]">📥</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent font-heading">
              yt-dlp
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

      {/* App Main Area */}
      <main className="flex-1 flex flex-col gap-6">
        
        {/* Section: Input URL */}
        <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Paste YouTube video URL here..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                className="bg-[#0b0e17]/80 border-white/[0.06] text-slate-200 placeholder:text-zinc-500 h-12 focus:border-violet-500/50 focus:ring-violet-500/20"
                disabled={isAnalyzing}
              />
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim()}
                className="h-12 px-6 font-semibold bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-500/10 hover:shadow-violet-500/25 transition-all duration-300 active:scale-[0.98]"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Link'
                )}
              </Button>
            </div>
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

        {/* Section: Active Downloads Queue */}
        {hasActiveDownloads && (
          <Card className="bg-[#0f1420]/75 border-white/[0.05] shadow-2xl backdrop-blur-xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                Active Downloads
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Object.values(activeDownloads).map(item => (
                <div key={item.id} className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-sm font-medium text-slate-200 truncate flex-1" title={item.title}>
                      {item.title}
                    </span>
                    {item.status !== 'finished' && item.status !== 'error' ? (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleCancelDownload(item.id)}
                        className="bg-red-950/40 hover:bg-red-800 border border-red-900/30 text-red-300 text-xs h-8"
                      >
                        Cancel
                      </Button>
                    ) : item.status === 'error' ? (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleRemoveFailedCard(item.id)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.03] text-xs h-8"
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                  
                  <Progress 
                    value={item.progress} 
                    className="h-2 bg-zinc-950" 
                    style={{
                      backgroundColor: item.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                  
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <div className="flex gap-4">
                      <span className="text-zinc-400 font-semibold">{item.speed}</span>
                      <span>
                        {item.total !== "0 B" && item.total !== "Unknown size" ? `${item.downloaded} of ${item.total}` : item.downloaded}
                      </span>
                      <span className="text-violet-400 font-medium">
                        {item.status === 'downloading' ? 'Downloading...' : 
                         item.status === 'finished' ? 'Merging formats (Post-processing)...' : 
                         item.status === 'error' ? 'Failed' : 'Preparing...'}
                      </span>
                    </div>
                    <div>
                      {item.status === 'downloading' && `ETA: ${item.eta}`}
                    </div>
                  </div>

                  {item.status === 'error' && item.error && (
                    <div className="text-[11px] text-red-400 bg-red-950/15 border border-red-950/30 p-2 rounded mt-1">
                      ⚠️ {item.error}
                    </div>
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

      {/* App Footer */}
      <footer className="flex justify-between items-center text-[10px] text-zinc-600 mt-6 pt-4 border-t border-white/[0.02]">
        <span>Powered by yt-dlp Core & PyWebview</span>
        <span>v1.0.0</span>
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
