import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true
  },
  webServer: [
    {
      command: 'bun run --cwd ../server dev',
      port: 4317,
      reuseExistingServer: true,
      timeout: 60_000
    },
    {
      command: 'bun run --cwd . dev',
      port: 5173,
      reuseExistingServer: true,
      timeout: 60_000
    }
  ]
});
