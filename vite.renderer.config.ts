import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import type { Plugin } from 'vite';
import { injectCspMeta } from './src/main/security/csp';

/** Replaces the `<!--seedora-csp-->` marker in index.html with the CSP meta tag (relaxed for the dev server); throws when the marker is missing. */
function cspPlugin(): Plugin {
  let isDev = false;
  return {
    name: 'seedora-csp',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    transformIndexHtml: (html) => injectCspMeta(html, isDev),
  };
}

export default defineConfig({
  plugins: [cspPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
