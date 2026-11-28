import { expect, test } from '@playwright/test';
import { enterGame } from './helpers';

test('miasto: strażnicy bronią bram, skrzynia przy fontannie, wnętrze sklepu', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await enterGame(page, 'Mieszczanin');
  await page.evaluate(() => window.__game!.peace(true));
  expect(await page.evaluate(() => window.__game!.guards().length)).toBe(8);
  // mieszkańcy: młoda kobieta i dziadek, kliknięcie → kwestia na czacie
  const folk = await page.evaluate(() => window.__game!.folk());
  expect(folk.map((f) => f.name).sort()).toEqual(['Dziadek Ostromir', 'Liwia']);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/miasto_fontanna.png' });

  // skrzynia: przedmiot z plecaka do skrzyni; zapis wspólny dla konta (osobny klucz)
  await page.evaluate(() => window.__game!.give('helm2'));
  await page.evaluate(() => window.__game!.openStash());
  await page.waitForFunction(() => window.__game!.stashOpen(), null, { timeout: 60_000 });
  await page.locator('.stash [data-move^="bag:"]').filter({ hasText: 'Żelazny hełm' }).click();
  await expect(page.locator('.stash [data-move^="stash:"]')).toContainText('Żelazny hełm');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('glastemia.stash')!).items)).toContain('helm2');
  await page.screenshot({ path: 'test-results/skrzynia.png' });
  await page.keyboard.press('Escape');

  // strażnik: potwór podprowadzony pod wschodnią bramę ginie
  await page.evaluate(() => window.__game!.warp(2, 1, 60, 640));
  await page.waitForFunction(() => window.__game!.cell().cx === 2 && !window.__game!.busy() && window.__game!.mobs().length > 5, null, { timeout: 60_000 });
  const mob = await page.evaluate(() => window.__game!.mobs()[0]);
  const g = await page.evaluate(() => window.__game!.guards().sort((a, b) => b.u - a.u)[0]);
  await page.evaluate(([id, u, v]) => window.__game!.moveMob(id, u + 40, v), [mob.id, g.u, g.v]);
  await page.waitForFunction((id) => window.__game!.mobState(id) === 'dead', mob.id, { timeout: 60_000 });
  await page.screenshot({ path: 'test-results/straznik.png' });

  // wnętrze sklepu z wyposażeniem; wejście i wyjście bez ekranu wczytywania (krótkie wygaszenie)
  let sawLoading = false;
  await page.exposeFunction('__sawLoading', () => { sawLoading = true; });
  await page.evaluate(() => {
    const ls = document.querySelector('.loading-screen')!;
    new MutationObserver(() => { if (ls.classList.contains('on')) (window as unknown as { __sawLoading(): void }).__sawLoading(); }).observe(ls, { attributes: true });
  });
  await page.evaluate(() => { void window.__game!.warp(1, 1, 200, 140); });
  await page.waitForFunction(() => window.__game!.cell().cx === 1 && !window.__game!.busy(), null, { timeout: 60_000 });
  sawLoading = false;
  await page.evaluate(() => { void window.__game!.warp(100, 100, 200, 140); });
  await page.waitForFunction(() => window.__game!.cell().name === 'Sklep' && !window.__game!.busy(), null, { timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/sklep_wnetrze.png' });
  const t0 = Date.now();
  await page.evaluate(() => { void window.__game!.warp(1, 1, 200, 140); });
  await page.waitForFunction(() => window.__game!.cell().cx === 1 && !window.__game!.busy(), null, { timeout: 60_000 });
  expect(Date.now() - t0).toBeLessThan(3000);    // miasto zostało w pamięci
  expect(sawLoading).toBe(false);
  expect(errors).toEqual([]);
});
