// パネルの「浸水シミュレーション（浸水ナビ）」セクション。
//
// ハザードマップ（法指定の静的な区域）とは操作系が別なので、UI も独立させている。
// 破堤点を選ぶ → 経過時間を動かす、という順序が UI 上も分かるよう、
// 破堤点を選ぶまで時間操作は出さない。

import { SWATCHES_SHINSUISHIN } from '../config/hazard-layers';
import { formatMinutes, scaleLabel, SUIBOU_OPACITY, type BreakPoint } from '../config/suibou-navi';

export interface SuibouState {
  /** シミュレーションモードの ON/OFF */
  active: boolean;
  /** 直近の検索でヒットした破堤点 */
  breakPoints: BreakPoint[];
  /** 選択中の破堤点 */
  selected: BreakPoint | null;
  /** selected.BPTime に対するインデックス */
  timeIndex: number;
  playing: boolean;
  /** 破堤点を河川名で絞り込む（null＝すべて）。数百件返ることがあるため */
  riverFilter: string | null;
  layers: { maxRank: boolean; maxRed: boolean; range: boolean };
  opacity: number;
}

export function initialSuibouState(): SuibouState {
  return {
    active: false,
    breakPoints: [],
    selected: null,
    timeIndex: 0,
    playing: false,
    riverFilter: null,
    // 検索可能範囲は既定でON。どこにデータがあるか先に見せて空振りを減らす
    layers: { maxRank: false, maxRed: false, range: true },
    opacity: SUIBOU_OPACITY,
  };
}

export interface SuibouHandlers {
  onActive(on: boolean): void;
  onRange(on: boolean): void;
  onTimeIndex(index: number): void;
  onPlay(playing: boolean): void;
  onMaxRank(on: boolean): void;
  onMaxRed(on: boolean): void;
  onOpacity(value: number): void;
  onClearSelection(): void;
  /** 候補（最大浸水をもたらす破堤点）をワンタップで選ぶ */
  onSelect(id: string): void;
  /** 破堤点を河川名で絞り込む（null＝すべて） */
  onRiverFilter(river: string | null): void;
}

export interface SuibouPanel {
  /** state の変化（検索結果・選択・再生状態）を UI に反映する */
  render(): void;
  /**
   * 検索中・該当なし・エラーなどの一行メッセージ。
   * action を渡すと、その場で押せるボタンを添える（例: 検索可能範囲を表示）。
   */
  setStatus(message: string | null, action?: { label: string; onClick: () => void }): void;
  /**
   * 「最大浸水をもたらす破堤点」へのショートカットを出す。
   * 破堤点が数百件返ることがあり、地図上から目当ての点を探すのが難しいため。
   */
  setSuggestion(bp: BreakPoint | null): void;
}

const DESC_ACTIVE =
  '国土地理院「浸水ナビ」の想定破堤点シミュレーションです。地図をクリックすると、その地点を浸水させる想定破堤点が表示されます。破堤点を選ぶと、破堤からの経過時間ごとの浸水範囲を追えます。ハザードマップが「指定された区域」を示すのに対し、こちらは「どの堤防が切れると、いつ、どこまで浸水するか」を示します。';
const DESC_RANGE =
  '浸水ナビがシミュレーションデータを持っている範囲です。この範囲外をクリックしても破堤点は見つかりません。';
const DESC_MAX_RANK =
  'その破堤点が切れた場合に最終的に浸水する範囲を、浸水深のランクで色分けして表示します。';
