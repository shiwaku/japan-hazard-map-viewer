import type { Map as MlMap } from 'maplibre-gl';
import { POP_FILL_COLOR } from '../config/population';

/** 令和2年簡易100mメッシュ人口（全国）レイヤ。初期は非表示 */
export function addPopulationLayer(map: MlMap): void {
  map.addSource('100m_mesh_pop2020', {
    type: 'vector',
    url: 'pmtiles://https://xs489works.xsrv.jp/pmtiles-data/100m_mesh_pop2020/100m_mesh_pop2020_v2.pmtiles',
    attribution:
      '<a href="https://gtfs-gis.jp/teikyo/index.html" target="_blank">地域・交通データ研究所 簡易100mメッシュ人口データ(2020年国勢調査ベース)</a>',
  });

  map.addLayer({
    id: '100m_mesh_pop2020_fill',
    type: 'fill',
    source: '100m_mesh_pop2020',
    'source-layer': '100m_mesh_pop2020fgb',
    minzoom: 12,
    maxzoom: 23,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': POP_FILL_COLOR,
      'fill-opacity': 0.5,
      'fill-outline-color': 'rgba(0,0,0,0)',
    },
  });
}
