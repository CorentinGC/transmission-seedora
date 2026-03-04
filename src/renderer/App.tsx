import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useServerStore } from './stores/server-store';

export function App() {
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  useEffect(() => {
    fetchServers().then(() => {
      // Auto-connect to first server if none active
      window.api.prefsGet().then((res) => {
        if (res.success && res.data) {
          // Load preferences on startup
        }
      });
    });
  }, [fetchServers]);

  // Auto-connect to the first server after servers are loaded
  useEffect(() => {
    if (servers.length > 0 && !activeServerId) {
      setActiveServer(servers[0].id);
    }
  }, [servers, activeServerId, setActiveServer]);

  return <AppShell />;
}
