// 背景地図スタイル（淡色ベクトル / 写真ラスタ）の生成。
// ダークは淡色スタイルの色を明度反転して機械的に作る（別スタイルを持たない）。

import type { StyleSpecification } from 'maplibre-gl';
import paleStyle from '../pale-style.json';
import type { Theme } from '../theme';

// ---- 色ユーティリティ（明度反転でダーク化するため） ----

function parseColor(str: string): [number, number, number, number] | null {
  const s = str.trim();
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    s,
  );
  if (rgba) {
    return [+rgba[1], +rgba[2], +rgba[3], rgba[4] !== undefined ? +rgba[4] : 1];
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
  ];
}

/** 明度を反転して暗色に変換（色相は保持、彩度は少し抑える）。 */
function darkenColor(str: string): string {
  const c = parseColor(str);
  if (!c) return str;
  const [r, g, b, a] = c;
  const [h, s, l] = rgbToHsl(r, g, b);
  const nl = Math.min(0.9, Math.max(0.05, 1 - l));
  const [nr, ng, nb] = hslToRgb(h, s * 0.85, nl);
  return `rgba(${nr},${ng},${nb},${a})`;
}

/** paint 値（文字列 or 式配列）の中の色文字列だけを再帰的に変換する。 */
function transformValue(v: unknown): unknown {
  if (typeof v === 'string') return parseColor(v) ? darkenColor(v) : v;
  if (Array.isArray(v)) return v.map(transformValue);
  return v;
}

function buildDarkStyle(): StyleSpecification {
  const style = structuredClone(paleStyle) as StyleSpecification;
  for (const layer of style.layers) {
    const paint = (layer as { paint?: Record<string, unknown> }).paint;
    if (!paint) continue;
    for (const key of Object.keys(paint)) {
      if (key.includes('color')) paint[key] = transformValue(paint[key]);
    }
  }
  return style;
}

export type Basemap = 'pale' | 'photo';

// ---- 追加スプライト（避難場所・伝承碑のピン） ----
// MapLibre は sprite を配列で複数指定できる。接頭辞なしで参照できるのは id 'default' の
// スプライトだけなので、アイコンを接頭辞なしで参照している地理院スタイル側を 'default' に据え、
// 追加分は `smartmap:<アイコン名>` で参照する。背景（淡色 / 写真）を切り替えても使えるよう、
// スタイルを返す直前に必ず注入する。
export const SPRITE_ID = 'smartmap';
const SPRITE_URL = 'https://shiwaku.github.io/custom-smartmap-sprite/sprite';

interface SpriteEntry {
  id: string;
  url: string;
}

function withSprite(style: StyleSpecification): StyleSpecification {
  const base = style.sprite;
  const list: SpriteEntry[] = [];
  if (typeof base === 'string') list.push({ id: 'default', url: base });
  else if (Array.isArray(base)) list.push(...(base as SpriteEntry[]));
  if (list.some((s) => s.id === SPRITE_ID)) return style;
  list.push({ id: SPRITE_ID, url: SPRITE_URL });
  return { ...style, sprite: list } as StyleSpecification;
}

// ---- 陰影起伏図（地理院タイル） ----
// 淡色ベクトルには起伏の表現が無いため、2D でも地形が読めるように薄く重ねる。
// ダークでは背景が暗いぶん陰影が強く出るので不透明度を落とす。
const HILLSHADE_SOURCE = 'hillshade';
const HILLSHADE_ATTRIBUTION =
  "<a href='https://maps.gsi.go.jp/development/ichiran.html#hillshademap' target='_blank' rel='noopener'>地理院タイル(陰影起伏図)</a>";

function withHillshade(style: StyleSpecification, theme: Theme): StyleSpecification {
  const s = structuredClone(style) as StyleSpecification;
  s.sources[HILLSHADE_SOURCE] = {
    type: 'raster',
    tiles: ['https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: HILLSHADE_ATTRIBUTION,
  };
  // 背景（background）の直上・その他の地物より下に差し込む
  s.layers.splice(1, 0, {
    id: HILLSHADE_SOURCE,
    type: 'raster',
    source: HILLSHADE_SOURCE,
    paint: { 'raster-opacity': theme === 'dark' ? 0.18 : 0.3 },
  });
  return s;
}

/** 地理院 全国最新写真（シームレス）ラスタスタイル。 */
function photoStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: (paleStyle as unknown as StyleSpecification).glyphs,
    sources: {
      photo: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
        tileSize: 256,
        maxzoom: 18,
        attribution:
          "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank' rel='noopener'>地理院タイル(全国最新写真)</a>",
      },
    },
    layers: [{ id: 'photo', type: 'raster', source: 'photo' }],
  } as StyleSpecification;
}

let paleCache: StyleSpecification | null = null;
let darkCache: StyleSpecification | null = null;

/** 背景＋テーマの組み合わせからスタイル定義を返す（淡色はキャッシュ） */
export function getBasemapStyle(base: Basemap, theme: Theme): StyleSpecification {
  if (base === 'photo') return withSprite(photoStyle());
  if (theme === 'dark') {
    if (!darkCache) darkCache = withSprite(withHillshade(buildDarkStyle(), 'dark'));
    return darkCache;
  }
  if (!paleCache) {
    paleCache = withSprite(withHillshade(paleStyle as unknown as StyleSpecification, 'light'));
  }
  return paleCache;
}
