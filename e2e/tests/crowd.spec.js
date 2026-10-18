import { test, expect, devices } from '@playwright/test';
import WebSocket from '../../node_modules/ws/wrapper.mjs';
import { hostRoom, resetLobby, statRow, joinAs, addPart } from './util.js';

// Localhost load check: N phone guests through chip + rack flows, host screenshots at each stage.
const API = process.env.E2E_API || 'http://localhost:8787';
const N = Number(process.env.CROWD || 20);
const NAMES = Array.from({ length: N }, (_, i) => i % 5 === 4 ? `PLAYER-LONGNAME${i}`.slice(0, 16) : `P${String(i + 1).padStart(2, '0')}-${'ABCDEFGHIJKLMNOPQRST'[i]}`);
const PHONES = Math.min(N, Number(process.env.PHONES || 4)); // real browser guests; rest are WebSocket bots
function bot(name) {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws?room=DEMO&kind=phone&mode=chip&name=${encodeURIComponent(name)}`);
  const errs = []; ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'error') errs.push(`${name}: ${m.error}`); });
  const send = op => ws.send(JSON.stringify(op));
  return { ready: new Promise(r => ws.once('open', () => { send({ type: 'player.name', name }); r(); })), send, errs, close: () => ws.close() };
}
const shot = (p, n) => p.screenshot({ path: `shots/crowd-${N}-${n}.png` });

test(`${N} guests: join, chip tape-out, rack purchase, host UI holds`, async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const errors = [];
  const host = await (await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } })).newPage();
  host.on('pageerror', e => errors.push(`host: ${e.message}`));
  await hostRoom(host, 'chip', 'Join'); await resetLobby(host);
  await host.goto('/?mode=chip&stage=Join');
  const guests = [];
  const bots = NAMES.slice(PHONES).map(bot); await Promise.all(bots.map(b => b.ready));
  for (let i = 0; i < PHONES; i++) {
    const p = await (await browser.newContext({ baseURL, ...devices[i % 2 ? 'Pixel 7' : 'iPhone 15'] })).newPage();
    p.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
    await joinAs(p, NAMES[i]); guests.push(p);
  }
  await expect(host.locator('#count')).toHaveText(String(N));
  for (const n of NAMES) await expect(host.locator('#names')).toContainText(n);
  await shot(host, '1-chip-join');

  await host.locator('#next').click();
  await Promise.all(guests.map(async p => {
    await p.locator('#go-chip').click(); await p.locator('#begin').click();
    if (await p.locator('#tipok').isVisible()) await p.locator('#tipok').click();
    await expect(p.locator('#grid .die')).toHaveCount(8);
  }));
  bots.forEach((b, i) => { b.send({ type: 'my.clear' }); if (i % 2) b.send({ type: 'my.autocool' }); });
  await expect(statRow(host, 'Designing')).toHaveText(String(N));
  await host.waitForTimeout(1500); await shot(host, '2-chip-design');
  await Promise.all(guests.map(p => p.locator('#tape').click()));
  bots.forEach(b => b.send({ type: 'my.tapeout' }));
  await Promise.all(guests.map(p => expect(p.locator('#s-result.on')).toBeVisible({ timeout: 30000 })));
  const ranks = await Promise.all(guests.map(p => p.locator('#rank').textContent()));
  expect(ranks.map(r => r.match(/#(\d+)/)[1]).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: PHONES }, (_, i) => i + 1).map(() => expect.any(Number)));
  ranks.forEach(r => expect(r).toMatch(new RegExp(`of ${N}$`)));
  await expect(statRow(host, 'Taped out')).toHaveText(String(N));
  await host.waitForTimeout(1500); await shot(host, '3-chip-leaderboard');
  await host.locator('#next').click();
  await expect(host.locator('#headline')).toContainText('WINS', { timeout: 5000 });
  await host.waitForTimeout(1500); await shot(host, '4-chip-results');

  await host.locator('[data-mode=rack]').click();
  await Promise.all(guests.map(async p => { await expect(p.locator('#s-rack.on')).toBeVisible(); await addPart(p, 'gpu', 'DGX B200'); }));
  bots.forEach(b => b.send({ type: 'rack.add', id: 'dgx-b200' }));
  await expect(statRow(host, 'Racks')).toHaveText(String(N));
  bots.forEach(b => b.send({ type: 'rack.order' }));
  await Promise.all(guests.map(async p => {
    await p.getByRole('button', { name: /Next · Paint/ }).click();
    await p.getByRole('button', { name: /^Purchase/ }).click();
  }));
  for (const p of guests) await expect(p.locator('#roomcount')).toContainText(`${N} racks`);
  await expect(statRow(host, 'Purchased')).toHaveText(String(N));
  await host.waitForTimeout(2500); await shot(host, '5-rack-room');
  await shot(guests[0], '6-guest-room');
  await host.locator('#prev').click(); await host.waitForTimeout(2500); await shot(host, '7-rack-design');
  const s = await (await fetch(`${API}/api/rooms/DEMO`)).json();
  expect(Object.values(s.racks).map(r => r.owner).sort()).toEqual([...NAMES].sort());
  expect([...errors, ...bots.flatMap(b => b.errs)]).toEqual([]);
  bots.forEach(b => b.close());
});
