import { test, expect, devices } from '@playwright/test';
import { hostRoom, resetLobby, statRow, parseMoney } from './util.js';

const api = process.env.E2E_API || 'http://localhost:8787';
const add = (p, cat, name) => p.getByRole('button', { name: cat, exact: true }).click()
  .then(() => p.locator('.item', { hasText: name }).getByRole('button', { name: 'Add' }).click());

test('two phones: own racks, host Racks=2 and summed value, purchase, chip, reset', async ({ browser, baseURL }) => {
  const hostCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const host = await hostCtx.newPage();
  await hostRoom(host);
  await resetLobby(host);
  const aCtx = await browser.newContext({ baseURL, ...devices['iPhone 15'] });
  const bCtx = await browser.newContext({ baseURL, ...devices['Pixel 7'] });
  const a = await aCtx.newPage(), b = await bCtx.newPage();
  await a.goto('/join.html?room=DEMO&mode=rack');
  await b.goto('/join.html?room=DEMO&mode=rack');

  await add(a, 'gpu', 'DGX B200');
  await expect(a.locator('#sum')).toContainText('10/42U');
  await add(b, 'network', 'QM9700');
  await expect(b.locator('#sum')).toContainText('1/42U');
  // racks are separate: a is not affected by b
  await expect(a.locator('#sum')).toContainText('10/42U');
  await expect(statRow(host, 'Racks')).toHaveText('2');
  const pa = parseMoney(await a.locator('#sum').textContent());
  const pb = parseMoney(await b.locator('#sum').textContent());
  await expect(statRow(host, 'Value')).toHaveText('$' + (pa + pb).toLocaleString('en-US'));
  // own color change does not leak
  const bFrame = await b.locator('input[type=color]').first().inputValue();
  await a.locator('input[type=color]').first().fill('#aa2244');
  await expect(a.locator('input[type=color]').first()).toHaveValue('#aa2244');
  await b.waitForTimeout(500);
  await expect(b.locator('input[type=color]').first()).toHaveValue(bFrame);

  await a.getByRole('button', { name: /^Purchase/ }).click();
  await expect(a.locator('.bar .n')).toContainText(/Order CD-[A-Z0-9]{6}/);
  const id = (await a.locator('.bar .n').textContent()).match(/CD-[A-Z0-9]{6}/)[0];
  await expect(statRow(host, 'Purchased')).toHaveText('1');
  await expect(b.getByRole('button', { name: /^Purchase/ })).toBeVisible();
  await b.getByRole('button', { name: /^Purchase/ }).click();
  await expect(statRow(host, 'Purchased')).toHaveText('2');

  const s = await (await fetch(`${api}/api/rooms/DEMO`)).json();
  const racks = Object.values(s.racks);
  expect(racks.length).toBe(2);
  expect(s.totals.room.racks).toBe(2);
  expect(racks.find(r => r.ordered?.orderId === id)).toBeTruthy();
  expect(racks.map(r => r.frame.toLowerCase())).toContain('#aa2244');
  await host.screenshot({ path: 'test-results/multi-host.png' });

  // chip die is shared
  await a.getByRole('button', { name: 'Chip Design' }).click();
  await b.getByRole('button', { name: 'Chip Design' }).click();
  await a.getByRole('button', { name: 'Tensor cores' }).click();
  await a.locator('.grid div').nth(0).click();
  await expect(b.locator('#sum')).toContainText(/^\d{2,} TFLOPS/);
  const tf = parseInt(await b.locator('#sum').textContent());
  await b.getByRole('button', { name: 'Tape out' }).click();
  await expect(a.getByRole('button', { name: /Taped out/ })).toBeVisible();
  await host.locator('[data-mode=chip]').click();
  await expect(host.locator('#stats')).toContainText(`${tf} TFLOPS`);
  await expect(host.locator('#stats')).toContainText('Taped out');

  await resetLobby(host);
  await expect(statRow(host, 'Purchased')).toHaveText('0');
  await a.getByRole('button', { name: 'Server Rack' }).click();
  await expect(a.locator('#sum')).toContainText('0/42U');
  const s2 = await (await fetch(`${api}/api/rooms/DEMO`)).json();
  expect(Object.keys(s2.racks).length).toBe(0);
  expect(s2.chip.taped).toBe(false);
  expect(s2.chip.cells.some(Boolean)).toBe(false);
  await Promise.all([hostCtx, aCtx, bCtx].map(c => c.close()));
});
