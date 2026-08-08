import type { Map as MlMap } from 'maplibre-gl';

const DEM_SOURCE = 'aist-dem';

/**
 * 産総研 シームレス標高タイル（陸域統合DEM）で地形を立体化する。
 * setStyle で背景を差し替えると source ごと消えるため、貼り直せるよう分離してある。
 */
export function setTerrainEnabled(map: MlMap, on: boolean): void {
  if (!on) {
    if (map.getTerrain()) map.setTerrain(null);
    return;
  }

  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: 'raster-dem',
      tiles: ['https://gbank.gsj.jp/seamless/elev/terrainRGB/land/{z}/{y}/{x}.png'],
      tileSize: 256,
      attribution:
        "<a href='https://tiles.gsj.jp/tiles/elev/tiles.html' target='_blank'>産業技術総合研究所 シームレス標高タイル(陸域統合DEM)</a>",
    });
  }
  map.setTerrain({ source: DEM_SOURCE, exaggeration: 1 });
}
