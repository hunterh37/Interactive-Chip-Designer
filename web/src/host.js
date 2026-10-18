import QRCode from 'qrcode';
import { catalog, connect } from './net.js';
import { stage, buildRoom, buildChip, buildDieGrid, replace, realityHDProps } from './scene.js';
import { monoCatalog, asciiField, scramble } from './ascii.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let mode = params.get('mode') === 'rack' ? 'rack' : 'chip';
const STAGES = ['Join', 'Design', 'Results'];
let st = Math.max(0, STAGES.indexOf(params.get('stage') || 'Join'));
const cat = monoCatalog(await catalog());
const room = (params.get('room') || 'DEMO').toUpperCase();

const { world, controls, camera, tick } = stage($('view'));
realityHDProps(world);
const field = asciiField($('field'), { alpha: 0.16 });
let localAt = 0, last = null, view = '', leader = null, seen = new Set(), t0 = 0;
tick.push(t => {
  const d = world.getObjectByName('chip'); if (d && d.userData.spin) d.rotation.y = t / 7000;
  if (STAGES[st] === 'Join') { camera.position.x = Math.sin(t / 9000) * 2.2; camera.position.z = Math.cos(t / 9000) * 3.6; }
});

const sync = () => history.replaceState(null, '', `?mode=${mode}&stage=${STAGES[st]}`);
function goStage(i) {
  st = Math.max(0, Math.min(STAGES.length - 1, i)); sync(); view = '';
  localAt = Date.now(); net.send({ type: 'show.set', stage: st, mode });
  field.pulse(); render();
}
$('prev').onclick = () => goStage(st - 1);
$('next').onclick = () => goStage(st + 1);
addEventListener('keydown', e => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goStage(st + 1); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); goStage(st - 1); }
});
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; sync(); view = ''; showQR(); localAt = Date.now(); net.send({ type: 'show.set', stage: st, mode }); render(); });
$('reset').onclick = () => confirm('Clear all racks, dies and scores?') && (seen.clear(), net.send({ type: 'lobby.reset' }), goStage(0));

const guests = () => Object.entries(last.players).filter(([, p]) => p.kind === 'phone');
const taped = () => Object.entries(last.chips || {}).filter(([, c]) => c.taped).sort((a, b) => b[1].result.score - a[1].result.score);

function setCam(px, py, pz, tx, ty, tz) { camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); }

