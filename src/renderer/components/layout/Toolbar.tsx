import {
  Play,
  Pause,
  Plus,
  Trash2,
  CheckCircle,
  Search,
  Settings,
  Sliders,
  PlayCircle,
  StopCircle,
  PanelBottom,
  PanelLeft,
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTorrentStore } from '../../stores/torrent-store';
import { useServerStore } from '../../stores/server-store';
import { useUiStore } from '../../stores/ui-store';
import { useMenuEvents } from '../../hooks/useMenuEvents';
import { ServerSwitcher } from '../server/ServerSwitcher';
import { AddTorrentDialog } from '../torrent/AddTorrentDialog';
import { RemoveTorrentDialog } from '../torrent/RemoveTorrentDialog';
import { SettingsDialog } from '../settings/SettingsDialog';
import { AppPrefsDialog } from '../settings/AppPrefsDialog';

export function Toolbar() {
  const { t } = useTranslation();
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const startTorrents = useTorrentStore((s) => s.startTorrents);
  const stopTorrents = useTorrentStore((s) => s.stopTorrents);
  const verifyTorrents = useTorrentStore((s) => s.verifyTorrents);
  const startAll = useTorrentStore((s) => s.startAll);
  const stopAll = useTorrentStore((s) => s.stopAll);
  const globalFilter = useTorrentStore((s) => s.globalFilter);
  const setGlobalFilter = useTorrentStore((s) => s.setGlobalFilter);
  const connectionStatus = useServerStore((s) => s.connectionStatus);
  const toggleFilterPanel = useUiStore((s) => s.toggleFilterPanel);
  const toggleDetailsPanel = useUiStore((s) => s.toggleDetailsPanel);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  // Native menu events
  useMenuEvents({
    onAddTorrent: () => setShowAddDialog(true),
    onAddMagnet: () => setShowAddDialog(true),
    onOpenSettings: () => setShowSettings(true),
    onOpenPreferences: () => setShowPrefs(true),
    onRemoveTorrent: () => setShowRemoveDialog(true),
  });

  const ids = Array.from(selectedIds);
  const hasSelection = ids.length > 0;
  const isConnected = connectionStatus === 'connected';

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-card">
        <ServerSwitcher />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Plus size={16} />}
          tooltip={t('toolbar.addTorrent')}
          onClick={() => setShowAddDialog(true)}
          disabled={!isConnected}
          colorClass="text-blue-400/80"
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Play size={16} />}
          tooltip={t('toolbar.start')}
          onClick={() => hasSelection && startTorrents(ids)}
          disabled={!hasSelection || !isConnected}
          colorClass="text-green-400/80"
        />
        <ToolbarButton
          icon={<Pause size={16} />}
          tooltip={t('toolbar.stop')}
          onClick={() => hasSelection && stopTorrents(ids)}
          disabled={!hasSelection || !isConnected}
          colorClass="text-amber-400/80"
        />
        <ToolbarButton
          icon={<Trash2 size={16} />}
          tooltip={t('toolbar.remove')}
          onClick={() => setShowRemoveDialog(true)}
          disabled={!hasSelection || !isConnected}
          colorClass="text-red-400/70"
        />
        <ToolbarButton
          icon={<CheckCircle size={16} />}
          tooltip={t('toolbar.verify')}
          onClick={() => hasSelection && verifyTorrents(ids)}
          disabled={!hasSelection || !isConnected}
          colorClass="text-cyan-400/70"
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<PlayCircle size={16} />}
          tooltip={t('toolbar.startAll')}
          onClick={startAll}
          disabled={!isConnected}
          colorClass="text-green-400/80"
        />
        <ToolbarButton
          icon={<StopCircle size={16} />}
          tooltip={t('toolbar.stopAll')}
          onClick={stopAll}
          disabled={!isConnected}
          colorClass="text-amber-400/80"
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<PanelLeft size={16} />}
          tooltip={t('toolbar.filterPanel')}
          onClick={toggleFilterPanel}
        />
        <ToolbarButton
          icon={<PanelBottom size={16} />}
          tooltip={t('toolbar.detailsPanel')}
          onClick={toggleDetailsPanel}
        />

        <div className="flex-1" />

        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('toolbar.searchPlaceholder')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-7 pl-7 pr-2 w-48 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Sliders size={16} />}
          tooltip={t('toolbar.preferences')}
          onClick={() => setShowPrefs(true)}
          colorClass="text-muted-foreground"
        />
        <ToolbarButton
          icon={<Settings size={16} />}
          tooltip={t('toolbar.serverSettings')}
          onClick={() => setShowSettings(true)}
          disabled={!isConnected}
          colorClass="text-muted-foreground"
        />
      </div>

      {showAddDialog && <AddTorrentDialog onClose={() => setShowAddDialog(false)} />}
      {showRemoveDialog && <RemoveTorrentDialog ids={ids} onClose={() => setShowRemoveDialog(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showPrefs && <AppPrefsDialog onClose={() => setShowPrefs(false)} />}
    </>
  );
}

function ToolbarButton({
  icon,
  tooltip,
  onClick,
  disabled,
  colorClass,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  colorClass?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 800);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setShowTooltip(false);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={`inline-flex items-center justify-center h-7 w-7 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none ${colorClass ?? ''}`}
        onClick={onClick}
        disabled={disabled}
      >
        {icon}
      </button>
      {showTooltip && (
        <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded bg-popover text-popover-foreground border shadow-md whitespace-nowrap pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}
