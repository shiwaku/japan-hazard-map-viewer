// ハザードマップに重ねる情報（避難場所・伝承碑・人口・3D建物・地形）の定義。
// パネルのトグル生成・初期表示状態・説明文をここから生成する。

// 地形（起伏の立体化）は MapLibre 標準の TerrainControl（右上）で切り替えるため、
// ここには含めない。
export type OverlayKey = 'hinanbasho' | 'denshouhi' | 'pop' | 'plateau';

export interface OverlayDef {
  key: OverlayKey;
  /** トグルのラベル */
  name: string;
  /** i ボタンで開閉する説明 */
  desc: string;
  /** 初期表示状態 */
  on: boolean;
  /** visibility を切り替える地図レイヤID */
  layers: string[];
  /** このズーム以上で表示される旨をラベル脇に添える */
  minzoom?: number;
}

export const OVERLAYS: OverlayDef[] = [
  {
    key: 'hinanbasho',
    name: '指定緊急避難場所',
    desc: '災害の危険が切迫したときに緊急に避難する場所として、市町村長が指定したものです。選択中のハザード（洪水・土砂災害・高潮・津波・内水）に対応する場所だけを表示します。最新かつ詳細の状況は必ず当該市町村にご確認ください。',
    on: true,
    layers: ['hinanbasho'],
    minzoom: 12,
  },
  {
    key: 'denshouhi',
    name: '自然災害伝承碑',
    desc: '過去に発生した自然災害の様子や被害の状況が記載された石碑・モニュメントです。同じ場所で繰り返し災害が起きていることを示す手がかりになります。',
    on: true,
    layers: ['denshouhi'],
    minzoom: 9,
  },
  {
    key: 'pop',
    name: '100mメッシュ人口',
    desc: '2020年国勢調査をもとに100mメッシュへ簡易に按分した人口です。簡易な按分のため、当該メッシュの実際の人口を示すものではありません。浸水想定区域にどれだけの人が住んでいるかの目安に使えます。',
    on: false,
    layers: ['100m_mesh_pop2020_fill'],
    minzoom: 12,
  },
  {
    key: 'plateau',
    name: 'PLATEAU 3D建物',
    desc: '国土交通省 3D都市モデル（Project PLATEAU）の建物データ（2023年度・LOD0）を、記録された高さで立体表示します。浸水深と建物の高さを見比べる用途を想定しています。整備済みの都市のみ表示されます。',
    on: true,
    layers: ['plateau-pmtiles'],
    minzoom: 16,
  },
];

/** 初期表示状態のコピーを返す（state の初期値用） */
export function initialOverlayState(): Record<OverlayKey, boolean> {
  return OVERLAYS.reduce(
    (acc, o) => {
      acc[o.key] = o.on;
      return acc;
    },
    {} as Record<OverlayKey, boolean>,
  );
}
