import { expect, test } from '@playwright/test';
import { enterGame } from './helpers';

test('obrót widoku co 90°: 4 widoki miasta, postać zostaje w miejscu i może chodzić', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await enterGame(page);
  await page.evaluate(() => window.__game!.peace(true));
  const start = await page.evaluate(() => window.__game!.hero());
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('.');
    await page.waitForFunction((r) => window.__game!.rot() === r % 4 && !window.__game!.busy(), i, { timeout: 60_000 });
    const h = await page.evaluate(() => window.__game!.hero());
    expect(Math.hypot(h.u - start.u, h.v - start.v)).toBeLessThan(1);
    if (i < 4) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `test-results/obrot_${i}.png` });
      // chodzenie w obróconym widoku (kliknięcie → mapa wyboru w układzie świata)
      expect(await page.evaluate(([u, v]) => window.__game!.goTo(u + 40, v), [start.u, start.v])).toBe(true);
      await page.waitForTimeout(1500);
      await page.evaluate(([u, v]) => window.__game!.place(u, v), [start.u, start.v]);
    }
  }
  expect(errors).toEqual([]);
});
