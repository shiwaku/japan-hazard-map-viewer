import { expect, test } from '@playwright/test';
import { mockSuibouNavi, ownLayerOrder, waitForMap } from './fixtures';

const VIEW = '#13.5/35.7620/139.8000/0/0';

/** 浸水シミュレーションを ON にして、地図クリックで破堤点を検索する */
async function searchBreakPoints(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#suibou .layer-item .switch').first().click();
  await page.locator('#map').click({ position: { x: 700, y: 400 } });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __suibou: { breakPoints: unknown[] } }).__suibou.breakPoints
            .length,
      ),
    )
    .toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await mockSuibouNavi(page);
  await page.goto(`/${VIEW}`);
  await waitForMap(page);
});

test('モードONで破堤点レイヤーと検索可能範囲が載る', async ({ page }) => {
  await page.locator('#suibou .layer-item .switch').first().click();

  const order = await ownLayerOrder(page);
  expect(order).toContain('suibou-points');
  // 検索可能範囲は既定ONで、ハザードより下
  expect(order.indexOf('suibou-range')).toBe(0);
  // 破堤点は地名ラベルより前面（＝ピンの直前）
  expect(order.indexOf('suibou-points')).toBeGreaterThan(order.indexOf('plateau-pmtiles'));
});

test('破堤点を検索して選ぶと、時系列レイヤーがハザードの上に入る', async ({ page }) => {
  await searchBreakPoints(page);
  await expect(page.locator('.suibou-status')).toContainText('3件');

  // 「最大浸水の破堤点を選ぶ」ショートカット
  await expect(page.locator('.suibou-suggest')).toBeVisible();
  await page.locator('.suibou-suggest').click();

  await expect(page.locator('.suibou-title')).toHaveText('荒川 BP168');
  await expect(page.locator('.suibou-badge.is-depth')).toBeVisible();
  await expect(page.locator('.suibou-time-label')).toContainText('10分');

  const order = await ownLayerOrder(page);
  const ts = order.find((id) => id.startsWith('suibou-ts-'));
  expect(ts).toBeTruthy();
  expect(order.indexOf(ts!)).toBeGreaterThan(order.indexOf('flood_l2_shinsuishin'));
  expect(order.indexOf(ts!)).toBeLessThan(order.indexOf('plateau-pmtiles'));
});

test('経過時間スライダーは BPTime の刻みで動き、常にタイルが存在する', async ({ page }) => {
  await searchBreakPoints(page);
  await page.locator('.suibou-suggest').click();

  const slider = page.locator('.suibou-time input[type="range"]');
  // BPTime は 9 要素 → インデックス 0..8
  await expect(slider).toHaveAttribute('max', '8');

  await slider.fill('5');
  await expect(page.locator('.suibou-time-label')).toContainText('3時間');

  // 時系列レイヤーは常に 1 枚だけ（メモリ対策）
  const count = (await ownLayerOrder(page)).filter((id) => id.startsWith('suibou-ts-')).length;
  expect(count).toBe(1);
});

test('再生は末尾で自動停止する', async ({ page }) => {
  await searchBreakPoints(page);
  // BPTime が 4 要素の BP199 を選ぶ（再生テストを短く終わらせるため）
  await selectBreakPointByName(page, 'BP199');

  const play = page.locator('.suibou-controls .mini-btn');
  await play.click();
  await expect(play).toHaveText('■ 停止');

  // BPTime が 4 要素の破堤点なので 3 ステップ（2秒間隔）で終わる
  await expect(play).toHaveText('▶ 再生', { timeout: 20000 });
  await expect(page.locator('.suibou-time-label')).toContainText('3時間');
});

/**
 * 破堤点を名前で選ぶ。
 * 「実際に描画されている」フィーチャの座標をクリックする（合成イベントでは
 * MapLibre のハンドラが反応せず、state の座標だけでは描画前に外すことがある）。
 */
async function selectBreakPointByName(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  const pt = await page.evaluate((target) => {
    const m = (
      window as unknown as {
        __map: {
          queryRenderedFeatures(o: { layers: string[] }): {
            properties: { name: string };
            geometry: { coordinates: [number, number] };
          }[];
          project(c: [number, number]): { x: number; y: number };
        };
      }
    ).__map;
    const f = m
      .queryRenderedFeatures({ layers: ['suibou-points'] })
      .find((x) => x.properties.name === target);
    if (!f) return null;
    const q = m.project(f.geometry.coordinates);
    return { x: Math.round(q.x), y: Math.round(q.y) };
  }, name);

  expect(pt, `${name} が描画されていない`).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
  await expect(page.locator('.suibou-title')).toContainText(name);
}

test('河川で絞り込める', async ({ page }) => {
  await searchBreakPoints(page);

  const select = page.locator('.suibou-river select');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveCount(3); // すべて / 荒川 / 中川

  await select.selectOption('中川');
  const filter = await page.evaluate(() =>
    JSON.stringify(
      (window as unknown as { __map: { getFilter(id: string): unknown } }).__map.getFilter(
        'suibou-points',
      ),
    ),
  );
  expect(filter).toContain('中川');
});

test('浸水深ポップアップに3つの値が出る', async ({ page }) => {
  await searchBreakPoints(page);
  await page.locator('.suibou-suggest').click();

  // 破堤点から離れた場所をクリック
  await page.locator('#map').click({ position: { x: 1000, y: 250 } });

  const popup = page.locator('.suibou-popup .maplibregl-popup-content');
  await expect(popup).toContainText('2.13 m');
  await expect(popup).toContainText('3.43 m');
  await expect(popup).toContainText('25分');
});

test('破堤点が無い地点では検索可能範囲への案内を出す', async ({ page, context }) => {
  await context.unroute('**/suiboumap.gsi.go.jp/**').catch(() => undefined);
  await mockSuibouNavi(page, { breakPoints: [] });

  await page.locator('#suibou .layer-item .switch').first().click();
  await page.locator('#map').click({ position: { x: 700, y: 400 } });

  await expect(page.locator('.suibou-status')).toContainText('登録されていません');
  // 検索可能範囲は既定ONなので、その中をクリックするよう案内される
  await expect(page.locator('.suibou-status')).toContainText('検索可能範囲');
});
