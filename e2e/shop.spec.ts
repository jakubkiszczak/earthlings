import { expect, test } from '@playwright/test';

test('wejście do sklepu przez portal, kupiec, wyjście portalem; kontur za budynkiem', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready === true);

  // za sklepem (od strony -u) bohater jest zasłonięty → widać kontur
  const shop = await page.evaluate(() => window.__game!.shop());
  await page.evaluate(([u, v]) => window.__game!.place(u, v), [shop.u - 16 - 112 - 14, shop.v - 30]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/kontur.png' });
  expect(await page.evaluate(() => window.__game!.outlines())).toBeGreaterThan(0);
  // na placu nic nie zasłania
  await page.evaluate(([u, v]) => window.__game!.place(u, v), [shop.u + 90, shop.v + 60]);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game!.outlines())).toBe(0);

  // portal przed drzwiami → wnętrze sklepu
  await page.evaluate(([u, v]) => { window.__game!.place(u + 30, v); window.__game!.goTo(u, v); }, [shop.u, shop.v]);
  await page.waitForFunction(() => window.__game!.cell().name === 'Sklep' && !window.__game!.busy(), null, { timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/sklep.png' });

  // wyjście portalem → miasto
  const ok = await page.evaluate(() => window.__game!.goTo(290, 222));
  expect(ok).toBe(true);
  await page.waitForFunction(() => window.__game!.cell().name === 'Miasto' && !window.__game!.busy(), null, { timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/po_wyjsciu.png' });
  expect(errors).toEqual([]);
});
