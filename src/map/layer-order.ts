// レイヤーの重ね順を 1 箇所で決める。
//
// ハザードマップ群・浸水ナビ群・オーバーレイ群が独立して自分のレイヤーを足すため、
// 「どこに挿すか」を各所で個別に計算すると順序が壊れる。ここでスロット順だけを定義し、
// beforeId は現在のスタイルから機械的に求める。どの群を先に貼っても最終的な順序は同じになる。

import type { Map as MlMap } from 'maplibre-gl';
import { HAZARD_LAYERS } from '../config/hazard-layers';
import { POINTS_LAYER, SELECTED_POINT_LAYER, TIMESERIES_PREFIX } from '../config/suibou-navi';

/** 下から上への描画順 */
const SLOT_ORDER = [
  'suibou-range', // 浸水ナビ 検索可能範囲
  'suibou-max', // 浸水ナビ 最大浸水域
  'hazard', // ハザードマップ（法指定の区域）
  'suibou-timeseries', // 浸水ナビ 時系列
  'population', // 100mメッシュ人口
  'plateau', // PLATEAU 3D建物
  'labels', // 背景スタイルの地名ラベル
  'suibou-points', // 浸水ナビ 破堤点
  'pins', // 指定緊急避難場所・自然災害伝承碑
] as const;

export type LayerSlot = (typeof SLOT_ORDER)[number];

export const POPULATION_LAYER = '100m_mesh_pop2020_fill';
export const PLATEAU_LAYER = 'plateau-pmtiles';
export const PIN_LAYERS = ['hinanbasho', 'denshouhi'];

export const SUIBOU_RANGE_LAYER = 'suibou-range';
export const SUIBOU_MAX_RANK_LAYER = 'suibou-max-rank';
export const SUIBOU_MAX_RED_LAYER = 'suibou-max-red';

const HAZARD_IDS = new Set(HAZARD_LAYERS.map((d) => d.id));

/** レイヤーIDからスロットを引く。背景スタイル側のレイヤーは undefined */
function slotOf(id: string): LayerSlot | undefined {
  if (id === SUIBOU_RANGE_LAYER) return 'suibou-range';
  if (id === SUIBOU_MAX_RANK_LAYER || id === SUIBOU_MAX_RED_LAYER) return 'suibou-max';
  if (HAZARD_IDS.has(id)) return 'hazard';
  if (id.startsWith(TIMESERIES_PREFIX)) return 'suibou-timeseries';
  if (id === POPULATION_LAYER) return 'population';
  if (id === PLATEAU_LAYER) return 'plateau';
  if (id === POINTS_LAYER || id === SELECTED_POINT_LAYER) return 'suibou-points';
  if (PIN_LAYERS.includes(id)) return 'pins';
  return undefined;
}

const LABELS_INDEX = SLOT_ORDER.indexOf('labels');

/**
 * slot のレイヤーを挿入するときの beforeId。
 * 「自分より上のスロットで、既に地図に載っている最初のレイヤー」を返す。
 * 該当が無ければ undefined（＝最前面へ追加）。
 *
 * 背景スタイル側の最初の symbol レイヤー（地名ラベル）は 'labels' スロットとして扱う。
 * これにより、ハザードや浸水ナビのラスタが地名を覆わない。
 */
export function beforeIdFor(map: MlMap, slot: LayerSlot): string | undefined {
  const target = SLOT_ORDER.indexOf(slot);

  for (const layer of map.getStyle().layers) {
    const own = slotOf(layer.id);
    if (own !== undefined) {
      if (SLOT_ORDER.indexOf(own) > target) return layer.id;
      continue;
    }
    // 背景スタイル側のレイヤー。最初の symbol を地名ラベルの位置とみなす
    if (layer.type === 'symbol' && LABELS_INDEX > target) return layer.id;
  }
  return undefined;
}

/**
 * 同一スロット内で順序を持つレイヤー群（ハザード 15 種など）の挿入位置。
 * ids は下から上への並び。self より後ろで既に載っているものがあればその手前、
 * 無ければスロット全体の beforeId を返す。
 */
export function beforeIdWithin(
  map: MlMap,
  slot: LayerSlot,
  ids: readonly string[],
  self: string,
): string | undefined {
  const i = ids.indexOf(self);
  for (let j = i + 1; j < ids.length; j++) {
    if (map.getLayer(ids[j])) return ids[j];
  }
  return beforeIdFor(map, slot);
}
