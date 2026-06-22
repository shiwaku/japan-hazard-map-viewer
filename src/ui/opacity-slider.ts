import type { Map as MlMap } from 'maplibre-gl';
import { HAZARD_OPACITY } from '../config/hazard-layers';

export interface OpacityControl {
  /** スライダーを初期値（HAZARD_OPACITY）に戻す */
  reset(): void;
}

/**
 * 不透明度スライダーを配線する。スライダーは「現在アクティブなハザードレイヤ」の
 * raster-opacity を変更する。アクティブレイヤIDは getActiveLayerId() で都度取得するため、
 * レイヤ切替のたびにリスナーを貼り直す必要がない（旧実装のリスナー多重登録を解消）。
 */
export function setupOpacitySlider(map: MlMap, getActiveLayerId: () => string): OpacityControl {
  const slider = document.getElementById('slider-opacity') as HTMLInputElement | null;
  const valueLabel = document.getElementById('slider-opacity-value');
  if (!slider || !valueLabel) {
    throw new Error('不透明度スライダーの要素が見つかりません');
  }

  // つまみより左側を塗る（CSS の --_fill）。値表示も更新。
  const render = () => {
    valueLabel.textContent = `${slider.value}%`;
    slider.style.setProperty('--_fill', `${slider.value}%`);
  };

  slider.addEventListener('input', () => {
    map.setPaintProperty(getActiveLayerId(), 'raster-opacity', parseInt(slider.value, 10) / 100);
    render();
  });

  render(); // 初期表示

  return {
    reset() {
      slider.value = String(Math.round(HAZARD_OPACITY * 100));
      render();
    },
  };
}
