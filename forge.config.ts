import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { APP_FUSES } from './src/main/security/fuses';
import { adhocSignMacApps } from './tools/macos-adhoc-sign';
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
    afterCopy: [({ buildPath }) => copyExternalModules(buildPath)],
    name: 'Seedora',
    executableName: 'seedora',
    appBundleId: 'com.seedora.app',
    appCategoryType: 'public.app-category.utilities',
    icon: './resources/icon',
    // macOS: lets Seedora appear as a handler for magnet: links and .torrent files (it never becomes the
    // default on its own: 'Alternate' rank, and main only registers itself when no handler exists).
    protocols: [{ name: 'Magnet link', schemes: ['magnet'] }],
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'BitTorrent file',
          CFBundleTypeExtensions: ['torrent'],
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
        },
      ],
    },
  },
  hooks: {
    postPackage: async (_config, { platform, outputPaths }) => adhocSignMacApps(platform, outputPaths, 'Seedora'),
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      name: 'Seedora',
      setupExe: 'Seedora-Setup.exe',
    }),
    new MakerDeb({
      options: {
        name: 'seedora',
        productName: 'Seedora',
        genericName: 'BitTorrent Client',
        description: 'Remote GUI for Transmission daemon',
        categories: ['Network', 'P2P'],
        mimeType: ['application/x-bittorrent', 'x-scheme-handler/magnet'],
      },
    }),
    new MakerRpm({
      options: {
        name: 'seedora',
        productName: 'Seedora',
        description: 'Remote GUI for Transmission daemon',
        categories: ['Network', 'P2P'],
        mimeType: ['application/x-bittorrent', 'x-scheme-handler/magnet'],
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
    new FusesPlugin(APP_FUSES),
  ],
};

export default config;
