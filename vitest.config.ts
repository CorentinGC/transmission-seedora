import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = __dirname;

/**
 * Vitest workspace. One project per build target (mirrors the vite.*.config.ts files).
 * `@shared` is `packages/shared/src` everywhere; `@ipc` is `src/shared` (IPC channel names, main/preload only).
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@shared': path.resolve(root, 'packages/shared/src'),
            '@ipc': path.resolve(root, 'src/shared'),
          },
        },
        test: {
          name: 'main',
          environment: 'node',
          include: [
            'src/main/**/*.test.ts',
            'src/preload/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'tools/**/*.test.ts',
          ],
        },
      },
      {
        resolve: {
          alias: {
            '@': path.resolve(root, 'src/renderer'),
            '@shared': path.resolve(root, 'packages/shared/src'),
          },
        },
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.test.{ts,tsx}', 'src/renderer/**/*.test.{ts,tsx}'],
        },
      },
      {
        resolve: {
          alias: {
            '@': path.resolve(root, 'apps/web/src'),
            '@shared': path.resolve(root, 'packages/shared/src'),
          },
        },
        test: {
          name: 'web',
          environment: 'node',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
