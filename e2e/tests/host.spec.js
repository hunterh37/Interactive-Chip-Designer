import { test, expect } from '@playwright/test';
import { hostRoom, statRow } from './util.js';

test('join stage: centered QR, live count, presenter next/prev and arrow keys', async ({ page }) => {
  await hostRoom(page, 'chip', 'Join');
  await expect(page.locator('#code')).toHaveText('DEMO');
  await expect(page.locator('#join')).not.toHaveClass(/hidden/);
  await expect(page.locator('#count')).toHaveText(/^\d+$/);
  await expect(page.locator('#sname')).toHaveText('01 · Join');
  await expect(page.locator('#prev')).toBeDisabled();
  await page.locator('#next').click();
  await expect(page.locator('#sname')).toHaveText('02 · Design');
  await expect(page.locator('#join')).toHaveClass(/hidden/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#sname')).toHaveText('03 · Results');
  await expect(page.locator('#next')).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#sname')).toHaveText('01 · Join');
});

test('mode toggle switches QR url and stats', async ({ page }) => {
  await hostRoom(page, 'chip');
  await expect(statRow(page, 'Taped out')).toBeVisible();
  await page.locator('[data-mode=rack]').click();
  await expect(page.locator('#url')).toContainText('mode=rack');
  await expect(statRow(page, 'Racks')).toBeVisible();
});
