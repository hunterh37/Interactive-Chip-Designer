import { test, expect } from '@playwright/test';
import { hostRoom, resetLobby, statRow } from './util.js';

test('host uses DEMO lobby, renders QR, mode toggle updates QR url', async ({ page, request }) => {
  const reqs = [];
  page.on('request', r => reqs.push(r.method() + ' ' + new URL(r.url()).pathname));
  const code = await hostRoom(page);
  expect(code).toBe('DEMO');
  expect(reqs).not.toContain('POST /api/rooms');
  await expect(page.locator('#code')).toHaveText('DEMO');
  const qr = page.locator('#qr');
  await expect(qr).toBeVisible();
  const dark = await qr.evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60) n++;
    return n;
  });
  expect(dark).toBeGreaterThan(500);
  const url = page.locator('#url');
  await expect(url).toContainText('join.html?room=DEMO&mode=rack');
  const before = await qr.evaluate(c => c.toDataURL());
  await page.locator('[data-mode=chip]').click();
  await expect(url).toContainText('join.html?room=DEMO&mode=chip');
  await expect.poll(() => qr.evaluate(c => c.toDataURL())).not.toBe(before);
  await expect(page.locator('[data-mode=chip]')).toHaveClass(/on/);
});

test('host shows room totals and Reset lobby button', async ({ page }) => {
  await hostRoom(page);
  await resetLobby(page);
  for (const l of ['Racks', 'Power', 'Value', 'Purchased']) await expect(statRow(page, l)).toBeVisible();
  await expect(statRow(page, 'Racks')).toHaveText('0');
  await expect(statRow(page, 'Purchased')).toHaveText('0');
  await expect(page.locator('#reset')).toHaveText('Reset lobby');
});

test('Reset lobby dismissed confirm keeps state', async ({ page, browser, baseURL }) => {
  const host = page;
  await hostRoom(host);
  await resetLobby(host);
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 800 } });
  const ph = await ctx.newPage();
  await ph.goto('/join.html?room=DEMO&mode=rack');
  await ph.getByRole('button', { name: 'gpu', exact: true }).click();
  await ph.locator('.item', { hasText: 'DGX B200' }).getByRole('button', { name: 'Add' }).click();
  await expect(statRow(host, 'Racks')).toHaveText('1');
  host.once('dialog', d => d.dismiss());
  await host.locator('#reset').click();
  await host.waitForTimeout(800);
  await expect(statRow(host, 'Racks')).toHaveText('1');
  await resetLobby(host);
  await expect(ph.locator('#sum')).toContainText('0/42U');
  await ctx.close();
});
