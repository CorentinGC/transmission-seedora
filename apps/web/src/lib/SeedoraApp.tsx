'use client';

import { ApiProvider } from '@shared/platform/api-context';
import { initPlatformApi } from '@shared/platform/api-store';
import { webApi } from './web-api';
import { WebApp } from './WebApp';
import './i18n';

// Initialize the platform API for stores (module-level access)
initPlatformApi(webApi);

export default function SeedoraApp() {
  return (
    <ApiProvider api={webApi}>
      <WebApp />
    </ApiProvider>
  );
}
