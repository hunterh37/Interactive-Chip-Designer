import { catalog, connect } from './net.js';
import * as THREE from 'three';
import { stage, buildRack, buildChip, buildRoom, replace, emptyRack, realityHDProps, paintOf } from './scene.js';
import { monoCatalog, BLOCK_STYLE, bar, scramble, asciiField, asciiDie, LOGO } from './ascii.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const room = (q.get('room') || 'DEMO').toUpperCase();
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const pid = store.get('cd-pid') || Math.random().toString(36).slice(2, 12); store.set('cd-pid', pid);
let name = store.get('cd-name') || '';
const cat = monoCatalog(await catalog());
const DURATION = 120, POWER = 1000;
const money = n => '$' + n.toLocaleString('en-US');

// ── state + net
let s = null, screen = 'intro', brush = 'tensor', deadline = 0, fabbing = false, tab = cat.components[0].cat;
const net = connect({ room, kind: 'phone', mode: 'chip', name: name || 'guest', pid, onState: st => { s = st; render(); }, onError: e => toast(e) });
const send = op => net.send(op);
const me = () => s?.chips?.[pid];
const result = () => me()?.result ?? { tflops: 0, watts: 0, bandwidth: 0, effective: 0, score: 0, checks: {}, usedMM2: 0 };
const cells = () => me()?.cells ?? Array(cat.die.cols * cat.die.rows).fill(null);

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
$('name').onkeydown = e => e.key === 'Enter' && enter();

// ── menu
$('go-chip').onclick = () => { me()?.taped ? go('result') : go('brief'); };
$('go-rack').onclick = () => go('rack');

// ── brief
$('brief-back').onclick = () => go('menu');
$('spec').innerHTML = [
  ['Power budget', `≤ ${POWER} W`], ['Memory', '≥ 1 × HBM4 · edge'], ['Interconnect', '≥ 1 × I/O · edge'], ['Control', '≥ 1 × CPU'], ['Die', `${cat.die.cols}×${cat.die.rows} · ${cat.die.reticleMM2} mm²`],
].map(([k, v]) => `<div class="row"><span class="mute">${k}</span><span>${v}</span></div>`).join('');
$('begin').onclick = () => {
  send({ type: 'my.clear' }); deadline = Date.now() + DURATION * 1000; go('design'); $('binfo').textContent = INFO[brush];
  if (!store.get('cd-tip')) { tipHeld = Date.now(); showTip(); }
};

// ── design
const chipStage = stage($('view'));
chipStage.scene.background = null;
chipStage.camera.position.set(0, 1.55, 0.62); chipStage.controls.target.set(0, 0.82, 0); chipStage.controls.enableZoom = false;
chipStage.tick.push(t => { const c = chipStage.world.getObjectByName('chip'); if (c) c.rotation.y = Math.sin(t / 3000) * 0.25; });
$('pal').innerHTML = '';
cat.chipBlocks.forEach(b => {
  const x = document.createElement('button'); x.dataset.id = b.id;
  x.innerHTML = `<i>${b.glyph}</i>${b.short}`; x.onclick = () => { brush = b.id; $('binfo').textContent = INFO[b.id] ?? ''; render(); };
  $('pal').append(x);
});
const grid = $('grid');
const isEdge = i => { const x = i % cat.die.cols, y = Math.floor(i / cat.die.cols); return !x || !y || x === cat.die.cols - 1 || y === cat.die.rows - 1; };
for (let i = 0; i < cat.die.cols * cat.die.rows; i++) { const d = document.createElement('div'); d.dataset.i = i; grid.append(d); }
const INFO = {
  tensor: 'Tensor cores: matrix math. All the compute, most of the power (~20 W/cell).',
  sram: 'SRAM cache: on-die memory. +150 TF of bandwidth, low power.',
  hbm: 'HBM4 PHY: stacked DRAM link. +900 TF of bandwidth. Edge cells only.',
  cpu: 'Arm CPU cluster: control. At least 1 required.',
  noc: 'Network-on-chip: wiring between blocks. No score.',
  io: 'NVLink / CPO I/O: chip-to-chip link. At least 1, edge cells only.',
};

