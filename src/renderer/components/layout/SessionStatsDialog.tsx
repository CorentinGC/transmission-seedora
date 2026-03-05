import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { formatBytes, formatDuration } from '../../lib/format';
import { StatRow } from '../ui';

interface Props {
  onClose: () => void;
}

export function SessionStatsDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const stats = useSessionStore((s) => s.stats);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  if (!stats) return null;

  const cumulative = stats['cumulative-stats'];
  const current = stats['current-stats'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div ref={ref} className="bg-popover border rounded-lg shadow-lg p-4 w-[440px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-sm font-semibold mb-3">{t('sessionStats.title')}</h2>

        {/* Current session */}
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-1.5">{t('sessionStats.currentSession')}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <StatRow label={t('sessionStats.downloaded')} value={formatBytes(current.downloadedBytes)} />
            <StatRow label={t('sessionStats.uploaded')} value={formatBytes(current.uploadedBytes)} />
            <StatRow label={t('sessionStats.ratio')} value={current.downloadedBytes > 0 ? (current.uploadedBytes / current.downloadedBytes).toFixed(2) : '—'} />
            <StatRow label={t('sessionStats.filesAdded')} value={current.filesAdded.toLocaleString()} />
            <StatRow label={t('sessionStats.activeTime')} value={formatDuration(current.secondsActive)} />
            <StatRow label={t('sessionStats.downloadSpeed')} value={`${formatBytes(stats.downloadSpeed)}/s`} />
            <StatRow label={t('sessionStats.uploadSpeed')} value={`${formatBytes(stats.uploadSpeed)}/s`} />
          </div>
        </div>

        <div className="border-t my-2" />

        {/* Cumulative */}
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-1.5">{t('sessionStats.allTime')}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <StatRow label={t('sessionStats.downloaded')} value={formatBytes(cumulative.downloadedBytes)} />
            <StatRow label={t('sessionStats.uploaded')} value={formatBytes(cumulative.uploadedBytes)} />
            <StatRow label={t('sessionStats.ratio')} value={cumulative.downloadedBytes > 0 ? (cumulative.uploadedBytes / cumulative.downloadedBytes).toFixed(2) : '—'} />
            <StatRow label={t('sessionStats.filesAdded')} value={cumulative.filesAdded.toLocaleString()} />
            <StatRow label={t('sessionStats.activeTime')} value={formatDuration(cumulative.secondsActive)} />
            <StatRow label={t('sessionStats.sessionCount')} value={cumulative.sessionCount.toLocaleString()} />
          </div>
        </div>

        <div className="border-t my-2" />

        {/* General */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <StatRow label={t('sessionStats.activeTorrents')} value={String(stats.activeTorrentCount)} />
          <StatRow label={t('sessionStats.pausedTorrents')} value={String(stats.pausedTorrentCount)} />
          <StatRow label={t('sessionStats.totalTorrents')} value={String(stats.torrentCount)} />
        </div>

        <div className="flex justify-end mt-3">
          <button className="px-3 py-1 text-xs rounded border hover:bg-accent" onClick={onClose}>
            {t('app.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
