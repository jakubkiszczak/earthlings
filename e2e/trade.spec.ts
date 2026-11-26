import { expect, test } from '@playwright/test';
import { enterGame } from './helpers';

test('sklep: kupiec, kupno strzał i butów, sprzedaż przedmiotu', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await enterGame(page, 'Kupujacy', 'elf', 'hunter');
  await page.evaluate(() => window.__game!.peace(true));
  // złoto ze sprzedaży: dajemy zbroję płytową (wartość 600 → 150 zł) i sprzedajemy ją
  await page.evaluate(() => window.__game!.give('armor3'));
  await page.evaluate(() => window.__game!.warp(100, 100, 200, 160));
  await page.waitForFunction(() => window.__game!.cell().name === 'Sklep' && !window.__game!.busy(), null, { timeout: 60_000 });
  await page.evaluate(() => window.__game!.talkToMerchant());
  await page.waitForFunction(() => window.__game!.shopOpen(), null, { timeout: 60_000 });
  await expect(page.locator('.shop .shead')).toContainText('Kupiec');
  await page.screenshot({ path: 'test-results/sklep_handel.png' });

  const gold0 = (await page.evaluate(() => window.__game!.player())).gold;
  await page.locator('.shop [data-sell^="bag:"]').filter({ hasText: 'Zbroja płytowa' }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__game!.player())).gold).toBe(gold0 + 150);

  // strzały: +100 za 10 zł
  const a0 = (await page.evaluate(() => window.__game!.player())).arrows;
  await page.locator('.shop [data-buy="arrows"]').click();
  await expect.poll(async () => (await page.evaluate(() => window.__game!.player())).arrows).toBe(a0 + 100);
  // buty za 50 zł → w plecaku; na Buty wędrowca (250) brakuje złota – przycisk wyłączony
  await page.locator('.shop [data-buy="boots1"]').click();
  await expect.poll(async () => (await page.evaluate(() => window.__game!.inv())).bag).toContain('boots1');
  await expect(page.locator('.shop [data-buy="boots2"]')).toBeDisabled();
  expect((await page.evaluate(() => window.__game!.player())).gold).toBe(gold0 + 150 - 10 - 50);
  await page.screenshot({ path: 'test-results/sklep_po_zakupach.png' });

  // Esc zamyka okno
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__game!.shopOpen())).toBe(false);
  expect(errors).toEqual([]);
});
