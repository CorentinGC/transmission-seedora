import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload, Link, RefreshCw } from 'lucide-react';
import { Dialog, Button } from '../ui';
import { useTorrentStore } from '../../stores/torrent-store';
import { useSessionStore } from '../../stores/session-store';
import { useApi } from '../../platform/api-context';
import { guardedCall } from '../../lib/guarded-call';
import { fetchTorrentFields } from '../../hooks/useTorrentFields';
import { formatBytes } from '../../lib/format';
import type { AddDialogInitial } from '../../lib/launch-target';
import { errorCodeKey, isCancelled } from '../../lib/error-messages';
import { extractTrackersFromBase64, MAX_TRACKERS } from '../../lib/torrent-parser';

interface Props {
  onClose: () => void;
  /** Prefill from a magnet link or `.torrent` file the OS asked the app to open. */
  initial?: AddDialogInitial;
}

export function AddTorrentDialog({ onClose, initial }: Props) {
  const { t } = useTranslation();
  const addTorrent = useTorrentStore((s) => s.addTorrent);
  const settings = useSessionStore((s) => s.settings);
  const freeSpace = useSessionStore((s) => s.freeSpace);
  const fetchFreeSpace = useSessionStore((s) => s.fetchFreeSpace);

  const [mode, setMode] = useState<'file' | 'url'>(initial?.mode ?? 'url');
  const [url, setUrl] = useState(initial?.mode === 'url' ? initial.url : '');
  const [filePath, setFilePath] = useState(initial?.mode === 'file' ? initial.filePath : '');
  const [fileBase64, setFileBase64] = useState(initial?.mode === 'file' ? initial.fileBase64 : '');
  const [downloadDir, setDownloadDir] = useState(settings?.downloadDir ?? '');
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState('');
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [updatingTrackers, setUpdatingTrackers] = useState(false);
  const api = useApi();
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowseFile = async () => {
    // Electron: use native dialog + read file as base64
    if (api.dialogOpenFile) {
      const openFile = api.dialogOpenFile.bind(api);
      const res = await guardedCall(() => openFile(), 'notification.pickerFailed');
      const selectedPath = res?.data?.[0];
      if (selectedPath) {
        // Read file content as base64 for metainfo
        if (api.readFileBase64) {
          const readFile = api.readFileBase64.bind(api);
          const contentRes = await guardedCall(() => readFile(selectedPath), 'notification.fileReadFailed');
          // Without the content the add would send a local path the daemon cannot read.
          if (!contentRes?.data) return;
          setFileBase64(contentRes.data);
        }
        setFilePath(selectedPath);
        setMode('file');
      }
      return;
    }
    // Web: trigger hidden file input
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePath(file.name);
    setMode('file');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBrowseDir = async () => {
    if (!api.dialogOpenDirectory) return;
    const openDirectory = api.dialogOpenDirectory.bind(api);
    const res = await guardedCall(() => openDirectory(), 'notification.pickerFailed');
    if (res?.data) {
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

    if (mode === 'file' && filePath && fileBase64) {
      params.metainfo = fileBase64;
    } else if (mode === 'file' && filePath) {
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
    } else if (result.duplicate) {
      setDuplicateId(result.duplicateId ?? null);
      setError(t('dialog.errorDuplicate', { name: result.torrentName ?? '' }));
    } else if (!isCancelled(result.code)) {
      const reasonKey = errorCodeKey(result.code);
      setError(reasonKey ? t(reasonKey) : t('dialog.errorAddFailed'));
    }
    setSaving(false);
  };

  const handleUpdateTrackers = async () => {
    if (!duplicateId || !fileBase64) return;
    setUpdatingTrackers(true);
    try {
      const newTrackers = extractTrackersFromBase64(fileBase64);
      if (newTrackers.length === 0) {
        setError(t('dialog.errorNoTrackers'));
        setUpdatingTrackers(false);
        return;
      }
      // Get existing torrent's trackerList
      // A failed read must abort: merging into an empty list would overwrite the real trackers.
      const { trackerList } = await fetchTorrentFields<{ trackerList?: string }>(api, ['trackerList'], duplicateId);
      const existing = trackerList ?? '';
      const existingUrls = existing.split('\n').map((s) => s.trim()).filter(Boolean);
      // Merge: add new trackers that don't already exist
      const merged = [...existingUrls];
      const seen = new Set(existingUrls);
      let added = 0;
      for (const url of newTrackers) {
        if (merged.length >= MAX_TRACKERS) break;
        if (seen.has(url)) continue;
        seen.add(url);
        merged.push(url);
        added++;
      }
      if (added === 0) {
        setError(t('dialog.errorTrackersAlreadyPresent'));
        setUpdatingTrackers(false);
        return;
      }
      // Update the torrent's tracker list
      if (await setTorrentProps([duplicateId], { trackerList: merged.join('\n') + '\n' })) onClose();
    } catch {
      setError(t('dialog.errorAddFailed'));
    }
    setUpdatingTrackers(false);
  };

  return (
    <Dialog
      title={t('dialog.addTorrent')}
      onClose={onClose}
      width="w-[500px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button variant="primary" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" aria-label={t('app.loading')} /> : t('dialog.add')}
          </Button>
        </div>
      }
    >
    <div className="space-y-4">
      {/* Source tabs */}
      <div className="flex gap-2">
        <button
          className={`flex items-center gap-1 h-8 px-3 text-sm rounded border ${mode === 'url' ? 'bg-primary text-primary-foreground' : ''}`}
          aria-pressed={mode === 'url'}
          onClick={() => setMode('url')}
        >
          <Link size={14} />
          {t('dialog.urlMagnet')}
        </button>
        <button
          className={`flex items-center gap-1 h-8 px-3 text-sm rounded border ${mode === 'file' ? 'bg-primary text-primary-foreground' : ''}`}
          aria-pressed={mode === 'file'}
          onClick={() => setMode('file')}
        >
          <Upload size={14} />
          {t('dialog.file')}
        </button>
      </div>

      {mode === 'url' ? (
        <div>
          <label htmlFor="add-field-1" className="text-xs text-muted-foreground">{t('dialog.urlOrMagnet')}</label>
          <input id="add-field-1"
            type="text"
            className="w-full h-8 px-2 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('dialog.urlPlaceholder')}
            data-autofocus
          />
        </div>
      ) : (
        <div>
          <label htmlFor="add-field-2" className="text-xs text-muted-foreground">{t('dialog.torrentFile')}</label>
          <div className="flex gap-2">
            <input id="add-field-2"
              type="text"
              className="flex-1 h-8 px-2 text-sm rounded border bg-background"
              value={filePath}
              readOnly
              placeholder={t('dialog.selectTorrentFile')}
            />
            <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowseFile}>
              {t('dialog.browse')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".torrent"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="add-field-3" className="text-xs text-muted-foreground">{t('dialog.downloadDirectory')}</label>
        <div className="flex gap-2">
          <input id="add-field-3"
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
          <label htmlFor="add-field-4" className="text-xs text-muted-foreground">{t('torrent.labels')}</label>
          <input id="add-field-4"
            type="text"
            className="w-full h-8 px-2 text-sm rounded border bg-background"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder={t('optionsTab.labelsPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="add-field-5" className="text-xs text-muted-foreground">{t('torrent.priority')}</label>
          <select
            id="add-field-5"
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
        <div className="text-sm text-destructive-text bg-destructive/10 p-2 rounded">
          <p>{error}</p>
          {duplicateId && fileBase64 && (
            <button
              className="mt-2 flex items-center gap-1 h-7 px-3 text-xs rounded border border-destructive/40 hover:bg-destructive/10 disabled:opacity-50"
              onClick={handleUpdateTrackers}
              disabled={updatingTrackers}
            >
              {updatingTrackers ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t('dialog.updateTrackers')}
            </button>
          )}
        </div>
      )}
    </div>
    </Dialog>
  );
}
