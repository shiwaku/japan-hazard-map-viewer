import maplibregl, { type Map as MlMap, type LngLat } from 'maplibre-gl';
import { HAZARD_LAYERS } from '../config/hazard-layers';
import { getLegendItemAt } from '../lib/geo';

/**
 * 表示中の浸水深対応ハザードレイヤがあれば、クリック地点のPNGタイルのRGBから
 * 想定浸水深（または継続時間）を読み取りポップアップ表示する。
 */
export async function showDepthPopup(map: MlMap, lngLat: LngLat): Promise<void> {
  const def = HAZARD_LAYERS.find(
    (d) => d.depth && map.getLayer(d.id) && map.getLayoutProperty(d.id, 'visibility') === 'visible',
  );
  if (!def?.depth) return;

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
