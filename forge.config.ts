import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'node:fs';
import path from 'node:path';

// Copy native/data-heavy modules that can't be bundled by Vite into the packaged app
function copyExternalModules(buildPath: string) {
  const modulesToCopy = ['geoip-lite'];
  for (const mod of modulesToCopy) {
    const src = path.join(__dirname, 'node_modules', mod);
    const dest = path.join(buildPath, 'node_modules', mod);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`[forge] Copied ${mod} to packaged app`);
    } else {
      console.warn(`[forge] Module ${mod} not found, skipping`);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/geoip-lite/**',
    },
    afterCopy: [
      (buildPath: string, _electronVersion: string, _platform: string, _arch: string, callback: (err?: Error) => void) => {
        try {
          copyExternalModules(buildPath);
          callback();
        } catch (err) {
          callback(err as Error);
        }
      },
    ],
    name: 'Transmission Remote',
    executableName: 'transmission-remote',
    appBundleId: 'com.transmission-remote.app',
    appCategoryType: 'public.app-category.utilities',
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      name: 'TransmissionRemote',
      setupExe: 'TransmissionRemote-Setup.exe',
    }),
    new MakerDeb({
      options: {
        name: 'transmission-remote',
        productName: 'Transmission Remote',
        genericName: 'BitTorrent Client',
        description: 'Remote GUI for Transmission daemon',
        categories: ['Network', 'P2P'],
        mimeType: ['application/x-bittorrent', 'x-scheme-handler/magnet'],
      },
    }),
    new MakerRpm({
      options: {
        name: 'transmission-remote',
        productName: 'Transmission Remote',
        description: 'Remote GUI for Transmission daemon',
        categories: ['Network', 'P2P'],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
