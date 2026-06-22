import maplibregl, { type Map as MlMap, type MapGeoJSONFeature } from 'maplibre-gl';

/** 画像が存在するか HEAD リクエストで確認 */
async function imageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

function googleMapsLink(lat: number, lng: number): string {
  return `<a href="https://www.google.com/maps?q=${lat},${lng}&hl=ja" target="_blank">🌎Google Maps</a>`;
}

function streetViewLink(lat: number, lng: number): string {
  return `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&hl=ja" target="_blank">📷Street View</a>`;
}

/**
 * 各フィーチャレイヤ（避難場所・伝承碑・100mメッシュ人口）のクリックポップアップを登録する。
 */
export function registerFeaturePopups(map: MlMap): void {
  // ---- 指定緊急避難場所 ----
  map.on('click', 'hinanbasho', (e) => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    const p = f.properties ?? {};

    const disasterTypes = [
      '洪水',
      '崖崩れ、土石流及び地滑り',
      '高潮',
      '津波',
      '大規模な火事',
      '内水氾濫',
      '火山現象',
    ];
    const matched = disasterTypes.filter((t) => p[t] === '1').join('　');
    const chofuku = p['指定避難所との住所同一'] === '1' ? '〇' : '-';

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-title" style="color:#0f9d58;">${p['施設・場所名'] ?? ''}</div>` +
          `<div class="popup-row"><span class="popup-key">住所</span> ${p['住所'] ?? ''}</div>` +
          `<div class="popup-row"><span class="popup-key">対応する災害種別</span> ${matched || '-'}</div>` +
          `<div class="popup-row"><span class="popup-key">指定避難所との住所同一</span> ${chofuku}</div>` +
          `<div class="popup-note">※最新かつ詳細の状況などは必ず当該市町村にご確認ください。</div>` +
          `<div class="popup-actions">${googleMapsLink(lat, lng)}` +
          `<a href="https://www.gsi.go.jp/bousaichiri/hinanbasho.html" target="_blank">「指定緊急避難場所」について</a></div>`,
      )
      .addTo(map);
  });

  // ---- 自然災害伝承碑 ----
  map.on('click', 'denshouhi', async (e) => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    const p = f.properties ?? {};
    const id = String(p['ID'] ?? '');

    // 画像URL（.jpg / .JPG の両方を試す）
    const base = `https://maps.gsi.go.jp/legend/disaster_lore/${id.substring(0, 5)}/${id}`;
    let imgURL = '';
    if (await imageExists(`${base}.jpg`)) imgURL = `${base}.jpg`;
    else if (await imageExists(`${base}.JPG`)) imgURL = `${base}.JPG`;

    const row = (label: string, value: unknown) =>
      `<div class="popup-row"><span class="popup-key">${label}</span> ${value ?? ''}</div>`;

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-title" style="color:#dc2626;">碑名: ${p['碑名'] ?? ''}</div>` +
          row('建立年', p['建立年']) +
          row('所在地', p['所在地']) +
          row('災害名', p['災害名']) +
          row('災害種別', p['災害種別']) +
          row('伝承内容', p['伝承内容']) +
          (imgURL
            ? `<a class="popup-photo" href="${imgURL}" target="_blank"><img src="${imgURL}" alt="画像" /></a>`
            : '') +
          row('ID', id) +
          `<div class="popup-actions">${googleMapsLink(lat, lng)}</div>`,
      )
      .addTo(map);
  });

  // ---- 100mメッシュ人口 ----
  map.on('click', '100m_mesh_pop2020_fill', (e) => {
    const f = e.features?.[0];
    if (!f) return;
    const [lng, lat] = polygonCentroid(f) ?? [e.lngLat.lng, e.lngLat.lat];
    const p = f.properties ?? {};

    const popRow = (label: string, value: unknown) =>
      `<tr><td>${label}：</td><td><b>${value ?? ''}</b></td></tr>`;

    new maplibregl.Popup({ className: 'custom-100m-mesh-pop2020-popup' })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-title" style="color:#0065cb;">簡易100mメッシュ人口` +
          `<br><span style="font-weight:600;font-size:11px;">(2020年国勢調査ベース)</span></div>` +
          `<table class="pop-info">` +
          popRow('メッシュコード', p['MESH_CODE']) +
          popRow('総人口', `${p['PopT'] ?? ''}人`) +
          popRow('0～14歳人口', `${p['Pop0_14'] ?? ''}人`) +
          popRow('15～64歳人口', `${p['Pop15_64'] ?? ''}人`) +
          popRow('65歳以上人口', `${p['Pop65over'] ?? ''}人`) +
          popRow('75歳以上人口', `${p['Pop75over'] ?? ''}人`) +
          popRow('85歳以上人口', `${p['Pop85over'] ?? ''}人`) +
          `</table>` +
          `<div class="popup-note">※このデータは、簡易な方法で人口を按分したものであり、当該100mメッシュの実際の人口を示しているものではありません。</div>` +
          `<div class="popup-actions">${googleMapsLink(lat, lng)}${streetViewLink(lat, lng)}</div>`,
      )
      .addTo(map);
  });
}

/** ポリゴン外周リングの単純重心（経度・緯度の平均）を返す */
function polygonCentroid(f: MapGeoJSONFeature): [number, number] | null {
  if (f.geometry.type !== 'Polygon') return null;
  const ring = f.geometry.coordinates[0];
  let lngSum = 0;
  let latSum = 0;
  for (const [lng, lat] of ring) {
    lngSum += lng;
    latSum += lat;
  }
  return [lngSum / ring.length, latSum / ring.length];
}
