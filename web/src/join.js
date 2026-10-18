import { catalog, connect } from './net.js';
import * as THREE from 'three';
import { stage, buildRack, buildChip, buildRoom, replace, emptyRack, realityHDProps, paintOf } from './scene.js';
import { monoCatalog, BLOCK_STYLE, bar, scramble, asciiField, asciiDie, LOGO } from './ascii.js';
import { buildGlobe, setPins, toLatLon, placeName, fmtLatLon, faceQuat } from './globe.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const room = (q.get('room') || 'DEMO').toUpperCase();
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const pid = store.get('cd-pid') || Math.random().toString(36).slice(2, 12); store.set('cd-pid', pid);
const randName = () => { const a = ['ADA','VOLT','NOVA','ZED','BYTE','FLUX','ION','ECHO','NEO','RAY','KAI','LUX','ORB','PIX','REX','SOL']; return a[Math.random() * a.length | 0] + (10 + Math.random() * 90 | 0); };
let name = store.get('cd-name') || randName(); store.set('cd-name', name);
const cat = monoCatalog(await catalog());
const DURATION = 120, POWER = 1000;
const money = n => '$' + n.toLocaleString('en-US');

// ── state + net
let s = null, screen = 'intro', brush = 'tensor', deadline = 0, fabbing = false, tab = cat.components[0].cat;
const net = connect({ room, kind: 'phone', mode: 'chip', name: name || 'guest', pid, onState: st => { s = st; render(); }, onError: e => toast(e) });
const send = op => net.send(op);
const me = () => s?.chips?.[pid];
const result = () => me()?.result ?? { passed: false, score: null, points: 0, bad: [], links: {} };

// ── background field + screens
const field = asciiField($('field'));
function go(id) {
  screen = id;
  document.querySelectorAll('.screen').forEach(e => e.classList.toggle('on', e.id === 's-' + id));
  $('field').style.opacity = ['intro', 'menu', 'brief', 'fab', 'result'].includes(id) ? 1 : 0;
  if (id === 'room' && picked) roomSheet(false);
  dispatchEvent(new Event('resize'));
  render();
}

// ── intro
$('roomlbl').textContent = `Room ${room}`;
$('logo').textContent = LOGO.trimStart();
$('name').value = name;
const enter = () => {
  const n = $('name').value.trim().toUpperCase().slice(0, 16);
  if (!n) { $('name').focus(); return; }
  name = n; store.set('cd-name', n); send({ type: 'player.name', name: n });
  field.pulse(); go('menu');
};
$('enter').onclick = enter;
$('who').onclick = () => { go('intro'); setTimeout(() => { $('name').focus(); $('name').select(); }, 300); };
$('name').onkeydown = e => { if (e.key === 'Enter') enter(); };

// ── menu
$('go-chip').onclick = () => { me()?.taped ? go('result') : go('brief'); };
$('go-rack').onclick = () => goRack();

// ── brief
$('brief-back').onclick = () => go('menu');
$('spec').innerHTML = [
  ['Interposer', '52 × 42 mm Si'], ['Chiplets', '4 GPU 11.5×10.5 · 4 HBM 10.5×10.2'], ['Links', 'P 600 GB/s ≤5 mm · S 300 GB/s ≤6 mm'],
  ['Wire budget', 'Σ GB/s × mm ≤ 13,500'], ['Clearance', '1 mm die gap · 1 mm edge'], ['Workloads', '5 · worst GPU + HBM °C'], ['Score', '< 1 beats random baseline'],
].map(([k, v]) => `<div class="row"><span class="mute">${k}</span><span>${v}</span></div>`).join('');
$('begin').onclick = () => {
  send({ type: 'my.clear' }); deadline = Date.now() + DURATION * 1000; go('design'); $('binfo').textContent = '';
  if (!store.get('cd-tip')) { tipHeld = Date.now(); showTip(); }
};

