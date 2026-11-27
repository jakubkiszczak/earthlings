import { expect, test } from '@playwright/test';
import { enterGame } from './helpers';

test('karczma: wejście przez portal, karczmarz mówi w dymku, wyjście; dym z komina', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await enterGame(page);
  await page.evaluate(() => window.__game!.peace(true));
  const door = (await page.evaluate(() => window.__game!.door('tavern')))!;
  expect(door).not.toBeNull();
  // przed karczmą (zrzut budynku z kominem i szyldem)
  await page.evaluate(([u, v]) => window.__game!.place(u - 20, v + 50), [door.u, door.v]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/karczma_zewn.png' });
  // portal przed drzwiami → wnętrze
  await page.evaluate(([u, v]) => { window.__game!.place(u, v + 30); window.__game!.goTo(u, v); }, [door.u, door.v]);
  await page.waitForFunction(() => window.__game!.cell().name.startsWith('Karczma') && !window.__game!.busy(), null, { timeout: 40_000 });
  expect(await page.evaluate(() => window.__game!.npcName())).toBe('Karczmarz Bogumił');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/karczma.png' });
  // rozmowa z karczmarzem – dymek
  await page.evaluate(() => window.__game!.talkToMerchant());
  await expect(page.locator('.wbubble')).toContainText('Karczmarz', { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/karczma_rozmowa.png' });
  // wyjście portalem → miasto
  expect(await page.evaluate(() => window.__game!.goTo(352, 292))).toBe(true);
  await page.waitForFunction(() => window.__game!.cell().name === 'Miasto' && !window.__game!.busy(), null, { timeout: 40_000 });
  expect(errors).toEqual([]);
});
