import { catalog, connect } from './net.js';
import { stage, buildRoom, buildChip, replace, realityHDProps } from './scene.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

const q = new URLSearchParams(location.search);
const room = (q.get('room') || 'DEMO').toUpperCase(), mode = q.get('mode') === 'chip' ? 'chip' : 'rack';
const cat = await catalog();
const { renderer, world, camera } = stage(document.getElementById('view'), { xr: true });
realityHDProps(world);
const xrb = document.getElementById('xrb');
for (const B of [ARButton, VRButton]) { const b = B.createButton(renderer); b.style.position = 'static'; xrb.append(b); }
// Place content 1.5 m ahead on session start.
renderer.xr.addEventListener('sessionstart', () => { world.position.set(0, mode === 'chip' ? 0 : -0.2, -1.5); });
const net = connect({ room, kind: 'xr', mode, name: 'WebXR', onState: s => {
  replace(world, 'rack', mode === 'rack' ? buildRoom(s.racks, cat) : null);
  replace(world, 'chip', mode === 'chip' ? buildChip(s.chip, cat) : null);
} });
setInterval(() => { if (renderer.xr.isPresenting) net.send({ type: 'pose', p: camera.position.toArray().map(v => +v.toFixed(3)) }); }, 200);
