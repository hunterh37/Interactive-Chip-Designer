// WebXR presenter (Vision Pro Safari / Quest): same stages as the desktop host, driven by shared `show` state.
import * as THREE from 'three';
import QRCode from 'qrcode';
import { catalog, connect } from './net.js';
import { stage, buildRoom, buildChip, buildDieGrid, replace, realityHDProps } from './scene.js';
import { monoCatalog } from './ascii.js';
import { hostGate } from './hostgate.js'; hostGate();

const q = new URLSearchParams(location.search);
const room = (q.get('room') || 'DEMO').toUpperCase();
const STAGES = ['Join', 'Design', 'Results'];
const cat = monoCatalog(await catalog());
const { renderer, scene, world, camera, controls } = stage(document.getElementById('view'), { xr: true });
realityHDProps(world, { xr: true });
camera.position.set(0, 1.35, 0.9); controls.target.set(0, 1.2, -1.6); // desktop preview framing
// One plain immersive-vr session. No hand-tracking, layers or bounded-floor: Vision Pro gaze+pinch
// arrives as a transient-pointer `select` without extra permission prompts.
const xrb = document.getElementById('xrb');
const enter = document.createElement('button'); enter.className = 'primary'; xrb.append(enter);
let session = null;
const label = () => { enter.textContent = session ? 'Exit' : 'Enter XR'; };
if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) { enter.textContent = 'WebXR unavailable'; enter.disabled = true; }
else {
  label();
  enter.onclick = async () => {
    if (session) return session.end();
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session); label();
    session.addEventListener('end', () => { session = null; label(); });
  };
}
renderer.xr.addEventListener('sessionstart', () => { scene.background = new THREE.Color('#000000'); world.position.set(0, -0.15, -2.2); hud.position.set(0, 1.0, -1.05); });
renderer.xr.addEventListener('sessionend', () => { scene.background = null; });

