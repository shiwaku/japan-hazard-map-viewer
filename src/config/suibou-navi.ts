// 浸水ナビ（国土地理院）の定数・型・URL 組み立て。
// 仕様: 「浸水ナビ API 仕様及び使用方法の説明書」3.2版（令和5年3月）

const BASE = 'https://suiboumap.gsi.go.jp/shinsuimap';
export const API_BASE = `${BASE}/Api/Public`;
export const TILE_BASE = `${BASE}/Tile`;

/** 想定破堤点（GetBreakPoint の戻り値） */
export interface BreakPoint {
  ID: string;
  BPName: string;
  /** 例: 「荒川右岸 10.25k」 */
  BPLocation: string;
  BPLat: number;
  BPLon: number;
  /** 降雨規模コード: 0=想定最大規模, 1=計画規模, -1=降雨規模未区分 */
  CSVScale: number;
  EntryRiverName: string;
  RiverCode: string;
  /** 河川コード枝番。採番されていない場合は "_" */
  SubRiverCode: string;
  OfficeCode: string;
  /** 破堤発生からの経過時間（分）の配列。ここに無い時刻のタイルは存在しない */
  BPTime: number[];
  /** その地点に最大の浸水深をもたらす破堤点 */
  isDepthMax?: boolean;
  /** その地点に最速の浸水開始をもたらす破堤点 */
  isStartMax?: boolean;
  /** その地点に最長の浸水継続をもたらす破堤点 */
  isDurationMax?: boolean;
}

/** 降雨規模コード → タイルパスの規模表記 */
export function scalePath(csvScale: number): string {
  if (csvScale === 1) return 'L1';
  if (csvScale === -1) return 'L1b';
  return 'L2';
}

/** 降雨規模コード → 画面表示用のラベル */
export function scaleLabel(csvScale: number): string {
  if (csvScale === 1) return '計画規模';
  if (csvScale === -1) return '降雨規模未区分';
  return '想定最大規模';
}

/** 拡張河川コード = 河川コード + 枝番（枝番が "_" のときは河川コードのみ） */
function riverPath(bp: BreakPoint): string {
  return bp.SubRiverCode && bp.SubRiverCode !== '_'
    ? `${bp.RiverCode}${bp.SubRiverCode}`
    : bp.RiverCode;
}

/** 破堤点ごとのタイルのベースパス */
function tileBase(bp: BreakPoint): string {
  return `${TILE_BASE}/${bp.OfficeCode}/${scalePath(bp.CSVScale)}/${riverPath(bp)}/${bp.BPName}`;
}

/** 時系列タイル（破堤発生からの経過時間ぶん）。経過時間は5桁ゼロ埋め */
export function timeseriesTileUrl(bp: BreakPoint, minutes: number): string {
  const t = String(minutes).padStart(5, '0');
  return `${tileBase(bp)}/${bp.BPName}_${t}m/{z}/{x}/{y}.png`;
}

/** 最大浸水域タイル（浸水ランクで色分け） */
export function maxRankTileUrl(bp: BreakPoint): string {
  return `${tileBase(bp)}/${bp.BPName}_MAX/overlayer/{z}/{x}/{y}.png`;
}

/** 最大浸水域タイル（赤一色） */
export function maxRedTileUrl(bp: BreakPoint): string {
  return `${tileBase(bp)}/${bp.BPName}_MAX/baselayer/{z}/{x}/{y}.png`;
}

/** 検索可能範囲タイル（浸水ナビがデータを持っている範囲） */
export function rangeTileUrl(csvScale = 0): string {
  return `${TILE_BASE}/rangelayer/${scalePath(csvScale)}/{z}/{x}/{y}.png`;
}

/** タイルが用意されている最大ズーム。これ以上は拡大表示になる */
export const TILE_MAXZOOM = 16;

/** レイヤーID */
export const POINTS_SOURCE = 'suibou-points';
export const POINTS_LAYER = 'suibou-points';
export const SELECTED_POINT_LAYER = 'suibou-selected-point';
/** 時系列レイヤーのID接頭辞（`suibou-ts-{破堤点ID}-{経過時間5桁}`） */
export const TIMESERIES_PREFIX = 'suibou-ts-';

/** タイルの既定の不透明度 */
export const SUIBOU_OPACITY = 0.8;

export const SUIBOU_ATTRIBUTION =
  "<a href='https://suiboumap.gsi.go.jp/' target='_blank' rel='noopener'>浸水ナビ（国土地理院）</a>";

/** 経過時間（分）を「1日6時間」のような可読表記にする */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m === 0 ? `${h}時間` : `${h}時間${m}分`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${d}日` : `${d}日${rh}時間`;
}
