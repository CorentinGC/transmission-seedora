import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '@shared/types';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-store-'));
vi.mock('electron', () => ({ app: { getPath: () => dir } }));

const { configStore } = await import('./config-store');

const server: ServerConfig = { id: 's1', name: 'n', host: 'nas', port: 9091, path: '/transmission/rpc', useSSL: false };

beforeAll(() => fs.rmSync(path.join(dir, 'config.json'), { force: true }));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('configStore patches', () => {
  it('does not erase a server field when the patch carries an explicit undefined', () => {
    configStore.addServer(server);
    configStore.updateServer('s1', { host: undefined, port: 1234 });
    expect(configStore.getServers()[0]).toMatchObject({ host: 'nas', port: 1234 });
  });

  it('does not erase a preference when the patch carries an explicit undefined', () => {
    configStore.updatePreferences({ language: 'fr' });
    configStore.updatePreferences({ language: undefined, theme: 'dark' });
    expect(configStore.getPreferences()).toMatchObject({ language: 'fr', theme: 'dark' });
  });
});
