import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ServerConfig, ServerConfigPatch, AppPreferences } from '@shared/types';
import { preferenceFields } from '../security/schemas';
import { sameEndpoint, sameProxy } from '../security/server-credentials';
import { stripUndefined } from '../security/strip-undefined';
import { writeFileAtomic } from './atomic-write';
import { safeStorageCrypto, type SecretCrypto } from './secret-crypto';

/** A server as written to disk: passwords are encrypted (`*Enc`), or cleartext only when no secret store exists. */
type StoredServer = Omit<ServerConfig, 'password' | 'proxyPassword' | 'hasPassword' | 'hasProxyPassword'> & {
  password?: string;
  passwordEnc?: string;
  proxyPassword?: string;
  proxyPasswordEnc?: string;
};

interface StoreData {
  servers: StoredServer[];
  activeServerId: string | null;
  preferences: AppPreferences;
}

/** Why the configuration file could not be used as-is at startup. */
export interface ConfigLoadError {
  /** `corrupt`: invalid content (moved aside). `unreadable`: the file exists but cannot be read (left untouched). */
  kind: 'corrupt' | 'unreadable';
  /** Where the invalid file was moved; absent when it could not be moved. */
  backupPath?: string;
}

/** Raised for writes while the configuration file is unreadable: the existing file must not be overwritten. */
export class ConfigStoreError extends Error {}

const DEFAULT_PREFERENCES: AppPreferences = {
  pollingInterval: 3000,
  theme: 'system',
  minimizeToTray: false,
  closeToTray: false,
  showNotifications: true,
  relativeDates: true,
  language: 'en',
  watchFolderEnabled: false,
  deleteWatchedTorrent: false,
};

const storedServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  port: z.number(),
  path: z.string(),
  useSSL: z.boolean(),
  allowSelfSigned: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  passwordEnc: z.string().optional(),
  proxyType: z.enum(['none', 'http', 'socks5']).optional(),
  proxyHost: z.string().optional(),
  proxyPort: z.number().optional(),
  proxyUsername: z.string().optional(),
  proxyPassword: z.string().optional(),
  proxyPasswordEnc: z.string().optional(),
});

const storedDataSchema = z.object({
  servers: z.array(storedServerSchema).default([]),
  activeServerId: z.string().nullable().default(null),
  preferences: z.record(z.string(), z.unknown()).default({}),
});

/** Keeps the stored preferences that are still valid, one field at a time; unknown or invalid keys are dropped. */
function sanitizePreferences(stored: Record<string, unknown>): AppPreferences {
  const valid: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(preferenceFields)) {
    if (!Object.hasOwn(stored, key)) continue;
    const parsed = schema.safeParse(stored[key]);
    if (parsed.success && parsed.data !== undefined) valid[key] = parsed.data;
  }
  return { ...DEFAULT_PREFERENCES, ...valid };
}

type SecretField = 'password' | 'proxyPassword';

/** Options of a store instance (injectable for tests). */
export interface ConfigStoreOptions {
  filePath: () => string;
  crypto: SecretCrypto;
  now?: () => number;
}

