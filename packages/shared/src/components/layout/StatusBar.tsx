import { useState } from 'react';
import { ArrowDown, ArrowUp, HardDrive, Turtle, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { useServerStore } from '../../stores/server-store';
import { formatSpeed, formatBytes } from '../../lib/format';
import { DiskSpaceDialog } from './DiskSpaceDialog';
import { SpeedLimitPopover } from './SpeedLimitPopover';
import { SessionStatsDialog } from './SessionStatsDialog';

const SPEED_BUTTON = 'flex items-center gap-1 px-1 rounded hover:bg-accent pointer-coarse:min-h-11';

export function StatusBar() {
  const { t } = useTranslation();
  const stats = useSessionStore((s) => s.stats);
  const settings = useSessionStore((s) => s.settings);
  const freeSpace = useSessionStore((s) => s.freeSpace);
  const totalSpace = useSessionStore((s) => s.totalSpace);
  const toggleAltSpeed = useSessionStore((s) => s.toggleAltSpeed);
  const connectionStatus = useServerStore((s) => s.connectionStatus);
  const connectionError = useServerStore((s) => s.connectionError);

  const [showDiskSpace, setShowDiskSpace] = useState(false);
  const [showSessionStats, setShowSessionStats] = useState(false);
  const [speedPopover, setSpeedPopover] = useState<{ x: number; y: number; direction: 'down' | 'up' } | null>(null);

  /** Click or keyboard activation: anchor the popover on the button itself. */
  const openSpeedPopover = (e: React.MouseEvent<HTMLElement>, direction: 'down' | 'up') => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpeedPopover({ x: rect.left + rect.width / 2, y: rect.top, direction });
  };

  const isConnected = connectionStatus === 'connected';
  const altSpeedEnabled = settings?.altSpeedEnabled ?? false;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1 border-t bg-card text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-1" title={connectionStatus === 'error' ? connectionError ?? undefined : undefined}>
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-success' : connectionStatus === 'error' ? 'bg-destructive-text' : 'bg-muted-foreground'
          }`}
        />
        <span>{isConnected ? t('statusBar.connected') : connectionStatus === 'connecting' ? t('statusBar.connecting') : connectionStatus === 'error' ? t('statusBar.connectionError') : t('statusBar.disconnected')}</span>
      </div>

      {isConnected && stats && (
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${t('statusBar.downloadLimit')}: ${formatSpeed(stats.downloadSpeed)}`}
            className={SPEED_BUTTON}
            onClick={(e) => openSpeedPopover(e, 'down')}
            onContextMenu={(e) => { e.preventDefault(); setSpeedPopover({ x: e.clientX, y: e.clientY, direction: 'down' }); }}
          >
            <ArrowDown size={12} className="text-info" aria-hidden="true" />
            <span>{formatSpeed(stats.downloadSpeed)}</span>
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${t('statusBar.uploadLimit')}: ${formatSpeed(stats.uploadSpeed)}`}
            className={SPEED_BUTTON}
            onClick={(e) => openSpeedPopover(e, 'up')}
            onContextMenu={(e) => { e.preventDefault(); setSpeedPopover({ x: e.clientX, y: e.clientY, direction: 'up' }); }}
          >
            <ArrowUp size={12} className="text-success" aria-hidden="true" />
            <span>{formatSpeed(stats.uploadSpeed)}</span>
          </button>
          <div className="text-muted-foreground">
            {t('statusBar.activeTotal', { active: stats.activeTorrentCount, total: stats.torrentCount })}
          </div>

          <button
            type="button"
            aria-pressed={altSpeedEnabled}
            className={`flex items-center gap-1 px-1 rounded hover:bg-accent pointer-coarse:min-h-11 ${altSpeedEnabled ? 'text-info' : ''}`}
            onClick={toggleAltSpeed}
            title={altSpeedEnabled ? t('statusBar.disableAltSpeed') : t('statusBar.enableAltSpeed')}
          >
            <Turtle size={12} aria-hidden="true" />
            <span>{altSpeedEnabled ? t('statusBar.alt') : ''}</span>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            className="flex items-center gap-1 hover:bg-accent px-1 rounded cursor-pointer pointer-coarse:min-h-11"
            onClick={() => setShowSessionStats(true)}
          >
            <BarChart3 size={12} aria-hidden="true" />
            <span>
              ↓ {formatBytes(stats.cumulativeStats.downloadedBytes)} ↑ {formatBytes(stats.cumulativeStats.uploadedBytes)}
            </span>
          </button>

          {freeSpace !== null && (
            <button
              type="button"
            className="flex items-center gap-1 hover:bg-accent px-1 rounded cursor-pointer pointer-coarse:min-h-11"
              onClick={() => setShowDiskSpace(true)}
            >
              <HardDrive size={12} aria-hidden="true" />
              <span>
                {totalSpace
                  ? t('statusBar.freeOfTotal', { free: formatBytes(freeSpace), total: formatBytes(totalSpace) })
                  : t('statusBar.freeSpace', { space: formatBytes(freeSpace) })}
              </span>
            </button>
          )}
        </>
      )}

      {showDiskSpace && <DiskSpaceDialog onClose={() => setShowDiskSpace(false)} />}
      {showSessionStats && <SessionStatsDialog onClose={() => setShowSessionStats(false)} />}

      {speedPopover && (
        <SpeedLimitPopover
          x={speedPopover.x}
          y={speedPopover.y}
          direction={speedPopover.direction}
          onClose={() => setSpeedPopover(null)}
        />
      )}
    </div>
  );
}
