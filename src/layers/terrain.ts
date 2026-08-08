import type { Map as MlMap } from 'maplibre-gl';

/** 産総研 シームレス標高タイル（陸域統合DEM）のソースID */
export const DEM_SOURCE = 'aist-dem';

/**
 * DEM ソースを用意する（地形OFFでも常に置く）。
 * 右上の TerrainControl はクリック時に map.setTerrain({source: DEM_SOURCE}) を呼ぶだけなので、
 * ソースが無いと切替が失敗する。背景スタイルを差し替えるとソースごと消えるため、
 * スタイル再構築のたびに呼び直す。
 */
export function ensureDemSource(map: MlMap): void {
  if (map.getSource(DEM_SOURCE)) return;
  map.addSource(DEM_SOURCE, {
    type: 'raster-dem',
    tiles: ['https://gbank.gsj.jp/seamless/elev/terrainRGB/land/{z}/{y}/{x}.png'],
    tileSize: 256,
    attribution:
      "<a href='https://tiles.gsj.jp/tiles/elev/tiles.html' target='_blank'>産業技術総合研究所 シームレス標高タイル(陸域統合DEM)</a>",
  });
}

/** 地形の立体化を切り替える（ソースが無ければ用意してから） */
export function setTerrainEnabled(map: MlMap, on: boolean): void {
  ensureDemSource(map);
  if (on) map.setTerrain({ source: DEM_SOURCE, exaggeration: 1 });
  else if (map.getTerrain()) map.setTerrain(null);
}
