import { FuseV1Options, FuseVersion } from '@electron/fuses';

/**
 * Electron fuses flipped at packaging time (used by `forge.config.ts`). Every one is hardened; never
 * set one back to its permissive value without a security review.
 */
export const APP_FUSES = {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
} as const;
