import { expect, test, type Page } from '@playwright/test';
import {
  mockGsiRasterTiles,
  mockSuibouNavi,
  ownLayerOrder,
  styleInfo,
  waitForMap,
} from './fixtures';

const VIEW = '#13.5/35.7620/139.8000/0/0';

// 背景の切替は setStyle(diff:false) → idle → データ層の再追加、という順で進む。
// 描画が落ち着くまで数秒かかるので、待ちは長めに取る。
const REBUILD = { timeout: 30_000 };

const basemapButton = (page: Page, base: 'pale' | 'photo') =>
  page.locator(`.basemap-switch button[data-base="${base}"]`);

// TerrainControl は ON/OFF で class を付け足すのではなく
// maplibregl-ctrl-terrain ⇄ maplibregl-ctrl-terrain-enabled に置き換える
const terrainButton = (page: Page) => page.locator('[class^="maplibregl-ctrl-terrain"]');

test.beforeEach(async ({ page }) => {
  await mockSuibouNavi(page);
  await mockGsiRasterTiles(page);
  await page.goto(`/${VIEW}`);
  await waitForMap(page);
});

test('写真に切り替えるとラスタ背景になり、自前レイヤーが同じ並びで戻る', async ({ page }) => {
  await page.locator('.layer-item[data-key="tsunami_newlegend"] .switch').click();
  const before = await ownLayerOrder(page);

  await basemapButton(page, 'photo').click();
  await expect(basemapButton(page, 'photo')).toHaveAttribute('aria-selected', 'true');
  await expect(basemapButton(page, 'pale')).toHaveAttribute('aria-selected', 'false');

  // ラスタ（写真）へ完全に入れ替わる。diff 適用では背景が残ってしまう箇所
  await expect.poll(async () => (await styleInfo(page)).firstLayer, REBUILD).toBe('photo');
  const info = await styleInfo(page);
  expect(info.sources).toContain('photo');
  // 淡色専用の陰影起伏は写真には重ねない
  expect(info.sources).not.toContain('hillshade');

  // 表示中だったレイヤーが、同じ重ね順で戻る
  await expect
    .poll(async () => (await ownLayerOrder(page)).join(','), REBUILD)
    .toBe(before.join(','));
});

test('写真から地図へ戻すと、ベクタ背景と陰影起伏が復帰する', async ({ page }) => {
  await basemapButton(page, 'photo').click();
  await expect.poll(async () => (await styleInfo(page)).firstLayer, REBUILD).toBe('photo');

  await basemapButton(page, 'pale').click();
  await expect(basemapButton(page, 'pale')).toHaveAttribute('aria-selected', 'true');

  // スタイルの差し替えより、データ層の再追加（idle 後）のほうが遅い。
  // 再構築の最後まで進んだことを、自前レイヤーの復帰で見る
  await expect
    .poll(async () => (await ownLayerOrder(page)).includes('flood_l2_shinsuishin'), REBUILD)
    .toBe(true);

  const info = await styleInfo(page);
  expect(info.sources).toContain('hillshade');
  expect(info.sources).not.toContain('photo');
});

test('地形ONのまま背景を切り替えても地形は残る', async ({ page }) => {
  // 地形は既定でON
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(true);

  await basemapButton(page, 'photo').click();
  await expect.poll(async () => (await styleInfo(page)).firstLayer, REBUILD).toBe('photo');
  // setStyle は terrain を落とすので、再構築後に復元されることを見る
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(true);
});

test('地形をOFFにしてから背景を切り替えても、OFFのままになる', async ({ page }) => {
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(true);

  await terrainButton(page).click();
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(false);

  await basemapButton(page, 'photo').click();
  await expect.poll(async () => (await styleInfo(page)).firstLayer, REBUILD).toBe('photo');

  // 再構築中の terrain 消失を「利用者がOFFにした」と取り違えないこと。
  // 勝手にONへ戻らないかを見たいので、しばらく観察してから確かめる
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(false);
  await page.waitForTimeout(2000);
  expect((await styleInfo(page)).terrain).toBe(false);
});

test('テーマを切り替えても地形の ON/OFF は保たれる', async ({ page }) => {
  await terrainButton(page).click();
  await expect.poll(async () => (await styleInfo(page)).terrain, REBUILD).toBe(false);

  await page.locator('#theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect.poll(async () => (await ownLayerOrder(page)).length, REBUILD).toBeGreaterThan(0);
  expect((await styleInfo(page)).terrain).toBe(false);
});
