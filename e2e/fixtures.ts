import type { Page, Route } from '@playwright/test';

/**
 * 浸水ナビ API のモック。
 *
 * 実 API は「分間リクエスト数30以下程度」という制約があり、地点によっては応答に
 * 10秒以上かかる。テストのたびに叩くのは負荷の面でも安定性の面でも避けたいため、
 * 実レスポンス（荒川下流）を元にした固定データを返す。
 */

export const BREAK_POINTS = [
  {
    ID: 'bp-max-0001',
    BPName: 'BP168',
    BPLocation: '荒川左岸 15.00k',
    BPLat: 35.766,
    BPLon: 139.806,
    CSVScale: 0,
    EntryRiverName: '荒川',
    RiverCode: '8303040001',
    SubRiverCode: '_',
    OfficeCode: '21281',
    BPTime: [10, 20, 30, 60, 120, 180, 360, 720, 1440],
    isDepthMax: true,
    isStartMax: false,
    isDurationMax: false,
  },
  {
    ID: 'bp-second-0002',
    BPName: 'BP199',
    BPLocation: '荒川左岸 12.25k',
    BPLat: 35.762,
    BPLon: 139.812,
    CSVScale: 1,
    EntryRiverName: '荒川',
    RiverCode: '8303040001',
    SubRiverCode: '_',
    OfficeCode: '21281',
    BPTime: [10, 30, 60, 180],
    isDepthMax: false,
    isStartMax: true,
    isDurationMax: false,
  },
  {
    ID: 'bp-other-0003',
    BPName: 'BP012',
    BPLocation: '中川右岸 5.00k',
    BPLat: 35.769,
    BPLon: 139.818,
    CSVScale: 0,
    EntryRiverName: '中川',
    RiverCode: '8303050001',
    SubRiverCode: 'a',
    OfficeCode: '21281',
    BPTime: [10, 60, 240],
    isDepthMax: false,
    isStartMax: false,
    isDurationMax: true,
  },
];

/** 1x1 の透明 PNG（タイルの代わり） */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export interface SuibouMockOptions {
  /** GetBreakPoint が返す破堤点。空配列にすると「該当なし」を再現できる */
  breakPoints?: typeof BREAK_POINTS;
  /** GetBreakPoint を失敗させる（APIの不調を再現する） */
  breakPointStatus?: number;
  /** GetBreakPoint の応答を遅らせる。破堤点が密集する地点の遅さを再現する */
  breakPointDelayMs?: number;
}

/** 浸水ナビへのリクエストをすべて横取りする */
export async function mockSuibouNavi(page: Page, opts: SuibouMockOptions = {}): Promise<void> {
  const breakPoints = opts.breakPoints ?? BREAK_POINTS;

  await page.route('**/suiboumap.gsi.go.jp/**', async (route: Route) => {
    const url = route.request().url();

    if (url.includes('/Api/Public/GetBreakPoint')) {
      if (opts.breakPointDelayMs) {
        await new Promise((r) => setTimeout(r, opts.breakPointDelayMs));
      }
      if (opts.breakPointStatus) {
        return route.fulfill({ status: opts.breakPointStatus, body: '' });
      }
      return route.fulfill({ json: breakPoints });
    }
    if (url.includes('/Api/Public/GetMaxDepthByTime')) {
      return route.fulfill({ json: { Depth: 2.13, OfficeCode: '21281' } });
    }
    if (url.includes('/Api/Public/GetMaxDepth')) {
      return route.fulfill({ json: { Depth: 3.43, OfficeCode: '21281' } });
    }
    if (url.includes('/Api/Public/GetFloodStartTime')) {
      return route.fulfill({ json: { StartTime: 25.0, OfficeCode: '21281' } });
    }
    if (url.includes('/Tile/')) {
      return route.fulfill({ contentType: 'image/png', body: PNG_1X1 });
    }
    return route.fulfill({ status: 404, body: '' });
  });
}

/**
 * 地理院のラスタタイル（写真・陰影起伏）を 1x1 の画像で差し替える。
 *
 * 背景の切替は `map.once('idle')` を待って組み直すため、タイルの取得が終わらないと
 * 先へ進まない。実タイルを引くと CI の回線次第で遅く不安定になるので、
 * 背景切替のテストではここを止める（ベクタタイルは触らない）。
 */
export async function mockGsiRasterTiles(page: Page): Promise<void> {
  await page.route('**/cyberjapandata.gsi.go.jp/xyz/seamlessphoto/**', (route: Route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1X1 }),
  );
  await page.route('**/cyberjapandata.gsi.go.jp/xyz/hillshademap/**', (route: Route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1X1 }),
  );
}

export interface StyleInfo {
  sources: string[];
  firstLayer: string | null;
  terrain: boolean;
}

/**
 * 現在のスタイルの素性（背景の種類・地形の ON/OFF）を覗く。
 *
 * setStyle の最中は getStyle() が undefined を返す。その瞬間に当たったら null を返し、
 * 呼び出し側の expect.poll が待ち直せるようにする（例外にすると poll が打ち切られる）。
 */
export async function styleInfo(page: Page): Promise<StyleInfo | null> {
  return page.evaluate(() => {
    const m = (
      window as unknown as {
        __map: {
          getStyle(): { layers: { id: string }[]; sources: Record<string, unknown> } | undefined;
          getTerrain(): unknown;
        };
      }
    ).__map;
    const style = m.getStyle();
    if (!style) return null;
    return {
      sources: Object.keys(style.sources),
      firstLayer: style.layers[0]?.id ?? null,
      terrain: !!m.getTerrain(),
    };
  });
}

/** 地図の初期化完了を待つ */
export async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map?: { isStyleLoaded(): boolean } }).__map;
    return !!m && m.isStyleLoaded();
  });
  // load イベント後のデータ層追加が終わるまで
  await page.waitForFunction(() =>
    (window as unknown as { __map?: { getLayer(id: string): unknown } }).__map?.getLayer(
      'flood_l2_shinsuishin',
    ),
  );
}

/**
 * 現在のスタイルにおける、自前レイヤーの並び（下→上）。
 * setStyle の最中は空配列を返す（styleInfo と同じ理由）。
 */
export async function ownLayerOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const m = (
      window as unknown as { __map: { getStyle(): { layers: { id: string }[] } | undefined } }
    ).__map;
    const style = m.getStyle();
    if (!style) return [];
    return style.layers
      .map((l) => l.id)
      .filter((id) =>
        /^(suibou|flood_|hightide|tsunami|naisui|dosekiryu|kyukeis|jisuberi|nadare|100m_mesh|plateau-pmtiles|hinanbasho|denshouhi)/.test(
          id,
        ),
      );
  });
}