// ── design
const chipStage = stage($('view'));
chipStage.scene.background = null;
chipStage.camera.position.set(0, 1.55, 0.62); chipStage.controls.target.set(0, 0.82, 0); chipStage.controls.enableZoom = false;
chipStage.tick.push(t => { const c = chipStage.world.getObjectByName('chip'); if (c) c.rotation.y = Math.sin(t / 3000) * 0.25; });
$('pal').hidden = true;
const T2 = cat.track2, [IW, IH] = T2.interposer, SV = 'http://www.w3.org/2000/svg';
const grid = $('grid'); grid.className = 'ip';
const svg = document.createElementNS(SV, 'svg'); svg.setAttribute('viewBox', `0 0 ${IW} ${IH}`); grid.append(svg);
const heatImg = document.createElementNS(SV, 'image'); heatImg.setAttribute('width', IW); heatImg.setAttribute('height', IH); heatImg.setAttribute('preserveAspectRatio', 'none'); svg.append(heatImg);
const [cx0, cy0, cx1, cy1] = T2.contact;
svg.insertAdjacentHTML('beforeend', `<rect x="${cx0}" y="${IH - cy1}" width="${cx1 - cx0}" height="${cy1 - cy0}" class="contact"/><rect x="${T2.edge}" y="${T2.edge}" width="${IW - 2 * T2.edge}" height="${IH - 2 * T2.edge}" class="margin"/><defs><marker id="fixhead" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0L6,3L0,6z" fill="#fff"/></marker></defs><g id="wires"></g><g id="dies"></g><g id="fix"></g><g id="hots"></g>`);
let drag = null, local = null; // local: optimistic place while dragging
const place = () => local ?? me()?.place ?? [];
const svgPt = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * IW, (e.clientY - r.top) / r.height * IH]; };
grid.onpointerdown = e => {
  if (e.target.closest('[data-fix]') && !me()?.taped) { const f = result().fix; if (f) { send({ type: 'my.move', i: f.i, x: f.x, y: f.y }); navigator.vibrate?.(12); } return; }
  const t = e.target.closest('[data-i]'); if (!t || me()?.taped) return;
  const i = +t.dataset.i, p = place()[i], [mx, my] = svgPt(e), [, h] = T2.dies[p.id];
  local = place().map(q => ({ ...q })); drag = { i, dx: mx - p.x, dy: my - (IH - p.y - h) }; grid.setPointerCapture(e.pointerId);
  if (navigator.vibrate) navigator.vibrate(4);
};
grid.onpointermove = e => {
  if (!drag) return; const [mx, my] = svgPt(e), p = local[drag.i], [, h] = T2.dies[p.id];
  p.x = Math.round((mx - drag.dx) * 4) / 4; p.y = Math.round((IH - (my - drag.dy) - h) * 4) / 4; drawPlace();
};
grid.onpointerup = grid.onpointercancel = () => {
  if (!drag) return; const p = local[drag.i]; drag = null;
  send({ type: 'my.move', i: local.indexOf(p), x: p.x, y: p.y }); setTimeout(() => { local = null; render(); }, 400);
};
const INFO = {};

// ── how-to popover: loops a demo floorplan being drawn
const DEMO = [
  'Track 2: place 4 GPU and 4 HBM chiplets on a 52 × 42 mm silicon interposer. Drag a die to move it.',
  'Every GPU links to two HBMs: its primary (600 GB/s, ≤ 5 mm wire) and a secondary (300 GB/s, ≤ 6 mm). Yellow lines are the routed wires.',
  'Wires and PHYs dissipate power: 0.20 pJ/bit at the ends plus 0.08 pJ/bit per mm. Total GB/s × mm must stay ≤ 13,500.',
  'Keep 1 mm between dies and 1 mm from the edge. Red dies break a rule. Only the dashed center sits on good cooler contact.',
  'Five workloads run. Score = worst GPU and HBM rise vs the random baseline. Below 1.000 wins.',
];
$('demo').hidden = true;
let demoT = null;
function showTip() {
  $('tip').hidden = false; clearTimeout(demoT);
  const run = k => { if ($('tip').hidden) return; $('tipcap').textContent = DEMO[k]; $('tipstep').textContent = `${k + 1} / ${DEMO.length}`; demoT = setTimeout(() => run((k + 1) % DEMO.length), 4200); };
  run(0);
}
let tipHeld = 0;
$('help').onclick = () => { tipHeld = Date.now(); showTip(); };
$('tipok').onclick = () => { $('tip').hidden = true; clearTimeout(demoT); store.set('cd-tip', '1'); deadline += Date.now() - tipHeld; };
$('clear').onclick = () => send({ type: 'my.clear' });
$('tape').onclick = () => tapeout();

function tapeout() {
  if (fabbing) return;
  if (!result().passed) return toast(result().reason || 'layout breaks a rule');
  fabbing = true; send({ type: 'my.tapeout' }); fab();
}

