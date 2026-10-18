import { test, expect } from '@playwright/test';
import { watchErrors, hostRoom, resetLobby } from './util.js';

test('no console errors on host, join, xr pages and reset', async ({ page }) => {
  const errs = [];
  watchErrors(page, errs);
  await hostRoom(page);
  await resetLobby(page);
  await page.locator('[data-mode=chip]').click();
  await page.waitForTimeout(1500);
  for (const u of ['/join.html?room=DEMO&mode=rack', '/join.html?room=DEMO&mode=chip', '/xr.html?room=DEMO&mode=rack']) {
    await page.goto(u);
    await page.waitForTimeout(2500);
  }
  expect(errs).toEqual([]);
});