// ── how-to popover: loops a demo floorplan being drawn
const DEMO = [
  ['Pick a block below, then tap or drag on the die to place it. Tap again to erase.', 'tensor', [27, 28, 35, 36]],
  ['Tensor cores make compute. Fill the middle of the die with them.', 'tensor', [18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45]],
  ['Compute is capped by memory bandwidth. Put HBM4 on the dashed edge cells to feed it.', 'hbm', [8, 16, 24, 15, 23, 31]],
  ['SRAM next to the cores adds a little more bandwidth.', 'sram', [10, 13, 50, 53]],
  ['Add 1 CPU and 1 I/O (edge) to pass the checks. Stay under 1000 W.', 'cpu', [2], 'io', [60]],
  ['Highest effective TFLOPS wins. Tape out before the timer hits 0.', null, []],
];
const demo = $('demo');
for (let i = 0; i < cat.die.cols * cat.die.rows; i++) { const d = document.createElement('div'); if (isEdge(i)) d.className = 'e'; d.textContent = '·'; demo.append(d); }
let demoT = null;
function showTip() {
  $('tip').hidden = false; clearTimeout(demoT);
  const put = (i, id) => { const d = demo.children[i], st = BLOCK_STYLE[id]; d.textContent = st.g; d.className = 'f pop'; d.style.background = st.c; };
  const run = (step, k) => {
    if ($('tip').hidden) return;
    if (step === 0 && k === 0) [...demo.children].forEach((d, i) => { d.textContent = '·'; d.className = isEdge(i) ? 'e' : ''; d.style.background = ''; });
    const [cap, ...pairs] = DEMO[step];
    const todo = []; for (let p = 0; p < pairs.length; p += 2) if (pairs[p]) pairs[p + 1].forEach(i => todo.push([i, pairs[p]]));
    $('tipcap').textContent = cap; $('tipstep').textContent = `${step + 1} / ${DEMO.length}`;
    if (k < todo.length) { put(...todo[k]); demoT = setTimeout(() => run(step, k + 1), 160); }
    else demoT = setTimeout(() => run((step + 1) % DEMO.length, 0), 1900);
  };
  run(0, 0);
}
let tipHeld = 0;
$('help').onclick = () => { tipHeld = Date.now(); showTip(); };
$('tipok').onclick = () => { $('tip').hidden = true; clearTimeout(demoT); store.set('cd-tip', '1'); deadline += Date.now() - tipHeld; };
let painting = false, lastCell = -1;
const paintAt = e => {
  const t = document.elementFromPoint(e.clientX, e.clientY); if (!t?.dataset?.i || !grid.contains(t)) return;
  const i = +t.dataset.i; if (i === lastCell) return; lastCell = i;
  const block = cells()[i] === brush ? null : brush;
  if (cells()[i] === block) return;
  t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
  if (navigator.vibrate) navigator.vibrate(4);
  send({ type: 'my.paint', cell: i, block });
};
grid.onpointerdown = e => { painting = true; lastCell = -1; grid.setPointerCapture(e.pointerId); paintAt(e); };
grid.onpointermove = e => painting && paintAt(e);
grid.onpointerup = grid.onpointercancel = () => { painting = false; };
$('clear').onclick = () => send({ type: 'my.clear' });
$('tape').onclick = () => tapeout();

function tapeout() {
  if (fabbing) return;
  if (!cells().some(Boolean)) return toast('empty die');
  fabbing = true; send({ type: 'my.tapeout' }); fab();
}

