import { expect, test } from '@playwright/test';
import { mockSuibouNavi, waitForMap } from './fixtures';

const VIEW = '#13.5/35.7620/139.8000/0/0';

test.beforeEach(async ({ page }) => {
  await mockSuibouNavi(page);
});

test('スケールバーは左下にあり、パネルと重ならない', async ({ page }) => {
  await page.goto(`/${VIEW}`);
  await waitForMap(page);

  const scale = page.locator('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale');
  await expect(scale).toBeVisible();

  const s = (await scale.boundingBox())!;
  const panel = (await page.locator('#panel').boundingBox())!;
  const view = page.viewportSize()!;

  // パネルの右端より外側にある
  expect(s.x).toBeGreaterThanOrEqual(panel.x + panel.width);
  // 画面の下寄り・左寄りにある
  expect(s.y + s.height).toBeGreaterThan(view.height * 0.8);
  expect(s.x).toBeLessThan(view.width / 2);
});

test('パネルを畳むとスケールバーは地図の隅へ戻る', async ({ page }) => {
  await page.goto(`/${VIEW}`);
  await waitForMap(page);

  const scale = page.locator('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale');
  const before = (await scale.boundingBox())!;

  await page.locator('#collapse-btn').click();
  await expect(page.locator('#panel')).toHaveClass(/collapsed/);

  await expect.poll(async () => (await scale.boundingBox())!.x).toBeLessThan(before.x);
});

test('既定の視点は 2D', async ({ page }) => {
  // ハッシュを付けずに開く（＝URL 指定ではなくアプリの既定値を見る）
  await page.goto('/');
  await waitForMap(page);

  expect(
    await page.evaluate(() =>
      (window as unknown as { __map: { getPitch(): number } }).__map.getPitch(),
    ),
  ).toBe(0);
  await expect(page.locator('#pitch-seg button[data-mode="2d"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#pitch-seg button[data-mode="3d"]')).toHaveAttribute(
    'aria-selected',
    'false',
  );
});