setInterval(() => {
  if (screen !== 'design' || !$('tip').hidden) return;
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  $('timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('low', left <= 10);
  if (left === 0) result().passed ? tapeout() : (deadline = Date.now() + 30e3, toast('fix the layout to tape out'));
}, 250);

// ── fab sequence
async function fab() {
  go('fab'); const log = $('fablog'); log.innerHTML = '';
  const steps = ['Route 8 links', 'Check reach + 13,500 budget', 'Build power traces', 'Thermal solve · 5 workloads', 'Compare to random baseline', 'CoWoS package'];
  for (const st of steps) {
    const line = document.createElement('div'); log.append(line); scramble(line, st.toUpperCase(), 260); field.pulse();
    await new Promise(r => setTimeout(r, 420)); line.classList.add('done');
  }
  await new Promise(r => setTimeout(r, 300));
  fabbing = false; go('result');
}

// ── result
$('again').onclick = () => { send({ type: 'my.clear' }); deadline = Date.now() + DURATION * 1000; go('design'); };
$('tomenu').onclick = () => go('menu');
$('toroom').onclick = () => go('room');

// ── rack builder
const rackStage = stage($('rackview'));
rackStage.scene.background = null;
$('rack-back').onclick = () => { rackFitted = false; lastSlots = -1; rackUiSig = ''; go('menu'); };
$('rack-room').onclick = () => go('room');
const sheet = (id, hint, openTxt = 'Hide ↓', closedTxt = 'Show ↑') => {
  const el = $(id), set = min => { el.classList.toggle('min', min); $(hint).textContent = min ? closedTxt : openTxt; };
  let y0 = null;
  el.querySelector('.handle').onclick = () => set(!el.classList.contains('min'));
  el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; if (Math.abs(dy) > 40) set(dy > 0); y0 = null; });
  return set;
};
const rackSheet = sheet('racksheet', 'rackhint');
// Keep the rack canvas in the open area above the sheet and frame the whole rack in it.
let rackFitted = false, lastSlots = -1, slideAnim = null;
// New server slides in on its rails from the front, eases out with a small overshoot, then the LED flashes.
function slideIn(srv) {
  if (!srv) return;
  const z0 = srv.position.z, t0 = performance.now(), dur = 650;
  const led = srv.children[srv.children.length - 1];
  srv.position.z = z0 + 1.1; srv.scale.setScalar(0.96);
  slideAnim = t => {
    const k = Math.min(1, (t - t0) / dur), c = 1.4;
    const e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); // easeOutBack
    srv.position.z = z0 + 1.1 * (1 - e); srv.scale.setScalar(0.96 + 0.04 * Math.min(1, k * 1.5));
    if (led) led.visible = k < 1 || Math.floor((t - t0 - dur) / 90) % 2 === 0 || t - t0 > dur + 540;
    if (k >= 1 && t - t0 > dur + 540) { led && (led.visible = true); slideAnim = null; }
  };
  if (navigator.vibrate) setTimeout(() => navigator.vibrate(12), dur * 0.8);
}
rackStage.tick.push(t => slideAnim?.(t));
const fitRack = () => {
  const el = $('racksheet'), v = $('rackview');
  const open = el.classList.contains('min') ? 52 : el.offsetHeight;
  v.style.top = '60px'; v.style.height = Math.max(120, innerHeight - open - 60) + 'px'; v.style.bottom = 'auto';
  dispatchEvent(new Event('resize'));
  const obj = rackStage.world.getObjectByName('rack'); if (!obj) return;
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const cam = rackStage.camera, half = THREE.MathUtils.degToRad(cam.fov / 2);
  const r = size.length() / 2 * 1.15; // bounding sphere + margin
  const d = Math.max(r / Math.sin(half), r / Math.sin(Math.atan(Math.tan(half) * cam.aspect)));
  rackStage.controls.target.copy(c);
  cam.position.copy(c).add(new THREE.Vector3(0.45, 0.2, 1).normalize().multiplyScalar(d));
  cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix(); rackStage.controls.update?.();
};
new ResizeObserver(fitRack).observe($('racksheet'));
$('racksheet').addEventListener('transitionend', fitRack);
const roomSheet = sheet('roomsheet', 'roomhint');

// ── shared room: every player's rack in the hall, name tags, tap to inspect
const roomStage = stage($('roomview'));
realityHDProps(roomStage.world);
roomStage.camera.position.set(0.6, 2.4, 5.2); roomStage.controls.target.set(0, 1.1, 0);
let picked = null, roomSig = '';
$('room-back').onclick = () => go('menu');
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
$('roomview').addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
$('roomview').addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
  const r = $('roomview').getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, roomStage.camera);
  const obj = roomStage.world.getObjectByName('rack');
  const hit = obj && ray.intersectObject(obj, true).find(h => h.object.userData.pid);
  picked = hit ? hit.object.userData.pid : null;
  if (picked) { const g = obj.children.find(c => c.userData.pid === picked); roomStage.controls.target.set(g.position.x, 1, 0); roomSheet(false); }
  renderRoom(true);
});
const mine = () => s?.racks?.[pid] ?? emptyRack();

