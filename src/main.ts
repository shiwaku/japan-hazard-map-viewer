import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import './style.css';

import { getBasemapStyle, type Basemap } from './map/basemap';
import { attributionControl, createMap, PITCH_3D, scaleControl } from './map/create-map';
import { beforeIdFor, beforeIdWithin } from './map/layer-order';
import { HAZARD_LAYERS, HAZARD_OPACITY, type HazardLayerDef } from './config/hazard-layers';
import { initialOverlayState, OVERLAYS, type OverlayKey } from './config/overlays';
import { POINTS_LAYER, type BreakPoint } from './config/suibou-navi';
import { ensureHazardLayer, removeHazardLayer } from './layers/hazard-layers';
import { addPlateauLayer } from './layers/plateau';
import { addPopulationLayer } from './layers/population';
import {
  addEvacuationPointLayers,
  hinanbashoFilter,
  setHinanbashoFilter,
} from './layers/evacuation-points';
import { setTerrainEnabled } from './layers/terrain';
import {
  ensurePointLayers,
  highlightBreakPoint,
  removeAllSuibouLayers,
  removeTimeseriesLayers,
  setBreakPoints,
  setMaxRank,
  setMaxRed,
  setRange,
  showTimeseries,
} from './layers/suibou-navi';
import { fetchBreakPoints } from './api/suibou-navi';
import { buildPanel, collapsePanel, type PanelState, type PitchMode } from './ui/panel';
import { buildSuibouPanel, initialSuibouState, type SuibouPanel } from './ui/suibou-panel';
import { BasemapControl } from './ui/basemap-control';
import { registerFeaturePopups } from './popups/feature-popups';
import { showDepthPopup } from './popups/depth-popup';
import { closeSuibouDepthPopup, showSuibouDepthPopup } from './popups/suibou-depth-popup';
import { initDiag } from './lib/diag';
import { applyThemeAttr, initialTheme } from './theme';

/** クリック時に各フィーチャのポップアップへ委譲するレイヤ（浸水深ポップアップを出さない） */
const FEATURE_LAYERS = ['hinanbasho', 'denshouhi', '100m_mesh_pop2020_fill'];

const HAZARD_IDS = HAZARD_LAYERS.map((d) => d.id);

const isMobile = window.matchMedia('(max-width: 640px)').matches;

const state: PanelState = {
  // 初期表示は洪水（想定最大規模）のみ。トグルで何枚でも重ねられる。
  hazards: { [HAZARD_LAYERS[0].id]: true },
  hazardOpacity: {},
  overlays: initialOverlayState(),
  pitch: '3d',
  theme: initialTheme(),
};
const suibou = initialSuibouState();

let base: Basemap = 'pale';
// 地形の ON/OFF は右上の TerrainControl が持つ。背景/テーマ切替で消えるため、
// 直前の状態をここに控えて再構築時に復元する。
let terrainOn = true;
// スタイル適用中は MapLibre 自身も terrain を落とす（'terrain' イベントが null で飛ぶ）。
// これを利用者の操作と取り違えないよう、その間はイベントを無視する。
// 初期スタイルの読み込み中も同じなので true から始める。
let styleReloading = true;

applyThemeAttr(state.theme);

const map = createMap(getBasemapStyle(base, state.theme), isMobile);

const basemapCtrl = new BasemapControl(
  () => base,
  (next) => setBase(next),
);
// 右下は「先に追加したものほど下」に積まれる。
// 下から順に 出典(ⓘ) → 背景切替 → スケール になるようこの順で追加する。
map.addControl(attributionControl(), 'bottom-right');
map.addControl(basemapCtrl, 'bottom-right');
map.addControl(scaleControl(), 'bottom-right');
// compact 指定でも初期状態は開いており、スマホでは画面の1/3を出典が覆ってしまう。
// 畳んでおき、ⓘ ボタンで開けるようにする（出典はパネル下部にも常時掲載）。
// MapLibre はソースが増えるたびに出典を組み直して再表示するため、
// 利用者が自分で開くまでは畳み続ける。
let attribOpenedByUser = false;
document.addEventListener(
  'click',
  (e) => {
    if ((e.target as HTMLElement | null)?.closest?.('.maplibregl-ctrl-attrib-button')) {
      attribOpenedByUser = true;
    }
  },
  true,
);
function collapseAttribution(): void {
  if (attribOpenedByUser) return;
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
}
map.on('sourcedata', collapseAttribution);
map.on('styledata', collapseAttribution);
requestAnimationFrame(collapseAttribution);

