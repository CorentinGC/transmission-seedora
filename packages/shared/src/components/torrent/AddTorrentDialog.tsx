import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Upload, Link } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { useSessionStore } from '../../stores/session-store';
import { useApi } from '../../platform/api-context';
import { formatBytes } from '../../lib/format';

interface Props {
  onClose: () => void;
}

export function AddTorrentDialog({ onClose }: Props) {
  const { t } = useTranslation();
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
  const api = useApi();

  const handleBrowseFile = async () => {
    if (!api.dialogOpenFile) return;
    const res = await api.dialogOpenFile();
    if (res.success && res.data && res.data.length > 0) {
      setFilePath(res.data[0]);
      setMode('file');
    }
  };

  const handleBrowseDir = async () => {
    if (!api.dialogOpenDirectory) return;
    const res = await api.dialogOpenDirectory();
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
      setError(t('dialog.errorNoInput'));
      setSaving(false);
      return;
    }

    const result = await addTorrent(params);
    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? t('dialog.errorAddFailed'));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[500px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('dialog.addTorrent')}</h2>
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
              {t('dialog.urlMagnet')}
            </button>
            <button
              className={`flex items-center gap-1 h-8 px-3 text-sm rounded border ${mode === 'file' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setMode('file')}
            >
              <Upload size={14} />
              {t('dialog.file')}
            </button>
          </div>

          {mode === 'url' ? (
            <div>
              <label className="text-xs text-muted-foreground">{t('dialog.urlOrMagnet')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('dialog.urlPlaceholder')}
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground">{t('dialog.torrentFile')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 h-8 px-2 text-sm rounded border bg-background"
                  value={filePath}
                  readOnly
                  placeholder={t('dialog.selectTorrentFile')}
                />
                <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowseFile}>
                  {t('dialog.browse')}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">{t('dialog.downloadDirectory')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-8 px-2 text-sm rounded border bg-background"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
              />
              <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowseDir}>
                {t('dialog.browse')}
              </button>
            </div>
            {freeSpace !== null && (
              <div className="text-xs text-muted-foreground mt-1">
                {t('dialog.freeSpace', { space: formatBytes(freeSpace) })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('torrent.labels')}</label>
              <input
                type="text"
                className="w-full h-8 px-2 text-sm rounded border bg-background"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder={t('optionsTab.labelsPlaceholder')}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('torrent.priority')}</label>
              <select
                className="w-full h-8 px-2 text-sm rounded border bg-background"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                <option value={-1}>{t('priority.low')}</option>
                <option value={0}>{t('priority.normal')}</option>
                <option value={1}>{t('priority.high')}</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            {t('dialog.startPaused')}
          </label>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button
            className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t('dialog.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
