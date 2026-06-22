import { HAZARD_LAYERS, type HazardLegend } from '../config/hazard-layers';
import { POP_COLORS, POP_LEGEND_LABELS } from '../config/population';
import { assetUrl } from '../lib/geo';

// すべてのハザード凡例の下部に表示する避難場所・伝承碑のピン
const PIN_ROWS =
  `<div><img src="${assetUrl('img/location-pin.png')}" alt="指定緊急避難場所" style="width:20px; height:20px;" />指定緊急避難場所</div>` +
  `<div><img src="${assetUrl('img/location-pin2_red.png')}" alt="自然災害伝承碑" style="width:20px; height:20px;" />自然災害伝承碑</div>`;

function swatchHtml(color: string, label: string): string {
  return (
    `<div class="square" style="background-color: ${color}; display: inline-block;"></div>` +
    `<span style="display: inline-block; margin-left: 5px;">${label}</span><br>`
  );
}

function legendInnerHtml(legend: HazardLegend): string {
  let html = '';
  if (legend.title) html += `<h4>${legend.title}</h4>`;
  if (legend.image) {
    html += `<img src="${assetUrl(legend.image.src)}" width="${legend.image.width}" height="${legend.image.height}" alt="" /><br>`;
  }
  if (legend.swatches) {
    for (const s of legend.swatches) html += swatchHtml(s.color, s.label);
  }
  return html + PIN_ROWS;
}

/**
 * 設定からハザード凡例と人口凡例の DOM を生成して container に追加する。
 * 各凡例は id=`legend-<layerId>`、人口は id=`legend-pop`。表示切替は layer-switcher が行う。
 */
export function renderLegends(container: HTMLElement): void {
  HAZARD_LAYERS.forEach((def, index) => {
    const el = document.createElement('div');
    el.id = `legend-${def.id}`;
    el.className = 'legend';
    el.style.display = index === 0 ? 'block' : 'none';
    el.innerHTML = legendInnerHtml(def.legend);
    container.appendChild(el);
  });

  const pop = document.createElement('div');
  pop.id = 'legend-pop';
  pop.className = 'legend-pop';
  pop.style.display = 'none';
  let popHtml = '<h4>人口(100mﾒｯｼｭ)</h4>';
  POP_COLORS.forEach((color, i) => {
    popHtml += swatchHtml(color, POP_LEGEND_LABELS[i]);
  });
  pop.innerHTML = popHtml;
  container.appendChild(pop);
}
