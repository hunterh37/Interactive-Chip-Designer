import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const U = 0.04445; // 1 rack unit in metres

/** Renderer + scene + orbit camera. Returns handles; caller adds content to `world`. */
export function stage(canvas, { xr = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: xr });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.xr.enabled = xr;
  const scene = new THREE.Scene();
  if (!xr) scene.background = new THREE.Color('#0b0c0f');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(2, 4, 3); scene.add(key);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.set(1.8, 1.4, 2.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0); controls.enableDamping = true;
  const world = new THREE.Group(); scene.add(world);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; if (!xr) scene.add(floor);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();
  const tick = [];
  renderer.setAnimationLoop(t => { controls.update(); tick.forEach(f => f(t)); renderer.render(scene, camera); });
  return { renderer, scene, camera, controls, world, tick };
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.7, ...o });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/** 19in rack with populated servers, bottom-up. Units placed from slot 1. */
export function buildRack(state, catalog) {
  const g = new THREE.Group(); g.name = 'rack';
  const r = catalog.racks.find(x => x.id === state.rackId) ?? catalog.racks[0];
  const H = r.u * U + 0.12, W = 0.6, D = 1.07, t = 0.03;
  const frame = mat(state.frame, { metalness: 0.5, roughness: 0.55 });
  const accent = mat(state.accent, { emissive: state.accent, emissiveIntensity: 0.6 });
  for (const x of [-1, 1]) g.add(Object.assign(box(t, H, D, frame), { position: new THREE.Vector3(x * (W - t) / 2, H / 2, 0) }));
  g.add(Object.assign(box(W, t, D, frame), { position: new THREE.Vector3(0, H - t / 2, 0) }));
  g.add(Object.assign(box(W, 0.06, D, frame), { position: new THREE.Vector3(0, 0.03, 0) }));
  g.add(Object.assign(box(W, H, 0.01, frame), { position: new THREE.Vector3(0, H / 2, -D / 2) }));
  for (const x of [-1, 1]) g.add(Object.assign(box(0.008, H - 0.1, 0.01, accent), { position: new THREE.Vector3(x * (W / 2 - 0.004), H / 2, D / 2 + 0.006) }));
  let y = 0.06;
  state.slots.forEach((s, i) => {
    const c = catalog.components.find(x => x.id === s.id); if (!c) return;
    const h = c.u * U - 0.002;
    const srv = new THREE.Group(); srv.userData.slot = i;
    srv.add(box(0.482, h, 0.9, mat('#2a2c31')));
    const bezel = box(0.47, h * 0.86, 0.01, mat(c.color, { metalness: 0.3, roughness: 0.6 }));
    bezel.position.z = 0.455; srv.add(bezel);
    const vents = Math.max(1, Math.round(c.u * 1.5));
    for (let k = 0; k < vents; k++) {
      const v = box(0.38, Math.min(0.008, h * 0.15), 0.004, mat('#0a0a0a', { metalness: 0.1 }));
      v.position.set(-0.02, -h / 2 + (k + 0.5) * h / vents, 0.462); srv.add(v);
    }
    const led = box(0.012, 0.012, 0.004, accent); led.position.set(0.21, h / 2 - 0.014, 0.462); srv.add(led);
    srv.position.set(0, y + h / 2, 0.06); y += c.u * U; g.add(srv);
  });
  return g;
}

/** Die on substrate. 1 grid cell = 0.06 m at tabletop scale. */
export function buildChip(chip, catalog) {
  const g = new THREE.Group(); g.name = 'chip';
  const { cols, rows } = catalog.die, s = 0.06, W = cols * s, D = rows * s;
  const sub = box(W + 0.24, 0.03, D + 0.24, mat('#1d4a2c', { metalness: 0.2 })); sub.position.y = 0.015; g.add(sub);
  for (let i = 0; i < 40; i++) { // BGA balls along the edge
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), mat('#c9c9c9'));
    const a = (i / 40) * Math.PI * 2; b.position.set(Math.cos(a) * (W / 2 + 0.09), 0.0, Math.sin(a) * (D / 2 + 0.09)); g.add(b);
  }
  const die = box(W + 0.02, 0.02, D + 0.02, mat('#202226')); die.position.y = 0.04; g.add(die);
  const blocks = new Map(catalog.chipBlocks.map(b => [b.id, b]));
  chip.cells.forEach((id, i) => {
    const x = (i % cols) - cols / 2 + 0.5, z = Math.floor(i / cols) - rows / 2 + 0.5;
    const b = blocks.get(id);
    const m = box(s * 0.94, b ? 0.025 : 0.004, s * 0.94, b ? mat(b.color, { emissive: b.color, emissiveIntensity: chip.taped ? 0.5 : 0.12 }) : mat('#3a3d44', { metalness: 0.9 }));
    m.position.set(x * s, 0.05 + (b ? 0.0125 : 0.002), z * s); m.userData.cell = i; g.add(m);
  });
  if (chip.taped) {
    const lid = box(W + 0.06, 0.012, D + 0.06, mat('#b8bcc4', { metalness: 1, roughness: 0.25, transparent: true, opacity: 0.35 }));
    lid.position.y = 0.11; g.add(lid);
  }
  g.position.y = 0.8;
  return g;
}

/** RealityHD GLB props exported by scripts/export-realityhd.sh (optional; missing files skipped). */
export async function realityHDProps(world) {
  const loader = new GLTFLoader();
  const place = [['desktop-monitor', [-1.2, 0.75, 0.6], -0.6], ['laptop', [1.2, 0.75, 0.6], 0.6]];
  for (const [id, p, ry] of place) {
    try {
      const gltf = await loader.loadAsync(`/models/${id}.glb`);
      gltf.scene.position.set(...p); gltf.scene.rotation.y = ry; world.add(gltf.scene);
      const desk = box(0.8, 0.75, 0.6, mat('#f1f0ec', { metalness: 0.1 })); desk.position.set(p[0], 0.375, p[2]); world.add(desk);
    } catch { /* asset not exported */ }
  }
}

export function replace(world, name, obj) {
  const old = world.getObjectByName(name);
  if (old) { world.remove(old); old.traverse(o => { o.geometry?.dispose(); }); }
  if (obj) world.add(obj);
}
