import { expect, test } from '@playwright/test';

test('gra startuje, postać idzie po kliknięciu, brak błędów w konsoli', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`404/błąd: ${r.url()}`));

  await page.goto('/');
  await page.waitForFunction(() => window.__ready === true);
  await expect(page.locator('.fatal')).toHaveCount(0);
  await expect(page.locator('#hud .skill')).toHaveCount(8);

  // klik w trawę po prawej od bohatera → bohater rusza (zmienia się pozycja tabliczki z imieniem)
  const plate = page.locator('.nameplate');
  const before = await plate.evaluate((e) => e.style.transform);
  await page.mouse.click(900, 500);
  await page.waitForTimeout(1500);
  const after = await plate.evaluate((e) => e.style.transform);
  expect(after).not.toBe(before);

  await page.keyboard.press('i');
  await expect(page.locator('.inv')).toHaveClass(/open/);

  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});
