import maplibregl, { type Map as MlMap, type LngLat } from 'maplibre-gl';
import polyline from '@mapbox/polyline';
import { haversineDistance, assetUrl, type LngLat as LngLatTuple } from '../lib/geo';

type Profile = 'person' | 'elderly' | 'car';

interface Candidate {
  coordinates: [number, number]; // [lng, lat]
  properties: Record<string, unknown>;
}

interface RoutePath {
  distance: number;
  points: string; // encoded polyline
}

interface RouteResult {
  route: RoutePath;
  endLatLng: { lat: number; lng: number };
  properties: Record<string, unknown>;
}

// ---- 経路プロファイルの状態 ----
let currentApiProfile: 'foot' | 'car' = 'foot';
let currentSpeed = 4 / 3.6; // m/s（初期 4km/h）
let currentGif = 'person.gif';
let routeCounter = 0;
const destinationMarkers: maplibregl.Marker[] = [];

/** 右下の速度切替ボタンを配線し、初期選択（一般の人）を適用する */
export function setupRoutingControls(): void {
  const buttons: { profile: Profile; speed: number; id: string }[] = [
    { profile: 'car', speed: 10, id: 'carButton' },
    { profile: 'person', speed: 4, id: 'personButton' },
    { profile: 'elderly', speed: 2, id: 'elderlyButton' },
  ];
  for (const b of buttons) {
    document.getElementById(b.id)?.addEventListener('click', () => setSpeed(b.profile, b.speed));
  }
  updateButtonSelection('person');
}

function setSpeed(profile: Profile, speedKmh: number): void {
  currentApiProfile = profile === 'car' ? 'car' : 'foot';
  currentSpeed = speedKmh / 3.6;
  currentGif = `${profile}.gif`;
  updateButtonSelection(profile);
}

function updateButtonSelection(profile: Profile): void {
  for (const id of ['carButton', 'personButton', 'elderlyButton']) {
    document.getElementById(id)?.classList.remove('selected');
  }
  document.getElementById(`${profile}Button`)?.classList.add('selected');
}

/**
 * クリック地点から最寄りの避難場所への最短経路を探索して描画する。
 * 避難場所候補は BODIK WAPI から取得し、失敗時は表示中の 'hinanbasho' から補完する。
 */
export async function routeToNearestShelter(map: MlMap, lngLat: LngLat): Promise<void> {
  const startMarker = new maplibregl.Marker().setLngLat([lngLat.lng, lngLat.lat]);

  try {
    const candidates = await fetchEvacuationCandidates(lngLat);
    if (candidates.length === 0) throw new Error('WAPIから候補が取得できませんでした');
    await findShortestRoute(map, startMarker, candidates);
  } catch (err) {
    console.warn('BODIK WAPI 取得に失敗、地図上の避難場所から補完します:', err);
    const candidates = fallbackCandidatesFromMap(map, lngLat);
    if (candidates.length === 0) {
      alert('避難場所が見つかりません（WAPI/フォールバックともに失敗）');
      return;
    }
    await findShortestRoute(map, startMarker, candidates);
  }
}

/** BODIK WAPI から近傍の避難場所を取得して候補に整形 */
async function fetchEvacuationCandidates(lngLat: LngLat): Promise<Candidate[]> {
  const url = new URL('https://wapi.bodik.jp/evacuation_space');
  url.searchParams.set('select_type', 'geometry');
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('lat', String(lngLat.lat));
  url.searchParams.set('lon', String(lngLat.lng));
  url.searchParams.set('distance', '10000'); // [m]

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`WAPI status ${res.status}`);
  const data = await res.json();

  // 返却形式の揺れを吸収
  const features: {
    geometry?: { coordinates?: number[] };
    properties?: Record<string, unknown>;
  }[] = data?.resultsets?.features ?? data?.resultset?.features ?? data?.features ?? [];

  return features
    .filter((f) => Array.isArray(f.geometry?.coordinates))
    .map((f) =>
      normalizeCandidate(f.geometry!.coordinates as [number, number], f.properties ?? {}),
    );
}

/** 画面に描画済みの 'hinanbasho' から、クリック地点に近い順で最大5件を候補にする */
function fallbackCandidatesFromMap(map: MlMap, lngLat: LngLat): Candidate[] {
  const rendered = map.queryRenderedFeatures({ layers: ['hinanbasho'] });
  const origin: LngLatTuple = [lngLat.lng, lngLat.lat];

  return rendered
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => {
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      return normalizeCandidate(coords, f.properties ?? {});
    })
    .sort(
      (a, b) => haversineDistance(a.coordinates, origin) - haversineDistance(b.coordinates, origin),
    )
    .slice(0, 5);
}

/** 名称・住所キーの揺れを正規化した候補を作る */
function normalizeCandidate(
  coordinates: [number, number],
  props: Record<string, unknown>,
): Candidate {
  return {
    coordinates,
    properties: {
      ...props,
      name: props.name ?? props['施設・場所名'] ?? props['名称'],
      address: props.address ?? props['住所'],
    },
  };
}

