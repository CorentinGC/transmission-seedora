import { safeStorage } from 'electron';

/** Result of decrypting one stored secret. */
export interface DecryptedSecret {
  value: string;
  /** True when the OS key was rotated or upgraded: the secret should be encrypted again and re-stored. */
  shouldReEncrypt: boolean;
}

/** Encrypts and decrypts the credentials kept in `config.json`. */
export interface SecretCrypto {
  /** Resolves true when the OS offers a real secret store (never the Linux `basic_text` fallback). */
  isAvailable(): Promise<boolean>;
  /** Resolves a base64 ciphertext. @throws when encryption fails */
  encrypt(plain: string): Promise<string>;
  /** @throws when the ciphertext cannot be decrypted (other user, other machine, locked keychain) */
  decrypt(cipherBase64: string): Promise<DecryptedSecret>;
}

/** `safeStorage`-backed implementation (async API). Only meaningful after the `ready` event. */
export const safeStorageCrypto: SecretCrypto = {
  async isAvailable() {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
    // basic_text encrypts with a hard-coded password: obfuscation, not protection.
    return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
  },
  encrypt: async (plain) => (await safeStorage.encryptStringAsync(plain)).toString('base64'),
  async decrypt(cipherBase64) {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(cipherBase64, 'base64'));
    return { value: result, shouldReEncrypt };
  },
};
