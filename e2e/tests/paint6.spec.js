import { test, expect, devices } from '@playwright/test';
import { hostRoom, resetLobby, statRow, joinAs, addPart } from './util.js';

const API = process.env.E2E_API || 'https://chipdesigner-api.onrender.com';
const room = async () => (await fetch(`${API}/api/rooms/DEMO`)).json();
const NAMES = ['ADA', 'LINUS', 'GRACE', 'ALAN', 'KEN', 'BARB'];
const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#bf5af2'];
const DESIGNS = ['stripes', 'chevron', 'circuit', 'flames', 'grid', 'dots'];

test('6 guests: host picks mode, components then paint, all synced live', async ({ browser, baseURL }) => {
  const errors = [];
  const host = await (await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } })).newPage();
  await hostRoom(host, 'chip', 'Join'); await resetLobby(host);
  await host.goto('/?mode=chip&stage=Join');
  const guests = [];
  for (let i = 0; i < 6; i++) {
    const p = await (await browser.newContext({ baseURL, ...devices[i % 2 ? 'Pixel 7' : 'iPhone 15'] })).newPage();
    p.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
    await joinAs(p, NAMES[i]); guests.push(p);
  }
  for (const n of NAMES) await expect(host.locator('#names')).toContainText(n);
  // chip mode: guests see only the chip program
  for (const p of guests) { await expect(p.locator('#go-chip')).toBeVisible(); await expect(p.locator('#go-rack')).toBeHidden(); }
  // host switches to rack: every guest is moved into the rack builder, chip option hidden
  await host.locator('[data-mode=rack]').click();
  for (const p of guests) await expect(p.locator('#s-rack.on')).toBeVisible();
  await Promise.all(guests.map(p => addPart(p, 'gpu', 'DGX B200')));
  await expect(statRow(host, 'Racks')).toHaveText('6');
  // step 2: paint, all six concurrently
  await Promise.all(guests.map(async (p, i) => {
    await p.getByRole('button', { name: /Next · Paint/ }).click();
    for (const part of ['sides', 'door', 'top', 'rails']) {
      await p.locator(`.parts button[data-part=${part}]`).click();
      await p.locator(`.swatches button[data-c="${COLORS[(i + part.length) % 6]}"]`).first().click();
    }
    await p.locator(`.designs button[data-design=${DESIGNS[i]}]`).click();
  }));
  await expect.poll(async () => {
    const s = await room();
    return Object.values(s.racks).filter(r => r.paint?.design !== 'none').map(r => r.owner).sort().join(',');
  }).toBe([...NAMES].sort().join(','));
  const s = await room();
  Object.values(s.racks).forEach(r => {
    const i = NAMES.indexOf(r.owner);
    expect(r.paint.design).toBe(DESIGNS[i]);
    expect(r.paint.sides).toBe(COLORS[(i + 5) % 6]);
    expect(r.paint.door).toBe(COLORS[(i + 4) % 6]);
  });
  // everyone purchases, sees six racks in the shared room
  await Promise.all(guests.map(p => p.getByRole('button', { name: /^Purchase/ }).click()));
  for (const p of guests) await expect(p.locator('#roomcount')).toContainText('6 racks');
  await expect(statRow(host, 'Purchased')).toHaveText('6');
  // host back to chip: guests follow out of the rack screens
  await host.locator('[data-mode=chip]').click();
  for (const p of guests) await expect(p.locator('#s-brief.on')).toBeVisible();
  expect(errors).toEqual([]);
});
