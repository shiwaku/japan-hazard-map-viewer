import type { Map as MlMap } from 'maplibre-gl';
import { HAZARD_LAYERS, HAZARD_OPACITY, DISAPORTAL_ATTRIBUTION } from '../config/hazard-layers';

/**
 * 設定配列からハザードラスタの source/layer を一括追加する。
 * 先頭レイヤ（洪水浸水想定区域・想定最大規模）のみ初期表示。
 */
export function addHazardLayers(map: MlMap): void {
  HAZARD_LAYERS.forEach((def, index) => {
    map.addSource(def.id, {
      type: 'raster',
      tiles: [def.tiles],
      tileSize: 256,
      attribution: DISAPORTAL_ATTRIBUTION,
    });
    map.addLayer({
      id: def.id,
      type: 'raster',
      source: def.id,
      minzoom: 0,
      maxzoom: 23,
      paint: { 'raster-opacity': HAZARD_OPACITY },
      layout: { visibility: index === 0 ? 'visible' : 'none' },
    });
  });
}
