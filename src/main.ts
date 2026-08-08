import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import './style.css';

import { getBasemapStyle, type Basemap } from './map/basemap';
import { attributionControl, createMap, PITCH_3D } from './map/create-map';
import { HAZARD_LAYERS, HAZARD_OPACITY, type HazardLayerDef } from './config/hazard-layers';
import { initialOverlayState, OVERLAYS, type OverlayKey } from './config/overlays';
import { ensureHazardLayer, removeOtherHazardLayers } from './layers/hazard-layers';
import { addPlateauLayer } from './layers/plateau';
import { addPopulationLayer } from './layers/population';
import { addEvacuationPointLayers, setHinanbashoFilter } from './layers/evacuation-points';
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
  hazardId: HAZARD_LAYERS[0].id,
  hazardOpacity: {},
  overlays: initialOverlayState(),
  pitch: '3d',
  theme: initialTheme(),
};
let base: Basemap = 'pale';

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

/**
 * データ層をすべて現在の state に合わせて貼る（idempotent）。
 * 初回 load・背景/テーマ切替後・WebGL コンテキスト復帰後に呼ぶ。
 */
async function buildLayers(): Promise<void> {
  const def = defOf(state.hazardId);
  const before = labelBeforeId();

  ensureHazardLayer(map, def, opacityOf(def.id), before);
  removeOtherHazardLayers(map, def.id);
  addPopulationLayer(map, state.overlays.pop, before);
  addPlateauLayer(map, state.overlays.plateau, state.theme, before);
  setTerrainEnabled(map, state.overlays.terrain);
  // ピン（避難場所・伝承碑）は常に最前面。アイコン読込が非同期なので最後に await
  await addEvacuationPointLayers(
    map,
    { hinanbasho: state.overlays.hinanbasho, denshouhi: state.overlays.denshouhi },
    def.hinanbashoProperty,
  );
}

/**
 * 背景スタイルを差し替える。ラスタ（写真）↔ベクタ（淡色）の切替では diff 適用が
 * 効かず背景が入れ替わらないため diff:false で完全に再構築する。
 * setStyle 直後は isStyleLoaded() が旧スタイルで true を返して競合するため、
 * 新スタイルの描画が落ち着く idle を待ってからデータ層を再追加する。
 */
function reloadStyle(): void {
  map.setStyle(getBasemapStyle(base, state.theme), { diff: false });
  map.once('idle', () => void buildLayers());
}

function setBase(next: Basemap): void {
  if (next === base) return;
  base = next;
  basemapCtrl.sync();
  reloadStyle();
}

// ---- パネル ----
const panel = buildPanel(state, {
  onHazard(id) {
    const def = defOf(id);
    ensureHazardLayer(map, def, opacityOf(id), labelBeforeId());
    removeOtherHazardLayers(map, id);
    setHinanbashoFilter(map, def.hinanbashoProperty);
  },
  onOpacity(id, value) {
    state.hazardOpacity[id] = value;
    if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', value);
  },
  onOverlay(key, on) {
    if (key === 'terrain') {
      setTerrainEnabled(map, on);
      return;
    }
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

if (isMobile) collapsePanel();

// ---- 初期化 ----
map.on('load', () => {
  void buildLayers();
  registerFeaturePopups(map);

  // 地図クリック: フィーチャ上なら各ポップアップに委譲。それ以外は浸水深ポップアップ。
  map.on('click', (e) => {
    const onFeature = map
      .queryRenderedFeatures(e.point)
      .some((f) => FEATURE_LAYERS.includes(f.layer.id));
    if (onFeature) return;
    void showDepthPopup(map, e.lngLat, defOf(state.hazardId));
  });
});

const buildEl = document.getElementById('build-ver');
if (buildEl) buildEl.textContent = `build: ${__BUILD_TIME__}`;

initDiag(
  map,
  () => void buildLayers(),
  () =>
    `hazard: ${state.hazardId} (${map.getLayer(state.hazardId) ? 'on map' : 'missing'})<br>` +
    `overlays: ${
      OVERLAYS.filter((o) => state.overlays[o.key])
        .map((o) => o.key)
        .join(', ') || '(none)'
    }`,
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
