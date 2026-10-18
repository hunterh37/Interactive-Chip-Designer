import QRCode from 'qrcode';
import { catalog, connect } from './net.js';
import { stage, buildRoom, buildChip, replace, realityHDProps } from './scene.js';

const params = new URLSearchParams(location.search);
let mode = params.get('mode') === 'chip' ? 'chip' : 'rack';
const cat = await catalog();
const room = (params.get('room') || 'DEMO').toUpperCase();
history.replaceState(null, '', `?mode=${mode}`);

const { world, controls, tick } = stage(document.getElementById('view'));
realityHDProps(world);
tick.push(t => { const r = world.getObjectByName(mode); if (r && mode === 'chip') r.rotation.y = t / 6000; });
let last;

function render() {
  if (!last) return;
  replace(world, 'rack', mode === 'rack' ? buildRoom(last.racks, cat) : null);
  replace(world, 'chip', mode === 'chip' ? buildChip(last.chip, cat) : null);
  controls.target.set(0, mode === 'rack' ? 1 : 0.85, 0);
  const t = last.totals, s = document.getElementById('stats');
  s.innerHTML = mode === 'rack'
    ? `<div class="row"><span class="mute">Racks</span><b class="stat">${t.room.racks}</b></div>
       <div class="row"><span class="mute">Power</span><b class="stat">${t.room.kw} kW</b></div>
       <div class="row"><span class="mute">Value</span><b class="stat">$${t.room.price.toLocaleString()}</b></div>
       <div class="row"><span class="mute">Purchased</span><b class="stat">${t.room.ordered}</b></div>
       <button id="reset">Reset lobby</button>`
    : `<div class="row"><span class="mute">Area</span><b class="stat">${t.chip.usedMM2} mm²</b></div>
       <div class="row"><span class="mute">Compute</span><b class="stat">${t.chip.tflops} TFLOPS</b></div>
       <div class="row"><span class="mute">TDP</span><b class="stat">${t.chip.watts} W</b></div>
       ${last.chip.taped ? '<div class="row"><span>Taped out</span><b>✓</b></div>' : ''}`;
  document.getElementById('reset')?.addEventListener('click', () => confirm('Clear all racks and the die?') && net.send({ type: 'lobby.reset' }));
  const n = Object.values(last.racks).length; controls.target.x = 0; if (mode === 'rack') controls.object.position.set(0, 1.6, 2.2 + n * 0.45);
  const ps = Object.values(last.players);
  document.getElementById('players').textContent = `${ps.length} connected · ${ps.map(p => p.name).join(', ')}`;
}

async function showQR() {
  const url = `${location.origin}/join.html?room=${room}&mode=${mode}`;
  await QRCode.toCanvas(document.getElementById('qr'), url, { width: 600, margin: 1 });
  document.getElementById('qr').style.width = '100%'; document.getElementById('qr').style.height = 'auto';
  document.getElementById('code').textContent = room;
  document.getElementById('url').textContent = url;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
}

document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  mode = b.dataset.mode; history.replaceState(null, '', `?room=${room}&mode=${mode}`); showQR(); render();
});
const net = connect({ room, kind: 'host', mode, name: 'Stage', onState: s => { last = s; render(); } });
showQR();
