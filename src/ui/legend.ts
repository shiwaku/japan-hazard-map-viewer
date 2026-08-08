// 凡例のマークアップ生成。
// 旧実装は地図の四隅に絶対配置した凡例パネルを 16 個生成していたが、
// 現在はパネル内の各レイヤー直下にインライン表示するため HTML 断片だけを返す。

import type { HazardLayerDef } from '../config/hazard-layers';
import type { OverlayKey } from '../config/overlays';
import { POP_COLORS, POP_LEGEND_LABELS } from '../config/population';
import { assetUrl } from '../lib/geo';

function swatchRow(color: string, label: string): string {
  return `<span class="lg-row"><span class="lg-sw" style="background:${color}"></span>${label}</span>`;
}

function iconRow(src: string, label: string): string {
  return `<span class="lg-row"><img class="lg-icon" src="${assetUrl(src)}" alt="" />${label}</span>`;
}

/** ハザードレイヤの凡例（色見本 or 画像凡例） */
export function hazardLegendHtml(def: HazardLayerDef): string {
  const { legend } = def;
  let html = '';
  if (legend.image) {
    html += `<img class="lg-img" src="${assetUrl(legend.image.src)}" width="${legend.image.width}" height="${legend.image.height}" alt="${def.label}の凡例" />`;
  }
  if (legend.swatches) {
    for (const s of legend.swatches) html += swatchRow(s.color, s.label);
  }
  return html;
}

/** 重ねる情報の凡例（ピン画像・人口の色分け） */
export function overlayLegendHtml(key: OverlayKey): string {
  switch (key) {
    case 'hinanbasho':
      return iconRow('img/evacuation-area.svg', '指定緊急避難場所');
    case 'denshouhi':
      return iconRow('img/bunkazai.svg', '自然災害伝承碑');
    case 'pop':
      return POP_COLORS.map((c, i) => swatchRow(c, POP_LEGEND_LABELS[i])).join('');
    default:
      return '';
  }
}
