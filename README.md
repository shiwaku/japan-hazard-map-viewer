# 全国ハザードマップ on MapLibre GL JS

## Public Website

https://shiwaku.github.io/japan-hazard-map-on-maplibre/#16.29/35.733868/139.797143/22.4/67

![image](https://github.com/shi-works/japan-hazard-map-on-maplibre-gl-js/assets/71203808/6164ba8e-aa32-41b4-84ad-6203c5096863)

## 開発

Vite + TypeScript で構成しています。

```bash
npm install      # 依存のインストール
npm run dev      # 開発サーバー（http://localhost:5173/japan-hazard-map-on-maplibre/）
npm run build    # 型チェック（tsc）＋本番ビルド（dist/ に出力）
npm run preview  # ビルド成果物のローカルプレビュー
npm run lint     # ESLint
npm run format   # Prettier で整形
```

### 構成

- `index.html` … エントリ（UIの骨組みのみ。凡例・ラジオは実行時に生成）
- `src/` … TypeScript ソース
  - `config/hazard-layers.ts` … 全ハザードレイヤ（タイルURL・凡例・避難場所フィルタ・浸水深）の定義
  - `map/` `layers/` `ui/` `popups/` `routing/` `lib/` … 機能ごとのモジュール
- `public/` … 静的アセット（`std_1.json` / `std_2.json` / `img` / `gif` / `legend`）

### デプロイ

`main` ブランチへの push で GitHub Actions（`.github/workflows/deploy.yml`）が `npm run build` を実行し、GitHub Pages に公開します。GitHub リポジトリの Settings → Pages で「Source」を **GitHub Actions** に設定してください。
公開URLは `https://shiwaku.github.io/japan-hazard-map-on-maplibre/` で、`vite.config.ts` の `base` がこのパスに対応しています。

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

## 背景地図及び地形データ

- 国土地理院 最適化ベクトルタイル
  - 出典：https://github.com/gsi-cyberjapan/optimal_bvmap
  - ライセンス：[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従い、出典明示により、転載も含め使用可
- 国土地理院 地理院タイル（陰影起伏図）
  - 出典：https://maps.gsi.go.jp/development/ichiran.html#hillshademap
  - ライセンス：[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従い、出典明示により、転載も含め使用可
- 産業技術総合研究所 シームレス標高タイル（統合DEM）
  - 出典：https://tiles.gsj.jp/tiles/elev/tiles.html
  - ライセンス：「[産総研地質調査総合センターウェブサイト利用規約](https://www.gsj.jp/license/license.html)」に従い、商用を含む自由な二次利用が可能です。この規約はCC BY 4.0と互換です。
