import QRCode from 'qrcode';
import { catalog, createRoom, connect } from './net.js';
import { stage, buildRack, buildChip, replace, realityHDProps } from './scene.js';

const params = new URLSearchParams(location.search);
let mode = params.get('mode') === 'chip' ? 'chip' : 'rack';
const cat = await catalog();
const room = params.get('room') || (await createRoom()).code;
history.replaceState(null, '', `?room=${room}&mode=${mode}`);

const { world, controls, tick } = stage(document.getElementById('view'));
realityHDProps(world);
tick.push(t => { const r = world.getObjectByName(mode); if (r && mode === 'chip') r.rotation.y = t / 6000; });
let last;

function render() {
  if (!last) return;
  replace(world, 'rack', mode === 'rack' ? buildRack(last.rack, cat) : null);
  replace(world, 'chip', mode === 'chip' ? buildChip(last.chip, cat) : null);
  controls.target.set(0, mode === 'rack' ? 1 : 0.85, 0);
  const t = last.totals, s = document.getElementById('stats');
  s.innerHTML = mode === 'rack'
    ? `<div class="row"><span class="mute">Units</span><b class="stat">${t.rack.u} / ${t.rack.capacity}U</b></div>
       <div class="row"><span class="mute">Power</span><b class="stat">${t.rack.kw} kW</b></div>
       <div class="row"><span class="mute">Price</span><b class="stat">$${t.rack.price.toLocaleString()}</b></div>
       ${last.rack.ordered ? `<div class="row"><span>Ordered</span><b>${last.rack.ordered.orderId}</b></div>` : ''}`
    : `<div class="row"><span class="mute">Area</span><b class="stat">${t.chip.usedMM2} mm²</b></div>
       <div class="row"><span class="mute">Compute</span><b class="stat">${t.chip.tflops} TFLOPS</b></div>
       <div class="row"><span class="mute">TDP</span><b class="stat">${t.chip.watts} W</b></div>
       ${last.chip.taped ? '<div class="row"><span>Taped out</span><b>✓</b></div>' : ''}`;
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
connect({ room, kind: 'host', mode, name: 'Stage', onState: s => { last = s; render(); } });
showQR();
