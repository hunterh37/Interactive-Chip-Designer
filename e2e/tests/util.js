export const IGNORED = [/favicon/i, /GPU stall/i, /WebGL.*(performance|swiftshader)/i];
export const LOBBY = 'DEMO';

export function watchErrors(page, sink) {
  page.on('pageerror', e => sink.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORED.some(r => r.test(t))) sink.push(`console: ${t}`);
  });
}

/** Opens the host page on the single DEMO lobby (no room creation). Returns the room code. */
export async function hostRoom(page, mode = 'rack', stage = 'Design') {
  await page.goto(`/?mode=${mode}&stage=${stage}`);
  await page.waitForFunction(() => document.getElementById('code')?.textContent === 'DEMO');
  await page.locator('#stats .row').first().waitFor();
  return LOBBY;
}

/** Clicks "Reset lobby" on the host (accepting confirm) and waits for 0 racks. */
export async function resetLobby(host) {
  host.once('dialog', d => d.accept());
  await host.locator('#reset').click();
  await host.goto(host.url().replace(/stage=\w+/, 'stage=Design').replace(/mode=\w+/, 'mode=rack'));
  await expect_racks(host, 0);
}

export const statRow = (host, label) => host.locator('#stats .row', { hasText: label }).locator('b');
async function expect_racks(host, n) {
  const { expect } = await import('@playwright/test');
  await expect(statRow(host, 'Racks')).toHaveText(String(n));
}
export const racksOnHost = expect_racks;

export const parseMoney = t => Number(t.match(/\$([\d,]+)/)[1].replace(/,/g, ''));

/** Guest onboarding: name screen → menu. */
export async function joinAs(page, name, path = '/join.html?room=DEMO') {
  await page.addInitScript(() => { try { localStorage.setItem('cd-tip', '1'); } catch {} });
  await page.goto(path);
  await page.locator('#name').fill(name);
  await page.locator('#enter').click();
  await page.locator('#s-menu.on').waitFor();
}
/** Selects a block and taps cells on the guest die grid. */
export async function paint(page, block, cells) {
  await page.locator(`#pal button[data-id=${block}]`).click();
  for (const i of cells) await page.locator(`#grid div[data-i="${i}"]`).click();
}
export async function addPart(page, cat, name) {
  await page.getByRole('button', { name: cat, exact: true }).click();
  await page.locator('.item', { hasText: name }).getByRole('button', { name: 'Add' }).click();
}
