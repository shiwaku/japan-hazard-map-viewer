import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import MaplibreGeocoder, {
  type MaplibreGeocoderApi,
  type MaplibreGeocoderApiConfig,
} from '@maplibre/maplibre-gl-geocoder';
import { assetUrl } from '../lib/geo';

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a> | ' +
  '<a href="https://twitter.com/shi__works" target="_blank">X(旧Twitter)</a> | ' +
  '<a href="https://github.com/shiwaku/japan-hazard-map-on-maplibre" target="_blank">GitHub</a> ';

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
export function createMap(): maplibregl.Map {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const map = new maplibregl.Map({
    container: 'map',
    style: assetUrl('std_1.json'),
    center: [131.673877, 32.588641],
    zoom: 15.5,
    minZoom: 1,
    maxZoom: 23,
    pitch: 65,
    maxPitch: 85,
    bearing: 0,
    hash: true,
    attributionControl: false,
  });

  map.addControl(new MaplibreGeocoder(geocoderApi, { maplibregl }), 'top-right');
  map.addControl(new maplibregl.NavigationControl());
  map.addControl(new maplibregl.FullscreenControl());
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      fitBoundsOptions: { maxZoom: 18 },
      trackUserLocation: true,
      showUserLocation: true,
    }),
  );
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }));
  map.addControl(
    new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }),
  );
  map.addControl(new maplibregl.TerrainControl({ source: 'aist-dem', exaggeration: 1 }));

  return map;
}