// ── site vote: before building, the room picks one data center location on a globe
const siteStage = stage($('siteview'));
siteStage.scene.background = null;
siteStage.camera.position.set(0, 0, 3.3); siteStage.controls.target.set(0, 0, 0);
siteStage.controls.enablePan = false; siteStage.controls.minDistance = 1.35; siteStage.controls.maxDistance = 4.5; siteStage.controls.rotateSpeed = 0.5;
const globe = buildGlobe(); siteStage.world.add(globe);
const sun = new THREE.DirectionalLight('#ffffff', 1.2); sun.position.set(-2, 1, 3); siteStage.scene.add(sun);
let spinTo = null, siteSig = '', lockedShown = false;
siteStage.tick.push(() => {
  if (spinTo) { globe.quaternion.slerp(spinTo, 0.08); if (globe.quaternion.angleTo(spinTo) < 0.002) spinTo = null; }
  else if (!Object.keys(s?.site?.pins || {}).length) globe.rotation.y += 0.0015;
  const d = siteStage.camera.position.length(); siteStage.controls.rotateSpeed = 0.15 + (d - 1.35) * 0.18; // finer drag when zoomed in
});
const siteSheet = sheet('sitesheet', 'sitehint');
const goRack = () => { if (s?.site?.chosen) { rackFitted = false; lastSlots = -1; rackUiSig = ''; go('rack'); } else go('site'); };
$('site-back').onclick = () => go('menu');
let sdown = null;
$('siteview').addEventListener('pointerdown', e => { sdown = [e.clientX, e.clientY]; });
$('siteview').addEventListener('pointerup', e => {
  if (!sdown || Math.hypot(e.clientX - sdown[0], e.clientY - sdown[1]) > 8 || s?.site?.chosen) return;
  const r = $('siteview').getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, siteStage.camera);
  const pinHit = ray.intersectObject(globe.getObjectByName('pins'), true)[0];
  if (pinHit) { send({ type: 'site.vote', target: pinHit.object.userData.pin }); navigator.vibrate?.(10); return; }
  const hit = ray.intersectObject(globe.getObjectByName('earth'))[0]; if (!hit) return;
  const { lat, lon } = toLatLon(globe.worldToLocal(hit.point.clone()));
  send({ type: 'site.pin', lat, lon, place: placeName(lat, lon) }); navigator.vibrate?.(15); siteSheet(false);
});
const focusPin = p => { spinTo = faceQuat(p.lat, p.lon); };

function renderSite() {
  const site = s.site || { pins: {}, tally: {} }, ids = Object.keys(site.pins);
  const sig = JSON.stringify([site.pins, site.tally, site.chosen?.id]);
  if (sig !== siteSig) { siteSig = sig; setPins(globe, site, pid); }
  const mineV = site.votes?.[pid], tally = site.tally || {};
  $('sitecount').textContent = `${ids.length} pin${ids.length === 1 ? '' : 's'}`;
  if (site.chosen) {
    const c = site.chosen;
    $('sitehead').textContent = 'Site chosen'; $('sitecue').innerHTML = `<span>${c.place || fmtLatLon(c.lat, c.lon)}</span>`;
    $('sitetitle').textContent = `${c.votes} vote${c.votes === 1 ? '' : 's'} · ${c.owner}`;
    if (!lockedShown) { lockedShown = true; focusPin(c); navigator.vibrate?.([20, 60, 20]); }
    $('siteui').innerHTML = `<div class="row"><span class="mute">Location</span><span>${fmtLatLon(c.lat, c.lon)}</span></div>`;
    const b = btn('Build racks here →', () => goRack(), 'primary'); b.style.cssText = 'width:100%;padding:16px;margin-top:12px'; $('siteui').append(b);
    return;
  }
  lockedShown = false;
  $('sitehead').textContent = 'Pick the site';
  $('sitecue').innerHTML = `<span>${site.pins[pid] ? 'Tap again to move your pin · tap a pin to vote' : 'Tap the globe to drop a pin'}</span>`;
  $('sitetitle').textContent = ids.length ? `Vote · ${ids.length} site${ids.length === 1 ? '' : 's'}` : 'No sites yet';
  const ui = $('siteui'); ui.innerHTML = '';
  if (!ids.length) { ui.append(el('div', 'mute', 'Everyone drops one pin. Most votes when the host starts wins.')); return; }
  ids.sort((a, b) => (tally[b] || 0) - (tally[a] || 0) || site.pins[a].at - site.pins[b].at).forEach(id => {
    const p = site.pins[id], row = el('div', 'vote' + (id === site.leader ? ' lead' : ''));
    const info = el('div', 'n'); info.append(el('div', '', p.place || fmtLatLon(p.lat, p.lon)), el('div', 'p mute', `${p.owner}${id === pid ? ' · you' : ''} · ${fmtLatLon(p.lat, p.lon)}`));
    info.onclick = () => focusPin(p);
    row.append(info, el('span', 'v', String(tally[id] || 0)),
      btn(mineV === id ? 'Voted' : 'Vote', () => { send({ type: 'site.vote', target: id }); focusPin(p); }, mineV === id ? 'on' : ''));
    ui.append(row);
  });
}

