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
        `<b><big><span style="color:#009800;">${p['施設・場所名'] ?? ''}</span></big></b><br>` +
          `住所: ${p['住所'] ?? ''}<br>` +
          `${googleMapsLink(lat, lng)}<br><br>` +
          `<b><big>対応している災害の種別</big></b><br>${matched}<br><br>` +
          `指定避難所との住所同一: ${chofuku}<br><br>` +
          `<b>※最新かつ詳細の状況などは必ず当該市町村にご確認ください。</b><br>` +
          `<a href="https://www.gsi.go.jp/bousaichiri/hinanbasho.html" target="_blank">「指定緊急避難場所」について</a>`,
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
      `<div style="border-bottom:1px solid #000;">${label}: ${value ?? ''}</div>`;

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="border-bottom:1px solid #000; font-size: 1.2em; color: red;"><strong>碑名: ${p['碑名'] ?? ''}</strong></div>` +
          row('建立年', p['建立年']) +
          row('所在地', p['所在地']) +
          row('災害名', p['災害名']) +
          row('災害種別', p['災害種別']) +
          row('伝承内容', p['伝承内容']) +
          (imgURL
            ? `<div><a href="${imgURL}" target="_blank"><img src="${imgURL}" alt="画像" style="width: 100%; height: auto;"></a></div>`
            : '') +
          row('ID', id) +
          `<div>${googleMapsLink(lat, lng)}</div>`,
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
        `<div style="font-size: 1.2em; color: #0065CB;"><strong>簡易100mメッシュ人口</strong></div>` +
          `<div style="font-size: 1.2em; color: #0065CB;"><strong>(2020年国勢調査ベース)</strong></div>` +
          `<table class="pop-info">` +
          popRow('メッシュコード', p['MESH_CODE']) +
          popRow('総人口', `${p['PopT'] ?? ''}人`) +
          popRow('0～14歳人口', `${p['Pop0_14'] ?? ''}人`) +
          popRow('15～64歳人口', `${p['Pop15_64'] ?? ''}人`) +
          popRow('65歳以上人口', `${p['Pop65over'] ?? ''}人`) +
          popRow('75歳以上人口', `${p['Pop75over'] ?? ''}人`) +
          popRow('85歳以上人口', `${p['Pop85over'] ?? ''}人`) +
          `</table>` +
          `※このデータは、簡易な方法で人口を按分したものであり、当該100mメッシュの実際の人口を示しているものではありません。<br>` +
          `${googleMapsLink(lat, lng)} ${streetViewLink(lat, lng)}`,
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
