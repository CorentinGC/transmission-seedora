import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Plus, ChevronDown } from 'lucide-react';
import { useServerStore } from '../../stores/server-store';
import { ServerFormDialog } from './ServerFormDialog';

export function ServerSwitcher() {
  const { t } = useTranslation();
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const connectionStatus = useServerStore((s) => s.connectionStatus);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const activeServer = servers.find((s) => s.id === activeServerId);

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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 rounded-md border bg-popover shadow-lg z-50">
            {servers.map((server) => (
              <button
                key={server.id}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left ${
                  server.id === activeServerId ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setActiveServer(server.id);
                  setOpen(false);
                }}
              >
                <Server size={14} />
                <span className="flex-1 truncate">{server.name}</span>
                <span className="text-xs text-muted-foreground">
                  {server.host}:{server.port}
                </span>
              </button>
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
          </div>
        </>
      )}

      {showForm && (
        <ServerFormDialog onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
