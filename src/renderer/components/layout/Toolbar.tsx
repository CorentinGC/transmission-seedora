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
import { useState } from 'react';
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
          title="Add Torrent"
          onClick={() => setShowAddDialog(true)}
          disabled={!isConnected}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Play size={16} />}
          title="Start"
          onClick={() => hasSelection && startTorrents(ids)}
          disabled={!hasSelection || !isConnected}
        />
        <ToolbarButton
          icon={<Pause size={16} />}
          title="Stop"
          onClick={() => hasSelection && stopTorrents(ids)}
          disabled={!hasSelection || !isConnected}
        />
        <ToolbarButton
          icon={<Trash2 size={16} />}
          title="Remove"
          onClick={() => setShowRemoveDialog(true)}
          disabled={!hasSelection || !isConnected}
        />
        <ToolbarButton
          icon={<CheckCircle size={16} />}
          title="Verify"
          onClick={() => hasSelection && verifyTorrents(ids)}
          disabled={!hasSelection || !isConnected}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<PlayCircle size={16} />}
          title="Start All"
          onClick={startAll}
          disabled={!isConnected}
        />
        <ToolbarButton
          icon={<StopCircle size={16} />}
          title="Stop All"
          onClick={stopAll}
          disabled={!isConnected}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<PanelLeft size={16} />}
          title="Toggle Filter Panel"
          onClick={toggleFilterPanel}
        />
        <ToolbarButton
          icon={<PanelBottom size={16} />}
          title="Toggle Details Panel"
          onClick={toggleDetailsPanel}
        />

        <div className="flex-1" />

        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search torrents..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-7 pl-7 pr-2 w-48 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Sliders size={16} />}
          title="Preferences"
          onClick={() => setShowPrefs(true)}
        />
        <ToolbarButton
          icon={<Settings size={16} />}
          title="Server Settings"
          onClick={() => setShowSettings(true)}
          disabled={!isConnected}
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
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}
