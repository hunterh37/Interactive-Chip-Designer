import { catalog, connect } from './net.js';
import * as THREE from 'three';
import { stage, buildRack, buildChip, buildRoom, replace, emptyRack, realityHDProps } from './scene.js';
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
  ['Power budget', `≤ ${POWER} W`], ['Memory', '≥ 1 × HBM4'], ['Interconnect', '≥ 1 × I/O'], ['Control', '≥ 1 × CPU'], ['Die', `${cat.die.cols}×${cat.die.rows} · ${cat.die.reticleMM2} mm²`],
].map(([k, v]) => `<div class="row"><span class="mute">${k}</span><span>${v}</span></div>`).join('');
$('begin').onclick = () => { send({ type: 'my.clear' }); deadline = Date.now() + DURATION * 1000; go('design'); };

// ── design
const chipStage = stage($('view'));
chipStage.scene.background = null;
chipStage.camera.position.set(0, 1.55, 0.62); chipStage.controls.target.set(0, 0.82, 0); chipStage.controls.enableZoom = false;
chipStage.tick.push(t => { const c = chipStage.world.getObjectByName('chip'); if (c) c.rotation.y = Math.sin(t / 3000) * 0.25; });
$('pal').innerHTML = '';
cat.chipBlocks.forEach(b => {
  const x = document.createElement('button'); x.dataset.id = b.id;
  x.innerHTML = `<i>${b.glyph}</i>${b.short}`; x.onclick = () => { brush = b.id; render(); };
  $('pal').append(x);
});
const grid = $('grid');
for (let i = 0; i < cat.die.cols * cat.die.rows; i++) { const d = document.createElement('div'); d.dataset.i = i; grid.append(d); }
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
  if (screen !== 'design') return;
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
$('rack-back').onclick = () => go('menu');
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

function render() {
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
  $('pal').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === brush));
  [...grid.children].forEach((d, i) => {
    const st = BLOCK_STYLE[c[i]];
    d.textContent = st ? st.g : '·'; d.className = st ? 'f' : ''; d.style.background = st ? st.c : '';
  });
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

function renderRack() {
  const r = mine(), ui = $('rackui');
  replace(rackStage.world, 'rack', buildRack(r, cat)); rackStage.controls.target.set(0, 1, 0);
  $('sum').textContent = `${r.totals?.u ?? 0}/${r.totals?.capacity ?? 42}U · ${money(r.totals?.price ?? 1890)}`;
  ui.innerHTML = '';
  const frames = el('div', 'chips'); cat.racks.forEach(f => frames.append(btn(f.name, () => send({ type: 'rack.frameType', id: f.id }), r.rackId === f.id ? 'on' : '')));
  const colors = el('div', 'item');
  colors.append(el('span', 'n', 'Frame / accent'), colorIn(r.frame, v => send({ type: 'rack.color', frame: v })), colorIn(r.accent, v => send({ type: 'rack.color', accent: v })));
  const cats = el('div', 'chips');
  [...new Set(cat.components.map(c => c.cat))].forEach(c => cats.append(btn(c, () => { tab = c; render(); }, tab === c ? 'on' : '')));
  ui.append(frames, colors, cats, Object.assign(el('div', 'err'), { id: 'rerr' }));
  cat.components.filter(c => c.cat === tab).forEach(c => {
    const it = el('div', 'item'); const n = el('div', 'n', c.name); n.append(el('div', 'p mute', `${c.u}U · ${c.kw} kW · ${money(c.price)}`));
    it.append(n, btn('Add', () => send({ type: 'rack.add', id: c.id }))); ui.append(it);
  });
  ui.append(Object.assign(el('div', 'label', `In rack · ${r.slots.length}`), { style: 'margin-top:16px' }));
  r.slots.forEach((sl, i) => { const c = cat.components.find(x => x.id === sl.id); const it = el('div', 'item'); it.append(el('span', 'n', c.name), btn('Remove', () => send({ type: 'rack.remove', index: i }))); ui.append(it); });
  const b = el('div', 'bar');
  b.append(btn('AR', ar), r.ordered ? btn('View room', () => go('room'), 'primary') : btn(`Purchase ${money(r.totals?.price ?? 1890)}`, () => { send({ type: 'rack.order' }); pendingRoom = true; }, 'primary'));
  if (pendingRoom && r.ordered) { pendingRoom = false; picked = pid; setTimeout(() => go('room'), 700); }
  ui.append(b);
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
if (name) { send({ type: 'player.name', name }); go(q.get('mode') === 'rack' ? 'rack' : 'menu'); }
else setTimeout(() => $('name').focus(), 300);
