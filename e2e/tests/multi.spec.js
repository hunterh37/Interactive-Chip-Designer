import { test, expect, devices } from '@playwright/test';
import { hostRoom, resetLobby, statRow, joinAs, paint, addPart } from './util.js';

test('two guests: live count, chip dies on host, leaderboard, racks in shared room', async ({ browser, baseURL }) => {
  const hostCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const host = await hostCtx.newPage();
  await hostRoom(host); await resetLobby(host);
  await host.goto('/?mode=chip&stage=Join');
  const a = await (await browser.newContext({ baseURL, ...devices['iPhone 15'] })).newPage();
  const b = await (await browser.newContext({ baseURL, ...devices['Pixel 7'] })).newPage();
  await joinAs(a, 'ADA'); await joinAs(b, 'LINUS');
  await expect(host.locator('#names')).toContainText('ADA');
  await expect(host.locator('#names')).toContainText('LINUS');
  await host.locator('#next').click();
  for (const [p, n] of [[a, 6], [b, 3]]) {
    await p.locator('#go-chip').click(); await p.locator('#begin').click();
    await paint(p, 'tensor', [...Array(n).keys()]); await paint(p, 'hbm', [20]); await paint(p, 'io', [21]); await paint(p, 'cpu', [22]);
  }
  await expect(statRow(host, 'Designing')).toHaveText('2');
  await a.locator('#tape').click(); await b.locator('#tape').click();
  await expect(a.locator('#s-result.on')).toBeVisible({ timeout: 15000 });
  await expect(b.locator('#s-result.on')).toBeVisible({ timeout: 15000 });
  await expect(a.locator('#rank')).toHaveText('#1 of 2');
  await expect(b.locator('#rank')).toHaveText('#2 of 2');
  await host.locator('#next').click();
  await expect(host.locator('#headline')).toContainText('ADA WINS', { timeout: 5000 });

  await host.locator('[data-mode=rack]').click();
  for (const [p, c, n] of [[a, 'gpu', 'DGX B200'], [b, 'network', 'QM9700']]) {
    await p.locator('#tomenu').click(); await p.locator('#go-rack').click(); await addPart(p, c, n);
  }
  await expect(statRow(host, 'Racks')).toHaveText('2');
  await a.getByRole('button', { name: /^Purchase/ }).click();
  await expect(a.locator('#s-room.on')).toBeVisible();
  await expect(a.locator('#roomcount')).toContainText('2 racks');
  await expect(statRow(host, 'Purchased')).toHaveText('1');
  const s = await (await fetch(`${process.env.E2E_API || 'https://chipdesigner-api.onrender.com'}/api/rooms/DEMO`)).json();
  expect(Object.values(s.racks).map(r => r.owner).sort()).toEqual(['ADA', 'LINUS']);
  await hostCtx.close();
});
