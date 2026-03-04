import { useState } from 'react';
import { X, Loader2, Upload, Link } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { useSessionStore } from '../../stores/session-store';
import { formatBytes } from '../../lib/format';

interface Props {
  onClose: () => void;
}

export function AddTorrentDialog({ onClose }: Props) {
  const addTorrent = useTorrentStore((s) => s.addTorrent);
  const settings = useSessionStore((s) => s.settings);
  const freeSpace = useSessionStore((s) => s.freeSpace);
  const fetchFreeSpace = useSessionStore((s) => s.fetchFreeSpace);

  const [mode, setMode] = useState<'file' | 'url'>('url');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [downloadDir, setDownloadDir] = useState(settings?.downloadDir ?? '');
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState('');
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBrowseFile = async () => {
    const res = await window.api.dialogOpenFile();
    if (res.success && res.data && res.data.length > 0) {
      setFilePath(res.data[0]);
      setMode('file');
    }
  };

  const handleBrowseDir = async () => {
    const res = await window.api.dialogOpenDirectory();
    if (res.success && res.data) {
      setDownloadDir(res.data);
      fetchFreeSpace(res.data);
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    setError('');

    const params: Record<string, unknown> = {
      'download-dir': downloadDir || undefined,
      paused,
      bandwidthPriority: priority,
    };

    if (labels.trim()) {
      params.labels = labels.split(',').map((l) => l.trim()).filter(Boolean);
    }

    if (mode === 'file' && filePath) {
      params.filename = filePath;
    } else if (mode === 'url' && url.trim()) {
      params.filename = url.trim();
    } else {
      setError('Please provide a torrent file or URL/magnet link');
      setSaving(false);
      return;
    }

    const result = await addTorrent(params);
    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? 'Failed to add torrent');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[500px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Torrent</h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Source tabs */}
          <div className="flex gap-2">
            <button
              className={`flex items-center gap-1 h-8 px-3 text-sm rounded border ${mode === 'url' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setMode('url')}
            >
              <Link size={14} />
              URL / Magnet
            </button>
            <button
              className={`flex items-center gap-1 h-8 px-3 text-sm rounded border ${mode === 'file' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setMode('file')}
            >
              <Upload size={14} />
              File
            </button>
          </div>

          {mode === 'url' ? (
            <div>
              <label className="text-xs text-muted-foreground">URL or Magnet Link</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="magnet:?xt= or https://..."
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground">Torrent File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 h-8 px-2 text-sm rounded border bg-background"
                  value={filePath}
                  readOnly
                  placeholder="Select a .torrent file..."
                />
                <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowseFile}>
                  Browse...
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Download Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-8 px-2 text-sm rounded border bg-background"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
              />
              <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowseDir}>
                Browse...
              </button>
            </div>
            {freeSpace !== null && (
              <div className="text-xs text-muted-foreground mt-1">
                Free space: {formatBytes(freeSpace)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Labels</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-sm rounded border bg-background"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="label1, label2"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select
                className="w-full h-8 px-2 text-sm rounded border bg-background"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                <option value={-1}>Low</option>
                <option value={0}>Normal</option>
                <option value={1}>High</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            Start paused
          </label>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>
            Cancel
          </button>
          <button
            className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
