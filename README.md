# ハザードマップ

## Public Website

https://shiwaku.github.io/japan-hazard-map-viewer/#16.29/35.733868/139.797143/22.4/67

## 画面の使い方

- **左サイドパネル** … ハザードマップ（トグルで**複数を重ねられます**）、浸水シミュレーション（浸水ナビ）、重ねる情報（避難場所・伝承碑・100mメッシュ人口・PLATEAU建物）、視点（2D / 3D）。
  表示中のレイヤーの直下に不透明度スライダーと凡例をインライン表示します。重ねたときは不透明度で下のレイヤーを透かして見比べてください。
  各行の `i` ボタンでそのレイヤーの説明を開閉できます。スマホではボトムシートになり、初期状態では畳まれています。
- **重ね順** … `src/config/hazard-layers.ts` の並び順（後ろにあるものほど前面）。ハザード → 100mメッシュ人口 → PLATEAU建物 → 地名ラベル → ピン の順に重なります。
- **ヘッダのボタン** … 🌙/☀️ でライト・ダークテーマ切替（選択は `localStorage` に保存）、▴/▾ でパネル開閉。
- **右上** … 地名検索、ズーム・方位・傾き、**地形（起伏の立体化）の ON/OFF**、全画面、現在地。
- **右下** … 背景地図の切替（地図＝国土地理院 最適化ベクトルタイル淡色 / 写真＝全国最新写真）、スケール、出典。
- **地図クリック** … 避難場所・伝承碑・人口メッシュの上ではその属性を、それ以外では表示中ハザードの想定浸水深（PNGタイルのRGBから判定）をポップアップ表示します。複数重ねている場合は、それぞれの値を並べて表示します。
- **指定緊急避難場所** … 表示中のハザードに対応するものだけに絞り込みます（複数重ねている場合は、そのいずれかに対応するもの）。
- **`?debug`** … 診断HUD（ビルド時刻・ズーム・WebGLコンテキスト消失回数・エラーログ）を表示します。

### 浸水シミュレーション（浸水ナビ）

