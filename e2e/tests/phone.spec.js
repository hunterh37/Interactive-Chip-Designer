import { test, expect } from '@playwright/test';
import { hostRoom, resetLobby, statRow, joinAs, paint, addPart } from './util.js';

async function host(browser, baseURL) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const h = await ctx.newPage(); await hostRoom(h); await resetLobby(h); return { ctx, h };
}

test('chip challenge: name → brief → design → tape out → result rank', async ({ page, browser, baseURL }) => {
  const { ctx, h } = await host(browser, baseURL);
  await joinAs(page, 'ADA');
  await page.locator('#go-chip').click();
  await page.locator('#begin').click();
  await paint(page, 'tensor', [0, 1, 2, 3]);
  await paint(page, 'hbm', [8]);
  await paint(page, 'io', [9]);
  await paint(page, 'cpu', [10]);
  await expect(page.locator('#checks .ok')).toHaveCount(4);
  await page.locator('#tape').click();
  await expect(page.locator('#s-result.on')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#rank')).toHaveText('#1 of 1');
  expect(Number((await page.locator('#score').textContent()).replace(/,/g, ''))).toBeGreaterThan(0);
  await h.locator('[data-mode=chip]').click();
  await expect(statRow(h, 'Taped out')).toHaveText('1');
  await expect(h.locator('#rows')).toContainText('ADA');
  await ctx.close();
});

test('rack: build, purchase, auto room view with own rack selected', async ({ page, browser, baseURL }) => {
  const { ctx, h } = await host(browser, baseURL);
  await joinAs(page, 'LINUS', '/join.html?room=DEMO&mode=rack');
  await page.locator('#go-rack').click();
  await addPart(page, 'gpu', 'DGX B200');
  await expect(page.locator('#sum')).toContainText('10/42U');
  await page.locator('#rackhandle').click();
  await expect(page.locator('#racksheet')).toHaveClass(/min/);
  await page.locator('#rackhandle').click();
  await page.getByRole('button', { name: /^Purchase/ }).click();
  await expect(page.locator('#s-room.on')).toBeVisible();
  await expect(page.locator('#roomtitle')).toHaveText('LINUS · you');
  await expect(page.locator('#roominfo')).toContainText('DGX B200');
  await expect(statRow(h, 'Purchased')).toHaveText('1');
  await ctx.close();
});

test('rack full shows error', async ({ page, browser, baseURL }) => {
  const { ctx } = await host(browser, baseURL);
  await joinAs(page, 'GRACE');
  await page.locator('#go-rack').click();
  await page.getByRole('button', { name: 'gpu', exact: true }).click();
  const add = page.locator('.item', { hasText: 'DGX B200' }).getByRole('button', { name: 'Add' });
  for (let i = 0; i < 4; i++) { await add.click(); await expect(page.locator('#sum')).toContainText(`${(i + 1) * 10}/42U`); }
  await add.click();
  await expect(page.locator('#rerr')).toHaveText('rack full');
  await ctx.close();
});
