import { ArrowDown, ArrowUp, HardDrive, Turtle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { useServerStore } from '../../stores/server-store';
import { formatSpeed, formatBytes } from '../../lib/format';

export function StatusBar() {
  const { t } = useTranslation();
  const stats = useSessionStore((s) => s.stats);
  const settings = useSessionStore((s) => s.settings);
  const freeSpace = useSessionStore((s) => s.freeSpace);
  const toggleAltSpeed = useSessionStore((s) => s.toggleAltSpeed);
  const connectionStatus = useServerStore((s) => s.connectionStatus);

  const isConnected = connectionStatus === 'connected';
  const altSpeedEnabled = settings?.altSpeedEnabled ?? false;

  return (
    <div className="flex items-center gap-4 px-3 py-1 border-t bg-card text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`}
        />
        <span>{isConnected ? t('statusBar.connected') : connectionStatus === 'connecting' ? t('statusBar.connecting') : t('statusBar.disconnected')}</span>
      </div>

      {isConnected && stats && (
        <>
          <div className="flex items-center gap-1">
            <ArrowDown size={12} className="text-blue-500" />
            <span>{formatSpeed(stats.downloadSpeed)}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUp size={12} className="text-green-500" />
            <span>{formatSpeed(stats.uploadSpeed)}</span>
          </div>
          <div className="text-muted-foreground">
            {t('statusBar.activeTotal', { active: stats.activeTorrentCount, total: stats.torrentCount })}
          </div>

          <button
            className={`flex items-center gap-1 px-1 rounded hover:bg-accent ${altSpeedEnabled ? 'text-blue-500' : ''}`}
            onClick={toggleAltSpeed}
            title={altSpeedEnabled ? t('statusBar.disableAltSpeed') : t('statusBar.enableAltSpeed')}
          >
            <Turtle size={12} />
            <span>{altSpeedEnabled ? t('statusBar.alt') : ''}</span>
          </button>

          <div className="flex-1" />

          {freeSpace !== null && (
            <div className="flex items-center gap-1">
              <HardDrive size={12} />
              <span>{t('statusBar.freeSpace', { space: formatBytes(freeSpace) })}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
