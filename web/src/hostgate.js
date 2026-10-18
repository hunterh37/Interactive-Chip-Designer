// Settings view: gear button (top-right) opens a panel. "Chip Designer" at the bottom;
// 5 taps on it within 2s enables host mode (stores localStorage 'tw.host', read by host.js / xr.js).
// Server enforces HOST_KEY when set, so the revealed field takes the key.
const get = () => { try { return localStorage.getItem('tw.host') || ''; } catch { return ''; } };
const put = v => { try { v ? localStorage.setItem('tw.host', v) : localStorage.removeItem('tw.host'); } catch {} };

export function hostGate() {
  const gear = document.createElement('button');
  gear.textContent = '⚙'; gear.setAttribute('aria-label', 'Settings');
  gear.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;width:44px;height:44px;border:1px solid #fff;background:#000;color:#fff;font:20px ui-monospace,monospace;border-radius:8px';
  gear.onclick = open; document.body.append(gear);

  function open() {
    if (document.getElementById('tw-settings')) return;
    const p = document.createElement('div'); p.id = 'tw-settings';
    p.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(0,0,0,.85);font:16px ui-monospace,monospace;color:#fff';
    p.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px;padding:24px;border:1px solid #fff;background:#000;width:min(320px,90vw)">
      <div style="font-size:20px">Settings</div>
      <div id="tw-host" hidden style="display:flex;flex-direction:column;gap:8px">
        <div id="tw-state"></div>
        <input id="tw-key" type="password" autocomplete="off" placeholder="Host key" style="font:inherit;padding:8px;background:#000;color:#fff;border:1px solid #888">
        <div style="display:flex;gap:8px"><button id="tw-save" class="primary">Save</button><button id="tw-off">Disable</button></div>
      </div>
      <button id="tw-close">Close</button>
      <div id="tw-brand" style="margin-top:12px;text-align:center;opacity:.6;user-select:none;-webkit-user-select:none;padding:8px">Chip Designer</div>
    </div>`;
    document.body.append(p);
    const $ = s => p.querySelector(s), host = $('#tw-host');
    const show = () => { host.hidden = false; host.style.display = 'flex'; $('#tw-state').textContent = get() ? 'Host mode enabled' : 'Host mode off'; };
    host.style.display = 'none';
    if (get()) show();
    let taps = [];
    $('#tw-brand').onclick = () => {
      const t = Date.now(); taps = taps.filter(x => t - x < 2000).concat(t);
      if (taps.length >= 5) { taps = []; if (!get()) put('1'); show(); }
    };
    $('#tw-save').onclick = () => { const v = $('#tw-key').value.trim(); if (v) { put(v); location.reload(); } };
    $('#tw-off').onclick = () => { put(''); location.reload(); };
    $('#tw-close').onclick = () => { p.remove(); if (get()) location.reload(); };
  }
}