const defOf = (id: string): HazardLayerDef =>
  HAZARD_LAYERS.find((d) => d.id === id) ?? HAZARD_LAYERS[0];
const opacityOf = (id: string): number => state.hazardOpacity[id] ?? HAZARD_OPACITY;
const layersOf = (key: OverlayKey): string[] => OVERLAYS.find((o) => o.key === key)?.layers ?? [];
/** 表示中のハザード（config の並び順＝重ね順。後ろほど前面） */
const activeHazards = (): HazardLayerDef[] => HAZARD_LAYERS.filter((d) => state.hazards[d.id]);
/** 選択中の破堤点の、現在の経過時間（分） */
const currentMinutes = (): number => suibou.selected?.BPTime[suibou.timeIndex] ?? 0;

/** 表示中のハザードすべてに対応する避難場所だけを残すフィルタを適用する */
function syncShelterFilter(): void {
  setHinanbashoFilter(map, hinanbashoFilter(activeHazards().map((d) => d.hinanbashoProperty)));
}

/**
 * データ層をすべて現在の state に合わせて貼る（idempotent）。
 * 初回 load・背景/テーマ切替後・WebGL コンテキスト復帰後に呼ぶ。
 * 挿入位置は layer-order.ts のスロット順に従うため、貼る順番に依存しない。
 */
function buildLayers(): void {
  addPopulationLayer(map, state.overlays.pop, beforeIdFor(map, 'population'));
  addPlateauLayer(map, state.overlays.plateau, state.theme, beforeIdFor(map, 'plateau'));

  for (const def of HAZARD_LAYERS) {
    if (state.hazards[def.id]) {
      ensureHazardLayer(
        map,
        def,
        opacityOf(def.id),
        beforeIdWithin(map, 'hazard', HAZARD_IDS, def.id),
      );
    } else {
      removeHazardLayer(map, def);
    }
  }

  setTerrainEnabled(map, terrainOn);
  buildSuibouLayers();

  // ピン（避難場所・伝承碑）は常に最前面なので最後に追加する
  addEvacuationPointLayers(
    map,
    { hinanbasho: state.overlays.hinanbasho, denshouhi: state.overlays.denshouhi },
    hinanbashoFilter(activeHazards().map((d) => d.hinanbashoProperty)),
  );
}

/** 浸水ナビのレイヤーを現在の state に合わせる */
function buildSuibouLayers(): void {
  if (!suibou.active) {
    removeAllSuibouLayers(map);
    return;
  }
  ensurePointLayers(map);
  setBreakPoints(map, suibou.breakPoints);
  highlightBreakPoint(map, suibou.selected?.ID ?? null);
  setRange(map, suibou.layers.range, suibou.selected?.CSVScale ?? 0);

  const bp = suibou.selected;
  setMaxRank(map, bp, suibou.layers.maxRank, suibou.opacity);
  setMaxRed(map, bp, suibou.layers.maxRed, suibou.opacity);
  if (bp) showTimeseries(map, bp, currentMinutes(), suibou.opacity, true);
  else removeTimeseriesLayers(map);
}

/**
 * 背景スタイルを差し替える。ラスタ（写真）↔ベクタ（淡色）の切替では diff 適用が
 * 効かず背景が入れ替わらないため diff:false で完全に再構築する。
 * setStyle 直後は isStyleLoaded() が旧スタイルで true を返して競合するため、
 * 新スタイルの描画が落ち着く idle を待ってからデータ層を再追加する。
 */
function reloadStyle(): void {
  // setStyle は terrain も落とすので、直前の ON/OFF を控えてから差し替える
  terrainOn = !!map.getTerrain();
  styleReloading = true;
  map.setStyle(getBasemapStyle(base, state.theme), { diff: false });
  map.once('idle', () => {
    buildLayers();
    styleReloading = false;
  });
}

function setBase(next: Basemap): void {
  if (next === base) return;
  base = next;
  basemapCtrl.sync();
  reloadStyle();
}

