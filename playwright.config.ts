import { defineConfig } from '@playwright/test';

// Test w przeglądarce na zbudowanej grze (npm run build → vite preview).
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:4174', viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
});
