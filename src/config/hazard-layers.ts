// ハザードレイヤの定義（データ駆動）。
// 旧 main.js / index.html に散在していた 15 レイヤぶんの source/layer/凡例/フィルタ/浸水深を
// この 1 配列に集約し、レイヤ追加・凡例描画・表示切替をすべてここから生成する。

import type { LegendColorItem } from '../lib/geo';

/** 凡例の色見本1行 */
export interface LegendSwatch {
  /** CSS color（例: 'rgb(220, 122, 220)'） */
  color: string;
  label: string;
}

/** 凡例の表示内容 */
export interface HazardLegend {
  /** 見出し（h4）。改行は <br> を含めてよい。無い凡例もある */
  title?: string;
  /** 色見本の行 */
  swatches?: LegendSwatch[];
  /** 画像凡例（家屋倒壊等氾濫想定区域など）。public/ 配下の相対パス */
  image?: { src: string; width: number; height: number };
}

/** 1ハザードレイヤの定義 */
export interface HazardLayerDef {
  /** レイヤ/ソースID（ラジオボタンの value と一致） */
  id: string;
  /** ラジオボタンのラベル */
  label: string;
  /** レイヤ説明（パネルの i ボタンで開閉表示） */
  desc: string;
  /** ラスタタイルURLテンプレート */
  tiles: string;
  legend: HazardLegend;
  /** 指定緊急避難場所フィルタに使う災害種別プロパティ名 */
  hinanbashoProperty: string;
  /** 浸水深ポップアップ対象レイヤのみ設定 */
  depth?: { legend: LegendColorItem[]; description: string };
}

const DISAPORTAL = 'https://disaportaldata.gsi.go.jp/raster';

// ---- 浸水深ポップアップ用の RGB→深さ 凡例 ----
const DEPTH_SHINSUISHIN: LegendColorItem[] = [
  { r: 247, g: 245, b: 169, title: '0.5m未満' },
  { r: 255, g: 216, b: 192, title: '0.5～3.0m' },
  { r: 255, g: 183, b: 183, title: '3.0～5.0m' },
  { r: 255, g: 145, b: 145, title: '5.0～10.0m' },
  { r: 242, g: 133, b: 201, title: '10.0～20.0m' },
  { r: 220, g: 122, b: 220, title: '20.0m以上' },
];

const DEPTH_KEIZOKU: LegendColorItem[] = [
  { r: 160, g: 210, b: 255, title: '12時間未満' },
  { r: 0, g: 65, b: 255, title: '12時間 ～ 1日未満' },
  { r: 250, g: 245, b: 0, title: '1日 ～ 3日未満' },
  { r: 255, g: 153, b: 0, title: '3日 ～ 1週間未満' },
  { r: 255, g: 40, b: 0, title: '1週間 ～ 2週間未満' },
  { r: 180, g: 0, b: 104, title: '2週間 ～ 4週間未満' },
  { r: 96, g: 0, b: 96, title: '4週間以上' },
];

const DEPTH_HIGHTIDE_TSUNAMI: LegendColorItem[] = [
  { r: 255, g: 255, b: 179, title: '0.3m未満' },
  { r: 247, g: 245, b: 169, title: '0.3～0.5m' },
  { r: 248, g: 225, b: 166, title: '0.5～1.0m' },
  { r: 255, g: 216, b: 192, title: '1.0～3.0m' },
  { r: 255, g: 183, b: 183, title: '3.0～5.0m' },
  { r: 255, g: 145, b: 145, title: '5.0～10.0m' },
  { r: 242, g: 133, b: 201, title: '10.0～20.0m' },
  { r: 220, g: 122, b: 188, title: '20.0m以上' },
];

