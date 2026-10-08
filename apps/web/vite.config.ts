import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { themeColor, palette } from '@ravion/ui';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveApiUrl } from './src/lib/api-url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(rootDir, '../..');

function assertProductionApiUrl(mode: string): void {
  if (mode !== 'production') {
    return;
  }

  const loaded = loadEnv(mode, envDir, 'VITE_');
  const value = Object.hasOwn(loaded, 'VITE_API_URL') ? loaded.VITE_API_URL : undefined;
  resolveApiUrl(value, mode);
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    assertProductionApiUrl(mode);
  }

  return {
  envDir,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.VITEST
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            // main.tsx already calls registerSW(). Null keeps that in the module graph and avoids an inline script.
            injectRegister: null,
            includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
            manifest: {
              id: '/',
              name: 'Ravion Barber',
              short_name: 'Ravion',
              description: 'Sistema de gestão para barbearia.',
              lang: 'pt-BR',
              dir: 'ltr',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              display_override: ['window-controls-overlay', 'standalone', 'browser'],
              orientation: 'any',
              background_color: palette.background,
              theme_color: themeColor,
              categories: ['business'],
              icons: [
                {
                  src: 'icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icons/icon-maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/api\//],
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]),
  ],
  server: {
    host: '0.0.0.0',
    port: 43110,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:43111',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 43110,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:43111',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: './src/test/jsdom-node-web.ts',
    environmentOptions: {
      jsdom: {
        url: 'http://127.0.0.1:43110/',
      },
    },
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
};
});