// ---- パネル（ハザード・重ねる情報・視点） ----
const panel = buildPanel(state, {
  onHazard(id, on) {
    const def = defOf(id);
    if (on)
      ensureHazardLayer(map, def, opacityOf(id), beforeIdWithin(map, 'hazard', HAZARD_IDS, id));
    else removeHazardLayer(map, def);
    syncShelterFilter();
  },
  onOpacity(id, value) {
    state.hazardOpacity[id] = value;
    if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', value);
  },
  onOverlay(key, on) {
    for (const id of layersOf(key)) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
  },
  onPitch(mode) {
    map.easeTo({ pitch: mode === '3d' ? PITCH_3D : 0, duration: 400 });
  },
  onTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyThemeAttr(state.theme);
    panel.renderTheme(state.theme);
    reloadStyle();
  },
});

// ---- パネル（浸水シミュレーション） ----
let playTimer: number | null = null;
let searchAbort: AbortController | null = null;

const suibouPanel: SuibouPanel = buildSuibouPanel(
  document.getElementById('suibou') as HTMLElement,
  suibou,
  {
    onActive(on) {
      suibou.active = on;
      setPlaying(false);
      closeSuibouDepthPopup();
      if (!on) {
        searchAbort?.abort();
        suibou.breakPoints = [];
        suibou.selected = null;
        suibouPanel.setStatus(null);
        suibouPanel.setSuggestion(null);
      } else {
        suibouPanel.setStatus('地図をクリックすると、その地点を浸水させる想定破堤点を表示します。');
      }
      buildSuibouLayers();
      suibouPanel.render();
    },
    onRange(on) {
      suibou.layers.range = on;
      setRange(map, on, suibou.selected?.CSVScale ?? 0);
    },
    onTimeIndex(index) {
      suibou.timeIndex = index;
      applyTime();
    },
    onPlay(playing) {
      setPlaying(playing);
    },
    onMaxRank(on) {
      suibou.layers.maxRank = on;
      setMaxRank(map, suibou.selected, on, suibou.opacity);
    },
    onMaxRed(on) {
      suibou.layers.maxRed = on;
      setMaxRed(map, suibou.selected, on, suibou.opacity);
    },
    onOpacity(value) {
      suibou.opacity = value;
      buildSuibouLayers();
    },
    onClearSelection() {
      selectBreakPoint(null);
      suibouPanel.setStatus('地図をクリックすると、その地点を浸水させる想定破堤点を表示します。');
      suibouPanel.setSuggestion(suibou.breakPoints.find((b) => b.isDepthMax) ?? null);
    },
    onSelect(id) {
      selectBreakPoint(id);
    },
  },
);

/** 経過時間を地図へ反映する */
function applyTime(): void {
  const bp = suibou.selected;
  if (bp) showTimeseries(map, bp, currentMinutes(), suibou.opacity, true);
  suibouPanel.render();
}

/** 再生・停止。2秒間隔は浸水ナビ側の負荷ガイドラインに合わせている */
function setPlaying(on: boolean): void {
  if (playTimer !== null) {
    clearInterval(playTimer);
    playTimer = null;
  }
  suibou.playing = on && suibou.selected !== null;
  if (suibou.playing) {
    playTimer = window.setInterval(() => {
      const bp = suibou.selected;
      if (!bp || suibou.timeIndex >= bp.BPTime.length - 1) {
        setPlaying(false);
        return;
      }
      suibou.timeIndex += 1;
      applyTime();
    }, 2000);
  }
  suibouPanel.render();
}

function selectBreakPoint(id: string | null): void {
  setPlaying(false);
  closeSuibouDepthPopup();
  suibou.selected = id ? (suibou.breakPoints.find((b) => b.ID === id) ?? null) : null;
  suibou.timeIndex = 0;
  buildSuibouLayers();
  if (suibou.selected) {
    suibouPanel.setStatus(null);
    suibouPanel.setSuggestion(null);
  }
  suibouPanel.render();
}

