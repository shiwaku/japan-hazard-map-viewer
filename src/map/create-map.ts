import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import MaplibreGeocoder, {
  type MaplibreGeocoderApi,
  type MaplibreGeocoderApiConfig,
} from '@maplibre/maplibre-gl-geocoder';
import { DEM_SOURCE } from '../layers/terrain';

const ATTRIBUTION =
  '<a href="https://twitter.com/shi__works" target="_blank">X(旧Twitter)</a> | ' +
  '<a href="https://github.com/shiwaku/japan-hazard-map-viewer" target="_blank">GitHub</a> ';

/** 3D 表示時のピッチ（2D は 0） */
export const PITCH_3D = 65;

// 国土地理院 地名検索API を使ったジオコーダ
const geocoderApi: MaplibreGeocoderApi = {
  forwardGeocode: async (config: MaplibreGeocoderApiConfig) => {
    const features: GeoJSON.Feature[] = [];
    const query = String(config.query ?? '');
    const prefix = query.substring(0, 3);
    try {
      const response = await fetch(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`,
      );
      const results: {
        geometry: { coordinates: [number, number] };
        properties: { title: string };
      }[] = await response.json();

      for (const r of results) {
        if (r.properties.title.indexOf(prefix) !== -1) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: r.geometry.coordinates },
            properties: r.properties,
            // @maplibre/maplibre-gl-geocoder が参照する追加フィールド
            place_name: r.properties.title,
            text: r.properties.title,
            place_type: ['place'],
            center: r.geometry.coordinates,
          } as GeoJSON.Feature);
        }
      }
    } catch (e) {
      console.error('Failed to forwardGeocode:', e);
    }
    return { type: 'FeatureCollection', features } as never;
  },
};

/** 地図とコントロール一式を生成して返す */
export function createMap(style: StyleSpecification, isMobile: boolean): maplibregl.Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [131.673877, 32.588641],
    zoom: 15.5,
    minZoom: 1,
    maxZoom: 23,
    pitch: PITCH_3D,
    maxPitch: 85,
    bearing: 0,
    // 地図位置を URL の #ズーム/緯度/経度 に反映（共有・リロード時の位置維持）
    hash: true,
    attributionControl: false,
    // モバイルはGPU/メモリが限られるため保持タイル数を絞る。地形＋3D建物＋ラスタを
    // 同時に描くとメモリ逼迫で WebGL コンテキストが失われ、地図がまるごと消える
    // （＝スマホで真っ白）事象があるため、その圧を下げる。
    maxTileCacheSize: isMobile ? 24 : undefined,
    // 近年のスマホは DPR=3。描画バッファ等の GPU メモリは DPR の2乗で効くため、
    // モバイルでは 2 に抑える（2x も十分 Retina 画質）。
    pixelRatio: isMobile ? Math.min(window.devicePixelRatio || 1, 2) : undefined,
  });

  map.addControl(new MaplibreGeocoder(geocoderApi, { maplibregl }), 'top-right');
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
    'top-right',
  );
  // 地形（起伏の立体化）の ON/OFF。DEM ソースは load 後に ensureDemSource() で用意する。
  map.addControl(
    new maplibregl.TerrainControl({ source: DEM_SOURCE, exaggeration: 1 }),
    'top-right',
  );
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      fitBoundsOptions: { maxZoom: 18 },
      trackUserLocation: true,
      showUserLocation: true,
    }),
    'top-right',
  );
  // 左下はサイドパネルの裏になるため、スケール・出典はすべて右下へ寄せる
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-right');

  return map;
}

/** 出典表記コントロール（背景切替のあとに足したいので分離） */
export function attributionControl(): maplibregl.AttributionControl {
  return new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIBUTION });
}
