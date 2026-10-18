import { catalog, connect } from './net.js';
import { stage, buildRack, buildChip, replace, emptyRack } from './scene.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

const q = new URLSearchParams(location.search);
const room = (q.get('room') || 'DEMO').toUpperCase();
let mode = q.get('mode') === 'chip' ? 'chip' : 'rack';
const name = localStorage.getItem('cd-name') || `Player ${Math.floor(Math.random() * 90 + 10)}`;
localStorage.setItem('cd-name', name);
const pid = localStorage.getItem('cd-pid') || Math.random().toString(36).slice(2, 12);
localStorage.setItem('cd-pid', pid);
const cat = await catalog();
const { world, controls } = stage(document.getElementById('view'));
const ui = document.getElementById('ui');
document.getElementById('room').textContent = room;
let s, tab = 'gpu', brush = cat.chipBlocks[0].id, errT;
const net = connect({ room, kind: 'phone', mode, name, pid, onState: st => { s = st; draw(); }, onError: e => toast(e) });
const send = op => net.send(op);
const money = n => '$' + n.toLocaleString();
function toast(msg) { const e = document.querySelector('.err'); if (!e) return; e.textContent = msg; clearTimeout(errT); errT = setTimeout(() => e.textContent = '', 2500); }

function draw() {
  if (!s) return;
  replace(world, 'rack', mode === 'rack' ? buildRack(mine(), cat) : null);
  replace(world, 'chip', mode === 'chip' ? buildChip(s.chip, cat) : null);
  controls.target.set(0, mode === 'rack' ? 1 : 0.85, 0);
  const t = s.totals;
  document.getElementById('sum').textContent = mode === 'rack' ? `${mine().totals?.u ?? 0}/${mine().totals?.capacity ?? 42}U · ${money(mine().totals?.price ?? 1890)}` : `${t.chip.tflops} TFLOPS · ${t.chip.watts} W`;
  ui.innerHTML = '';
  const tabs = el('div', 'tabs');
  for (const m of ['rack', 'chip']) tabs.append(btn(m === 'rack' ? 'Server Rack' : 'Chip Design', () => { mode = m; draw(); }, mode === m ? 'on' : ''));
  ui.append(tabs, el('div', 'mute', s.started ? '● Live: your rack is in the server room on the big screen' : 'Lobby: design now, host starts the experience'), el('div', 'err'));
  mode === 'rack' ? rackUI() : chipUI();
}

const mine = () => s.racks[pid] ?? emptyRack();

function rackUI() {
  const r = mine();
  const colors = el('div', 'item');
  colors.append(el('span', 'n', 'Frame / accent'), colorIn(r.frame, v => send({ type: 'rack.color', frame: v })), colorIn(r.accent, v => send({ type: 'rack.color', accent: v })));
  const frames = el('div', 'pal');
  cat.racks.forEach(f => frames.append(btn(f.name, () => send({ type: 'rack.frameType', id: f.id }), r.rackId === f.id ? 'on' : '')));
  const cats = el('div', 'pal'); cats.style.margin = '12px 0 4px';
  [...new Set(cat.components.map(c => c.cat))].forEach(c => cats.append(btn(c, () => { tab = c; draw(); }, tab === c ? 'on' : '')));
  ui.append(frames, colors, cats);
  cat.components.filter(c => c.cat === tab).forEach(c => {
    const it = el('div', 'item'); const sw = el('span', 'sw'); sw.style.background = c.color;
    const n = el('div', 'n', c.name); n.append(el('div', 'p mute', `${c.u}U · ${c.kw} kW · ${money(c.price)}`));
    it.append(sw, n, btn('Add', () => send({ type: 'rack.add', id: c.id }))); ui.append(it);
  });
  ui.append(el('h4', '', `In rack (${r.slots.length})`));
  r.slots.forEach((sl, i) => {
    const c = cat.components.find(x => x.id === sl.id);
    const it = el('div', 'item'); it.append(el('span', 'n', c.name), btn('Remove', () => send({ type: 'rack.remove', index: i }))); ui.append(it);
  });
  const bar = el('div', 'bar');
  bar.append(r.ordered ? el('div', 'n', `Order ${r.ordered.orderId} · ${money(r.ordered.price)}`) : btn(`Purchase ${money(r.totals?.price ?? 1890)}`, () => send({ type: 'rack.order' }), 'primary'));
  ui.append(bar);
}

function chipUI() {
  const pal = el('div', 'pal');
  cat.chipBlocks.forEach(b => { const x = btn(b.name, () => { brush = b.id; draw(); }, brush === b.id ? 'on' : ''); x.style.borderLeft = `6px solid ${b.color}`; pal.append(x); });
  pal.append(btn('Erase', () => { brush = null; draw(); }, brush === null ? 'on' : ''));
  const grid = el('div', 'grid');
  const colorOf = new Map(cat.chipBlocks.map(b => [b.id, b.color]));
  s.chip.cells.forEach((id, i) => {
    const c = el('div'); if (id) c.style.background = colorOf.get(id);
    c.onclick = () => send({ type: 'chip.paint', cell: i, block: brush }); grid.append(c);
  });
  const bar = el('div', 'bar');
  bar.append(btn('Clear', () => send({ type: 'chip.clear' })), btn(s.chip.taped ? 'Taped out ✓' : 'Tape out', () => send({ type: 'chip.tapeout' }), 'primary'));
  ui.append(pal, grid, bar);
}

// AR: iOS → AR Quick Look via USDZ export of the live model; Android → WebXR immersive-ar page.
document.getElementById('full').onclick = e => {
  const on = document.body.classList.toggle('full');
  e.target.textContent = on ? 'Edit' : 'Full view';
  dispatchEvent(new Event('resize'));
};
document.getElementById('ar').onclick = async () => {
  const a = document.createElement('a');
  if (a.relList?.supports?.('ar')) {
    const obj = world.getObjectByName(mode); if (!obj) return;
    const bytes = await new USDZExporter().parseAsync(obj);
    const ql = document.getElementById('ql');
    ql.href = URL.createObjectURL(new Blob([bytes], { type: 'model/vnd.usdz+zip' }));
    ql.click();
  } else location.href = `/xr.html?room=${room}&mode=${mode}`;
};

function el(tag, cls = '', text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, fn, cls = '') { const b = el('button', cls, label); b.onclick = fn; return b; }
function colorIn(v, fn) { const i = el('input'); i.type = 'color'; i.value = v; i.onchange = () => fn(i.value); return i; }