// Host owns the active program (s.show.mode). Guests see only that one and follow switches.
const CHIP_SCREENS = ['brief', 'design', 'fab', 'result'], RACK_SCREENS = ['site', 'rack', 'room'];
let shownMode = null;
function followMode() {
  const m = s?.show?.mode === 'rack' ? 'rack' : 'chip';
  $('go-chip').hidden = m !== 'chip'; $('go-rack').hidden = m !== 'rack';
  if ($('toroom')) $('toroom').hidden = m !== 'rack';
  $('menulbl') && ($('menulbl').textContent = m === 'rack' ? 'Now playing · Rack builder' : 'Now playing · Chip challenge');
  if (m === shownMode) return false;
  const first = shownMode === null; shownMode = m;
  if (screen === 'intro') return false;
  const wrong = m === 'rack' ? CHIP_SCREENS.includes(screen) : RACK_SCREENS.includes(screen);
  if (wrong || (screen === 'menu' && !first)) {
    if (screen === 'fab') return false; // let the tape-out animation finish
    if (m === 'rack') goRack(); else go(me()?.taped ? 'result' : 'brief');
    return true;
  }
  return false;
}

function render() {
  if (followMode()) return;
  const live = s?.started ? '● Live' : 'Lobby';
  $('live').textContent = live; $('live2').textContent = live;
  $('who').textContent = name || '';
  if (!s) return;
  if (screen === 'design') renderDesign();
  if (screen === 'result') renderResult();
  if (screen === 'site') renderSite();
  if (screen === 'rack') renderRack();
  if (screen === 'room') renderRoom();
}

const heatCanvas = document.createElement('canvas');
function drawHeat(r) {
  const h = r.heat; if (!h) { heatImg.removeAttribute('href'); return; }
  heatCanvas.width = h.nx; heatCanvas.height = h.ny; const x = heatCanvas.getContext('2d'), im = x.createImageData(h.nx, h.ny);
  const lo = 25, hi = Math.max(60, r.worstGpu);
  for (let j = 0; j < h.ny; j++) for (let i = 0; i < h.nx; i++) {
    const t = Math.max(0, Math.min(1, (h.map[j * h.nx + i] - lo) / (hi - lo))), o = ((h.ny - 1 - j) * h.nx + i) * 4;
    im.data[o] = 255 * Math.min(1, t * 2); im.data[o + 1] = 255 * Math.max(0, t * 2 - 1) * 0.85; im.data[o + 2] = 60 * (1 - t); im.data[o + 3] = 40 + 150 * t;
  }
  x.putImageData(im, 0, 0); heatImg.setAttribute('href', heatCanvas.toDataURL());
}
function drawPlace() {
  const r = result(), bad = new Set(drag ? [] : r.bad ?? []);
  $('dies').innerHTML = place().map((p, i) => [p, i]).sort(([a], [b]) => bad.has(a.id) - bad.has(b.id)).map(([p, i]) => { // broken dies on top
    const [w, h] = T2.dies[p.id], y = IH - p.y - h;
    return `<g data-i="${i}" class="die ${p.id[0] === 'G' ? 'gpu' : 'hbm'}${bad.has(p.id) ? ' bad' : ''}"><rect x="${p.x}" y="${y}" width="${w}" height="${h}"/><text x="${p.x + w / 2}" y="${y + h / 2 + 1.2}">${p.id}</text></g>`;
  }).join('');
  $('wires').innerHTML = drag ? '' : Object.entries(r.links ?? {}).map(([id, l]) => {
    const pts = [l.from, ...l.path.map(([i, j]) => [(i + 0.5) * 0.5, (j + 0.5) * 0.5]), l.to].map(([x, y]) => `${x},${IH - y}`).join(' ');
    return `<polyline class="${id[0] === 'P' ? 'wp' : 'ws'}" points="${pts}"/>`;
  }).join('');
  const f = !drag && !r.passed && r.fix, fp = f && place()[f.i];
  $('fix').innerHTML = fp ? (() => { const [w, h] = T2.dies[fp.id], y0 = IH - fp.y - h, y1 = IH - f.y - h;
    return `<line class="fixarrow" x1="${fp.x + w / 2}" y1="${y0 + h / 2}" x2="${f.x + w / 2}" y2="${y1 + h / 2}" marker-end="url(#fixhead)"/><g class="fixghost" data-fix="1"><rect x="${f.x}" y="${y1}" width="${w}" height="${h}"/><text x="${f.x + w / 2}" y="${y1 + h / 2 + 1.2}">${fp.id}</text></g>`; })() : '';
  $('hots').innerHTML = drag || !r.passed ? '' : [[r.gpuHot, 'g'], [r.hbmHot, 'h']].map(([[x, y], k]) => `<circle class="hot ${k}" cx="${x}" cy="${IH - y}" r="1.2"/>`).join('');
}

