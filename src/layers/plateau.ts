import type { Map as MlMap } from 'maplibre-gl';

/**
 * PLATEAU 建物（PMTiles, LOD0 2023）を 3D（fill-extrusion）で追加。
 * タイルは zoom 16 のみ提供されるため、source は minzoom/maxzoom=16
 * （3D建物は zoom16 以上で表示）。
 * 旧 S3（pmtiles-data バケット）が削除されたため、稼働中の xsrv ホストに切替。
 */
export function addPlateauLayer(map: MlMap): void {
  map.addSource('plateau-pmtiles', {
    type: 'vector',
    url: 'pmtiles://https://shiworks.xsrv.jp/pmtiles-data/plateau/PLATEAU_2023_LOD0.pmtiles',
    minzoom: 16,
    maxzoom: 16,
    attribution:
      '<a href="https://www.geospatial.jp/ckan/dataset/plateau">3D都市モデルPLATEAU建物データ（国土交通省）</a>',
  });

  map.addLayer({
    id: 'plateau-pmtiles',
    source: 'plateau-pmtiles',
    'source-layer': 'PLATEAU_2023_LOD0',
    minzoom: 16,
    maxzoom: 23,
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#FFFFFF',
      'fill-extrusion-opacity': 1,
      'fill-extrusion-height': ['get', 'measured_height'],
    },
  });
}
