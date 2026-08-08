import type { Map as MlMap } from 'maplibre-gl';
import { DISAPORTAL_ATTRIBUTION, type HazardLayerDef } from '../config/hazard-layers';

/**
 * 表示中のハザードラスタだけを地図に載せる（OFF のものはソースごと持たない）。
 * 複数を同時に載せられるので、beforeId で重ね順を指定する。
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

/** ハザードレイヤとソースを取り外す（未追加なら何もしない） */
export function removeHazardLayer(map: MlMap, def: HazardLayerDef): void {
  if (map.getLayer(def.id)) map.removeLayer(def.id);
  if (map.getSource(def.id)) map.removeSource(def.id);
}
