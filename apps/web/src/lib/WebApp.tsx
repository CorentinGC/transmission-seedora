'use client';

import '@shared/lib/i18n';
import { AppRoot } from '@shared/components/layout/AppRoot';
import { pickInitialServerId } from './initial-server';
import { getActiveServerId } from './web-storage';

const pickInitialServer = (servers: readonly { id: string }[]) => pickInitialServerId(servers, getActiveServerId());

/** Web root: the shared app root with the stored active server restored at startup. */
export function WebApp() {
  return <AppRoot pickInitialServer={pickInitialServer} />;
}