setInterval(() => {
  if (screen !== 'design' || !$('tip').hidden) return;
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  $('timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('low', left <= 10);
  if (left === 0) cells().some(Boolean) ? tapeout() : (deadline = Date.now() + 30e3, toast('place at least one block'));
}, 250);

// ── fab sequence
async function fab() {
  go('fab'); const log = $('fablog'); log.innerHTML = '';
  const steps = ['Netlist freeze', 'Place & route', 'EUV lithography · 14 layers', 'Etch & deposit', 'CoWoS package', 'Burn-in · bin'];
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

// Host owns the active program (s.show.mode). Guests see only that one and follow switches.
const CHIP_SCREENS = ['brief', 'design', 'fab', 'result'], RACK_SCREENS = ['rack', 'room'];
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
    if (m === 'rack') { rackFitted = false; lastSlots = -1; rackUiSig = ''; go('rack'); } else go(me()?.taped ? 'result' : 'brief');
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
  if (screen === 'rack') renderRack();
  if (screen === 'room') renderRoom();
}

function renderDesign() {
  const r = result(), c = cells();
  $('dname').textContent = `${name || 'Guest'} · die`;
  replace(chipStage.world, 'chip', buildChip({ cells: c, taped: false }, cat));
  const cap = 6500;
  $('meters').innerHTML = [
    ['Compute', bar(r.tflops, cap), `${r.tflops.toLocaleString()} TF`],
    ['Bandwidth', bar(r.bandwidth, cap), `${r.bandwidth.toLocaleString()} TF`],
    ['Power', bar(r.watts, POWER * 1.3), `${r.watts} W`],
    ['Effective', bar(r.effective, cap), `${r.effective.toLocaleString()} TF`],
  ].map(([k, b, v]) => `<span class="mute">${k}</span><pre class="ascii">${b}</pre><span class="stat">${v}</span>`).join('');
  const ck = r.checks || {};
  $('checks').innerHTML = [['power', `≤${POWER}W`], ['memory', 'HBM'], ['io', 'I/O'], ['control', 'CPU']]
    .map(([k, l]) => `<span class="${ck[k] ? 'ok' : ''}">${ck[k] ? '■' : '□'} ${l}</span>`).join('');
  $('hint').textContent = hintFor(r, c);
  $('pal').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === brush));
  [...grid.children].forEach((d, i) => {
    const st = BLOCK_STYLE[c[i]];
    d.textContent = st ? st.g : '·'; d.style.background = st ? st.c : '';
    d.className = [st ? 'f' : '', isEdge(i) ? 'e' : '', (c[i] === 'hbm' || c[i] === 'io') && !isEdge(i) ? 'bad' : ''].join(' ').trim();
  });
}

function hintFor(r, c) {
  const has = id => c.includes(id), ck = r.checks || {};
  if (!has('tensor')) return '→ Place tensor cores. They make the compute.';
  if (r.misplaced) return '✕ HBM4 and I/O only work on the dashed edge cells.';
  if (!ck.memory) return '→ Add HBM4 on the edge. Compute is 0 without bandwidth.';
  if (!ck.power) return `✕ ${r.watts} W is over budget. Remove tensor cores.`;
  if (r.bandwidth < r.tflops) return `→ Memory-bound: ${(r.tflops - r.bandwidth).toLocaleString()} TF idle. Add HBM4 or SRAM.`;
  if (!ck.io) return '→ Add an I/O block on the edge.';
  if (!ck.control) return '→ Add a CPU cluster.';
  if (r.tflops < r.bandwidth && r.watts < POWER - 20) return `→ Compute-bound: ${POWER - r.watts} W left. Add tensor cores.`;
  return '■ Balanced. Tape out, or trade cells for more.';
}

function renderResult() {
  const r = result();
  const board = Object.entries(s.chips || {}).filter(([, c]) => c.taped).sort((a, b) => b[1].result.score - a[1].result.score);
  const rank = board.findIndex(([id]) => id === pid) + 1;
  $('rank').textContent = rank ? `#${rank} of ${board.length}` : '';
  $('score').textContent = r.score.toLocaleString();
  $('die').textContent = asciiDie(cells(), cat.die.cols);
  $('stats').innerHTML = [
    ['Effective compute', `${r.effective.toLocaleString()} TFLOPS`], ['Peak compute', `${r.tflops.toLocaleString()} TFLOPS`],
    ['Bandwidth limit', `${r.bandwidth.toLocaleString()} TFLOPS`], ['TDP', `${r.watts} W`], ['Area', `${r.usedMM2} mm²`],
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
if (name) { send({ type: 'player.name', name }); go('menu'); }
else setTimeout(() => $('name').focus(), 300);
