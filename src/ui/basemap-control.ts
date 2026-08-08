// 背景地図スイッチャー（地図＝淡色ベクトル / 写真＝全国最新写真）。右下に置く。

import type { IControl } from 'maplibre-gl';
import type { Basemap } from '../map/basemap';

const DEFS: [Basemap, string][] = [
  ['pale', '地図'],
  ['photo', '写真'],
];

export class BasemapControl implements IControl {
  private el!: HTMLElement;

  constructor(
    private current: () => Basemap,
    private onSelect: (base: Basemap) => void,
  ) {}

  onAdd(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'maplibregl-ctrl basemap-switch';
    for (const [base, label] of DEFS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.base = base;
      btn.setAttribute('aria-selected', String(base === this.current()));
      btn.addEventListener('click', () => this.onSelect(base));
      this.el.append(btn);
    }
    return this.el;
  }

  onRemove(): void {
    this.el.remove();
  }

  /** 選択状態を現在の背景地図に合わせる */
  sync(): void {
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('button')) {
      btn.setAttribute('aria-selected', String(btn.dataset.base === this.current()));
    }
  }
}
