import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import './style.css';

import { createMap } from './map/create-map';
import { addHazardLayers } from './layers/hazard-layers';
import { addPlateauLayer } from './layers/plateau';
import { addPopulationLayer } from './layers/population';
import { addEvacuationPointLayers } from './layers/evacuation-points';
import { renderLegends } from './ui/legend';
import { setupLayerSwitcher } from './ui/layer-switcher';
import { registerFeaturePopups } from './popups/feature-popups';
import { showDepthPopup } from './popups/depth-popup';
// 経路探索（避難経路）機能は現在無効化中。再有効化する場合は以下と後述の呼び出しを復活させる。
// import { setupRoutingControls, routeToNearestShelter } from './routing/evacuation-route';

/** クリック時にフィーチャポップアップへ委譲するレイヤ */
const FEATURE_LAYERS = ['hinanbasho', 'denshouhi', '100m_mesh_pop2020_fill'];

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
}

const map = createMap();

// DOM 構築（map load を待たずに生成可）
renderLegends(requireElement('legends'));
// setupRoutingControls(); // 経路探索 無効化中

map.on('load', async () => {
  // 産総研 シームレス標高タイル（地形）
  map.addSource('aist-dem', {
    type: 'raster-dem',
    tiles: ['https://gbank.gsj.jp/seamless/elev/terrainRGB/land/{z}/{y}/{x}.png'],
    tileSize: 256,
    attribution:
      "<a href='https://tiles.gsj.jp/tiles/elev/tiles.html' target='_blank'>産業技術総合研究所 シームレス標高タイル(陸域統合DEM)</a>",
  });
  map.setTerrain({ source: 'aist-dem', exaggeration: 1 });

  addHazardLayers(map);
  addPlateauLayer(map);
  addPopulationLayer(map);
  await addEvacuationPointLayers(map);

  // レイヤ存在後に UI を配線
  setupLayerSwitcher(map, requireElement('layer-radios'));
  registerFeaturePopups(map);

  // 地図クリック: フィーチャ上なら各ポップアップに委譲。それ以外は浸水深ポップアップを表示。
  map.on('click', (e) => {
    const onFeature = map
      .queryRenderedFeatures(e.point)
      .some((f) => FEATURE_LAYERS.includes(f.layer.id));
    if (onFeature) return;
    void showDepthPopup(map, e.lngLat);
    // void routeToNearestShelter(map, e.lngLat); // 経路探索 無効化中
  });
});
