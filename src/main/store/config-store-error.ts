/** Stable failure kinds of a rejected configuration write, mapped to translated messages in the renderer. */
export type ConfigStoreErrorCode = 'SECRET_STORE_FAILED' | 'CONFIG_UNWRITABLE';

/**
 * Raised when the configuration cannot be written: the OS secret store refused to encrypt a credential, or the
 * existing file is unreadable and must not be overwritten. The message is credential-free by construction.
 */
export class ConfigStoreError extends Error {
  constructor(
    message: string,
    readonly code: ConfigStoreErrorCode,
  ) {
    super(message);
    this.name = 'ConfigStoreError';
  }
}
