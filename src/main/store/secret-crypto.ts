import { safeStorage } from 'electron';

/** Encrypts and decrypts the credentials kept in `config.json`. */
export interface SecretCrypto {
  /** True when the OS offers a real secret store (never the Linux `basic_text` fallback). */
  isAvailable(): boolean;
  /** Returns a base64 ciphertext. */
  encrypt(plain: string): string;
  /** @throws when the ciphertext cannot be decrypted (other user, other machine, locked keychain) */
  decrypt(cipherBase64: string): string;
}

/** `safeStorage`-backed implementation. Only meaningful after the `ready` event. */
export const safeStorageCrypto: SecretCrypto = {
  isAvailable() {
    if (!safeStorage.isEncryptionAvailable()) return false;
    // basic_text encrypts with a hard-coded password: obfuscation, not protection.
    return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
  },
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (cipherBase64) => safeStorage.decryptString(Buffer.from(cipherBase64, 'base64')),
};
