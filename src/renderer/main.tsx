import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ApiProvider } from '@shared/platform/api-context';
import { initPlatformApi } from '@shared/platform/api-store';
import { electronApi } from './electron-api';
import '@shared/lib/i18n';
import '@shared/globals.css';

// Initialize the platform API for stores (module-level access)
initPlatformApi(electronApi);

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <ApiProvider api={electronApi}>
      <App />
    </ApiProvider>
  </StrictMode>,
);
