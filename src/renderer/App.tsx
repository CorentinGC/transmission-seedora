import { AppRoot } from '@shared/components/layout/AppRoot';
import { useTrayAndNotifications } from './hooks/useTrayAndNotifications';

/** Electron root: the shared app plus tray updates and completion notifications. */
export function App() {
  useTrayAndNotifications();
  return <AppRoot />;
}
