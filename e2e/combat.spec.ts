import { expect, test, type Page } from '@playwright/test';
import { enterGame } from './helpers';

/** wejście na Łąki (wilki), bohater obok najbliższego wilka; zwraca id wilka */
async function nearWolf(page: Page): Promise<number> {
  await page.evaluate(() => window.__game!.warp(1, 0, 640, 640));
  await page.waitForFunction(() => window.__game!.cell().name === 'Łąki' && !window.__game!.busy() && window.__game!.mobs().length > 10, null, { timeout: 60_000 });
  const wolf = await page.evaluate(() => {
    const g = window.__game!;
    const w = g.mobs().filter((m) => m.kind === 'wolf').sort((a, b) => Math.hypot(a.u - 640, a.v - 640) - Math.hypot(b.u - 640, b.v - 640))[0];
    return w;
  });
  expect(wolf, 'na Łąkach są wilki').toBeTruthy();
  await page.evaluate(([u, v]) => window.__game!.place(u - 24, v), [wolf.u, wolf.v]);
  return wolf.id;
}

test('wojownik zabija wilka: obrażenia, exp, odrodzenie po śmierci w mieście', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await enterGame(page, 'Wojak');
  const id = await nearWolf(page);
  await page.evaluate((i) => window.__game!.attack(i), id);
  await page.evaluate(() => window.__game!.skill(0));      // super uderzenie
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/walka_wojownik.png' });
  await page.waitForFunction(() => window.__game!.player().kills >= 1, null, { timeout: 90_000 });
  const p = await page.evaluate(() => window.__game!.player());
  expect(p.exp).toBe(50);
  expect(p.mana).toBeLessThan(80);

  // śmierć → odrodzenie w mieście z pełnym zdrowiem
  await page.evaluate(() => window.__game!.hurt(99999));
  expect((await page.evaluate(() => window.__game!.player())).dead).toBe(true);
  await page.waitForFunction(() => window.__game!.cell().name === 'Miasto' && !window.__game!.player().dead, null, { timeout: 60_000 });
  const after = await page.evaluate(() => window.__game!.player());
  expect(after.hp).toBe(after.hpMax);
  expect(errors).toEqual([]);
});

test('łowca: strzały, podwójny strzał zużywa 2 strzały, odrzut', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await enterGame(page, 'Strzelec', 'elf', 'hunter');
  const id = await nearWolf(page);
  // wilk może zaatakować od razu (łowca odpowiada strzałami), więc liczymy od bieżącego stanu
  const arrows0 = (await page.evaluate(() => window.__game!.player())).arrows;
  expect(arrows0).toBeLessThanOrEqual(200);
  expect(arrows0).toBeGreaterThan(190);
  await page.evaluate((i) => window.__game!.attack(i), id);
  await page.evaluate(() => window.__game!.skill(0));      // podwójny strzał
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/walka_lowca.png' });
  await page.waitForFunction(() => window.__game!.player().kills >= 1, null, { timeout: 90_000 });
  const p = await page.evaluate(() => window.__game!.player());
  expect(p.arrows).toBeLessThanOrEqual(arrows0 - 2);
  expect(errors).toEqual([]);
});

test('odskok pod prawym przyciskiem myszy: 2 kafle, potem odnowienie 10 s', async ({ page }) => {
  test.setTimeout(120_000);
  await enterGame(page, 'Skoczek');
  await page.evaluate(() => window.__game!.peace(true));
  const before = await page.evaluate(() => window.__game!.hero());
  // kliknięcie prawym przyciskiem na lewo od postaci (na prawo stoi fontanna na placu)
  await page.mouse.click(280, 400, { button: 'right' });
  // poczekaj, aż odskok się skończy (w wolnej przeglądarce trwa dłużej niż 0,4 s)
  let after = await page.evaluate(() => window.__game!.hero());
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const p = await page.evaluate(() => window.__game!.hero());
    if (Math.hypot(p.u - after.u, p.v - after.v) < 0.5 && Math.hypot(p.u - before.u, p.v - before.v) > 1) break;
    after = p;
  }
  const d = Math.hypot(after.u - before.u, after.v - before.v);
  expect(d).toBeGreaterThan(40);
  expect(d).toBeLessThanOrEqual(66);
  expect(await page.evaluate(() => window.__game!.dashReady())).toBe(false);
  // drugi odskok od razu nie działa
  await page.mouse.click(1000, 400, { button: 'right' });
  await page.waitForTimeout(600);
  const again = await page.evaluate(() => window.__game!.hero());
  expect(Math.hypot(again.u - after.u, again.v - after.v)).toBeLessThan(2);
});

test('siedzenie: szybsza regeneracja, bez ataku, wstawanie po ataku potwora i klawiszem X', async ({ page }) => {
  test.setTimeout(120_000);
  await enterGame(page, 'Odpoczywa');
  await page.evaluate(() => window.__game!.hurt(150));
  await page.keyboard.press('x');
  expect(await page.evaluate(() => window.__game!.sitting())).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/siedzenie.png' });
  // 100/min w siadzie + regeneracja z Witalności (60/min) ≈ 2,7 HP/s (czas gry; wolna przeglądarka – dłużej)
  const hp0 = (await page.evaluate(() => window.__game!.player())).hp;
  await page.waitForFunction((h) => window.__game!.player().hp > h + 5, hp0, { timeout: 30_000 });
  // umiejętność w siadzie nie działa
  await page.keyboard.press('1');
  await expect(page.locator('.floats')).toContainText('Wstań');
  // X – wstaje
  await page.keyboard.press('x');
  expect(await page.evaluate(() => window.__game!.sitting())).toBe(false);
  // obrażenia stawiają na nogi
  await page.keyboard.press('x');
  await page.evaluate(() => window.__game!.hurt(1));
  expect(await page.evaluate(() => window.__game!.sitting())).toBe(false);
});
