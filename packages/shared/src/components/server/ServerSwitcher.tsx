import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Plus, ChevronDown, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { useServerStore } from '../../stores/server-store';
import { ServerFormDialog } from './ServerFormDialog';
import { ExportPasswordsOption } from './ExportPasswordsOption';
import type { ServerConfig } from '../../types';
import { useApi } from '../../platform/api-context';
import { useNotificationStore } from '../../stores/notification-store';
import { runConfigExport } from '../../lib/config-export';

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
  const [includePasswords, setIncludePasswords] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const api = useApi();

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
    if (confirmDelete === server.id) {
      if (server.id === activeServerId) {
        await setActiveServer(null);
      }
      await removeServer(server.id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(server.id);
    }
  };

  const exportJson = (options: Parameters<typeof api.configExport>[0], filename: string) =>
    runConfigExport(api, { ...options, includePasswords }, filename);

  const handleExportServer = async (server: ServerConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    await exportJson({ servers: true, serverIds: [server.id] }, `${server.name.replace(/[^a-zA-Z0-9]/g, '-')}.json`);
  };

  const handleExportAll = async () => {
    setOpen(false);
    await exportJson({ servers: true }, 'seedora-servers.json');
  };

  const notifyImportFailed = () => useNotificationStore.getState().notify('server.importFailed');

  const handleImport = async () => {
    if (api.dialogOpenFile) {
      // Electron: native file dialog
      const fileRes = await api.dialogOpenFile({
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!fileRes.success || !fileRes.data?.length) return;
      try {
        const importRes = await api.configImport({ filePath: fileRes.data[0] });
        if (importRes.success && importRes.data) {
          const d = importRes.data as { serversAdded: number; serversSkipped: number };
          setImportMsg(t('server.importSuccess', { added: d.serversAdded, skipped: d.serversSkipped }));
          await fetchServers();
          setTimeout(() => setImportMsg(null), 3000);
        } else {
          notifyImportFailed();
        }
      } catch {
        notifyImportFailed();
      }
      setOpen(false);
    } else {
      // Web: trigger hidden file input
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importRes = await api.configImport(data);
      if (importRes.success) {
        const counts = importRes.data as { serversAdded: number; serversSkipped: number } | undefined;
        setImportMsg(
          t('server.importSuccess', { added: counts?.serversAdded ?? 0, skipped: counts?.serversSkipped ?? 0 }),
        );
        await fetchServers();
        setTimeout(() => setImportMsg(null), 3000);
      } else {
        notifyImportFailed();
      }
    } catch {
      notifyImportFailed();
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Hidden file input for web import fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileInputChange}
      />
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
              ? 'bg-success'
              : connectionStatus === 'error'
                ? 'bg-destructive-text'
                : 'bg-muted-foreground'
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
                      confirmDelete === server.id
                        ? 'text-destructive-text bg-destructive/10'
                        : 'hover:bg-destructive/10 hover:text-destructive-text'
                    }`}
                    onClick={(e) => handleDelete(server, e)}
                    title={t('server.deleteServer')}
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
            <ExportPasswordsOption className="px-3 py-2 border-t" checked={includePasswords} onChange={setIncludePasswords} />
            {importMsg && (
              <div className="px-3 py-1.5 text-xs text-success bg-success/10 border-t">
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
