import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // 地図の描画とタイル読み込みを待つぶん、既定より長めに取る
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/japan-hazard-map-viewer/`,
    trace: 'on-first-retry',
    // WebGL をソフトウェアで描く（CI にGPUが無いため）
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // ビルド成果物に対して実行する（本番と同じもので確認する）
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/japan-hazard-map-viewer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
