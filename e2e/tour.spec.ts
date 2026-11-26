import { expect, test } from '@playwright/test';

// Wycieczka po 9 komórkach: każda się wczytuje, ma przechodni teren w środku, zrzut ekranu do oceny.
test('wszystkie komórki świata 3×3 wczytują się bez błędów', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__ready === true);
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
    await page.evaluate(([x, y]) => window.__game!.warp(x, y, 640, 520), [cx, cy]);
    await page.waitForFunction(([x, y]) => { const c = window.__game!.cell(); return c.cx === x && c.cy === y && !window.__game!.busy(); }, [cx, cy]);
    // w pobliżu środka da się dokądś pójść
    const ok = await page.evaluate(() => [[700, 600], [560, 460], [720, 420], [500, 640]].some(([u, v]) => window.__game!.goTo(u, v)));
    expect(ok, `komórka ${cx},${cy}: brak drogi w pobliżu środka`).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/komorka_${cx}${cy}.png` });
  }
  expect(errors).toEqual([]);
});
