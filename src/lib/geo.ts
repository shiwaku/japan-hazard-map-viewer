// 地理計算ユーティリティ

/** 経度・緯度のタプル [lng, lat] */
export type LngLat = [number, number];

/**
 * 2点間のハーサイン距離（m）。引数は [lng, lat]。
 */
export function haversineDistance(a: LngLat, b: LngLat): number {
  const R = 6371e3; // 地球半径[m]
  const phi1 = (a[1] * Math.PI) / 180;
  const phi2 = (b[1] * Math.PI) / 180;
  const dPhi = ((b[1] - a[1]) * Math.PI) / 180;
  const dLambda = ((b[0] - a[0]) * Math.PI) / 180;

  const h =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * 緯度経度をタイル座標（小数部はタイル内の位置）に変換する。
 * 参考: https://gsj-seamless.jp/labs/datapng/gridpngtile.html
 */
export function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const w = Math.pow(2, z) / 2; // 世界全体のタイル幅 / 2
  const yrad = Math.log(Math.tan((Math.PI * (90 + lat)) / 360));
  return { x: (lng / 180 + 1) * w, y: (1 - yrad / Math.PI) * w };
}

/** 凡例の1項目（RGB値とタイトル）。PNGタイルのピクセル色から浸水深などを引く */
export interface LegendColorItem {
  r: number;
  g: number;
  b: number;
  title: string;
}

/**
 * PNGタイルの指定地点のピクセルRGBを取得し、凡例から該当項目を返す。
 * 透明（α≠255）または該当なしの場合は null。
 */
export function getLegendItemAt(
  legend: LegendColorItem[],
  urlTemplate: string,
  lat: number,
  lng: number,
  z: number,
): Promise<LegendColorItem | null> {
  return new Promise((resolve) => {
    const p = latLngToTile(lat, lng, z);
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const i = (p.x - x) * 256; // タイル内i座標
    const j = (p.y - y) * 256; // タイル内j座標
    const img = new Image();

    img.crossOrigin = 'anonymous'; // 画像からデータを取り出すために必要
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      canvas.width = 1;
      canvas.height = 1;
      context.drawImage(img, i, j, 1, 1, 0, 0, 1, 1);
      const d = context.getImageData(0, 0, 1, 1).data;
      if (d[3] !== 255) {
        resolve(null);
        return;
      }
      resolve(legend.find((o) => o.r === d[0] && o.g === d[1] && o.b === d[2]) ?? null);
    };
    img.onerror = () => resolve(null);
    img.src = urlTemplate
      .replace('{z}', String(z))
      .replace('{y}', String(y))
      .replace('{x}', String(x));
  });
}

/** Viteのbaseパスを考慮したアセットURLを生成（public/配下のファイル用） */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
