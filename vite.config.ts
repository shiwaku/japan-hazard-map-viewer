import { defineConfig } from 'vite';

// GitHub Pages（プロジェクトページ）配信用のベースパス。
// https://shiwaku.github.io/japan-hazard-map-viewer/ で公開される。
export default defineConfig({
  base: '/japan-hazard-map-viewer/',
  build: {
    target: 'es2022',
    sourcemap: true,
    // maplibre-gl 単体で 1MB 前後あり、これは分割しても縮まない。
    // 既定の 500kB では毎回警告が出て、本当に見るべき変化に気づけなくなるため引き上げる。
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // maplibre-gl はサイズの大半を占め、更新頻度も低い。
        // アプリのコードと分けておくと、修正時に再ダウンロードされるのが差分だけになる。
        manualChunks: (id: string) =>
          id.includes('node_modules/maplibre-gl') ? 'maplibre' : undefined,
      },
    },
  },
  define: {
    // フッタと診断HUDに出すビルド時刻（どの版が配信されているかの確認用）
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    ),
  },
});
