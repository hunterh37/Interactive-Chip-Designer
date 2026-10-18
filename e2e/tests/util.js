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
export async function hostRoom(page, mode = 'rack') {
  await page.goto(`/?mode=${mode}`);
  await page.waitForFunction(() => document.getElementById('code')?.textContent === 'DEMO');
  await page.locator('#stats .row').first().waitFor();
  return LOBBY;
}

/** Clicks "Reset lobby" on the host (accepting confirm) and waits for 0 racks. */
export async function resetLobby(host) {
  await host.locator('[data-mode=rack]').click();
  host.once('dialog', d => d.accept());
  await host.locator('#reset').click();
  await expect_racks(host, 0);
}

export const statRow = (host, label) => host.locator('#stats .row', { hasText: label }).locator('b');
async function expect_racks(host, n) {
  const { expect } = await import('@playwright/test');
  await expect(statRow(host, 'Racks')).toHaveText(String(n));
}
export const racksOnHost = expect_racks;

export const parseMoney = t => Number(t.match(/\$([\d,]+)/)[1].replace(/,/g, ''));
