// 診断（?debug で画面表示）と WebGL コンテキスト消失からの自動復帰。
//
// iOS Safari などではメモリ逼迫時に GL コンテキストが失われ、地図の中身がまるごと
// 消えて戻らないことがある（スマホで真っ白）。復帰イベントでレイヤーを貼り直す。

import type { Map as MlMap } from 'maplibre-gl';

export const DEBUG = new URLSearchParams(location.search).has('debug');

export interface Diag {
  /** ログを1行追加する（HUD と console の両方へ） */
  log(msg: string): void;
}

/**
 * 診断ログ・HUD・コンテキスト消失復帰をまとめて仕込む。
 * @param relayer コンテキスト復帰時にデータ層を貼り直すコールバック
 * @param status HUD に出す現在状態（レイヤー数など）を返すコールバック
 */
export function initDiag(map: MlMap, relayer: () => void, status: () => string): Diag {
  const lines: string[] = [];
  let ctxLost = 0;
  let hud: HTMLElement | null = null;

  function render(): void {
    if (!DEBUG || !hud) return;
    hud.innerHTML =
      `<b>build ${__BUILD_TIME__}</b><br>` +
      `zoom ${map.getZoom().toFixed(1)} · pitch ${map.getPitch().toFixed(0)} · ctxLost ${ctxLost}<br>` +
      `${status()}<br>` +
      `<u>log</u><br>${lines.join('<br>')}`;
  }

  function log(msg: string): void {
    const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
    lines.push(line);
    if (lines.length > 8) lines.shift();
    console.log('[diag]', line);
    render();
  }

  if (DEBUG) {
    hud = document.createElement('div');
    hud.id = 'diag-hud';
    document.body.append(hud);
    render();
    map.on('render', () => {
      // 過負荷を避けるため描画完了時のみ更新
      if (map.areTilesLoaded()) render();
    });
  }

  const canvas = map.getCanvas();
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      // preventDefault しないと自動復帰イベントが発火しない
      e.preventDefault();
      ctxLost++;
      log('WebGL context lost');
    },
    false,
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      log('WebGL context restored → relayering');
      if (map.isStyleLoaded()) relayer();
      else map.once('idle', relayer);
    },
    false,
  );

  // ソース/タイル読込などのエラーを診断ログへ
  map.on('error', (e) => {
    const msg = (e && (e as unknown as { error?: Error }).error?.message) || 'map error';
    log(`error: ${msg}`);
  });

  return { log };
}
