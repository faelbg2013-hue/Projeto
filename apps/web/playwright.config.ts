import { defineConfig } from '@playwright/test';
import { e2eWebOrigin } from './e2e/target';

const onGithubActions = process.env.GITHUB_ACTIONS === 'true';

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
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: onGithubActions
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: e2eWebOrigin,
    screenshot: 'only-on-failure',
    trace: onGithubActions ? 'retain-on-failure' : 'off',
    video: 'off',
  },
  projects: viewports.map((viewport) => ({
    name: viewport.name,
    use: {
      viewport: { width: viewport.width, height: viewport.height },
    },
  })),
});