/** 各候補にルート検索し、距離最小のものを描画する */
async function findShortestRoute(
  map: MlMap,
  startMarker: maplibregl.Marker,
  candidates: Candidate[],
): Promise<void> {
  const start = startMarker.getLngLat();

  const routes = await Promise.all(
    candidates.map(async (candidate): Promise<RouteResult> => {
      const endLatLng = { lat: candidate.coordinates[1], lng: candidate.coordinates[0] };
      const url = `https://apps.bodik.jp/route?point=${start.lat},${start.lng}&point=${endLatLng.lat},${endLatLng.lng}&profile=${currentApiProfile}&type=json`;
      const data = await fetch(url).then((r) => r.json());
      return { route: data.paths[0], endLatLng, properties: candidate.properties };
    }),
  );

  const shortest = routes.reduce((prev, curr) =>
    prev.route.distance < curr.route.distance ? prev : curr,
  );
  displayRoute(map, shortest);
}

/** 最短ルートを地図に描画し、目的地マーカー・歩行アニメを開始する */
function displayRoute(map: MlMap, shortest: RouteResult): void {
  // エンコードされたポリライン → [lng, lat] の配列
  const latLngs: LngLatTuple[] = polyline
    .decode(shortest.route.points)
    .map(([lat, lng]) => [lng, lat]);

  const totalDistance = getTotalDistance(latLngs);
  const color = getRouteColor(totalDistance);

  const routeId = `route${routeCounter++}`;
  map.addSource(routeId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: latLngs },
    },
  });
  map.addLayer({
    id: routeId,
    type: 'line',
    source: routeId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': 5 },
  });

  // 目的地マーカー（避難所アイコンGIF）
  const evacImg = document.createElement('img');
  evacImg.src = assetUrl('gif/evac_place.gif');
  evacImg.alt = '避難場所';
  evacImg.style.width = '32px';
  evacImg.style.height = '32px';

  const name = String(shortest.properties.name ?? '避難場所');
  const address = String(shortest.properties.address ?? '');
  const destinationMarker = new maplibregl.Marker({ element: evacImg, anchor: 'bottom' })
    .setLngLat([shortest.endLatLng.lng, shortest.endLatLng.lat])
    .setPopup(
      new maplibregl.Popup({
        className: 'custom-popup',
        anchor: 'bottom',
        offset: [0, -40],
      }).setHTML(`<b>${name}</b><br>${address}`),
    )
    .addTo(map)
    .togglePopup();
  destinationMarkers.push(destinationMarker);

  // 歩行アニメ用マーカー
  const walkerImg = document.createElement('img');
  walkerImg.src = assetUrl(`gif/${currentGif}`);
  walkerImg.style.width = '32px';
  walkerImg.style.height = '32px';
  const walkerMarker = new maplibregl.Marker({ element: walkerImg })
    .setLngLat(latLngs[0])
    .addTo(map);

  const walkerPopup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    anchor: 'top',
    offset: [0, 20],
    className: 'custom-popup',
  }).setHTML(
    `<b>到着まで</b><br>あと ${Math.round(totalDistance)} m (${formatTime(totalDistance / currentSpeed)})`,
  );
  walkerMarker.setPopup(walkerPopup);
  walkerMarker.togglePopup();

  startWalking(latLngs, walkerMarker);
}

/**
 * 歩行アニメーション。ルート全長と現在速度から所要時間を計算し、
 * requestAnimationFrame で位置と残距離ポップアップを更新する。
 */
function startWalking(latLngs: LngLatTuple[], walkerMarker: maplibregl.Marker): void {
  const totalDistance = getTotalDistance(latLngs);
  const totalTime = totalDistance / currentSpeed; // 秒
  const startTime = performance.now();

  function animate() {
    const elapsedTime = (performance.now() - startTime) / 1000;
    const progress = elapsedTime / totalTime;

    if (progress >= 1) {
      walkerMarker.remove();
      return;
    }

    const distanceTraveled = progress * totalDistance;
    let covered = 0;
    for (let i = 1; i < latLngs.length; i++) {
      const segment = haversineDistance(latLngs[i - 1], latLngs[i]);
      if (covered + segment >= distanceTraveled) {
        const t = (distanceTraveled - covered) / segment;
        const lng = latLngs[i - 1][0] + t * (latLngs[i][0] - latLngs[i - 1][0]);
        const lat = latLngs[i - 1][1] + t * (latLngs[i][1] - latLngs[i - 1][1]);
        const position: LngLatTuple = [lng, lat];
        walkerMarker.setLngLat(position);

        const remainingDistance = totalDistance - distanceTraveled;
        const remainingTime = totalTime - elapsedTime;
        walkerMarker
          .getPopup()
          ?.setLngLat(position)
          .setHTML(
            `<b>到着まで</b><br>あと ${Math.round(remainingDistance)} m (${formatTime(remainingTime)})`,
          );
        break;
      }
      covered += segment;
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

/** ルート全長（m）をハーサイン距離の総和で算出 */
function getTotalDistance(latLngs: LngLatTuple[]): number {
  let total = 0;
  for (let i = 1; i < latLngs.length; i++) {
    total += haversineDistance(latLngs[i - 1], latLngs[i]);
  }
  return total;
}

/** 秒 → 「X分 Y秒」表記 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}分 ${rest}秒`;
}

/** 全長に応じた線色（近=青 → 遠=赤系） */
function getRouteColor(distance: number): string {
  if (distance <= 250) return '#0000FF';
  if (distance <= 500) return '#003FFF';
  if (distance <= 750) return '#007FFF';
  if (distance <= 1000) return '#00BFFF';
  if (distance <= 1250) return '#009800';
  if (distance <= 1500) return '#FFBF00';
  if (distance <= 1750) return '#FF0000';
  if (distance <= 2000) return '#FF00FF';
  return 'red';
}
