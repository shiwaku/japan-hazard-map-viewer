// 浸水ナビのレイヤー操作（破堤点・時系列タイル・最大浸水域・検索可能範囲）。
// すべて idempotent。背景/テーマ切替後の再構築でもそのまま呼べる。

import type { Map as MlMap } from 'maplibre-gl';
import {
  POINTS_LAYER,
  POINTS_SOURCE,
  SELECTED_POINT_LAYER,
  SUIBOU_ATTRIBUTION,
  TILE_MAXZOOM,
  TIMESERIES_PREFIX,
  type BreakPoint,
  maxRankTileUrl,
  maxRedTileUrl,
  rangeTileUrl,
  timeseriesTileUrl,
} from '../config/suibou-navi';
import {
  SUIBOU_MAX_RANK_LAYER,
  SUIBOU_MAX_RED_LAYER,
  SUIBOU_RANGE_LAYER,
  beforeIdFor,
} from '../map/layer-order';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** 破堤点レイヤーのIDから、時系列レイヤーのIDを作る */
function timeseriesLayerId(bp: BreakPoint, minutes: number): string {
  return `${TIMESERIES_PREFIX}${bp.ID}-${String(minutes).padStart(5, '0')}`;
}

// ---- 破堤点 ----

/** 破堤点のソース/レイヤーを用意する（データは setBreakPoints で流し込む） */
export function ensurePointLayers(map: MlMap): void {
  if (!map.getSource(POINTS_SOURCE)) {
    map.addSource(POINTS_SOURCE, { type: 'geojson', data: EMPTY });
  }
  if (!map.getLayer(POINTS_LAYER)) {
    map.addLayer(
      {
        id: POINTS_LAYER,
        type: 'circle',
        source: POINTS_SOURCE,
        paint: {
          // 最大浸水をもたらす破堤点は赤、それ以外は青
          'circle-radius': ['case', ['get', 'isDepthMax'], 7, 5],
          'circle-color': ['case', ['get', 'isDepthMax'], '#dc2626', '#3b82f6'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      beforeIdFor(map, 'suibou-points'),
    );
  }
  if (!map.getLayer(SELECTED_POINT_LAYER)) {
    map.addLayer(
      {
        id: SELECTED_POINT_LAYER,
        type: 'circle',
        source: POINTS_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 10,
          'circle-color': 'rgba(253, 224, 71, 0.9)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#a16207',
        },
      },
      beforeIdFor(map, 'suibou-points'),
    );
  }
}

/** 破堤点の一覧を地図へ反映する */
export function setBreakPoints(map: MlMap, points: BreakPoint[]): void {
  const src = map.getSource(POINTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: 'FeatureCollection',
    features: points.map((bp) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [bp.BPLon, bp.BPLat] },
      properties: {
        id: bp.ID,
        name: bp.BPName,
        location: bp.BPLocation,
        river: bp.EntryRiverName,
        isDepthMax: bp.isDepthMax === true,
      },
    })),
  });
}

/** 選択中の破堤点をハイライトする */
export function highlightBreakPoint(map: MlMap, id: string | null): void {
  if (!map.getLayer(SELECTED_POINT_LAYER)) return;
  map.setFilter(SELECTED_POINT_LAYER, ['==', ['get', 'id'], id ?? '']);
}

