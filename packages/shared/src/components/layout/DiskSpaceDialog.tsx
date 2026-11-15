import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive } from 'lucide-react';
import { Dialog } from '../ui';
import { useSessionStore, type FreeSpaceDetail } from '../../stores/session-store';
import { useTorrentStore } from '../../stores/torrent-store';
import { formatBytes } from '../../lib/format';

interface Props {
  onClose: () => void;
}

export function DiskSpaceDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const fetchFreeSpaceDetails = useSessionStore((s) => s.fetchFreeSpaceDetails);
  const freeSpaceDetails = useSessionStore((s) => s.freeSpaceDetails);
  const torrents = useTorrentStore((s) => s.torrents);

  useEffect(() => {
    const paths = new Set<string>();
    for (const tor of torrents.values()) {
      if (tor.downloadDir) paths.add(tor.downloadDir);
    }
    if (paths.size > 0) {
      fetchFreeSpaceDetails(Array.from(paths));
    }
  }, [torrents, fetchFreeSpaceDetails]);

  // Deduplicate by freeSpace value (same mount point)
  const deduped = deduplicateByMount(freeSpaceDetails ?? []);
  const totalFree = deduped.reduce((sum, d) => sum + d.freeSpace, 0);

  return (
    <Dialog
      title={
        <span className="flex items-center gap-2">
          <HardDrive size={16} aria-hidden="true" />
          {t('statusBar.diskSpaceTitle')}
        </span>
      }
      onClose={onClose}
      width="w-[500px]"
      maxHeight="max-h-[400px]"
      footer={
        deduped.length > 1 ? (
          <div className="flex justify-between text-sm font-medium">
            <span>{t('statusBar.totalFreeSpace')}</span>
            <span>{formatBytes(totalFree)}</span>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {deduped.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">{t('app.loading')}</div>
        )}

        {deduped.map((detail) => (
          <div key={detail.path} className="text-sm">
            <div className="flex justify-between mb-1">
              <span className="font-mono text-xs truncate flex-1 mr-2" title={detail.path}>{detail.path}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatBytes(detail.freeSpace)} {t('statusBar.freeSpace', { space: '' }).replace(' ', '').length > 0 ? '' : 'free'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-info rounded-full"
                style={{ width: '100%', opacity: Math.max(0.15, 1 - detail.freeSpace / (1024 * 1024 * 1024 * 1024)) }}
              />
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function deduplicateByMount(details: FreeSpaceDetail[]): FreeSpaceDetail[] {
  const seen = new Map<number, FreeSpaceDetail>();
  for (const d of details) {
    // Group by freeSpace value as a heuristic for same mount point
    if (!seen.has(d.freeSpace)) {
      seen.set(d.freeSpace, d);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.path.localeCompare(b.path));
}