function render() {
  if (!last) return;
  const S = STAGES[st], hall = world.getObjectByName('hall');
  $('sname').textContent = `${String(st + 1).padStart(2, '0')} · ${S}`;
  $('dots').innerHTML = STAGES.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('');
  $('prev').disabled = st === 0; $('next').disabled = st === STAGES.length - 1;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  const gs = guests();

  // join layer
  $('join').classList.toggle('hidden', S !== 'Join');
  $('mini').classList.toggle('hidden', S === 'Join');
  if ($('count').textContent !== String(gs.length)) { $('count').textContent = gs.length; field.pulse(); }
  $('countlbl').textContent = gs.length === 1 ? 'Player connected' : 'Players connected';
  $('names').innerHTML = gs.map(([, p]) => `<span>${p.name}</span>`).join('');
  $('count2').textContent = `${gs.length} live`;
  $('field').style.opacity = mode === 'chip' || S === 'Join' ? 1 : 0;

  // scene
  const sig = `${S}|${mode}|${JSON.stringify(mode === 'chip' ? last.chips : last.racks)}`;
  if (sig !== view) {
    const fresh = !view.startsWith(`${S}|${mode}|`); view = sig;
    if (hall) hall.visible = mode === 'rack';
    if (mode === 'rack') {
      replace(world, 'chip', null); replace(world, 'rack', buildRoom(last.racks, cat));
      if (fresh) S === 'Join' ? setCam(0, 1.8, 3.6, 0, 1, 0) : S === 'Design' ? setCam(1.6, 1.9, 4.2, 0, 1.1, 0) : setCam(0, 2.6, 5.4, 0, 1, 0);
    } else {
      replace(world, 'rack', null);
      const board = taped();
      if (S === 'Results' && board[0]) {
        const d = buildChip(board[0][1], cat); d.name = 'chip'; d.userData.spin = true; replace(world, 'chip', d);
        if (fresh) setCam(0, 1.45, 0.85, 0, 0.82, 0);
      } else {
        const g = buildDieGrid(last.chips, cat); replace(world, 'chip', g);
        const span = Math.max(g.userData.cols || 1, g.userData.rows || 1);
        if (fresh || S === 'Design') setCam(0, 1.1 + span * 0.85, 0.6 + span * 0.7, 0, 0.8, 0);
      }
    }
  }

  // overlays
  const board = taped();
  const showBoard = mode === 'chip' && S !== 'Join';
  $('board').classList.toggle('hidden', !showBoard);
  $('boardlbl').textContent = S === 'Results' ? 'Final · effective TFLOPS' : 'Leaderboard · effective TFLOPS';
  $('rows').innerHTML = board.slice(0, 8).map(([id, c], i) =>
    `<div class="row${seen.has(id) ? '' : ' new'}"><span>${String(i + 1).padStart(2, '0')}  ${c.owner}</span><b>${c.result.score.toLocaleString()}</b></div>`).join('')
    || '<div class="row mute"><span>No tape-outs yet</span><b>—</b></div>';
  board.forEach(([id]) => seen.add(id));

  const t = last.totals, designing = Object.values(last.chips || {}).filter(c => !c.taped && c.cells.some(Boolean)).length;
  $('stats').classList.toggle('hidden', S === 'Join');
  $('stats').innerHTML = (mode === 'rack'
    ? [['Racks', t.room.racks], ['Power', `${t.room.kw} kW`], ['Value', '$' + t.room.price.toLocaleString('en-US')], ['Purchased', t.room.ordered]]
    : [['Designing', designing], ['Taped out', board.length], ['Best', board[0] ? board[0][1].result.score.toLocaleString() : '—']])
    .map(([k, v]) => `<div class="row"><span class="mute">${k}</span><b class="stat">${v}</b></div>`).join('');

  const head = S === 'Join' ? `${gs.length} live · scan to join`
    : mode === 'chip' ? (S === 'Results' && board[0] ? `${board[0][1].owner} wins · ${board[0][1].result.score.toLocaleString()}` : board[0] ? `${board[0][1].owner} leads · ${board[0][1].result.score.toLocaleString()}` : `${designing} designing`)
    : `${t.room.racks} racks · ${t.room.kw} kW`;
  if (head !== leader) { leader = head; scramble($('headline'), head.toUpperCase(), 500); }
}

async function showQR() {
  const url = `${location.origin}/join.html?room=${room}${mode === 'rack' ? '&mode=rack' : ''}`;
  const opt = { width: 760, margin: 0, color: { dark: '#000000', light: '#ffffff' } };
  await QRCode.toCanvas($('qr'), url, opt); await QRCode.toCanvas($('qr2'), url, { ...opt, width: 200 });
  $('code').textContent = room; $('code2').textContent = room; $('url').textContent = url.replace(/^https?:\/\//, '');
}

const net = connect({ room, kind: 'host', mode, name: 'Stage', onState: s => {
  const first = !last; last = s;
  if (first && params.get('stage')) { localAt = Date.now(); net.send({ type: 'show.set', stage: st, mode }); } // explicit URL stage wins on load
  else if (first && s.show) { st = s.show.stage; mode = s.show.mode; sync(); showQR(); }
  else if (s.show && Date.now() - localAt > 800 && (s.show.stage !== st || s.show.mode !== mode)) { st = s.show.stage; mode = s.show.mode; view = ''; sync(); showQR(); } // follow XR presenter
  render();
} });
showQR(); sync();
