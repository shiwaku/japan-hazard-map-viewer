# 依存関係のメモ

上げられなかった依存と、その理由。次に更新を検討するときの出発点として残す。

- 記録日: 2026-08-08

---

## maplibre-gl 6 系（現在 5.24.0）

**保留。pmtiles 経由のベクタータイルが読み込めなくなるため。**

移行を試したところ、型の修正だけでは動かなかった。

### 型レベルで必要だった変更（これは対応可能）

- **default export が廃止**され、`import maplibregl from 'maplibre-gl'` が使えない。
  `import * as maplibregl from 'maplibre-gl'` へ書き換える（5 ファイル）
- 名前空間としての型参照 `maplibregl.GeoJSONSource` が使えない。
  `import type { GeoJSONSource } from 'maplibre-gl'` に変える

### 動かなかった点（本質的な問題）

型修正後、ビルドは通るが**地図のスタイルが読み込み完了にならない**。

```
styleLoaded: false
sources: 'v:NOT  hillshade:loaded'
```

- `v`（`pmtiles://` を含む vector source）だけが読み込まれない
- 素のラスタ（陰影起伏図）は読み込まれる
- `map.on('error')` には何も飛んでこない（エラーではなく、要求そのものが出ていない）

maplibre-gl 6 の `addProtocol` は
`(requestParameters, abortController) => Promise<GetResourceResponse>` を期待する。
pmtiles 4.4.1 には対応する `protocol.tilev4` があり、これを渡しても結果は同じだった。

カスタムプロトコルの扱いが変わったと見られるが、**pmtiles 側の対応が必要**と判断して保留した。

### 再開の目安

- pmtiles が maplibre-gl 6 対応を明記したリリースを出したとき
- `@maplibre/maplibre-gl-geocoder`（現在 1.9.4、peer は `maplibre-gl >=4.0.0`）が
  6 系で動くかもあわせて確認する

上げる際は `npm run e2e` を通すこと。今回もこれで不具合を検知した。

---

## TypeScript 7 系（現在 6.0.3）

**未検証。** maplibre-gl 6 と同時に試すと切り分けが難しくなるため、今回は触っていない。
単独で上げて `npx tsc --noEmit` と `npm run lint`（typescript-eslint の対応状況）を確認する。

---

## 更新済み（2026-08-08）

- `npm audit fix` で high 3 件（brace-expansion / nanoid / postcss）を解消。いずれも
  ビルドツール側の間接依存で、配信物には含まれない
- eslint 10.5.0 → 10.8.1 / prettier 3.8.4 → 3.9.6 /
  typescript-eslint 8.61.1 → 8.66.0 / vite 8.0.16 → 8.2.1
