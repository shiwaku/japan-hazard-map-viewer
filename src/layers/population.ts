import type { Map as MlMap } from 'maplibre-gl';
import { POP_FILL_COLOR } from '../config/population';

/**
 * 令和2年簡易100mメッシュ人口（全国）レイヤ。
 * 背景スタイル差し替え後にも呼ばれるため、二重追加しないようガードする。
 */
export function addPopulationLayer(map: MlMap, visible: boolean, beforeId?: string): void {
  if (!map.getSource('100m_mesh_pop2020')) {
    map.addSource('100m_mesh_pop2020', {
      type: 'vector',
      url: 'pmtiles://https://xs489works.xsrv.jp/pmtiles-data/100m_mesh_pop2020/100m_mesh_pop2020_v2.pmtiles',
      attribution:
        '<a href="https://gtfs-gis.jp/teikyo/index.html" target="_blank">地域・交通データ研究所 簡易100mメッシュ人口データ(2020年国勢調査ベース)</a>',
    });
  }

  if (!map.getLayer('100m_mesh_pop2020_fill')) {
    map.addLayer(
      {
        id: '100m_mesh_pop2020_fill',
        type: 'fill',
        source: '100m_mesh_pop2020',
        'source-layer': '100m_mesh_pop2020fgb',
        minzoom: 12,
        maxzoom: 23,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': POP_FILL_COLOR,
          'fill-opacity': 0.5,
          'fill-outline-color': 'rgba(0,0,0,0)',
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty('100m_mesh_pop2020_fill', 'visibility', visible ? 'visible' : 'none');
  }
}
