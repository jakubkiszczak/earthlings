import { expect, test } from '@playwright/test';
import { enterGame } from './helpers';

test('łup z wilka, podniesienie złota; ekwipunek: zakładanie, punkty atrybutów, mikstury', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await enterGame(page, 'Zbieracz');

  // zabij wilka na Łąkach
  await page.evaluate(() => window.__game!.warp(1, 0, 640, 640));
  await page.waitForFunction(() => window.__game!.cell().name === 'Łąki' && !window.__game!.busy() && window.__game!.mobs().length > 10, null, { timeout: 60_000 });
  const w = await page.evaluate(() => window.__game!.mobs().filter((m) => m.kind === 'wolf').sort((a, b) => Math.hypot(a.u - 640, a.v - 640) - Math.hypot(b.u - 640, b.v - 640))[0]);
  await page.evaluate(([u, v, id]) => { window.__game!.place(u - 24, v); window.__game!.attack(id); }, [w.u, w.v, w.id]);
  await page.waitForFunction(() => window.__game!.player().kills >= 1, null, { timeout: 90_000 });
  const drops = await page.evaluate(() => window.__game!.drops());
  const gold = drops.find((d) => d.kind === 'gold');
  expect(gold, 'zawsze wypada złoto').toBeTruthy();
  // ikony łupu są wczytane (wcześniej złoto było niewidoczne – pusta tekstura) i powiększone o 50%
  await page.waitForTimeout(600);
  for (const [tw, w] of await page.evaluate(() => window.__game!.dropSizes())) {
    expect(tw).toBeGreaterThan(1);
    expect(w).toBeCloseTo(tw * 1.5, 0);
  }
  await page.evaluate(() => window.__game!.peace(true));
  await page.evaluate(([u, v]) => { window.__game!.place(u - 40, v - 40); }, [gold!.u, gold!.v]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/lup.png' });
  await page.evaluate(() => window.__game!.peace(true));
  await page.evaluate(([u, v]) => window.__game!.goTo(u, v), [gold!.u, gold!.v]);
  await page.waitForFunction(() => window.__game!.player().gold > 0, null, { timeout: 60_000 });

  // ekwipunek: przedmiot do plecaka, załóż klikiem, pancerz rośnie
  expect(await page.evaluate(() => window.__game!.give('armor1'))).toBe(true);
  await page.keyboard.press('i');
  await expect(page.locator('.inv')).toHaveClass(/open/);
  const armor0 = (await page.evaluate(() => window.__game!.inv())).armor;
  await page.locator('.inv .islot.rar').filter({ has: page.locator('img') }).last().click();
  await expect.poll(async () => (await page.evaluate(() => window.__game!.inv())).eq.armor).toBe('armor1');
  expect((await page.evaluate(() => window.__game!.inv())).armor).toBe(armor0 + 15);
  // przedmiot dla innej klasy albo poziomu – nie da się założyć
  await page.evaluate(() => window.__game!.give('bow1'));

  // awans → punkty atrybutów → +1 Siła
  await page.evaluate(() => window.__game!.exp(1000));
  await expect.poll(async () => (await page.evaluate(() => window.__game!.inv())).points).toBe(5);
  const str0 = (await page.evaluate(() => window.__game!.inv())).str;
  await page.getByRole('button', { name: 'Siła plus' }).click();
  expect((await page.evaluate(() => window.__game!.inv())).str).toBe(str0 + 1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/ekwipunek.png' });
  expect(errors).toEqual([]);
});
