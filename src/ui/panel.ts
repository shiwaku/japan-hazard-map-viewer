// 左サイドパネルの組み立て。
// ハザード選択（ラジオ）・重ねる情報（トグル）・視点（2D/3D）を生成し、
// 選択中のハザード直下にだけ不透明度スライダーと凡例をインライン表示する。

import { HAZARD_LAYERS, HAZARD_OPACITY } from '../config/hazard-layers';
import { OVERLAYS, type OverlayKey } from '../config/overlays';
import type { Theme } from '../theme';
import { hazardLegendHtml, overlayLegendHtml } from './legend';

export type PitchMode = '2d' | '3d';

export interface PanelState {
  /** 表示中のハザードレイヤID */
  hazardId: string;
  /** ハザードごとの不透明度（切替で戻ってきても保つ） */
  hazardOpacity: Record<string, number>;
  overlays: Record<OverlayKey, boolean>;
  pitch: PitchMode;
  theme: Theme;
}

export interface PanelHandlers {
  onHazard(id: string): void;
  onOpacity(id: string, value: number): void;
  onOverlay(key: OverlayKey, on: boolean): void;
  onPitch(mode: PitchMode): void;
  onTheme(): void;
}

export interface Panel {
  /** テーマボタンの表示を現在のテーマに合わせる */
  renderTheme(theme: Theme): void;
  /** 地図操作によるピッチ変化を 2D/3D セグメントへ反映する */
  syncPitch(mode: PitchMode): void;
  /** 外部要因で変わったトグル状態をチェックボックスへ反映する */
  syncOverlay(key: OverlayKey, on: boolean): void;
}

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
}

/** 「i」ボタンと、その開閉対象になる説明文をまとめて作る */
function infoParts(name: string, desc: string): { info: HTMLButtonElement; descEl: HTMLElement } {
  const descEl = document.createElement('div');
  descEl.className = 'layer-desc';
  descEl.hidden = true;
  descEl.textContent = desc;

  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'info-btn';
  info.textContent = 'i';
  info.setAttribute('aria-label', `${name}の説明`);
  info.setAttribute('aria-expanded', 'false');
  info.addEventListener('click', (e) => {
    // label 内のボタン。クリックが input のトグルへ波及しないようにする
    e.preventDefault();
    e.stopPropagation();
    const open = descEl.hidden;
    descEl.hidden = !open;
    info.setAttribute('aria-expanded', String(open));
  });

  return { info, descEl };
}

