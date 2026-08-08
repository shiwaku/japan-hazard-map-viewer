import maplibregl, { type Map as MlMap, type LngLat } from 'maplibre-gl';
import type { HazardLayerDef } from '../config/hazard-layers';
import { getLegendItemAt } from '../lib/geo';

/**
 * 表示中のハザードのうち浸水深（または浸水継続時間）を持つものについて、
 * クリック地点の PNG タイルのRGBから該当する区分を読み取ってポップアップ表示する。
 * 複数のハザードを重ねている場合は、それぞれの値を並べて出す。
 */
export async function showDepthPopup(
  map: MlMap,
  lngLat: LngLat,
  defs: HazardLayerDef[],
): Promise<void> {
  const targets = defs.filter((d) => d.depth && map.getLayer(d.id));
  if (targets.length === 0) return;

  const zoom = Math.trunc(map.getZoom());
  const rows = await Promise.all(
    targets.map(async (def) => {
      const item = await getLegendItemAt(
        def.depth!.legend,
        def.tiles,
        lngLat.lat,
        lngLat.lng,
        zoom,
      );
      return { def, value: item?.title ?? null };
    }),
  );

  // 1つも値が取れなかった場合も「該当なし」を返して、クリックが無反応に見えないようにする
  const html = rows
    .map(
      ({ def, value }) =>
        `<div class="popup-row">` +
        `<span class="popup-key">${def.depth!.description}</span>` +
        `<div class="popup-value">${value ?? '該当なし'}</div>` +
        `</div>`,
    )
    .join('');
  const gmap = `<a href="https://www.google.com/maps?q=${lngLat.lat},${lngLat.lng}&hl=ja" target="_blank">🌎Google Maps</a>`;

  new maplibregl.Popup()
    .setLngLat(lngLat)
    .setHTML(`${html}<div class="popup-actions">${gmap}</div>`)
    .addTo(map);
}
