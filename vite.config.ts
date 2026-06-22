import { defineConfig } from 'vite';

// GitHub Pages（プロジェクトページ）配信用のベースパス。
// https://shiwaku.github.io/japan-hazard-map-on-maplibre/ で公開される。
export default defineConfig({
  base: '/japan-hazard-map-on-maplibre/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
