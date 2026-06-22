// 令和2年簡易100mメッシュ人口（全国）の色分け設定

import type { ExpressionSpecification } from 'maplibre-gl';

/** 人口区分の色（凡例と fill-color の両方で使用） */
export const POP_COLORS = [
  '#0000FF', // ～10人未満
  '#00FFFF', // 10～20人未満
  '#00FF00', // 20～40人未満
  '#FFBF00', // 40～60人未満
  '#FF0000', // 60～80人未満
  '#CB00CB', // 80人以上
] as const;

/** 凡例ラベル（POP_COLORS と対応） */
export const POP_LEGEND_LABELS = [
  '～10人未満',
  '10～20人未満',
  '20～40人未満',
  '40～60人未満',
  '60～80人未満',
  '80人以上',
] as const;

// 各区分の人口しきい値 [min, max)
const POP_BINS: [number, number][] = [
  [0, 10],
  [10, 20],
  [20, 40],
  [40, 60],
  [60, 80],
  [80, 1_000_000],
];

const popT = ['to-number', ['get', 'PopT']];

/** fill-color 用の case 式（人口に応じて色分け） */
const cases = POP_BINS.flatMap(([min, max], i) => [
  ['all', ['>=', popT, min], ['<', popT, max]],
  POP_COLORS[i],
]);

export const POP_FILL_COLOR = [
  'case',
  ...cases,
  POP_COLORS[POP_COLORS.length - 1],
] as unknown as ExpressionSpecification;