export function buildPanel(state: PanelState, handlers: PanelHandlers): Panel {
  const panel = requireElement('panel');
  const hazardsDiv = requireElement('hazards');
  const overlaysDiv = requireElement('overlays');
  const segDiv = requireElement('pitch-seg');
  const themeBtn = requireElement('theme-btn') as HTMLButtonElement;
  const collapseBtn = requireElement('collapse-btn') as HTMLButtonElement;

  // ---- ハザード（単一選択） ----
  for (const def of HAZARD_LAYERS) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.key = def.id;

    const label = document.createElement('label');
    label.className = 'toggle';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'hazard';
    input.value = def.id;
    input.checked = def.id === state.hazardId;
    input.addEventListener('change', () => {
      if (input.checked) selectHazard(def.id);
    });

    const mark = document.createElement('span');
    mark.className = 'radio-mark';
    const text = document.createElement('span');
    text.className = 't-label';
    text.textContent = def.label;

    const { info, descEl } = infoParts(def.label, def.desc);
    label.append(input, mark, text, info);

    // 不透明度スライダー（選択中のみ表示）
    const opac = document.createElement('div');
    opac.className = 'layer-opacity';
    opac.hidden = def.id !== state.hazardId;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    range.value = String(Math.round((state.hazardOpacity[def.id] ?? HAZARD_OPACITY) * 100));
    range.setAttribute('aria-label', `${def.label}の不透明度`);
    const val = document.createElement('span');
    val.className = 'op-val';
    val.textContent = `${range.value}%`;
    range.addEventListener('input', () => {
      val.textContent = `${range.value}%`;
      handlers.onOpacity(def.id, Number(range.value) / 100);
    });
    opac.append(range, val);

    const legend = document.createElement('div');
    legend.className = 'layer-legend';
    legend.innerHTML = hazardLegendHtml(def);
    legend.hidden = def.id !== state.hazardId;

    item.append(label, descEl, opac, legend);
    hazardsDiv.append(item);
  }

  function selectHazard(id: string): void {
    state.hazardId = id;
    for (const item of hazardsDiv.querySelectorAll<HTMLElement>('.layer-item')) {
      const selected = item.dataset.key === id;
      item.querySelector<HTMLElement>('.layer-opacity')?.toggleAttribute('hidden', !selected);
      item.querySelector<HTMLElement>('.layer-legend')?.toggleAttribute('hidden', !selected);
    }
    handlers.onHazard(id);
  }

  // ---- 重ねる情報（複数選択） ----
  for (const def of OVERLAYS) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.key = def.key;

    const label = document.createElement('label');
    label.className = 'toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.overlays[def.key];
    input.addEventListener('change', () => setOverlay(def.key, input.checked));

    const sw = document.createElement('span');
    sw.className = 'switch';
    const text = document.createElement('span');
    text.className = 't-label';
    text.textContent = def.name;

    const { info, descEl } = infoParts(def.name, def.desc);
    label.append(input, sw, text, info);
    if (def.minzoom !== undefined) {
      const zoom = document.createElement('span');
      zoom.className = 'zoom-hint';
      zoom.textContent = `Z${def.minzoom}+`;
      zoom.title = `ズーム${def.minzoom}以上で表示`;
      label.append(zoom);
    }

    item.append(label, descEl);

    const legendHtml = overlayLegendHtml(def.key);
    if (legendHtml) {
      const legend = document.createElement('div');
      legend.className = 'layer-legend';
      legend.innerHTML = legendHtml;
      legend.hidden = !state.overlays[def.key];
      item.append(legend);
    }

    overlaysDiv.append(item);
  }

  function setOverlay(key: OverlayKey, on: boolean): void {
    state.overlays[key] = on;
    const item = overlaysDiv.querySelector<HTMLElement>(`.layer-item[data-key="${key}"]`);
    item?.querySelector<HTMLElement>('.layer-legend')?.toggleAttribute('hidden', !on);
    handlers.onOverlay(key, on);
  }

  // ---- 視点（2D / 3D） ----
  const segs: [PitchMode, string][] = [
    ['2d', '2D'],
    ['3d', '3D'],
  ];
  for (const [mode, text] of segs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.dataset.mode = mode;
    btn.setAttribute('aria-selected', String(mode === state.pitch));
    btn.addEventListener('click', () => {
      state.pitch = mode;
      syncPitch(mode);
      handlers.onPitch(mode);
    });
    segDiv.append(btn);
  }

  function syncPitch(mode: PitchMode): void {
    state.pitch = mode;
    for (const btn of segDiv.querySelectorAll<HTMLButtonElement>('button')) {
      btn.setAttribute('aria-selected', String(btn.dataset.mode === mode));
    }
  }

  // ---- ヘッダのボタン ----
  function renderTheme(theme: Theme): void {
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  themeBtn.addEventListener('click', () => handlers.onTheme());

  const renderCollapse = (): void => {
    collapseBtn.textContent = panel.classList.contains('collapsed') ? '▾' : '▴';
  };
  collapseBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    renderCollapse();
  });

  renderTheme(state.theme);
  renderCollapse();

  return {
    renderTheme,
    syncPitch,
    syncOverlay(key, on) {
      const input = overlaysDiv.querySelector<HTMLInputElement>(
        `.layer-item[data-key="${key}"] input`,
      );
      if (input) input.checked = on;
      state.overlays[key] = on;
      const item = overlaysDiv.querySelector<HTMLElement>(`.layer-item[data-key="${key}"]`);
      item?.querySelector<HTMLElement>('.layer-legend')?.toggleAttribute('hidden', !on);
    },
  };
}

/** スマホでは初期状態でパネルを畳んで地図を広く見せる */
export function collapsePanel(): void {
  const panel = document.getElementById('panel');
  const btn = document.getElementById('collapse-btn');
  panel?.classList.add('collapsed');
  if (btn) btn.textContent = '▾';
}
