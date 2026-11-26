import { expect, test } from '@playwright/test';

test('gra startuje w mieście, postać idzie, przejście do sąsiedniej komórki, brak błędów', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`błąd pobrania: ${r.url()}`));

  await page.goto('/');
  await page.waitForFunction(() => window.__ready === true);
  await expect(page.locator('.fatal')).toHaveCount(0);
  await expect(page.locator('#hud .skill')).toHaveCount(8);
  expect(await page.evaluate(() => window.__game!.cell())).toMatchObject({ cx: 1, cy: 1, name: 'Miasto' });
  await expect(page.locator('.mmlabel')).toHaveText('Miasto');

  // klik obok bohatera → bohater rusza
  const before = await page.evaluate(() => window.__game!.hero());
  await page.mouse.click(760, 470);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__game!.hero());
  expect(Math.hypot(after.u - before.u, after.v - before.v)).toBeGreaterThan(3);

  await page.keyboard.press('i');
  await expect(page.locator('.inv')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/miasto.png' });

  // wschodnia brama (droga wzdłuż u): przejście do komórki (2,1)
  await page.evaluate(() => { window.__game!.place(1250, 640); });
  expect(await page.evaluate(() => window.__game!.goTo(1300, 640))).toBe(true);
  await page.waitForFunction(() => window.__game!.cell().cx === 2 && !window.__game!.busy(), null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__game!.cell())).toMatchObject({ cx: 2, cy: 1, name: 'Wzgórza' });
  const h = await page.evaluate(() => window.__game!.hero());
  expect(h.u).toBeGreaterThanOrEqual(0);
  expect(h.u).toBeLessThan(120);
  await expect(page.locator('.mmlabel')).toHaveText('Wzgórza');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/wzgorza.png' });

  expect(errors).toEqual([]);
});
