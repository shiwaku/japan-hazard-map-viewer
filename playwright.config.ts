import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // 地図の描画とタイル読み込みを待つぶん、既定より長めに取る。
  // CI は GPU が無くソフトウェア描画になるため、さらに余裕を持たせる。
  timeout: process.env.CI ? 120_000 : 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI は 1 本ずつ流す。ソフトウェア描画で地形・ラスタを描くのは CPU を強く食うため、
  // 並列にすると互いにコマを奪い合い、2秒間隔の setInterval すら数十秒動かなくなる
  // （＝再生や経過時間のテストが実装の問題なく落ちる）。直列のほうが速く、安定する。
  workers: process.env.CI ? 1 : undefined,
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
