import type { Map as MlMap } from 'maplibre-gl';
import {
  HAZARD_LAYERS,
  DISAPORTAL_ATTRIBUTION,
  type HazardLayerDef,
} from '../config/hazard-layers';

/**
 * 選択中のハザードラスタだけを地図に載せる（未選択のものはソースごと持たない）。
 * 旧実装は 15 レイヤ分の source/layer を常時抱えていたが、単一選択なので不要。
 * beforeId に地名ラベル（最初の symbol レイヤ）を渡し、ラスタがラベルを覆わないようにする。
 */
export function ensureHazardLayer(
  map: MlMap,
  def: HazardLayerDef,
  opacity: number,
  beforeId?: string,
): void {
  if (!map.getSource(def.id)) {
    map.addSource(def.id, {
      type: 'raster',
      tiles: [def.tiles],
      tileSize: 256,
      attribution: DISAPORTAL_ATTRIBUTION,
    });
  }
  if (!map.getLayer(def.id)) {
    map.addLayer(
      {
        id: def.id,
        type: 'raster',
        source: def.id,
        minzoom: 0,
        maxzoom: 23,
        paint: { 'raster-opacity': opacity },
      },
      beforeId,
    );
  } else {
    map.setPaintProperty(def.id, 'raster-opacity', opacity);
  }
}

/** keepId 以外のハザードレイヤとソースを取り外す */
export function removeOtherHazardLayers(map: MlMap, keepId: string): void {
  for (const def of HAZARD_LAYERS) {
    if (def.id === keepId) continue;
    if (map.getLayer(def.id)) map.removeLayer(def.id);
    if (map.getSource(def.id)) map.removeSource(def.id);
  }
}
