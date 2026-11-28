import { expect, test } from '@playwright/test';

test('ekran startowy → kreator → gra; zapis postaci i usuwanie', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.logo')).toHaveText('Glastemia');
  await page.screenshot({ path: 'test-results/menu_start.png' });
  await page.getByRole('button', { name: 'Graj' }).click();
  await expect(page.locator('.slot.empty')).toHaveCount(3);
  await page.getByRole('button', { name: 'Nowa postać' }).click();

  // kreator: bez budowy ciała; kolor skóry, fryzura, kolor włosów, broda
  await expect(page.getByText('Budowa ciała')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zarost', exact: true }).click();
  await expect(page.locator('.opt.on', { hasText: 'Zarost' })).toHaveCount(1);
  // elfka łowczyni, kok, blond, jasna skóra; broda zablokowana (elfy i kobiety)
  await page.getByRole('button', { name: 'Elf' }).click();
  await page.getByRole('button', { name: 'Łowca' }).click();
  await page.getByRole('button', { name: 'Kobieta' }).click();
  await page.getByRole('button', { name: 'Kok', exact: true }).click();
  await page.getByRole('button', { name: 'Blond' }).first().click();
  await expect(page.locator('.opt.on', { hasText: 'Jasna' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Długa', exact: true })).toBeDisabled();
  // bez nazwy i bez rozdzielonych punktów – błędy
  await page.getByRole('button', { name: 'Utwórz postać' }).click();
  await expect(page.locator('.err')).toContainText('3 znaki');
  await page.getByLabel('Nazwa postaci').fill('Lirael');
  await page.getByRole('button', { name: 'Utwórz postać' }).click();
  await expect(page.locator('.err')).toContainText('Rozdziel');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zręczność plus' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Energia plus' }).click();
  await expect(page.getByRole('button', { name: 'Siła plus' })).toBeDisabled();
  await expect(page.locator('.points b')).toHaveText('0');
  await expect(page.locator('.csum')).toContainText('Zdrowie 250');   // elf łowca: Witalność 15 → 250 HP
  await page.screenshot({ path: 'test-results/menu_kreator.png' });
  await page.getByRole('button', { name: 'Utwórz postać' }).click();

  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  await expect(page.locator('.pname')).toContainText('Lirael');
  await expect(page.locator('.pname')).toContainText('Elf · Łowca · poz. 1');
  const look = await page.evaluate(() => JSON.parse(localStorage.getItem('earthlings.saves')!).chars[0].look);
  expect(look).toMatchObject({ gender: 'female', hair: 'bun', hairColor: 'blond', beard: 'none', skin: 'fair' });
  await page.screenshot({ path: 'test-results/menu_gra.png' });

  // zapis: po odświeżeniu postać jest na liście, z zapisaną pozycją
  await page.evaluate(() => window.__game!.place(700, 600));
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.getByRole('button', { name: 'Graj' }).click();
  await expect(page.locator('.slot .sname')).toHaveText(['Lirael']);
  await page.screenshot({ path: 'test-results/menu_wybor.png' });
  await page.getByRole('button', { name: 'Wejdź do gry' }).click();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  const h = await page.evaluate(() => window.__game!.hero());
  expect(Math.round(h.u)).toBe(700);

  // usuwanie z potwierdzeniem
  await page.reload();
  await page.getByRole('button', { name: 'Graj' }).click();
  await page.getByRole('button', { name: 'Usuń', exact: true }).click();
  await page.getByRole('button', { name: 'Usuń na zawsze' }).click();
  await expect(page.locator('.slot.empty')).toHaveCount(3);
  expect(errors).toEqual([]);
});
