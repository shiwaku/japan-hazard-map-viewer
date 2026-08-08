import { defineConfig } from 'vite';

// GitHub Pages（プロジェクトページ）配信用のベースパス。
// https://shiwaku.github.io/japan-hazard-map-viewer/ で公開される。
export default defineConfig({
  base: '/japan-hazard-map-viewer/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  define: {
    // フッタと診断HUDに出すビルド時刻（どの版が配信されているかの確認用）
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    ),
  },
});
