import type { PlatformApi } from '../platform/api-types';

/**
 * True only when the host reports (Electron) that stored secrets are NOT encrypted.
 * A missing capability (web), a failed call or a thrown error resolves false: no warning on unknown.
 */
export async function isSecretStorageUnencrypted(api: Pick<PlatformApi, 'secretStorageEncrypted'>): Promise<boolean> {
  if (!api.secretStorageEncrypted) return false;
  try {
    const res = await api.secretStorageEncrypted();
    return res.success && res.data === false;
  } catch {
    return false;
  }
}
