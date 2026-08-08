import maplibregl, { type Map as MlMap, type LngLat } from 'maplibre-gl';
import type { HazardLayerDef } from '../config/hazard-layers';
import { getLegendItemAt } from '../lib/geo';

/**
 * 表示中のハザードが浸水深（または浸水継続時間）を持つ場合、クリック地点の
 * PNGタイルのRGBから該当する区分を読み取ってポップアップ表示する。
 */
export async function showDepthPopup(
  map: MlMap,
  lngLat: LngLat,
  def: HazardLayerDef,
): Promise<void> {
  if (!def.depth || !map.getLayer(def.id)) return;

  const item = await getLegendItemAt(
    def.depth.legend,
    def.tiles,
    lngLat.lat,
    lngLat.lng,
    Math.trunc(map.getZoom()),
  );
  const result = item ? item.title : '取得できません';
  const gmap = `<a href="https://www.google.com/maps?q=${lngLat.lat},${lngLat.lng}&hl=ja" target="_blank">🌎Google Maps</a>`;

  new maplibregl.Popup()
    .setLngLat(lngLat)
    .setHTML(
      `<div class="popup-note" style="margin:0 0 4px;">${def.depth.description}</div>` +
        `<div class="popup-title" style="margin:0;">${result}</div>` +
        `<div class="popup-actions">${gmap}</div>`,
    )
    .addTo(map);
}
