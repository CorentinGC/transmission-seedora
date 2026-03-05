import { createContext, useContext } from 'react';
import type { PlatformApi } from './api-types';

const ApiContext = createContext<PlatformApi | null>(null);

export function ApiProvider({ api, children }: { api: PlatformApi; children: React.ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): PlatformApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used within an ApiProvider');
  return api;
}