/** Creates a configuration store bound to one file. The file is read once; every change is written through. */
export function createConfigStore({ filePath, crypto, now = Date.now }: ConfigStoreOptions) {
  let data: StoreData | null = null;
  let loadError: ConfigLoadError | undefined;
  let writeBlocked = false;

  const fresh = (): StoreData => ({ servers: [], activeServerId: null, preferences: { ...DEFAULT_PREFERENCES } });

  function moveAside(file: string): string | undefined {
    const backup = `${file}.corrupt-${now()}`;
    try {
      fs.renameSync(file, backup);
      try {
        fs.chmodSync(backup, 0o600); // a legacy file holds cleartext passwords
      } catch {
        // best effort (no POSIX modes on Windows)
      }
      return backup;
    } catch {
      return undefined;
    }
  }

  function load(): StoreData {
    const file = filePath();
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fresh();
      loadError = { kind: 'unreadable' };
      writeBlocked = true;
      console.error(
        '[Config] Cannot read the configuration file:',
        (err as NodeJS.ErrnoException).code ?? 'unknown error',
      );
      return fresh();
    }
    try {
      const parsed = storedDataSchema.parse(JSON.parse(raw));
      return {
        servers: parsed.servers,
        activeServerId: parsed.activeServerId,
        preferences: sanitizePreferences(parsed.preferences),
      };
    } catch {
      const backupPath = moveAside(file);
      loadError = { kind: 'corrupt', backupPath };
      writeBlocked = backupPath === undefined;
      console.error(
        '[Config] The configuration file is invalid; ' +
          (backupPath ? 'it was moved aside.' : 'it could not be moved aside, writes are disabled.'),
      );
      return fresh();
    }
  }

  const state = (): StoreData => (data ??= load());

  /** Moves cleartext passwords into encrypted fields once a secret store is available. */
  function encryptLegacySecrets(servers: StoredServer[]): void {
    for (const server of servers) {
      for (const field of ['password', 'proxyPassword'] as const) {
        const clear = server[field];
        if (clear !== undefined) seal(server, field, clear);
      }
    }
  }

  function persist(): void {
    if (writeBlocked) throw new ConfigStoreError('The configuration file is unreadable and was left untouched');
    const current = state();
    encryptLegacySecrets(current.servers);
    writeFileAtomic(filePath(), JSON.stringify(current, null, 2));
  }

  /** Stores `value` encrypted when a secret store exists, else cleartext (file mode 0600); an empty value removes it. */
  function seal(server: StoredServer, field: SecretField, value: string | undefined): void {
    const encField = `${field}Enc` as const;
    delete server[field];
    delete server[encField];
    if (!value) return;
    if (crypto.isAvailable()) {
      try {
        server[encField] = crypto.encrypt(value);
        return;
      } catch {
        console.error('[Config] Encrypting a credential failed; it is kept in the 0600 configuration file.');
      }
    }
    server[field] = value;
  }

  /** A decrypted secret; undefined when absent or when it cannot be decrypted (the ciphertext is kept on disk). */
  function reveal(server: StoredServer, field: SecretField): string | undefined {
    const enc = server[`${field}Enc` as const];
    if (enc === undefined) return server[field];
    try {
      return crypto.decrypt(enc);
    } catch {
      return undefined;
    }
  }

  const hasSecret = (server: StoredServer, field: SecretField): boolean =>
    server[field] !== undefined || server[`${field}Enc` as const] !== undefined;

  function toServer(stored: StoredServer): ServerConfig {
    const { password: _p, passwordEnc: _pe, proxyPassword: _pp, proxyPasswordEnc: _ppe, ...rest } = stored;
    const password = reveal(stored, 'password');
    const proxyPassword = reveal(stored, 'proxyPassword');
    return {
      ...rest,
      ...(password !== undefined && { password }),
      ...(proxyPassword !== undefined && { proxyPassword }),
      hasPassword: hasSecret(stored, 'password'),
      hasProxyPassword: hasSecret(stored, 'proxyPassword'),
    };
  }

  function toStored(server: ServerConfig): StoredServer {
    const { password, proxyPassword, hasPassword: _hp, hasProxyPassword: _hpp, ...rest } = server;
    const stored: StoredServer = { ...rest }; // undefined keys vanish in JSON
    seal(stored, 'password', password);
    seal(stored, 'proxyPassword', proxyPassword);
    return stored;
  }

  return {
    /** Servers with decrypted passwords: for main-process use only, never send them to the renderer. */
    getServers(): ServerConfig[] {
      return state().servers.map(toServer);
    },

    addServer(server: ServerConfig): void {
      state().servers.push(toStored(server));
      persist();
    },

    /**
     * Merges a patch. An empty or absent password leaves the stored one untouched; `clearPassword` /
     * `clearProxyPassword` remove it explicitly. A stored password is dropped when the endpoint it belongs to
     * changes (host, port, path or TLS; proxy host, port or type; username emptied), unless the same patch
     * supplies a new one, so credentials can never be redirected or downgraded to cleartext.
     */
    updateServer(id: string, updates: ServerConfigPatch): void {
      const stored = state().servers.find((s) => s.id === id);
      if (!stored) return;
      const {
        password,
        proxyPassword,
        clearPassword,
        clearProxyPassword,
        hasPassword: _hp,
        hasProxyPassword: _hpp,
        id: _id,
        ...fields
      } = stripUndefined(updates);
      const before = { ...stored };
      Object.assign(stored, fields);

      const serverMoved = !sameEndpoint(before, stored) || fields.username === '';
      const proxyMoved = !sameProxy(before, stored) || fields.proxyUsername === '';
      if (serverMoved || clearPassword) seal(stored, 'password', undefined);
      if (proxyMoved || clearProxyPassword || stored.proxyType === 'none') seal(stored, 'proxyPassword', undefined);
      if (password) seal(stored, 'password', password);
      if (proxyPassword) seal(stored, 'proxyPassword', proxyPassword);
      persist();
    },

    removeServer(id: string): void {
      const current = state();
      current.servers = current.servers.filter((s) => s.id !== id);
      if (current.activeServerId === id) current.activeServerId = null;
      persist();
    },

    getActiveServerId(): string | null {
      return state().activeServerId;
    },

    setActiveServerId(id: string | null): void {
      state().activeServerId = id;
      persist();
    },

    getPreferences(): AppPreferences {
      return state().preferences;
    },

    updatePreferences(updates: Partial<AppPreferences>): void {
      const current = state();
      current.preferences = { ...current.preferences, ...stripUndefined(updates) };
      persist();
    },

    /** Set when the configuration file was invalid or unreadable at startup (the user must be told). */
    getLoadError(): ConfigLoadError | undefined {
      state();
      return loadError;
    },

    /** Encrypts cleartext passwords left from an older version, once a secret store is available (no-op otherwise). */
    migrateLegacySecrets(): void {
      if (!crypto.isAvailable() || writeBlocked) return;
      if (state().servers.some((s) => s.password !== undefined || s.proxyPassword !== undefined)) persist();
    },

    /** Names of the servers whose stored password cannot be decrypted (the user must re-enter it). */
    getLockedServerNames(): string[] {
      return state()
        .servers.filter((s) =>
          (['password', 'proxyPassword'] as const).some((f) => hasSecret(s, f) && reveal(s, f) === undefined),
        )
        .map((s) => s.name);
    },

    /** Whether new passwords are encrypted (false: cleartext in the 0600 file, no OS secret store). */
    isSecretStorageEncrypted(): boolean {
      return crypto.isAvailable();
    },
  };
}

/** The application's store: `config.json` in `userData`, passwords sealed with Electron `safeStorage`. */
export const configStore = createConfigStore({
  filePath: () => path.join(app.getPath('userData'), 'config.json'),
  crypto: safeStorageCrypto,
});
