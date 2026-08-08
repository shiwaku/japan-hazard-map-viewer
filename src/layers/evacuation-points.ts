import type { Map as MlMap, FilterSpecification } from 'maplibre-gl';
import { SPRITE_ID } from '../map/basemap';

/** 指定緊急避難場所のアイコン（JIS の「避難場所」ピクトグラム） */
export const ICON_HINANBASHO = `${SPRITE_ID}:evacuation-area`;
/** 自然災害伝承碑のアイコン（記念碑・文化財系） */
export const ICON_DENSHOUHI = `${SPRITE_ID}:bunkazai`;
/** ピン画像（75x90）を地図上でこの倍率に縮めて使う */
const ICON_SIZE = 0.36;

/** 表示状態（パネルのトグルに対応） */
export interface PointVisibility {
  hinanbasho: boolean;
  denshouhi: boolean;
}

/**
 * 指定緊急避難場所（hinanbasho）と自然災害伝承碑（denshouhi）のシンボルレイヤを追加。
 * アイコンはスタイルに注入した custom-smartmap-sprite を参照するため、画像の個別読込は不要。
 * 背景スタイル差し替え後にも呼ばれるため、二重追加しないようガードする。
 * ピンは常に最前面に置きたいので beforeId は取らない（末尾に追加）。
 */
export function addEvacuationPointLayers(
  map: MlMap,
  visible: PointVisibility,
  filter: FilterSpecification | null,
): void {
  // ---- 指定緊急避難場所 ----
  if (!map.getSource('hinanbasho')) {
    map.addSource('hinanbasho', {
      type: 'vector',
      url: 'pmtiles://https://xs489works.xsrv.jp/pmtiles-data/gsi/hinanbasho/hinanbasho_20240129.pmtiles',
      attribution:
        "<a href='https://www.gsi.go.jp/bousaichiri/hinanbasho.html'>指定緊急避難場所データ（国土地理院Webサイト）を加工して作成</a>",
    });
  }

  if (!map.getLayer('hinanbasho')) {
    map.addLayer({
      id: 'hinanbasho',
      source: 'hinanbasho',
      'source-layer': 'hinanbasho_20240129',
      minzoom: 12,
      maxzoom: 23,
      type: 'symbol',
      layout: {
        'icon-image': ICON_HINANBASHO,
        'icon-size': ICON_SIZE,
        // ピン形状なので先端（下端）を座標に合わせる
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        visibility: visible.hinanbasho ? 'visible' : 'none',
      },
    });
  } else {
    map.setLayoutProperty('hinanbasho', 'visibility', visible.hinanbasho ? 'visible' : 'none');
  }

  // 表示中のハザードに対応する避難場所だけに絞る
  setHinanbashoFilter(map, filter);

  // ---- 自然災害伝承碑 ----
  if (!map.getSource('denshouhi')) {
    map.addSource('denshouhi', {
      type: 'geojson',
      data: 'https://xs489works.xsrv.jp/pmtiles-data/gsi/denshouhi/20240125.geojson',
      attribution:
        "<a href='https://www.gsi.go.jp/bousaichiri/denshouhi_datainfo.html'>自然災害伝承碑データ（国土地理院Webサイト）</a>",
    });
  }

  if (!map.getLayer('denshouhi')) {
    map.addLayer({
      id: 'denshouhi',
      type: 'symbol',
      source: 'denshouhi',
      minzoom: 9,
      maxzoom: 23,
      layout: {
        'icon-image': ICON_DENSHOUHI,
        'icon-size': ICON_SIZE,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        visibility: visible.denshouhi ? 'visible' : 'none',
      },
    });
  } else {
    map.setLayoutProperty('denshouhi', 'visibility', visible.denshouhi ? 'visible' : 'none');
  }
}

/**
 * 災害種別プロパティの配列から避難場所フィルタ式を作る。
 * ハザードを複数重ねているときは、そのいずれかに対応する避難場所を残す（論理和）。
 * 空配列（ハザード未選択）のときは null＝絞り込みなし。
 */
export function hinanbashoFilter(properties: string[]): FilterSpecification | null {
  const uniq = [...new Set(properties)];
  if (uniq.length === 0) return null;
  const terms = uniq.map((p) => ['==', ['get', p], '1']);
  return (uniq.length === 1 ? terms[0] : ['any', ...terms]) as FilterSpecification;
}

/**
 * 指定緊急避難場所レイヤの絞り込みを適用する。
 * レイヤ未追加なら idle 後に一度だけ適用する。
 */
export function setHinanbashoFilter(map: MlMap, filter: FilterSpecification | null): void {
  if (map.getLayer('hinanbasho')) {
    map.setFilter('hinanbasho', filter ?? undefined);
  } else {
    map.once('idle', () => {
      if (map.getLayer('hinanbasho')) map.setFilter('hinanbasho', filter ?? undefined);
    });
  }
}