const DESC_MAX_RED = 'その破堤点が切れた場合に最終的に浸水する範囲を、赤一色で表示します。';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/** 説明付きのトグル行を作る */
function toggleRow(
  label: string,
  desc: string,
  checked: boolean,
  onChange: (on: boolean) => void,
): { item: HTMLElement; input: HTMLInputElement } {
  const item = el('div', 'layer-item');
  const lab = el('label', 'toggle');

  const input = el('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  const sw = el('span', 'switch');
  const text = el('span', 't-label');
  text.textContent = label;

  const descEl = el('div', 'layer-desc');
  descEl.hidden = true;
  descEl.textContent = desc;

  const info = el('button', 'info-btn');
  info.type = 'button';
  info.textContent = 'i';
  info.setAttribute('aria-label', `${label}の説明`);
  info.setAttribute('aria-expanded', 'false');
  info.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = descEl.hidden;
    descEl.hidden = !open;
    info.setAttribute('aria-expanded', String(open));
  });

  lab.append(input, sw, text, info);
  item.append(lab, descEl);
  return { item, input };
}

export function buildSuibouPanel(
  container: HTMLElement,
  state: SuibouState,
  handlers: SuibouHandlers,
): SuibouPanel {
  // ---- モード切替 ----
  const { item: activeItem } = toggleRow(
    '破堤点を探す',
    DESC_ACTIVE,
    state.active,
    handlers.onActive,
  );
  container.append(activeItem);

  // ---- 検索可能範囲 ----
  const { item: rangeItem } = toggleRow(
    '検索可能範囲を表示',
    DESC_RANGE,
    state.layers.range,
    handlers.onRange,
  );
  container.append(rangeItem);

  // ---- 状態メッセージ（必要なら操作ボタンを添える） ----
  const status = el('div', 'suibou-status');
  status.hidden = true;
  const statusAction = el('button', 'mini-btn suibou-action');
  statusAction.type = 'button';
  statusAction.hidden = true;
  const suggest = el('button', 'mini-btn suibou-suggest');
  suggest.type = 'button';
  suggest.hidden = true;

  // ---- 河川で絞り込む（破堤点が数百件返ることがあるため） ----
  const riverBox = el('div', 'suibou-river');
  riverBox.hidden = true;
  const riverLabel = el('label', 'suibou-river-label');
  riverLabel.textContent = '河川で絞り込む';
  const riverSelect = el('select');
  riverSelect.addEventListener('change', () => {
    const v = riverSelect.value;
    state.riverFilter = v === '' ? null : v;
    handlers.onRiverFilter(state.riverFilter);
  });
  riverLabel.append(riverSelect);
  riverBox.append(riverLabel);

  container.append(status, statusAction, suggest, riverBox);

  // ---- 選択中の破堤点 ----
  const detail = el('div', 'suibou-detail');
  detail.hidden = true;

  const head = el('div', 'suibou-head');
  const title = el('div', 'suibou-title');
  const sub = el('div', 'suibou-sub');
  const badges = el('div', 'suibou-badges');
  const clear = el('button', 'mini-btn');
  clear.type = 'button';
  clear.textContent = '選択解除';
  clear.addEventListener('click', () => handlers.onClearSelection());
  head.append(title, sub, badges, clear);

  // 経過時間
  const timeField = el('div', 'suibou-time');
  const timeLabel = el('div', 'suibou-time-label');
  const slider = el('input');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.setAttribute('aria-label', '破堤からの経過時間');
  slider.addEventListener('input', () => handlers.onTimeIndex(Number(slider.value)));

  const controls = el('div', 'suibou-controls');
  const playBtn = el('button', 'mini-btn');
  playBtn.type = 'button';
  playBtn.addEventListener('click', () => handlers.onPlay(!state.playing));
  controls.append(playBtn);

  timeField.append(timeLabel, slider, controls);

  // 重ねるタイル
  const { item: rankItem, input: rankInput } = toggleRow(
    '最大浸水域（浸水ランク）',
    DESC_MAX_RANK,
    state.layers.maxRank,
    handlers.onMaxRank,
  );
  const { item: redItem, input: redInput } = toggleRow(
    '最大浸水域（赤一色）',
    DESC_MAX_RED,
    state.layers.maxRed,
    handlers.onMaxRed,
  );

  // 不透明度
  const opac = el('div', 'layer-opacity');
  const opacRange = el('input');
  opacRange.type = 'range';
  opacRange.min = '0';
  opacRange.max = '100';
  opacRange.step = '1';
  opacRange.value = String(Math.round(state.opacity * 100));
  opacRange.setAttribute('aria-label', '浸水ナビのタイルの不透明度');
  const opacVal = el('span', 'op-val');
  opacVal.textContent = `${opacRange.value}%`;
  opacRange.addEventListener('input', () => {
    opacVal.textContent = `${opacRange.value}%`;
    handlers.onOpacity(Number(opacRange.value) / 100);
  });
  opac.append(opacRange, opacVal);

  // 凡例（浸水ランクはハザードマップの浸水深と同じ配色）
  const legend = el('div', 'layer-legend');
  legend.innerHTML = SWATCHES_SHINSUISHIN.map(
    (s) =>
      `<span class="lg-row"><span class="lg-sw" style="background:${s.color}"></span>${s.label}</span>`,
  ).join('');

  detail.append(head, timeField, rankItem, redItem, opac, legend);
  container.append(detail);

  /** 検索結果の河川名を件数つきでセレクトへ流し込む */
  function renderRivers(): void {
    const counts = new Map<string, number>();
    for (const bp of state.breakPoints) {
      counts.set(bp.EntryRiverName, (counts.get(bp.EntryRiverName) ?? 0) + 1);
    }
    // 河川が1つしかないなら絞り込む意味がない
    riverBox.hidden = !state.active || counts.size <= 1;
    if (riverBox.hidden) return;

    const opts = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    riverSelect.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = `すべての河川（${state.breakPoints.length}）`;
    riverSelect.append(all);
    for (const [name, n] of opts) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = `${name}（${n}）`;
      riverSelect.append(o);
    }
    riverSelect.value = state.riverFilter ?? '';
  }

  function render(): void {
    rangeItem.hidden = !state.active;
    renderRivers();
    const bp = state.selected;
    detail.hidden = !state.active || !bp;
    if (!bp) return;

    title.textContent = `${bp.EntryRiverName} ${bp.BPName}`;
    sub.textContent = `${bp.BPLocation}（${scaleLabel(bp.CSVScale)}）`;

    badges.replaceChildren();
    const flags: [boolean | undefined, string, string][] = [
      [bp.isDepthMax, 'この地点に最大の浸水をもたらす破堤点', 'is-depth'],
      [bp.isStartMax, '最も早く浸水が始まる破堤点', 'is-start'],
      [bp.isDurationMax, '最も長く浸水が続く破堤点', 'is-duration'],
    ];
    for (const [on, text, cls] of flags) {
      if (!on) continue;
      const b = el('span', `suibou-badge ${cls}`);
      b.textContent = text;
      badges.append(b);
    }

    const times = bp.BPTime;
    slider.max = String(Math.max(0, times.length - 1));
    slider.value = String(state.timeIndex);
    slider.disabled = state.playing || times.length <= 1;
    const minutes = times[state.timeIndex];
    timeLabel.innerHTML = `<span>破堤からの経過時間</span><b>${minutes === undefined ? '-' : formatMinutes(minutes)}</b>`;

    playBtn.textContent = state.playing ? '■ 停止' : '▶ 再生';
    playBtn.disabled = times.length <= 1;

    rankInput.checked = state.layers.maxRank;
    redInput.checked = state.layers.maxRed;
  }

  function setStatus(
    message: string | null,
    action?: { label: string; onClick: () => void },
  ): void {
    status.hidden = message === null;
    status.textContent = message ?? '';
    statusAction.hidden = !action;
    if (action) {
      statusAction.textContent = action.label;
      statusAction.onclick = action.onClick;
    }
  }

  function setSuggestion(bp: BreakPoint | null): void {
    suggest.hidden = bp === null;
    if (!bp) return;
    suggest.textContent = `最大浸水の破堤点を選ぶ（${bp.EntryRiverName} ${bp.BPName}）`;
    suggest.onclick = () => handlers.onSelect(bp.ID);
  }

  render();
  return { render, setStatus, setSuggestion };
}
