import { describe, expect, it } from 'vitest';
import { isSecretStorageUnencrypted } from './secret-storage';

describe('isSecretStorageUnencrypted', () => {
  it('is false without the capability (web)', async () => {
    expect(await isSecretStorageUnencrypted({})).toBe(false);
  });
  it('is true only when the host reports unencrypted storage', async () => {
    expect(await isSecretStorageUnencrypted({ secretStorageEncrypted: async () => ({ success: true, data: false }) })).toBe(true);
    expect(await isSecretStorageUnencrypted({ secretStorageEncrypted: async () => ({ success: true, data: true }) })).toBe(false);
  });
  it('is false when the call fails or throws', async () => {
    expect(await isSecretStorageUnencrypted({ secretStorageEncrypted: async () => ({ success: false }) })).toBe(false);
    expect(await isSecretStorageUnencrypted({ secretStorageEncrypted: async () => { throw new Error('x'); } })).toBe(false);
  });
});
