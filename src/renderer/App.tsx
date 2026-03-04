import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useServerStore } from './stores/server-store';
import { useUiStore } from './stores/ui-store';
import { useTrayAndNotifications } from './hooks/useTrayAndNotifications';

export function App() {
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const theme = useUiStore((s) => s.theme);

  // Tray updates + completion notifications
  useTrayAndNotifications();

  useEffect(() => {
    fetchServers().then(() => {
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

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return <AppShell />;
}
