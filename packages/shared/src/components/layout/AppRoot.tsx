import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { useAppBootstrap, type PickInitialServer } from '../../hooks/useAppBootstrap';

interface Props {
  /** Which server to reconnect to at startup; defaults to the first one. */
  pickInitialServer?: PickInitialServer;
}

/** Root of the UI for every host: startup logic, error boundary and the application shell. */
export function AppRoot({ pickInitialServer }: Props) {
  useAppBootstrap(pickInitialServer);
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