function renderDesign() {
  const r = result();
  $('dname').textContent = `${name || 'Guest'} · interposer`;
  replace(chipStage.world, 'chip', buildChip({ place: place(), result: r, taped: false }, cat));
  $('chipload').classList.add('done');
  const ref = r.ref ?? { gpu: 100, hbm: 85 };
  $('meters').innerHTML = !r.passed ? '' : [
    ['GPU max', bar(r.worstGpu - 25, (ref.gpu - 25) * 1.3), `${r.worstGpu} °C`],
    ['HBM max', bar(r.worstHbm - 25, (ref.hbm - 25) * 1.3), `${r.worstHbm} °C`],
    ['GB/s·mm', bar(r.weighted, 13500), `${r.weighted.toLocaleString()}`],
    ['Score', bar(r.score, 1.3), r.score.toFixed(3)],
  ].map(([k, b, v]) => `<span class="mute">${k}</span><pre class="ascii">${b}</pre><span class="stat">${v}</span>`).join('');
  const why = r.reason ?? '';
  $('checks').innerHTML = [['gap', !/clearance/.test(why)], ['ports', !/capacity|track/.test(why)], ['reach', !/reach|exceeds|needs/.test(why)], ['13,500', !/13,500/.test(why)], ['< 1.000', r.passed && r.score < 1]]
    .map(([l, ok]) => `<span class="${ok ? 'ok' : ''}">${ok ? '■' : '□'} ${l}</span>`).join('');
  $('hint').textContent = hintFor(r);
  drawHeat(r); drawPlace();
}

/** Judge wording → short plain words. */
function plain(why = '') {
  let m;
  if ((m = why.match(/^(\w+) and (\w+) violate/))) return `${m[1]} and ${m[2]} are too close (need 1 mm gap).`;
  if ((m = why.match(/^(\w+) violates package edge/))) return `${m[1]} is too close to the edge.`;
  if ((m = why.match(/(\w+)→(\w+) needs/))) return `${m[1]} is too far from ${m[2]}.`;
  if (/route .* exceeds/.test(why)) return 'A wire is too long.';
  if (/13,500/.test(why)) return 'Wires are too long overall. Pull GPUs closer to their HBMs.';
  return why;
}
function hintFor(r) {
  const cooled = me()?.cooled;
  if (!r.passed) return r.fix ? `✕ ${plain(r.reason)} → drag ${r.fix.id} to the dashed box, or tap the box.` : `✕ ${plain(r.reason)}`;
  const g = (r.worstGpu - 25) / (r.ref.gpu - 25), h = (r.worstHbm - 25) / (r.ref.hbm - 25);
  if (g >= h) return `→ GPU binds: ${r.worstGpu} °C in ${r.gpuWorkload.replace('_', ' ')}. Spread GPUs toward the cooler center.`;
  return `→ HBM binds: ${r.worstHbm} °C in ${r.hbmWorkload.replace('_', ' ')}. Move HBMs off GPU hot sides.`;
}

function renderResult() {
  const r = result();
  const board = Object.entries(s.chips || {}).filter(([, c]) => c.taped).sort((a, b) => (b[1].result.points ?? 0) - (a[1].result.points ?? 0));
  const rank = board.findIndex(([id]) => id === pid) + 1;
  $('rank').textContent = rank ? `#${rank} of ${board.length}` : '';
  $('score').textContent = r.score?.toFixed(3) ?? '—';
  $('die').textContent = '';
  $('stats').innerHTML = !r.passed ? '' : [
    ['Worst GPU', `${r.worstGpu} °C · ${r.gpuWorkload}`], ['Worst HBM', `${r.worstHbm} °C · ${r.hbmWorkload}`],
    ['Baseline', `${r.ref.gpu} / ${r.ref.hbm} °C`], ['Bandwidth·length', `${r.weighted.toLocaleString()} / 13,500`], ['Wire + PHY', `${(r.wireW + r.phyW).toFixed(1)} W`],
  ].map(([k, v]) => `<div class="row"><span class="mute">${k}</span><span class="stat">${v}</span></div>`).join('');
}

