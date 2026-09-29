import { defineConfig } from '@playwright/test';

const viewports = [
  { name: 'width-360', width: 360, height: 800 },
  { name: 'width-390', width: 390, height: 844 },
  { name: 'width-768', width: 768, height: 1024 },
  { name: 'width-1024', width: 1024, height: 768 },
  { name: 'width-1440', width: 1440, height: 900 },
] as const;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:43110',
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 43110 --strictPort',
    url: 'http://127.0.0.1:43110',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: viewports.map((viewport) => ({
    name: viewport.name,
    use: {
      viewport: { width: viewport.width, height: viewport.height },
    },
  })),
});
