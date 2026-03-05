import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Plus, ChevronDown, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { useServerStore } from '../../stores/server-store';
import { ServerFormDialog } from './ServerFormDialog';
import type { ServerConfig } from '@shared/types';

export function ServerSwitcher() {
  const { t } = useTranslation();
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const connectionStatus = useServerStore((s) => s.connectionStatus);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const removeServer = useServerStore((s) => s.removeServer);

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editServer, setEditServer] = useState<ServerConfig | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleEdit = (server: ServerConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setEditServer(server);
  };

  const handleDelete = async (server: ServerConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (server.id === activeServerId) return;
    if (confirmDelete === server.id) {
      await removeServer(server.id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(server.id);
    }
  };

  const handleExportServer = async (server: ServerConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await window.api.configExport({ servers: true, serverIds: [server.id] });
    if (res.success && res.data) {
      const json = JSON.stringify(res.data, null, 2);
      await window.api.dialogSaveFile({ defaultPath: `${server.name.replace(/[^a-zA-Z0-9]/g, '-')}.json` }, json);
    }
    setOpen(false);
  };

  const handleExportAll = async () => {
    const res = await window.api.configExport({ servers: true });
    if (res.success && res.data) {
      const json = JSON.stringify(res.data, null, 2);
      await window.api.dialogSaveFile({ defaultPath: 'transmission-remote-servers.json' }, json);
    }
    setOpen(false);
  };

  const handleImport = async () => {
    const fileRes = await window.api.dialogOpenFile({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!fileRes.success || !fileRes.data?.length) return;

    try {
      const importRes = await window.api.configImport({ filePath: fileRes.data[0] });
      if (importRes.success && importRes.data) {
        const d = importRes.data as { serversAdded: number; serversSkipped: number };
        setImportMsg(t('server.importSuccess', { added: d.serversAdded, skipped: d.serversSkipped }));
        await fetchServers();
        setTimeout(() => setImportMsg(null), 3000);
      }
    } catch {
      setImportMsg('Import failed');
      setTimeout(() => setImportMsg(null), 3000);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 h-7 px-2 rounded hover:bg-accent text-sm"
        onClick={() => setOpen(!open)}
      >
        <Server size={14} />
        <span className="max-w-32 truncate">
          {activeServer?.name ?? t('server.noServer')}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'error'
                ? 'bg-red-500'
                : 'bg-gray-400'
          }`}
        />
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirmDelete(null); }} />
          <div className="absolute top-full left-0 mt-1 w-72 rounded-md border bg-popover shadow-lg z-50">
            {servers.map((server) => (
              <div
                key={server.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer ${
                  server.id === activeServerId ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setActiveServer(server.id);
                  setOpen(false);
                  setConfirmDelete(null);
                }}
              >
                <Server size={14} className="shrink-0" />
                <span className="flex-1 truncate">{server.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {server.host}:{server.port}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    className="p-0.5 rounded hover:bg-primary/10"
                    onClick={(e) => handleExportServer(server, e)}
                    title={t('server.exportServer')}
                  >
                    <Download size={12} />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-primary/10"
                    onClick={(e) => handleEdit(server, e)}
                    title={t('server.editServer')}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className={`p-0.5 rounded ${
                      server.id === activeServerId
                        ? 'opacity-30 cursor-not-allowed'
                        : confirmDelete === server.id
                          ? 'text-red-500 bg-red-500/10'
                          : 'hover:bg-red-500/10 hover:text-red-500'
                    }`}
                    onClick={(e) => handleDelete(server, e)}
                    disabled={server.id === activeServerId}
                    title={server.id === activeServerId ? t('server.cannotDeleteActive') : t('server.deleteServer')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            <div className="border-t" />
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                setOpen(false);
                setShowForm(true);
              }}
            >
              <Plus size={14} />
              <span>{t('server.addServer')}</span>
            </button>
            <div className="flex items-center border-t">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs hover:bg-accent text-muted-foreground"
                onClick={handleExportAll}
              >
                <Download size={12} />
                {t('server.exportAll')}
              </button>
              <div className="w-px h-5 bg-border" />
              <button
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs hover:bg-accent text-muted-foreground"
                onClick={handleImport}
              >
                <Upload size={12} />
                {t('server.importServers')}
              </button>
            </div>
            {importMsg && (
              <div className="px-3 py-1.5 text-xs text-green-600 bg-green-500/10 border-t">
                {importMsg}
              </div>
            )}
          </div>
        </>
      )}

      {(showForm || editServer) && (
        <ServerFormDialog
          server={editServer ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditServer(null);
            fetchServers();
          }}
        />
      )}
    </div>
  );
}