async function searchBreakPoints(lng: number, lat: number): Promise<void> {
  searchAbort?.abort();
  const ctrl = new AbortController();
  searchAbort = ctrl;
  suibouPanel.setStatus('想定破堤点を検索しています…');

  try {
    const list: BreakPoint[] = await fetchBreakPoints(lng, lat, ctrl.signal);
    if (ctrl.signal.aborted) return;
    suibou.breakPoints = list;
    suibou.selected = null;
    buildSuibouLayers();
    suibouPanel.setStatus(
      list.length === 0
        ? 'この地点を浸水させる想定破堤点は登録されていません。別の地点を試してください。'
        : `${list.length}件の想定破堤点が見つかりました。地図上の点を選ぶと、経過時間ごとの浸水範囲を表示します。`,
    );
    suibouPanel.setSuggestion(list.find((b) => b.isDepthMax) ?? null);
    suibouPanel.render();
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    suibouPanel.setStatus('浸水ナビの取得に失敗しました。時間をおいて再度お試しください。');
    suibouPanel.setSuggestion(null);
  }
}

// 地図側の操作（コンパスのドラッグ等）で変わったピッチをセグメントへ反映
map.on('pitchend', () => {
  const mode: PitchMode = map.getPitch() > 10 ? '3d' : '2d';
  if (mode !== state.pitch) panel.syncPitch(mode);
});

// 右上の TerrainControl による切替を控えておく（スタイル再構築時の復元用）。
// setStyle 中の terrain 消失は状態変更ではないので無視する。
map.on('terrain', () => {
  if (!styleReloading) terrainOn = !!map.getTerrain();
});

if (isMobile) collapsePanel();

// ---- 初期化 ----
map.on('load', () => {
  buildLayers();
  styleReloading = false;
  registerFeaturePopups(map);

  // 破堤点はクリック対象なのでカーソルを変える
  map.on('mouseenter', POINTS_LAYER, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', POINTS_LAYER, () => {
    map.getCanvas().style.cursor = '';
  });

  // 地図クリックの優先順位:
  //   1. 避難場所・伝承碑・人口メッシュ → 各ポップアップに委譲
  //   2. 破堤点 → 選択
  //   3. 浸水ナビON・破堤点未選択 → 破堤点を検索
  //   4. 浸水ナビON・破堤点選択済み → 浸水ナビの浸水深
  //   5. それ以外 → ハザードの想定浸水深
  map.on('click', (e) => {
    const feats = map.queryRenderedFeatures(e.point);
    if (feats.some((f) => FEATURE_LAYERS.includes(f.layer.id))) return;

    if (suibou.active) {
      const hit = feats.find((f) => f.layer.id === POINTS_LAYER);
      if (hit) {
        selectBreakPoint(String(hit.properties?.id ?? ''));
        return;
      }
      if (!suibou.selected) {
        void searchBreakPoints(e.lngLat.lng, e.lngLat.lat);
        return;
      }
      void showSuibouDepthPopup(map, e.lngLat, suibou.selected, currentMinutes());
      return;
    }

    void showDepthPopup(map, e.lngLat, activeHazards());
  });
});

const buildEl = document.getElementById('build-ver');
if (buildEl) buildEl.textContent = `build: ${__BUILD_TIME__}`;

initDiag(
  map,
  buildLayers,
  () =>
    `hazards: ${
      activeHazards()
        .map((d) => `${d.id}${map.getLayer(d.id) ? '' : '(missing)'}`)
        .join(', ') || '(none)'
    }<br>` +
    `overlays: ${
      OVERLAYS.filter((o) => state.overlays[o.key])
        .map((o) => o.key)
        .join(', ') || '(none)'
    } · terrain: ${terrainOn}<br>` +
    `suibou: active=${suibou.active} bp=${suibou.selected?.BPName ?? '-'} ` +
    `t=${currentMinutes()}m (${suibou.timeIndex + 1}/${suibou.selected?.BPTime.length ?? 0})`,
);

// デバッグ/外部連携用にマップと浸水ナビの状態を公開
(window as unknown as { __map: typeof map; __suibou: typeof suibou }).__map = map;
(window as unknown as { __map: typeof map; __suibou: typeof suibou }).__suibou = suibou;

// PWA: Service Worker 登録（本番のみ。dev では HMR を妨げないよう無効）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
  // 新しい SW が制御を開始したら一度だけ再読込して最新版に切り替える
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
