import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import './style.css';

import { getBasemapStyle, type Basemap } from './map/basemap';
import { attributionControl, createMap, PITCH_3D } from './map/create-map';
import { HAZARD_LAYERS, HAZARD_OPACITY, type HazardLayerDef } from './config/hazard-layers';
import { initialOverlayState, OVERLAYS, type OverlayKey } from './config/overlays';
import { ensureHazardLayer, removeHazardLayer } from './layers/hazard-layers';
import { addPlateauLayer } from './layers/plateau';
import { addPopulationLayer } from './layers/population';
import {
  addEvacuationPointLayers,
  hinanbashoFilter,
  setHinanbashoFilter,
} from './layers/evacuation-points';
import { setTerrainEnabled } from './layers/terrain';
import { buildPanel, collapsePanel, type PanelState, type PitchMode } from './ui/panel';
import { BasemapControl } from './ui/basemap-control';
import { registerFeaturePopups } from './popups/feature-popups';
import { showDepthPopup } from './popups/depth-popup';
import { initDiag } from './lib/diag';
import { applyThemeAttr, initialTheme } from './theme';

/** クリック時に各フィーチャのポップアップへ委譲するレイヤ（浸水深ポップアップを出さない） */
const FEATURE_LAYERS = ['hinanbasho', 'denshouhi', '100m_mesh_pop2020_fill'];

/** このアプリが追加するレイヤ（背景スタイル側のラベル判定から除くため） */
const OWN_LAYERS = new Set<string>([
  ...HAZARD_LAYERS.map((d) => d.id),
  ...OVERLAYS.flatMap((o) => o.layers),
]);

const isMobile = window.matchMedia('(max-width: 640px)').matches;

const state: PanelState = {
  // 初期表示は洪水（想定最大規模）のみ。トグルで何枚でも重ねられる。
  hazards: { [HAZARD_LAYERS[0].id]: true },
  hazardOpacity: {},
  overlays: initialOverlayState(),
  pitch: '3d',
  theme: initialTheme(),
};
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
map.addControl(basemapCtrl, 'bottom-right');
map.addControl(attributionControl(), 'bottom-right');
// compact 指定でも初期状態は開いており、スマホでは画面の1/3を出典が覆ってしまう。
// 畳んでおき、ⓘ ボタンで開けるようにする（出典はパネル下部にも常時掲載）。
requestAnimationFrame(() => {
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
});

const defOf = (id: string): HazardLayerDef =>
  HAZARD_LAYERS.find((d) => d.id === id) ?? HAZARD_LAYERS[0];
const opacityOf = (id: string): number => state.hazardOpacity[id] ?? HAZARD_OPACITY;
const layersOf = (key: OverlayKey): string[] => OVERLAYS.find((o) => o.key === key)?.layers ?? [];
/** 表示中のハザード（config の並び順＝重ね順。後ろほど前面） */
const activeHazards = (): HazardLayerDef[] => HAZARD_LAYERS.filter((d) => state.hazards[d.id]);

/**
 * 背景スタイルの最初の地名ラベル（symbol）レイヤID。
 * ハザードラスタ・人口・3D建物をこの手前に挿入することで、地名が塗りに埋もれない。
 */
function labelBeforeId(): string | undefined {
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol' && !OWN_LAYERS.has(layer.id)) return layer.id;
  }
  return undefined;
}

/** ハザードより上に置くレイヤー（人口→3D建物→地名ラベル）のうち、最も下のもの */
function overlayFloorId(): string | undefined {
  for (const id of ['100m_mesh_pop2020_fill', 'plateau-pmtiles']) {
    if (map.getLayer(id)) return id;
  }
  return labelBeforeId();
}

/**
 * def を挿入すべき位置（このレイヤーの直下に入る）。
 * HAZARD_LAYERS の後ろにあるレイヤーほど前面になるよう、
 * 自分より後ろで既に地図に載っている最初のハザードの手前に入れる。
 */
function hazardBeforeId(def: HazardLayerDef): string | undefined {
  const i = HAZARD_LAYERS.indexOf(def);
  for (let j = i + 1; j < HAZARD_LAYERS.length; j++) {
    if (map.getLayer(HAZARD_LAYERS[j].id)) return HAZARD_LAYERS[j].id;
  }
  return overlayFloorId();
}

/** 表示中のハザードすべてに対応する避難場所だけを残すフィルタを適用する */
function syncShelterFilter(): void {
  setHinanbashoFilter(map, hinanbashoFilter(activeHazards().map((d) => d.hinanbashoProperty)));
}

/**
 * データ層をすべて現在の state に合わせて貼る（idempotent）。
 * 初回 load・背景/テーマ切替後・WebGL コンテキスト復帰後に呼ぶ。
 */
function buildLayers(): void {
  const before = labelBeforeId();

  // 人口・3D建物を先に置き、ハザードはその下（overlayFloorId の手前）へ順に積む
  addPopulationLayer(map, state.overlays.pop, before);
  addPlateauLayer(map, state.overlays.plateau, state.theme, before);
  for (const def of HAZARD_LAYERS) {
    if (state.hazards[def.id]) ensureHazardLayer(map, def, opacityOf(def.id), hazardBeforeId(def));
    else removeHazardLayer(map, def);
  }
  setTerrainEnabled(map, terrainOn);

  // ピン（避難場所・伝承碑）は常に最前面なので最後に追加する
  addEvacuationPointLayers(
    map,
    { hinanbasho: state.overlays.hinanbasho, denshouhi: state.overlays.denshouhi },
    hinanbashoFilter(activeHazards().map((d) => d.hinanbashoProperty)),
  );
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

// ---- パネル ----
const panel = buildPanel(state, {
  onHazard(id, on) {
    const def = defOf(id);
    if (on) ensureHazardLayer(map, def, opacityOf(id), hazardBeforeId(def));
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

  // 地図クリック: フィーチャ上なら各ポップアップに委譲。それ以外は浸水深ポップアップ。
  map.on('click', (e) => {
    const onFeature = map
      .queryRenderedFeatures(e.point)
      .some((f) => FEATURE_LAYERS.includes(f.layer.id));
    if (onFeature) return;
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
    } · terrain: ${terrainOn}`,
);

// デバッグ/外部連携用にマップを公開
(window as unknown as { __map: typeof map }).__map = map;

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
