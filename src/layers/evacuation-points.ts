import type { Map as MlMap, FilterSpecification } from 'maplibre-gl';
import { assetUrl } from '../lib/geo';

/** 表示状態（パネルのトグルに対応） */
export interface PointVisibility {
  hinanbasho: boolean;
  denshouhi: boolean;
}

/**
 * 指定緊急避難場所（hinanbasho）と自然災害伝承碑（denshouhi）のシンボルレイヤを追加。
 * アイコン画像の読み込みが非同期（maplibre-gl v5 で loadImage は Promise）なため async。
 * 背景スタイル差し替え後にも呼ばれるため、二重追加しないようガードする。
 * ピンは常に最前面に置きたいので beforeId は取らない（末尾に追加）。
 */
export async function addEvacuationPointLayers(
  map: MlMap,
  visible: PointVisibility,
  hinanbashoProperty: string,
): Promise<void> {
  // ---- 指定緊急避難場所 ----
  if (!map.getSource('hinanbasho')) {
    map.addSource('hinanbasho', {
      type: 'vector',
      url: 'pmtiles://https://xs489works.xsrv.jp/pmtiles-data/gsi/hinanbasho/hinanbasho_20240129.pmtiles',
      attribution:
        "<a href='https://www.gsi.go.jp/bousaichiri/hinanbasho.html'>指定緊急避難場所データ（国土地理院Webサイト）を加工して作成</a>",
    });
  }

  if (!map.hasImage('location-pin-1')) {
    const pin1 = await map.loadImage(assetUrl('img/location-pin.png'));
    if (!map.hasImage('location-pin-1')) map.addImage('location-pin-1', pin1.data);
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
        'icon-image': 'location-pin-1',
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        visibility: visible.hinanbasho ? 'visible' : 'none',
      },
    });
  } else {
    map.setLayoutProperty('hinanbasho', 'visibility', visible.hinanbasho ? 'visible' : 'none');
  }

  // 選択中のハザードに対応する避難場所だけに絞る
  setHinanbashoFilter(map, hinanbashoProperty);

  // ---- 自然災害伝承碑 ----
  if (!map.getSource('denshouhi')) {
    map.addSource('denshouhi', {
      type: 'geojson',
      data: 'https://xs489works.xsrv.jp/pmtiles-data/gsi/denshouhi/20240125.geojson',
      attribution:
        "<a href='https://www.gsi.go.jp/bousaichiri/denshouhi_datainfo.html'>自然災害伝承碑データ（国土地理院Webサイト）</a>",
    });
  }

  if (!map.hasImage('location-pin-2')) {
    const pin2 = await map.loadImage(assetUrl('img/location-pin2_red.png'));
    if (!map.hasImage('location-pin-2')) map.addImage('location-pin-2', pin2.data);
  }

  if (!map.getLayer('denshouhi')) {
    map.addLayer({
      id: 'denshouhi',
      type: 'symbol',
      source: 'denshouhi',
      minzoom: 9,
      maxzoom: 23,
      layout: {
        'icon-image': 'location-pin-2',
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        visibility: visible.denshouhi ? 'visible' : 'none',
      },
    });
  } else {
    map.setLayoutProperty('denshouhi', 'visibility', visible.denshouhi ? 'visible' : 'none');
  }
}

/**
 * 指定緊急避難場所レイヤを災害種別プロパティで絞り込む。
 * レイヤ未追加なら idle 後に一度だけ適用する。
 */
export function setHinanbashoFilter(map: MlMap, property: string): void {
  const expr: FilterSpecification = ['==', ['get', property], '1'];
  if (map.getLayer('hinanbasho')) {
    map.setFilter('hinanbasho', expr);
  } else {
    map.once('idle', () => {
      if (map.getLayer('hinanbasho')) map.setFilter('hinanbasho', expr);
    });
  }
}