// ---- 凡例の色見本（再利用するもの） ----
const SWATCHES_SHINSUISHIN: LegendSwatch[] = [
  { color: 'rgb(220, 122, 220)', label: '20.0m以上' },
  { color: 'rgb(242, 133, 201)', label: '10.0 ～ 20.0m' },
  { color: 'rgb(255, 145, 145)', label: '5.0 ～ 10.0m' },
  { color: 'rgb(255, 183, 183)', label: '3.0 ～ 5.0m' },
  { color: 'rgb(255, 216, 192)', label: '0.5 ～ 3.0m' },
  { color: 'rgb(247, 245, 169)', label: '0.5m未満' },
];

const SWATCHES_HIGHTIDE_TSUNAMI: LegendSwatch[] = [
  { color: 'rgb(220, 122, 188)', label: '20.0m以上' },
  { color: 'rgb(242, 133, 201)', label: '10.0 ～ 20.0m' },
  { color: 'rgb(255, 145, 145)', label: '5.0 ～ 10.0m' },
  { color: 'rgb(255, 183, 183)', label: '3.0 ～ 5.0m' },
  { color: 'rgb(255, 216, 192)', label: '1.0 ～ 3.0m' },
  { color: 'rgb(248, 225, 166)', label: '0.5 ～ 1.0m' },
  { color: 'rgb(247, 245, 169)', label: '0.3 ～ 0.5m' },
  { color: 'rgb(255, 255, 179)', label: '0.3m未満' },
];

// 土砂災害の「警戒区域」と「危険箇所」の違い（説明文で共通して使う注記）
const NOTE_KEIKAI =
  '土砂災害防止法に基づき都道府県が指定した区域です。特別警戒区域は建築物に損壊が生じ、住民等の生命・身体に著しい危害が生ずるおそれがある範囲です。';
const NOTE_KIKEN =
  '都道府県の調査で把握された、災害のおそれがある箇所です。法律に基づく指定区域ではないため、警戒区域とは位置づけが異なります。';

