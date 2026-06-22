import type { Map as MlMap } from 'maplibre-gl';
import { HAZARD_LAYERS, HAZARD_OPACITY } from '../config/hazard-layers';
import { setHinanbashoFilter } from '../layers/evacuation-points';
import { setupOpacitySlider } from './opacity-slider';

/**
 * ハザード選択ラジオ＋人口チェックボックスを生成し、表示切替・凡例切替・
 * 避難場所フィルタ・不透明度リセットを配線する。
 */
export function setupLayerSwitcher(map: MlMap, radioContainer: HTMLElement): void {
  let activeId = HAZARD_LAYERS[0].id;
  const opacity = setupOpacitySlider(map, () => activeId);

  // ラジオボタンを生成
  HAZARD_LAYERS.forEach((def, index) => {
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'layer';
    input.id = def.id;
    input.value = def.id;
    input.checked = index === 0;

    const label = document.createElement('label');
    label.htmlFor = def.id;
    label.textContent = def.label;

    wrapper.append(input, label);
    radioContainer.appendChild(wrapper);

    input.addEventListener('change', () => {
      if (input.checked) switchLayer(def.id);
    });
  });

  // 人口チェックボックスを生成
  const popWrapper = document.createElement('div');
  const popInput = document.createElement('input');
  popInput.type = 'checkbox';
  popInput.id = 'pop-map';
  popInput.value = 'pop-map';
  const popLabel = document.createElement('label');
  popLabel.htmlFor = 'pop-map';
  popLabel.textContent = '令和2年100mﾒｯｼｭ人口';
  popWrapper.append(popInput, popLabel);
  radioContainer.appendChild(popWrapper);

  popInput.addEventListener('change', () => {
    const legend = document.getElementById('legend-pop');
    map.setLayoutProperty(
      '100m_mesh_pop2020_fill',
      'visibility',
      popInput.checked ? 'visible' : 'none',
    );
    if (legend) legend.style.display = popInput.checked ? 'block' : 'none';
  });

  function switchLayer(layerId: string): void {
    activeId = layerId;

    HAZARD_LAYERS.forEach((def) => {
      const visible = def.id === layerId;
      map.setLayoutProperty(def.id, 'visibility', visible ? 'visible' : 'none');
      const legendEl = document.getElementById(`legend-${def.id}`);
      if (legendEl) legendEl.style.display = visible ? 'block' : 'none';
    });

    const def = HAZARD_LAYERS.find((d) => d.id === layerId);
    if (def) setHinanbashoFilter(map, def.hinanbashoProperty);

    // 不透明度を初期値に戻す
    map.setPaintProperty(layerId, 'raster-opacity', HAZARD_OPACITY);
    opacity.reset();
  }
}