let pendingRoom = false;
function renderRoom(force) {
  const racks = s.racks || {};
  const sig = JSON.stringify(racks);
  if (force || sig !== roomSig) { roomSig = sig; replace(roomStage.world, 'rack', buildRoom(racks, cat)); }
  const n = Object.keys(racks).length;
  $('roomcount').textContent = `${n} rack${n === 1 ? '' : 's'} · ${s.totals.room.kw} kW`;
  const r = picked && racks[picked];
  if (!r) { $('roomtitle').textContent = 'Tap a rack'; $('roominfo').innerHTML = `<div class="row"><span class="mute">Room value</span><span class="stat">${money(s.totals.room.price)}</span></div><div class="row"><span class="mute">Purchased</span><span class="stat">${s.totals.room.ordered}</span></div>`; return; }
  const chip = s.chips?.[picked], online = !!s.players?.[picked];
  $('roomtitle').textContent = `${r.owner}${picked === pid ? ' · you' : ''}`;
  const comp = {}; r.slots.forEach(sl => { comp[sl.id] = (comp[sl.id] || 0) + 1; });
  const frame = cat.racks.find(f => f.id === r.rackId)?.name ?? r.rackId;
  $('roominfo').innerHTML = [
    ['Status', online ? '● Online' : 'Offline'], ['Frame', frame], ['Units', `${r.totals.u} / ${r.totals.capacity}U`], ['Power', `${r.totals.kw} kW`],
    ['Value', money(r.totals.price)], ['Order', r.ordered?.orderId ?? 'Not purchased'], ['Chip score', chip?.taped ? chip.result.score.toLocaleString() : '—'],
  ].map(([k, v]) => `<div class="row"><span class="mute">${k}</span><span class="stat">${v}</span></div>`).join('')
    + '<div class="label" style="margin:16px 0 6px">Components</div>'
    + (Object.entries(comp).map(([id, k]) => `<div class="row"><span>${cat.components.find(c => c.id === id)?.name ?? id}</span><span class="stat">× ${k}</span></div>`).join('') || '<div class="row mute"><span>Empty</span></div>');
}

// Rack customizer: step 1 components, step 2 paint. Paint UI is rebuilt only when its structure changes so
// color pickers stay open while other players' updates stream in.
const SWATCHES = ['#1c1d20', '#f2f2f2', '#8a8f98', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00e0a4', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d92'];
const PARTS = [['frame', 'Frame'], ['sides', 'Sides'], ['top', 'Top'], ['door', 'Door'], ['rails', 'Rails'], ['chassis', 'Chassis'], ['bezel', 'Bezels'], ['led', 'LEDs']];
const DESIGNS = ['none', 'stripes', 'chevron', 'circuit', 'flames', 'grid', 'dots'];
let rackStep = 'parts', paintPart = 'sides', rackUiSig = '';
const throttle = (fn, ms = 70) => { let t = 0, last; return v => { last = v; if (t) return; t = setTimeout(() => { t = 0; fn(last); }, ms); }; };
const sendPaint = throttle(([part, color]) => send({ type: 'rack.paint', part, color }));
const sendInk = throttle(ink => send({ type: 'rack.design', ink }));

function renderRack() {
  const r = mine(), ui = $('rackui'), p = paintOf(r);
  const built = buildRack(r, cat); replace(rackStage.world, 'rack', built);
  if (r.slots.length > lastSlots && lastSlots >= 0) slideIn(built.children.find(o => o.userData.slot === r.slots.length - 1));
  lastSlots = r.slots.length;
  if (!rackFitted) { rackFitted = true; requestAnimationFrame(fitRack); }
  $('sum').textContent = `${r.totals?.u ?? 0}/${r.totals?.capacity ?? 42}U · ${money(r.totals?.price ?? 1890)}`;
  const sig = JSON.stringify([rackStep, tab, paintPart, r.rackId, r.slots.map(x => x.id), !!r.ordered, r.totals?.price, rackStep === 'paint' ? p : 0]);
  if (sig === rackUiSig) return; rackUiSig = sig;
  ui.innerHTML = '';
  const steps = el('div', 'steps');
  steps.append(btn('1 · Components', () => { rackStep = 'parts'; render(); }, rackStep === 'parts' ? 'on' : ''), btn('2 · Paint', () => { rackStep = 'paint'; render(); }, rackStep === 'paint' ? 'on' : ''));
  ui.append(steps, Object.assign(el('div', 'err'), { id: 'rerr' }));
  if (rackStep === 'paint') renderPaint(ui, p); else renderParts(ui, r);
  const b = el('div', 'bar');
  b.append(btn('AR', ar), rackStep === 'parts' ? btn('Next · Paint →', () => { rackStep = 'paint'; render(); })
    : r.ordered ? btn('View room', () => go('room'), 'primary') : btn(`Purchase ${money(r.totals?.price ?? 1890)}`, () => { send({ type: 'rack.order' }); pendingRoom = true; }, 'primary'));
  if (pendingRoom && r.ordered) { pendingRoom = false; picked = pid; setTimeout(() => go('room'), 700); }
  ui.append(b);
}