// ── text panels as canvas textures
function panel(w, h, px = 512) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData.draw = fn => { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); fn(x, c.width, c.height); tex.needsUpdate = true; };
  return m;
}
const FONT = '"JetBrains Mono", ui-monospace, monospace';
function button(text, primary) {
  const b = panel(0.2, 0.07, 400);
  b.userData.draw((x, w, h) => {
    x.fillStyle = primary ? '#fff' : '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = primary ? '#000' : '#fff'; x.font = `500 52px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  });
  return b;
}

// ── HUD: prev / stage / next, follows a fixed spot in front of the presenter
const hud = new THREE.Group(); hud.position.set(0, 1.0, -1.05); hud.rotation.x = -0.35; scene.add(hud);
const prev = button('← PREV'), next = button('NEXT →', true), sname = panel(0.32, 0.07, 640);
prev.position.x = -0.28; next.position.x = 0.28; hud.add(prev, sname, next);
prev.userData.act = () => go(show.stage - 1); next.userData.act = () => go(show.stage + 1);
const modeB = button('MODE'); modeB.position.set(0, -0.09, 0); modeB.scale.setScalar(0.7); hud.add(modeB);
modeB.userData.act = () => net.send({ type: 'show.set', stage: show.stage, mode: show.mode === 'chip' ? 'rack' : 'chip' });

// ── join panel: QR + live count
const joinP = panel(0.9, 0.5, 1024); joinP.position.set(0, 1.55, -2.0); scene.add(joinP);
const qrCanvas = document.createElement('canvas');
await QRCode.toCanvas(qrCanvas, `${location.origin}/join.html?room=${room}`, { width: 420, margin: 1 });
const info = panel(0.9, 0.12, 1024); info.position.set(0, 0.95, -2.0); scene.add(info);

let s = null, show = { stage: 0, mode: 'chip' }, sig = '';
const go = i => net.send({ type: 'show.set', stage: Math.max(0, Math.min(2, i)), mode: show.mode });

function render() {
  if (!s) return;
  show = s.show || show;
  const S = STAGES[show.stage], guests = Object.values(s.players).filter(p => p.kind === 'phone');
  sname.userData.draw((x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = '#fff'; x.font = `500 46px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`0${show.stage + 1} · ${S.toUpperCase()} · ${show.mode.toUpperCase()}`, w / 2, h / 2 + 2); });
  joinP.visible = S === 'Join';
  if (joinP.visible) joinP.userData.draw((x, w, h) => {
    x.fillStyle = 'rgba(0,0,0,.85)'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.fillRect(30, 30, h - 60, h - 60); x.drawImage(qrCanvas, 40, 40, h - 80, h - 80);
    x.font = `300 200px ${FONT}`; x.textBaseline = 'top'; x.fillText(String(guests.length), h + 10, 40);
    x.font = `500 30px ${FONT}`; x.fillStyle = '#8a8a8a'; x.fillText('PLAYERS CONNECTED', h + 16, 260);
    x.fillStyle = '#fff'; x.font = `400 28px ${FONT}`; x.fillText(guests.map(p => p.name).join('  ').slice(0, 40), h + 16, 320);
    x.fillStyle = '#8a8a8a'; x.fillText(`ROOM ${room}`, h + 16, 380);
  });
  const board = Object.values(s.chips || {}).filter(c => c.taped).sort((a, b) => b.result.score - a.result.score);
  info.userData.draw((x, w, h) => {
    x.fillStyle = '#fff'; x.font = `500 44px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = s.totals.room;
    x.fillText(show.mode === 'chip' ? (board[0] ? `${board[0].owner.toUpperCase()} ${S === 'Results' ? 'WINS' : 'LEADS'} · ${board[0].result.score.toLocaleString()}` : `${guests.length} DESIGNING`) : `${t.racks} RACKS · ${t.kw} KW · $${t.price.toLocaleString('en-US')}`, w / 2, h / 2);
  });
  info.visible = S !== 'Join';
  const nsig = `${S}|${show.mode}|${JSON.stringify(show.mode === 'chip' ? s.chips : s.racks)}`;
  if (nsig === sig) return; sig = nsig;
  const hall = world.getObjectByName('hall'); if (hall) hall.visible = show.mode === 'rack';
  if (show.mode === 'rack') { replace(world, 'chip', null); replace(world, 'rack', buildRoom(s.racks, cat)); }
  else {
    replace(world, 'rack', null);
    if (S === 'Results' && board[0]) { const d = buildChip(board[0], cat); d.name = 'chip'; d.scale.setScalar(2.2); d.position.y = 0.2; replace(world, 'chip', d); }
    else replace(world, 'chip', buildDieGrid(s.chips, cat));
  }
}

// ── input: controllers + Vision Pro transient pointer (gaze + pinch) both fire `select`
const ray = new THREE.Raycaster(), tmp = new THREE.Matrix4();
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); scene.add(c);
  c.addEventListener('select', () => {
    tmp.identity().extractRotation(c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmp);
    const hit = ray.intersectObjects([prev, next, modeB], false)[0];
    if (hit) { hit.object.userData.act(); hit.object.scale.multiplyScalar(0.92); setTimeout(() => hit.object.scale.multiplyScalar(1 / 0.92), 120); }
  });
}
// Desktop preview: click buttons too.
renderer.domElement.addEventListener('click', e => {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  ray.intersectObjects([prev, next, modeB], false)[0]?.object.userData.act();
});
addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(show.stage + 1); if (e.key === 'ArrowLeft') go(show.stage - 1); });

const net = connect({ room, kind: 'xr', key: (() => { try { return localStorage.getItem('tw.host') || ''; } catch { return ''; } })(), mode: 'chip', name: 'WebXR', onState: st => { s = st; render(); } });
setInterval(() => { if (renderer.xr.isPresenting) net.send({ type: 'pose', p: camera.position.toArray().map(v => +v.toFixed(3)) }); }, 200);
