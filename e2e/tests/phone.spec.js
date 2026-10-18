import { test, expect } from '@playwright/test';
import { hostRoom, resetLobby, statRow, parseMoney } from './util.js';

async function setup(browser, baseURL, mode = 'rack') {
  const hostCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const host = await hostCtx.newPage();
  await hostRoom(host, mode);
  await resetLobby(host);
  if (mode === 'chip') await host.locator('[data-mode=chip]').click();
  return { hostCtx, host };
}

test('rack: configure own rack, purchase; host sees totals and Purchased', async ({ page, browser, baseURL }) => {
  const { hostCtx, host } = await setup(browser, baseURL);
  await page.goto('/join.html?room=DEMO&mode=rack');
  await expect(page.locator('#room')).toHaveText('DEMO');
  await page.getByRole('button', { name: 'gpu', exact: true }).click();
  await page.locator('.item', { hasText: 'DGX B200' }).getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'network', exact: true }).click();
  await page.locator('.item', { hasText: 'QM9700' }).getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('#sum')).toContainText('11/42U');
  await expect(page.locator('#sum')).toContainText('$548,890');
  await page.locator('input[type=color]').first().fill('#aa2244');
  await expect(page.locator('input[type=color]').first()).toHaveValue('#aa2244');
  await expect(statRow(host, 'Racks')).toHaveText('1');
  await expect(statRow(host, 'Value')).toHaveText('$548,890');
  await expect(statRow(host, 'Purchased')).toHaveText('0');
  await page.getByRole('button', { name: /^Purchase/ }).click();
  await expect(page.locator('.bar .n')).toContainText(/Order CD-[A-Z0-9]{6}/);
  await expect(statRow(host, 'Purchased')).toHaveText('1');
  await expect(statRow(host, 'Value')).toHaveText('$548,890');
  // pid persists: reload keeps the same rack and order
  await page.reload();
  await expect(page.locator('#sum')).toContainText('11/42U');
  await expect(page.locator('.bar .n')).toContainText(/Order CD-/);
  await expect(statRow(host, 'Racks')).toHaveText('1');
  await hostCtx.close();
});

test('rack full shows error toast', async ({ page, browser, baseURL }) => {
  const { hostCtx } = await setup(browser, baseURL);
  await page.goto('/join.html?room=DEMO&mode=rack');
  await page.getByRole('button', { name: 'gpu', exact: true }).click();
  const add = page.locator('.item', { hasText: 'DGX B200' }).getByRole('button', { name: 'Add' });
  for (let i = 0; i < 4; i++) {
    await add.click();
    await expect(page.locator('#sum')).toContainText(`${(i + 1) * 10}/42U`);
  }
  await add.click();
  await expect(page.locator('.err')).toHaveText('rack full');
  await hostCtx.close();
});

test('chip: paint cells, tape out, host sees TFLOPS and Taped out', async ({ page, browser, baseURL }) => {
  const { hostCtx, host } = await setup(browser, baseURL, 'chip');
  await page.goto('/join.html?room=DEMO&mode=chip');
  await page.getByRole('button', { name: 'Tensor cores' }).click();
  const cells = page.locator('.grid div');
  await cells.nth(0).click();
  await expect(page.locator('#sum')).toContainText(/^\d{2,} TFLOPS/);
  const one = parseInt(await page.locator('#sum').textContent());
  expect(one).toBeGreaterThan(0);
  await cells.nth(1).click();
  await expect.poll(async () => parseInt(await page.locator('#sum').textContent())).toBeGreaterThan(one);
  const two = parseInt(await page.locator('#sum').textContent());
  await page.getByRole('button', { name: 'Tape out' }).click();
  await expect(page.getByRole('button', { name: /Taped out/ })).toBeVisible();
  await expect(host.locator('#stats')).toContainText(`${two} TFLOPS`);
  await expect(host.locator('#stats')).toContainText('Taped out');
  // reset clears the die
  await resetLobby(host);
  await host.locator('[data-mode=chip]').click();
  await expect(host.locator('#stats')).toContainText('0 TFLOPS');
  await expect(host.locator('#stats')).not.toContainText('Taped out');
  await hostCtx.close();
});