export const HAZARD_LAYERS: HazardLayerDef[] = [
  {
    id: 'flood_l2_shinsuishin',
    label: '洪水浸水想定区域（想定最大規模）',
    desc: '想定し得る最大規模の降雨で河川が氾濫した場合に想定される浸水の深さです。水防法に基づき国・都道府県が公表しています。地図をクリックするとその地点の想定浸水深を表示します。',
    tiles: `${DISAPORTAL}/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '洪水',
    legend: { title: '洪水浸水想定区域<br>(想定最大規模)', swatches: SWATCHES_SHINSUISHIN },
    depth: { legend: DEPTH_SHINSUISHIN, description: '洪水によって想定される浸水深' },
  },
  {
    id: 'flood_l1_shinsuishin',
    label: '洪水浸水想定区域（計画規模（現在の凡例））',
    desc: '河川整備の計画上の目標としている規模の降雨で河川が氾濫した場合に想定される浸水の深さです。想定最大規模より発生頻度が高い一方、浸水範囲は狭くなります。',
    tiles: `${DISAPORTAL}/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '洪水',
    legend: { title: '洪水浸水想定区域<br>(計画規模(現在の凡例))', swatches: SWATCHES_SHINSUISHIN },
    depth: { legend: DEPTH_SHINSUISHIN, description: '洪水によって想定される浸水深' },
  },
  {
    id: 'flood_l2_keizoku',
    label: '浸水継続時間（想定最大規模）',
    desc: '想定最大規模の洪水で、浸水した状態が続くと想定される時間です。長時間の浸水は電気・上下水道の停止や在宅避難の可否に影響するため、立退き避難の判断材料になります。',
    tiles: `${DISAPORTAL}/01_flood_l2_keizoku_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '洪水',
    legend: {
      title: '浸水継続時間<br>(想定最大規模)',
      swatches: [
        { color: 'rgb(160, 210, 255)', label: '12時間未満' },
        { color: 'rgb(0, 65, 255)', label: '12時間 ～ 1日未満' },
        { color: 'rgb(250, 245, 0)', label: '1日 ～ 3日未満' },
        { color: 'rgb(255, 153, 0)', label: '3日 ～ 1週間未満' },
        { color: 'rgb(255, 40, 0)', label: '1週間 ～ 2週間未満' },
        { color: 'rgb(180, 0, 104)', label: '2週間 ～ 4週間未満' },
        { color: 'rgb(96, 0, 96)', label: '4週間以上' },
      ],
    },
    depth: { legend: DEPTH_KEIZOKU, description: '浸水継続時間（想定最大規模）' },
  },
  {
    id: 'flood_l2_kaokutoukai_hanran',
    label: '家屋倒壊等氾濫想定区域（氾濫流）',
    desc: '氾濫した水の流れによって、木造家屋が倒壊するおそれがある範囲です。この区域では上階への垂直避難では不十分で、区域外への立退き避難が必要とされています。',
    tiles: `${DISAPORTAL}/01_flood_l2_kaokutoukai_hanran_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '洪水',
    legend: {
      title: '家屋倒壊等氾濫想定区域<br>(氾濫流)',
      image: { src: 'legend/kaokutoukai_hanran.png', width: 100, height: 68 },
    },
  },
  {
    id: 'flood_l2_kaokutoukai_kagan',
    label: '家屋倒壊等氾濫想定区域（河岸侵食）',
    desc: '洪水で河岸が削られ、家屋が流失・倒壊するおそれがある範囲です。氾濫流と同じく、区域外への立退き避難が必要とされています。',
    tiles: `${DISAPORTAL}/01_flood_l2_kaokutoukai_kagan_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '洪水',
    legend: {
      title: '家屋倒壊等氾濫想定区域<br>(河岸侵食)',
      image: { src: 'legend/kaokutoukai_kagan.png', width: 100, height: 68 },
    },
  },
  {
    id: 'dosekiryukeikaikuiki',
    label: '土砂災害警戒区域（土石流）',
    desc: `土石流によって住民等の生命・身体に危害が生ずるおそれがある区域です。${NOTE_KEIKAI}`,
    tiles: `${DISAPORTAL}/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: {
      title: '土砂災害警戒区域<br>(土石流)',
      swatches: [
        { color: 'rgb(165, 0, 33)', label: '特別警戒区域' },
        { color: 'rgb(230, 200, 50)', label: '警戒区域' },
      ],
    },
  },
  {
    id: 'kyukeishakeikaikuiki',
    label: '土砂災害警戒区域（急傾斜地の崩壊）',
    desc: `急傾斜地の崩壊（がけ崩れ）によって住民等の生命・身体に危害が生ずるおそれがある区域です。${NOTE_KEIKAI}`,
    tiles: `${DISAPORTAL}/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: {
      title: '土砂災害警戒区域<br>(急傾斜地の崩壊)',
      swatches: [
        { color: 'rgb(250, 40, 0)', label: '特別警戒区域' },
        { color: 'rgb(250, 230, 0)', label: '警戒区域' },
      ],
    },
  },
  {
    id: 'jisuberikeikaikuiki',
    label: '土砂災害警戒区域（地すべり）',
    desc: `地すべりによって住民等の生命・身体に危害が生ずるおそれがある区域です。${NOTE_KEIKAI}`,
    tiles: `${DISAPORTAL}/05_jisuberikeikaikuiki/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: {
      title: '土砂災害警戒区域<br>(地すべり)',
      swatches: [
        { color: 'rgb(202, 76, 149)', label: '特別警戒区域' },
        { color: 'rgb(255, 183, 76)', label: '警戒区域' },
      ],
    },
  },
  {
    id: 'dosekiryukikenkeiryu',
    label: '土石流危険渓流',
    desc: `土石流が発生するおそれがある渓流です。${NOTE_KIKEN}`,
    tiles: `${DISAPORTAL}/05_dosekiryukikenkeiryu/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: { swatches: [{ color: 'rgb(242, 136, 76)', label: '土石流危険渓流' }] },
  },
  {
    id: 'kyukeisyachihoukai',
    label: '急傾斜地崩壊危険箇所',
    desc: `がけ崩れが発生するおそれがある箇所です。${NOTE_KIKEN}`,
    tiles: `${DISAPORTAL}/05_kyukeisyachihoukai/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: { swatches: [{ color: 'rgb(218, 218, 254)', label: '急傾斜地崩壊危険箇所' }] },
  },
  {
    id: 'jisuberikikenkasyo',
    label: '地すべり危険箇所',
    desc: `地すべりが発生するおそれがある箇所です。${NOTE_KIKEN}`,
    tiles: `${DISAPORTAL}/05_jisuberikikenkasyo/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: { swatches: [{ color: 'rgb(254, 230, 218)', label: '地すべり危険箇所' }] },
  },
  {
    id: 'nadarekikenkasyo',
    label: '雪崩危険箇所',
    desc: `雪崩が発生するおそれがある箇所です。${NOTE_KIKEN}`,
    tiles: `${DISAPORTAL}/05_nadarekikenkasyo/{z}/{x}/{y}.png`,
    hinanbashoProperty: '崖崩れ、土石流及び地滑り',
    legend: { swatches: [{ color: 'rgb(254, 254, 76)', label: '雪崩危険箇所' }] },
  },
  {
    id: 'hightide_l2_shinsuishin',
    label: '高潮浸水想定区域',
    desc: '想定し得る最大規模の高潮で浸水する範囲と深さです。台風の規模や経路などを最大限の悪条件で設定して算定されており、水防法に基づき都道府県が公表しています。',
    tiles: `${DISAPORTAL}/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '高潮',
    legend: { title: '高潮浸水想定区域', swatches: SWATCHES_HIGHTIDE_TSUNAMI },
    depth: { legend: DEPTH_HIGHTIDE_TSUNAMI, description: '高潮によって想定される浸水深' },
  },
  {
    id: 'tsunami_newlegend',
    label: '津波浸水想定',
    desc: '最大クラスの津波が悪条件下で発生した場合に想定される浸水の範囲と深さです。津波防災地域づくり法に基づき都道府県が設定しています。',
    tiles: `${DISAPORTAL}/04_tsunami_newlegend_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '津波',
    legend: { title: '津波浸水想定', swatches: SWATCHES_HIGHTIDE_TSUNAMI },
    depth: { legend: DEPTH_HIGHTIDE_TSUNAMI, description: '津波によって想定される浸水深' },
  },
  {
    id: 'naisui_data',
    label: '内水（雨水出水）浸水想定区域(一部の地域のみ)',
    desc: '下水道や水路の排水能力を超える大雨で雨水があふれる（内水氾濫）場合の浸水想定です。公表している市町村が限られるため、表示されるのは一部の地域のみです。',
    tiles: `${DISAPORTAL}/02_naisui_data/{z}/{x}/{y}.png`,
    hinanbashoProperty: '内水',
    legend: {
      title: '内水（雨水出水）浸水想定区域',
      // 注: 元データの凡例ラベルは一部範囲が重複しているが、現行表示を維持するためそのまま記載
      swatches: [
        { color: 'rgb(220, 122, 220)', label: '20.0m以上' },
        { color: 'rgb(242, 133, 201)', label: '10.0 ～ 20.0m' },
        { color: 'rgb(255, 145, 145)', label: '5.0 ～ 10.0m' },
        { color: 'rgb(255, 183, 183)', label: '3.0 ～ 5.0m' },
        { color: 'rgb(255, 216, 192)', label: '0.5 ～ 3.0m' },
        { color: 'rgb(248, 225, 166)', label: '0.5 ～ 1.0m' },
        { color: 'rgb(247, 245, 169)', label: '0.1 ～ 0.5m' },
        { color: 'rgb(255, 255, 179)', label: '0.1 ～ 0.3m' },
      ],
    },
  },
];

/** ハザードラスタの初期不透明度 */
export const HAZARD_OPACITY = 0.8;

/** 共通の出典表記 */
export const DISAPORTAL_ATTRIBUTION =
  "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>";
