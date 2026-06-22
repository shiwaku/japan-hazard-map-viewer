import type { Map as MlMap, FilterSpecification } from 'maplibre-gl';
import { assetUrl } from '../lib/geo';

/**
 * 指定緊急避難場所（hinanbasho）と自然災害伝承碑（denshouhi）のシンボルレイヤを追加。
 * アイコン画像の読み込みが非同期（maplibre-gl v5 で loadImage は Promise）なため async。
 */
export async function addEvacuationPointLayers(map: MlMap): Promise<void> {
  // ---- 指定緊急避難場所 ----
  map.addSource('hinanbasho', {
    type: 'vector',
    url: 'pmtiles://https://xs489works.xsrv.jp/pmtiles-data/gsi/hinanbasho/hinanbasho_20240129.pmtiles',
    attribution:
      "<a href='https://www.gsi.go.jp/bousaichiri/hinanbasho.html'>指定緊急避難場所データ（国土地理院Webサイト）を加工して作成</a>",
  });

  const pin1 = await map.loadImage(assetUrl('img/location-pin.png'));
  if (!map.hasImage('location-pin-1')) map.addImage('location-pin-1', pin1.data);

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
    },
  });

  // 初期フィルタ（洪水）
  setHinanbashoFilter(map, '洪水');

  // ---- 自然災害伝承碑 ----
  map.addSource('denshouhi', {
    type: 'geojson',
    data: 'https://xs489works.xsrv.jp/pmtiles-data/gsi/denshouhi/20240125.geojson',
    attribution:
      "<a href='https://www.gsi.go.jp/bousaichiri/denshouhi_datainfo.html'>自然災害伝承碑データ（国土地理院Webサイト）</a>",
  });

  const pin2 = await map.loadImage(assetUrl('img/location-pin2_red.png'));
  if (!map.hasImage('location-pin-2')) map.addImage('location-pin-2', pin2.data);

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
    },
  });
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