function renderParts(ui, r) {
  const frames = el('div', 'chips'); cat.racks.forEach(f => frames.append(btn(f.name, () => send({ type: 'rack.frameType', id: f.id }), r.rackId === f.id ? 'on' : '')));
  const cats = el('div', 'chips');
  [...new Set(cat.components.map(c => c.cat))].forEach(c => cats.append(btn(c, () => { tab = c; render(); }, tab === c ? 'on' : '')));
  ui.append(frames, cats);
  cat.components.filter(c => c.cat === tab).forEach(c => {
    const it = el('div', 'item'); const n = el('div', 'n', c.name); n.append(el('div', 'p mute', `${c.u}U · ${c.kw} kW · ${money(c.price)}`));
    it.append(n, btn('Add', () => send({ type: 'rack.add', id: c.id }))); ui.append(it);
  });
  ui.append(Object.assign(el('div', 'label', `In rack · ${r.slots.length}`), { style: 'margin-top:16px' }));
  r.slots.forEach((sl, i) => { const c = cat.components.find(x => x.id === sl.id); const it = el('div', 'item'); it.append(el('span', 'n', c.name), btn('Remove', () => send({ type: 'rack.remove', index: i }))); ui.append(it); });
}

function swatchRow(current, pick, extra) {
  const row = el('div', 'swatches');
  if (extra) row.append(extra);
  SWATCHES.forEach(c => { const b = btn('', () => pick(c), current === c ? 'sw on' : 'sw'); b.style.background = c; b.dataset.c = c; b.setAttribute('aria-label', c); row.append(b); });
  const custom = colorIn(current || '#888888', pick); custom.oninput = () => pick(custom.value, true); custom.className = 'swc'; row.append(custom);
  return row;
}

function renderPaint(ui, p) {
  ui.append(el('div', 'label', 'Part'));
  const parts = el('div', 'chips parts');
  PARTS.forEach(([k, l]) => { const b = btn('', () => { paintPart = k; render(); }, paintPart === k ? 'on' : ''); b.dataset.part = k;
    const dot = el('i', 'dot'); dot.style.background = p[k] || '#888'; b.append(dot, document.createTextNode(l)); parts.append(b); });
  const live = (c, drag) => { if (drag) sendPaint([paintPart, c]); else send({ type: 'rack.paint', part: paintPart, color: c }); };
  const orig = paintPart === 'bezel' ? btn('Orig', () => send({ type: 'rack.paint', part: 'bezel', color: '' }), p.bezel === '' ? 'sw txt on' : 'sw txt') : null;
  ui.append(parts, swatchRow(p[paintPart], live, orig));
  const all = el('div', 'chips');
  all.append(btn('Body all this color', () => { const c = p[paintPart] || '#1c1d20'; send({ type: 'rack.paint', parts: { frame: c, sides: c, top: c, door: c } }); }));
  ui.append(all, Object.assign(el('div', 'label', 'Side design'), { style: 'margin-top:14px' }));
  const ds = el('div', 'chips designs'); DESIGNS.forEach(d => { const b = btn(d, () => send({ type: 'rack.design', design: d }), p.design === d ? 'on' : ''); b.dataset.design = d; ds.append(b); });
  ui.append(ds, el('div', 'label', 'Design ink'), swatchRow(p.ink, (c, drag) => drag ? sendInk(c) : send({ type: 'rack.design', ink: c })));
}

async function ar() {
  const a = document.createElement('a');
  if (a.relList?.supports?.('ar')) {
    const obj = rackStage.world.getObjectByName('rack'); if (!obj) return;
    const bytes = await new USDZExporter().parseAsync(obj);
    const ql = $('ql'); ql.href = URL.createObjectURL(new Blob([bytes], { type: 'model/vnd.usdz+zip' })); ql.click();
  } else location.href = `/xr.html?room=${room}&mode=rack`;
}

let errT;
function toast(msg) {
  const e = screen === 'rack' ? $('rerr') : $('err'); if (!e) return;
  e.textContent = msg; clearTimeout(errT); errT = setTimeout(() => e.textContent = '', 2500);
}
function el(tag, cls = '', text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, fn, cls = '') { const b = el('button', cls, label); b.onclick = fn; return b; }
function colorIn(v, fn) { const i = el('input'); i.type = 'color'; i.value = v; i.onchange = () => fn(i.value); return i; }

// Deep links: ?mode=rack opens the builder directly once a name exists.
send({ type: 'player.name', name }); go('menu');
