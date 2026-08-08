import { expect, test } from '@playwright/test';
import { mockSuibouNavi, ownLayerOrder, waitForMap } from './fixtures';

// 東京・荒川下流。ハザードのデータが確実にある場所
const VIEW = '#13.5/35.7620/139.8000/0/0';

test.beforeEach(async ({ page }) => {
  await mockSuibouNavi(page);
  await page.goto(`/${VIEW}`);
  await waitForMap(page);
});

test('初期表示は洪水（想定最大規模）のみで、凡例と不透明度が出る', async ({ page }) => {
  const item = page.locator('.layer-item[data-key="flood_l2_shinsuishin"]');
  await expect(item.locator('input[type="checkbox"]')).toBeChecked();
  await expect(item.locator('.layer-legend')).toBeVisible();
  await expect(item.locator('.layer-opacity')).toBeVisible();

  // 他のハザードは載っていない
  await expect(
    page.locator('.layer-item[data-key="tsunami_newlegend"] input[type="checkbox"]'),
  ).not.toBeChecked();
});

test('ハザードは複数重ねられ、重ね順は設定の並びに従う', async ({ page }) => {
  await page.locator('.layer-item[data-key="tsunami_newlegend"] .switch').click();
  await page.locator('.layer-item[data-key="dosekiryukeikaikuiki"] .switch').click();

  const order = await ownLayerOrder(page);
  const idx = (id: string) => order.indexOf(id);

  // config の並び: 洪水 → 土石流 → 津波。後ろほど前面
  expect(idx('flood_l2_shinsuishin')).toBeGreaterThanOrEqual(0);
  expect(idx('dosekiryukeikaikuiki')).toBeGreaterThan(idx('flood_l2_shinsuishin'));
  expect(idx('tsunami_newlegend')).toBeGreaterThan(idx('dosekiryukeikaikuiki'));
  // 人口・3D建物・ピンはハザードより前面
  expect(idx('plateau-pmtiles')).toBeGreaterThan(idx('tsunami_newlegend'));
  expect(idx('hinanbasho')).toBeGreaterThan(idx('plateau-pmtiles'));
});

test('避難場所の絞り込みは表示中ハザードの論理和になる', async ({ page }) => {
  const filter = () =>
    page.evaluate(() => {
      const m = (window as unknown as { __map: { getFilter(id: string): unknown } }).__map;
      return JSON.stringify(m.getFilter('hinanbasho'));
    });

  expect(await filter()).toContain('洪水');

  await page.locator('.layer-item[data-key="tsunami_newlegend"] .switch').click();
  const both = await filter();
  expect(both).toContain('any');
  expect(both).toContain('津波');

  // 全OFF で絞り込み解除（setFilter(undefined) なので getFilter も undefined）
  await page.locator('#hazard-all-off').click();
  expect(await filter()).toBeUndefined();
});

test('不透明度はレイヤーごとに保持される', async ({ page }) => {
  const opacity = (id: string) =>
    page.evaluate(
      (layerId) =>
        (
          window as unknown as {
            __map: { getPaintProperty(id: string, p: string): number };
          }
        ).__map.getPaintProperty(layerId, 'raster-opacity'),
      id,
    );

  await page.locator('.layer-item[data-key="flood_l2_shinsuishin"] input[type="range"]').fill('30');
  expect(await opacity('flood_l2_shinsuishin')).toBeCloseTo(0.3);

  // 別のハザードを足しても既定値のまま
  await page.locator('.layer-item[data-key="tsunami_newlegend"] .switch').click();
  expect(await opacity('tsunami_newlegend')).toBeCloseTo(0.8);
  expect(await opacity('flood_l2_shinsuishin')).toBeCloseTo(0.3);
});

test('テーマを切り替えても表示中のレイヤーと重ね順が復元される', async ({ page }) => {
  await page.locator('.layer-item[data-key="tsunami_newlegend"] .switch').click();
  const before = await ownLayerOrder(page);

  await page.locator('#theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // setStyle(diff:false) 後の再構築を待つ
  await expect
    .poll(async () => (await ownLayerOrder(page)).join(','), { timeout: 30000 })
    .toBe(before.join(','));
});
