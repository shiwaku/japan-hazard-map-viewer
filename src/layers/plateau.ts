import type { Map as MlMap } from 'maplibre-gl';
import type { Theme } from '../theme';

/** 建物面の色。ダークでは白い塊が眩しいので暗い灰にする */
const BODY_COLOR: Record<Theme, string> = { light: '#f2f4f7', dark: '#3b4250' };

/**
 * PLATEAU 建物（PMTiles, LOD0 2023）を 3D（fill-extrusion）で追加。
 * タイルは zoom 16 のみ提供されるため、source は minzoom/maxzoom=16
 * （3D建物は zoom16 以上で表示）。
 * 旧 S3（pmtiles-data バケット）が削除されたため、稼働中の xsrv ホストに切替。
 * 背景スタイル差し替え後にも呼ばれるため、二重追加しないようガードする。
 */
export function addPlateauLayer(
  map: MlMap,
  visible: boolean,
  theme: Theme,
  beforeId?: string,
): void {
  if (!map.getSource('plateau-pmtiles')) {
    map.addSource('plateau-pmtiles', {
      type: 'vector',
      url: 'pmtiles://https://shiworks.xsrv.jp/pmtiles-data/plateau/PLATEAU_2023_LOD0.pmtiles',
      minzoom: 16,
      maxzoom: 16,
      attribution:
        '<a href="https://www.geospatial.jp/ckan/dataset/plateau">3D都市モデルPLATEAU建物データ（国土交通省）</a>',
    });
  }

  if (!map.getLayer('plateau-pmtiles')) {
    map.addLayer(
      {
        id: 'plateau-pmtiles',
        source: 'plateau-pmtiles',
        'source-layer': 'PLATEAU_2023_LOD0',
        minzoom: 16,
        maxzoom: 23,
        type: 'fill-extrusion',
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': BODY_COLOR[theme],
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-height': ['get', 'measured_height'],
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty('plateau-pmtiles', 'visibility', visible ? 'visible' : 'none');
    map.setPaintProperty('plateau-pmtiles', 'fill-extrusion-color', BODY_COLOR[theme]);
  }
}