/** 破堤点レイヤーとソースを取り外す */
export function removePointLayers(map: MlMap): void {
  for (const id of [SELECTED_POINT_LAYER, POINTS_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(POINTS_SOURCE)) map.removeSource(POINTS_SOURCE);
}

// ---- 時系列タイル ----

/**
 * 指定した経過時間の時系列タイルだけを表示する。
 * 直前に読んだ時刻のレイヤーは残さず捨てる（破堤点あたり最大30枚近くになり、
 * モバイルのメモリを圧迫するため）。
 */
export function showTimeseries(
  map: MlMap,
  bp: BreakPoint,
  minutes: number,
  opacity: number,
  visible: boolean,
): void {
  const keep = timeseriesLayerId(bp, minutes);
  removeTimeseriesLayers(map, visible ? keep : undefined);
  if (!visible) return;

  if (!map.getSource(keep)) {
    map.addSource(keep, {
      type: 'raster',
      tiles: [timeseriesTileUrl(bp, minutes)],
      tileSize: 256,
      maxzoom: TILE_MAXZOOM,
      attribution: SUIBOU_ATTRIBUTION,
    });
  }
  if (!map.getLayer(keep)) {
    map.addLayer(
      {
        id: keep,
        type: 'raster',
        source: keep,
        paint: { 'raster-opacity': opacity },
      },
      beforeIdFor(map, 'suibou-timeseries'),
    );
  } else {
    map.setPaintProperty(keep, 'raster-opacity', opacity);
  }
}

/** keepId 以外の時系列レイヤー/ソースを取り外す */
export function removeTimeseriesLayers(map: MlMap, keepId?: string): void {
  for (const layer of map.getStyle().layers) {
    if (!layer.id.startsWith(TIMESERIES_PREFIX) || layer.id === keepId) continue;
    map.removeLayer(layer.id);
    if (map.getSource(layer.id)) map.removeSource(layer.id);
  }
}

// ---- 最大浸水域・検索可能範囲 ----

interface RasterSpec {
  id: string;
  url: string;
  slot: 'suibou-max' | 'suibou-range';
}

function ensureRaster(map: MlMap, spec: RasterSpec, opacity: number): void {
  if (!map.getSource(spec.id)) {
    map.addSource(spec.id, {
      type: 'raster',
      tiles: [spec.url],
      tileSize: 256,
      maxzoom: TILE_MAXZOOM,
      attribution: SUIBOU_ATTRIBUTION,
    });
  }
  if (!map.getLayer(spec.id)) {
    map.addLayer(
      { id: spec.id, type: 'raster', source: spec.id, paint: { 'raster-opacity': opacity } },
      beforeIdFor(map, spec.slot),
    );
  } else {
    map.setPaintProperty(spec.id, 'raster-opacity', opacity);
  }
}

function removeRaster(map: MlMap, id: string): void {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}

/** 最大浸水域（浸水ランク別）。破堤点が変わったら貼り直す */
export function setMaxRank(map: MlMap, bp: BreakPoint | null, on: boolean, opacity: number): void {
  removeIfStale(map, SUIBOU_MAX_RANK_LAYER, bp, on);
  if (!bp || !on) return;
  ensureRaster(
    map,
    { id: SUIBOU_MAX_RANK_LAYER, url: maxRankTileUrl(bp), slot: 'suibou-max' },
    opacity,
  );
  currentMaxBp.set(SUIBOU_MAX_RANK_LAYER, bp.ID);
}

/** 最大浸水域（赤一色） */
export function setMaxRed(map: MlMap, bp: BreakPoint | null, on: boolean, opacity: number): void {
  removeIfStale(map, SUIBOU_MAX_RED_LAYER, bp, on);
  if (!bp || !on) return;
  ensureRaster(
    map,
    { id: SUIBOU_MAX_RED_LAYER, url: maxRedTileUrl(bp), slot: 'suibou-max' },
    opacity,
  );
  currentMaxBp.set(SUIBOU_MAX_RED_LAYER, bp.ID);
}

/** 最大浸水域レイヤーが載っている破堤点ID（切り替え検知用） */
const currentMaxBp = new Map<string, string>();

function removeIfStale(map: MlMap, id: string, bp: BreakPoint | null, on: boolean): void {
  const stale = !on || !bp || currentMaxBp.get(id) !== bp.ID;
  if (stale) {
    removeRaster(map, id);
    currentMaxBp.delete(id);
  }
}

/** 検索可能範囲（浸水ナビがデータを持っている範囲） */
export function setRange(map: MlMap, on: boolean, csvScale = 0): void {
  if (!on) {
    removeRaster(map, SUIBOU_RANGE_LAYER);
    return;
  }
  ensureRaster(
    map,
    { id: SUIBOU_RANGE_LAYER, url: rangeTileUrl(csvScale), slot: 'suibou-range' },
    0.35,
  );
}

/** 浸水ナビのレイヤーをすべて取り外す（モードOFF時） */
export function removeAllSuibouLayers(map: MlMap): void {
  removeTimeseriesLayers(map);
  removeRaster(map, SUIBOU_MAX_RANK_LAYER);
  removeRaster(map, SUIBOU_MAX_RED_LAYER);
  removeRaster(map, SUIBOU_RANGE_LAYER);
  currentMaxBp.clear();
  removePointLayers(map);
}