国土地理院「[浸水ナビ](https://suiboumap.gsi.go.jp/)」の想定破堤点シミュレーションです。
ハザードマップが「法に基づき指定された区域」を示すのに対し、こちらは「**どの堤防が切れると、いつ、どこまで浸水するか**」を示します。

1. パネルの「破堤点を探す」をONにして地図をクリックすると、その地点を浸水させる想定破堤点が表示されます（地点によっては数百件、応答に10秒前後かかることがあります）
2. 破堤点を選ぶ（地図上の点、または「最大浸水の破堤点を選ぶ」ボタン）と、破堤からの経過時間ごとの浸水範囲が表示されます
3. スライダーで経過時間を動かせます。目盛りはその破堤点が実際に持つ時刻（`BPTime`）に対応しているため、**どの位置でも必ずタイルが存在します**
4. 「再生」で2秒ごとに時間が進みます（浸水ナビ側の負荷ガイドラインに合わせた間隔）。末尾に達すると自動停止します
5. 破堤点を選んだ状態で地図をクリックすると、その地点の**経過時間時点の浸水深・最大浸水深・浸水開始までの時間**を表示します

重ねられるタイルは、時系列・最大浸水域（浸水ランク／赤一色）・検索可能範囲（データがある範囲）です。
浸水ランクの配色はハザードマップの洪水浸水想定区域と同じ区分です。

設計の詳細と API 仕様の要点は [`docs/suibou-navi-design.md`](docs/suibou-navi-design.md) を参照してください。

PWA（`manifest.webmanifest` + Service Worker）に対応しており、ホーム画面に追加してスタンドアロン表示できます。
Service Worker は意図的にキャッシュを持たず、常に最新を取得します（古いハザード情報を掴ませないため）。

## 開発

Vite + TypeScript で構成しています。

```bash
npm install      # 依存のインストール
npm run dev      # 開発サーバー（http://localhost:5173/japan-hazard-map-viewer/）
npm run build    # 型チェック（tsc）＋本番ビルド（dist/ に出力）
npm run preview  # ビルド成果物のローカルプレビュー
npm run lint     # ESLint
npm run format   # Prettier で整形
```

### 構成

- `index.html` … エントリ（パネルの骨組みのみ。行・凡例・スライダーは実行時に生成）
- `src/` … TypeScript ソース
  - `config/hazard-layers.ts` … 全ハザードレイヤ（タイルURL・凡例・説明・避難場所フィルタ・浸水深）の定義
  - `config/overlays.ts` … 重ねる情報（避難場所・伝承碑・人口・PLATEAU）の定義
  - `config/suibou-navi.ts` `api/suibou-navi.ts` … 浸水ナビの型・タイルURL組み立て・APIクライアント（2秒スロットル）
  - `map/layer-order.ts` … レイヤーの重ね順（ハザード群・浸水ナビ群・オーバーレイ群）を1箇所で定義
  - `map/basemap.ts` … 背景スタイル生成。ダークは淡色スタイルの色を明度反転して機械的に作る
  - `map/` `layers/` `ui/` `popups/` `routing/` `lib/` … 機能ごとのモジュール
  - `pale-style.json` … 国土地理院 最適化ベクトルタイル（淡色地図風スタイル）
- `public/` … 静的アセット（`icons` / `manifest.webmanifest` / `sw.js` / `img` / `gif` / `legend`）

### デプロイ

`main` ブランチへの push で GitHub Actions（`.github/workflows/deploy.yml`）が `npm run build` を実行し、GitHub Pages に公開します。GitHub リポジトリの Settings → Pages で「Source」を **GitHub Actions** に設定してください。
公開URLは `https://shiwaku.github.io/japan-hazard-map-viewer/` で、`vite.config.ts` の `base` がこのパスに対応しています。

## 国土地理院

- 各種ハザードマップ（PNGタイル形式）
  - 出典：[ハザードマップポータルサイト オープンデータ配信](https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/opendata.html)
  - 概要：「重ねるハザードマップ」に掲載しているデータをURLからリアルタイムに読み込み、ウェブサイトやソフトウェア、アプリケーションに商用非商用問わず利用することが可能。
  - ライセンス：[利用規約](https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/copyright.html)参照。政府標準利用規約（第2.0版）および[国土交通省ウェブサイトの利用規約](https://www.mlit.go.jp/link.html)に準拠。

- 指定緊急避難場所データ（CSV形式、2024-01-29時点）
  - 出典：[指定緊急避難場所データ](https://www.gsi.go.jp/bousaichiri/hinanbasho.html)
  - 概要：指定緊急避難場所は、津波、洪水等、災害による危険が切迫した状況において、住民等の生命の安全の確保を目的として住民等が緊急に避難する際の避難先として位置付けるもの。
  - ライセンス：[免責事項・ご利用上の注意](https://www.gsi.go.jp/bousaichiri/hinanbasho-menseki.html)を参照。[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)のほか、以下のご利用上の注意をご確認いただき、内容に同意された場合のみご利用ください。
  - 【ご利用上の注意】
    1. 本データは、災害対策基本法第49条の4に基づき市町村長が指定した指定緊急避難場所の情報を各市町村に提供いただき、当該市町村に確認の上、地図上に表示したものです。最新かつ詳細の状況などは必ず当該市町村にご確認ください。
    2. 本データを、ダウンロードや印刷等を行い国土地理院サーバ外で利用される場合は、本データの更新にあわせて最新の情報をご利用ください（参照：市町村別公開日・更新日一覧）。
    3. 指定緊急避難場所は、災害種別ごとに指定されています。本データをダウンロードや印刷等を行い国土地理院サーバ外で利用される場合、指定された災害種別を利用者が正確に理解できるよう、十分にご留意ください。

- 自然災害伝承碑データ（GeoJSON形式、2024年1月25日版）
  - 出典：[自然災害伝承碑データ](https://www.gsi.go.jp/bousaichiri/denshouhi_datainfo.html)
  - 概要：自然災害伝承碑は過去に発生した自然災害の様子や被害の状況などが記載された石碑やモニュメントです。
  - ライセンス：ご利用上の注意を参照。[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)のほか、以下のご利用上の注意をご確認いただき、内容に同意された場合のみご利用ください。
  - 【ご利用上の注意】
    1. 本データは、自然災害伝承碑の情報を各市区町村より提供いただき、地図上に表示したものです。各市区町村の自然災害伝承碑の申請状況等は、当該市区町村にご確認ください。
    2. 本データの災害名について、同一の災害を伝承する自然災害伝承碑であっても、災害名の表記が異なる場合があることにご注意ください。
    3. 国土地理院のウェブ地図に掲載されている自然災害伝承碑の写真の一部は、第三者による二次利用に関して権利者への確認が必要な場合があります。別途、市町村別掲載情報一覧をご確認いただき、第三者に権利のあるものを利用する場合は、利用者の責任において確認してください。

## 国土交通省

- 3D都市モデル（Project PLATEAU）建物データ（LOD1、PMTiles形式）
  - 出典：[法務省地図XMLアダプトプロジェクト amx-project/apb](https://github.com/amx-project/apb)
    - 原初データ出典：[3D都市モデル（Project PLATEAU）ポータルサイト](https://www.geospatial.jp/ckan/dataset/plateau)
    - 概要：航空測量等に基づき取得したデータから建物等の地物を3次元で生成した3D都市モデルです。
  - ライセンス：CC BY 4.0等のオープンライセンス。詳細は[PLATEAU Policy](https://www.mlit.go.jp/plateau/site-policy/)を参照。商用利用も含め、無償で自由に利用可能。

## 地域・交通データ研究所

- 令和2年簡易100mメッシュ人口データ（全国）（PMTiles形式）
  - 出典：https://github.com/shi-works/noto-hanto-earthquake-2024-100m-mesh-pop-data
    - 原初データ出典：[地域分析に有用なデータの提供, 地域・交通データ研究所代表（東京大学空間情報科学研究センター客員研究員）西澤明](https://gtfs-gis.jp/teikyo/index.html)
  - 概要：地域・交通データ研究所にて公開されている令和2年簡易100mメッシュ人口データをFlatGeobuf形式に変換したデータです。
  - ライセンス：[西澤明](https://gtfs-gis.jp/teikyo/index.html)、[@shi-works](https://twitter.com/shi__works)、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)

## 浸水ナビ

- 想定破堤点シミュレーション（JSON API・タイル）
  - 出典：[浸水ナビ](https://suiboumap.gsi.go.jp/)（国土地理院）
  - 概要：想定破堤点ごとに、破堤からの経過時間・最大浸水域・浸水深を提供する。ハザードマップポータルが全国1枚のモザイクで「指定された区域」を配信するのに対し、浸水ナビは氾濫の原因（破堤点）ごとに分解されており、時間軸を持つ。
  - ライセンス：[国土交通省ホームページのリンク・著作権・免責事項](https://www.mlit.go.jp/link.html)が適用される。API 提供サーバに過度の負担を与えないこと（分間リクエスト数30以下程度）。

## アイコン

- custom-smartmap-sprite（Geolonia smartmap 向けアイコンセット）
  - 出典：https://github.com/shiwaku/custom-smartmap-sprite （プレビュー: https://shiwaku.github.io/custom-smartmap-sprite/ ）
  - 概要：指定緊急避難場所は `evacuation-area`（JIS の「避難場所」ピクトグラム）、自然災害伝承碑は `bunkazai` を使用。背景スタイルへ `smartmap` という id でスプライトを追加し、`smartmap:<アイコン名>` で参照しています。
  - ライセンス：MIT License（Copyright (c) 2024 Geolonia, Inc.）

## 背景地図及び地形データ

- 国土地理院 最適化ベクトルタイル（淡色地図風スタイル）
  - 出典：https://github.com/gsi-cyberjapan/optimal_bvmap
  - ライセンス：[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従い、出典明示により、転載も含め使用可
- 国土地理院 地理院タイル（全国最新写真（シームレス））
  - 出典：https://maps.gsi.go.jp/development/ichiran.html
  - ライセンス：[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従い、出典明示により、転載も含め使用可
- 国土地理院 地理院タイル（陰影起伏図）
  - 出典：https://maps.gsi.go.jp/development/ichiran.html#hillshademap
  - ライセンス：[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従い、出典明示により、転載も含め使用可
- 産業技術総合研究所 シームレス標高タイル（統合DEM）
  - 出典：https://tiles.gsj.jp/tiles/elev/tiles.html
  - ライセンス：「[産総研地質調査総合センターウェブサイト利用規約](https://www.gsj.jp/license/license.html)」に従い、商用を含む自由な二次利用が可能です。この規約はCC BY 4.0と互換です。
