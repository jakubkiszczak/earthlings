import type { Page } from '@playwright/test';

/** wejście do gry z pominięciem kreatora: postać testowa (tworzona przy pierwszym użyciu) */
export async function enterGame(page: Page, name = "Tester", race: "human" | "elf" = "human", cls: "warrior" | "hunter" = "warrior") {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__menu);
  await page.evaluate(([n, r, c]) => window.__menu!.quickPlay(n, r as never, c as never), [name, race, cls]);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
}
