import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { describe, expect, it } from 'vitest';
import { APP_FUSES } from './fuses';

describe('APP_FUSES', () => {
  it('pins the hardened value of every fuse we set', () => {
    expect(APP_FUSES).toEqual({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    });
  });

  it('disables the file:// extra privileges', () => {
    expect(APP_FUSES[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(false);
  });
});
