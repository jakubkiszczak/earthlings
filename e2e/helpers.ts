import type { Page } from '@playwright/test';

/** wejście do gry z pominięciem kreatora: postać testowa (tworzona przy pierwszym użyciu) */
export async function enterGame(page: Page, name = 'Tester') {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__menu);
  await page.evaluate((n) => window.__menu!.quickPlay(n), name);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
}
