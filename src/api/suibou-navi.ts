// 浸水ナビ JSON API のクライアント。
//
// 仕様書の「API 利用上の注意」に従い、リクエストは最短 2 秒間隔に制限する。
// （分間リクエスト数 30 以下程度。過負荷と判断されたアクセスは予告なく遮断される）

import { API_BASE, type BreakPoint } from '../config/suibou-navi';

/** 仕様書が示す最短間隔 */
const MIN_INTERVAL_MS = 2000;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/** 中断されたら待たずに起きる sleep */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

const aborted = (): DOMException => new DOMException('aborted', 'AbortError');

/**
 * 直列化＋間隔制御つきの fetch。
 * 同時に複数呼んでも順番待ちになり、2 秒間隔が守られる。
 *
 * 中断済みのものは間隔を待たずに行列から抜ける。待ってから捨てると、
 * 利用者が気を変えた後の操作（別地点の検索など）がそのぶん待たされる。
 * 実リクエストは出していないので lastRequestAt も更新しない＝間隔は消費しない。
 */
async function throttledFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const run = async (): Promise<Response> => {
    if (signal?.aborted) throw aborted();
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait, signal);
    if (signal?.aborted) throw aborted();
    lastRequestAt = Date.now();
    return fetch(url, { signal });
  };
  // 失敗しても後続を止めないよう、待ち行列は常に解決させる
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

async function getJson<T>(
  path: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await throttledFetch(`${API_BASE}/${path}?${qs}`, signal);
  if (!res.ok) throw new Error(`浸水ナビAPIの応答エラー (${res.status})`);
  return (await res.json()) as T;
}

/**
 * 指定地点を浸水域に含む想定破堤点を取得する。
 * 該当が無い場合、API は [] を返す（エラーではない）。
 */
export async function fetchBreakPoints(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<BreakPoint[]> {
  const data = await getJson<BreakPoint[]>('GetBreakPoint', { lon: lng, lat }, signal);
  return Array.isArray(data) ? data : [];
}

/**
 * API は「検索結果なし」を空配列で返す。数値項目を取り出す共通処理。
 * 値が取れない場合は null。
 */
function pickNumber(data: unknown, key: string): number | null {
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    const v = first?.[key];
    return typeof v === 'number' ? v : null;
  }
  const v = (data as Record<string, unknown> | null)?.[key];
  return typeof v === 'number' ? v : null;
}

/** 破堤発生からの経過時間における浸水深（m）。bptime は BPTime の要素であること */
export async function fetchDepthByTime(
  lng: number,
  lat: number,
  bpid: string,
  bptime: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const data = await getJson<unknown>('GetMaxDepthByTime', { lon: lng, lat, bpid, bptime }, signal);
  return pickNumber(data, 'Depth');
}

/** その破堤点による最大浸水深（m） */
export async function fetchMaxDepth(
  lng: number,
  lat: number,
  bpid: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const data = await getJson<unknown>('GetMaxDepth', { lon: lng, lat, bpid }, signal);
  return pickNumber(data, 'Depth');
}

/** 浸水開始までの時間（分） */
export async function fetchFloodStartTime(
  lng: number,
  lat: number,
  bpid: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const data = await getJson<unknown>('GetFloodStartTime', { lon: lng, lat, bpid }, signal);
  return pickNumber(data, 'StartTime');
}
