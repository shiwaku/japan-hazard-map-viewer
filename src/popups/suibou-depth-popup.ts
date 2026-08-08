import maplibregl, { type LngLat, type Map as MlMap } from 'maplibre-gl';
import { fetchDepthByTime, fetchFloodStartTime, fetchMaxDepth } from '../api/suibou-navi';
import { formatMinutes, type BreakPoint } from '../config/suibou-navi';

let inflight: AbortController | null = null;
let popup: maplibregl.Popup | null = null;

function row(label: string, value: string): string {
  return `<div class="popup-row"><span class="popup-key">${label}</span><div class="popup-value">${value}</div></div>`;
}

/**
 * 選択中の破堤点について、クリック地点の
 * 「経過時間時点の浸水深」「最大浸水深」「浸水開始までの時間」を表示する。
 *
 * API は 2 秒間隔のスロットルを通るため、3 本ぶんで最大 6 秒ほどかかる。
 * 先に枠だけ出して「取得中…」を見せ、揃ったところで書き換える。
 */
export async function showSuibouDepthPopup(
  map: MlMap,
  lngLat: LngLat,
  bp: BreakPoint,
  minutes: number,
): Promise<void> {
  // 連打・スライダー操作中の多重リクエストは前のものを捨てる
  inflight?.abort();
  const ctrl = new AbortController();
  inflight = ctrl;

  const head =
    `<div class="popup-title">${bp.EntryRiverName} ${bp.BPName}</div>` +
    `<div class="popup-note" style="margin:0 0 8px;">${bp.BPLocation} が破堤した場合</div>`;
  const gmap = `<a href="https://www.google.com/maps?q=${lngLat.lat},${lngLat.lng}&hl=ja" target="_blank">🌎Google Maps</a>`;

  popup?.remove();
  popup = new maplibregl.Popup({ className: 'suibou-popup', maxWidth: '300px' })
    .setLngLat(lngLat)
    .setHTML(`${head}<div class="popup-note">取得中…</div>`)
    .addTo(map);
  const shown = popup;

  try {
    const [depth, maxDepth, start] = await Promise.all([
      fetchDepthByTime(lngLat.lng, lngLat.lat, bp.ID, minutes, ctrl.signal),
      fetchMaxDepth(lngLat.lng, lngLat.lat, bp.ID, ctrl.signal),
      fetchFloodStartTime(lngLat.lng, lngLat.lat, bp.ID, ctrl.signal),
    ]);
    if (ctrl.signal.aborted || shown !== popup) return;

    const m = (v: number | null): string => (v === null ? '該当なし' : `${v.toFixed(2)} m`);
    shown.setHTML(
      head +
        row(`経過${formatMinutes(minutes)}時点の浸水深`, m(depth)) +
        row('最大浸水深', m(maxDepth)) +
        row('浸水開始まで', start === null ? '該当なし' : formatMinutes(Math.round(start))) +
        `<div class="popup-actions">${gmap}</div>`,
    );
  } catch (e) {
    if ((e as Error).name === 'AbortError' || shown !== popup) return;
    shown.setHTML(`${head}<div class="popup-note">浸水深を取得できませんでした。</div>`);
  }
}

/** 表示中のポップアップを閉じ、進行中のリクエストを中断する */
export function closeSuibouDepthPopup(): void {
  inflight?.abort();
  inflight = null;
  popup?.remove();
  popup = null;
}
