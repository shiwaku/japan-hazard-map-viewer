import type { Map as MlMap } from 'maplibre-gl';

/** PLATEAU 建物（PMTiles, LOD0）を 3D（fill-extrusion）で追加 */
export function addPlateauLayer(map: MlMap): void {
  map.addSource('plateau-pmtiles', {
    type: 'vector',
    url: 'pmtiles://https://pmtiles-data.s3.ap-northeast-1.amazonaws.com/plateau/PLATEAU_2023_LOD0.pmtiles',
    minzoom: 14,
    maxzoom: 16,
    attribution:
      '<a href="https://www.geospatial.jp/ckan/dataset/plateau">3D都市モデルPLATEAU建物データ（国土交通省）</a>',
  });

  map.addLayer({
    id: 'plateau-pmtiles',
    source: 'plateau-pmtiles',
    'source-layer': 'PLATEAU_2023_LOD0',
    minzoom: 14,
    maxzoom: 23,
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#FFFFFF',
      'fill-extrusion-opacity': 1,
      'fill-extrusion-height': ['get', 'measured_height'],
    },
  });
}
