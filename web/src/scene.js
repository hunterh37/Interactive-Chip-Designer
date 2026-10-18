import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const U = 0.04445; // 1 rack unit in metres

/** Renderer + scene + orbit camera. Returns handles; caller adds content to `world`. */
const at = (m, x, y, z) => (m.position.set(x, y, z), m);

export function stage(canvas, { xr = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: xr });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.xr.enabled = xr;
  const scene = new THREE.Scene();
  if (!xr) scene.background = new THREE.Color('#000000');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(2, 4, 3); scene.add(key);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.set(1.8, 1.4, 2.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0); controls.enableDamping = true;
  const world = new THREE.Group(); scene.add(world);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.01, 3), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.9 }));
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
  for (const x of [-1, 1]) g.add(at(box(t, H, D, frame), x * (W - t) / 2, H / 2, 0));
  g.add(at(box(W, t, D, frame), 0, H - t / 2, 0));
  g.add(at(box(W, 0.06, D, frame), 0, 0.03, 0));
  g.add(at(box(W, H, 0.01, frame), 0, H / 2, -D / 2));
  for (const x of [-1, 1]) g.add(at(box(0.008, H - 0.1, 0.01, accent), x * (W / 2 - 0.004), H / 2, D / 2 + 0.006));
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

export const emptyRack = () => ({ rackId: 'apc-ar3300', frame: '#1c1d20', accent: '#00e0a4', slots: [], ordered: null });
export const PITCH = 0.7; // rack-to-rack spacing in the server room row

/** Server room: every player's rack in one row, join order left to right. */
/** Camera-facing name tag sprite, white mono text on black. */
export function label(text, prefix = '') {
  const c = document.createElement('canvas'), x = c.getContext('2d'), t = (prefix + text).toUpperCase();
  x.font = '500 44px "JetBrains Mono", monospace'; const w = Math.ceil(x.measureText(t).width) + 48;
  c.width = w; c.height = 76; x.fillStyle = '#000'; x.fillRect(0, 0, w, 76); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, 73);
  x.font = '500 44px "JetBrains Mono", monospace'; x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(t, 24, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); sp.renderOrder = 10;
  sp.scale.set(0.12 * w / 76, 0.12, 1); sp.userData.isLabel = true; return sp;
}

export function buildRoom(racks, catalog) {
  const g = new THREE.Group(); g.name = 'rack';
  const list = Object.values(racks);
  Object.entries(racks).forEach(([id, r], i) => {
    const e = buildRack(r, catalog); e.name = ''; e.position.x = (i - (list.length - 1) / 2) * PITCH;
    e.userData.pid = id; e.traverse(o => { o.userData.pid = id; });
    const H = (catalog.racks.find(x => x.id === r.rackId)?.u ?? 42) * U + 0.12;
    const tag = label(r.owner || 'guest', r.ordered ? '● ' : ''); tag.position.set(0, H + 0.16, 0.3); e.add(tag);
    g.add(e);
  });
  return g;
}

/** Die on substrate. 1 grid cell = 0.06 m at tabletop scale. */
export function buildChip(chip, catalog) {
  const g = new THREE.Group(); g.name = 'chip';
  const { cols, rows } = catalog.die, s = 0.06, W = cols * s, D = rows * s;
  const sub = box(W + 0.24, 0.03, D + 0.24, mat('#0d0d0d', { metalness: 0.2, roughness: 0.8 })); sub.position.y = 0.015; g.add(sub);
  for (let i = 0; i < 40; i++) { // BGA balls along the edge
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), mat('#c9c9c9'));
    const a = (i / 40) * Math.PI * 2; b.position.set(Math.cos(a) * (W / 2 + 0.09), 0.0, Math.sin(a) * (D / 2 + 0.09)); g.add(b);
  }
  const die = box(W + 0.02, 0.02, D + 0.02, mat('#202226')); die.position.y = 0.04; g.add(die);
  const blocks = new Map(catalog.chipBlocks.map(b => [b.id, b]));
  chip.cells.forEach((id, i) => {
    const x = (i % cols) - cols / 2 + 0.5, z = Math.floor(i / cols) - rows / 2 + 0.5;
    const b = blocks.get(id);
    const m = box(s * 0.94, b ? 0.025 : 0.004, s * 0.94, b ? mat(b.color, { emissive: b.color, emissiveIntensity: chip.taped ? 0.5 : 0.12 }) : mat('#1a1a1a', { metalness: 0.9 }));
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
/** Data-center hall around the player racks: raised floor, background rack rows, containment, trays, lights. */
export const HALL = { roof: false }; // ceiling, light strips, trays, containment roof: off so the camera sees in
export function dataCenterHall(world, { xr = false } = {}) {
  const g = new THREE.Group(); g.name = 'hall';
  const tile = 0.6, nx = 24, nz = 24;
  if (!xr) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(nx * tile, nz * tile), mat('#2a2e35', { metalness: 0.3, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; g.add(floor);
    const grid = new THREE.GridHelper(nx * tile, nx, '#0e1013', '#0e1013'); grid.position.y = 0.003; g.add(grid);
    const perf = mat('#3a414b', { metalness: 0.4, roughness: 0.5 });
    for (let i = -6; i <= 6; i++) g.add(at(box(tile - 0.02, 0.004, tile - 0.02, perf), i * tile, 0.004, 1.2)); // cold-aisle perforated tiles
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(nx * tile, nz * tile), mat('#121418', { metalness: 0, roughness: 1, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.2; if (HALL.roof) g.add(ceil);
  }
  const H = 42 * U + 0.12, frame = mat('#16181c', { metalness: 0.5, roughness: 0.6 });
  const led = [mat('#00e0a4', { emissive: '#00e0a4', emissiveIntensity: 1 }), mat('#3aa0ff', { emissive: '#3aa0ff', emissiveIntensity: 1 })];
  const filler = (x, z, ry) => {
    const r = new THREE.Group(); r.add(at(box(0.6, H, 1.07, frame), 0, H / 2, 0));
    for (let k = 0; k < 14; k++) if ((x * 7 + k * 3) % 5) r.add(at(box(0.008, 0.008, 0.004, led[k % 2]), 0.2, 0.15 + k * 0.13, 0.537));
    r.position.set(x, 0, z); r.rotation.y = ry; return r;
  };
  for (let i = -8; i <= 8; i++) {
    if (Math.abs(i) > 3) g.add(filler(i * PITCH, 0.06, 0)); // same row as player racks, beyond them
    g.add(filler(i * PITCH, -2.4, 0));                        // back row facing hot aisle side
    g.add(filler(i * PITCH, 4.4, Math.PI));                    // opposite row across the cold aisle
  }
  const tray = mat('#8a8f98', { metalness: 0.8, roughness: 0.4 });
  if (HALL.roof) for (const z of [-0.2, -2.6, 4.6]) g.add(at(box(17 * PITCH, 0.05, 0.3, tray), 0, 2.75, z)); // overhead cable trays
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd6ff', transparent: true, opacity: 0.08, roughness: 0.1 });
  if (HALL.roof) g.add(at(box(17 * PITCH, 0.02, 3.8, glass), 0, H + 0.1, 2.25)); // cold-aisle containment roof
  if (!xr) {
    const strip = mat('#ffffff', { emissive: '#dfe8ff', emissiveIntensity: 1.2 });
    if (HALL.roof) for (let x = -4; x <= 4; x += 2) for (const z of [0.9, -3.6]) g.add(at(box(1.4, 0.02, 0.12, strip), x, 3.18, z));
    for (const z of [0.9, -3]) { const l = new THREE.PointLight('#dfe8ff', 6, 8); l.position.set(0, 3, z); g.add(l); }
  }
  world.add(g);
}
/** Kept for callers; the hall replaces the old desk/laptop props. */
export const realityHDProps = (world, o) => dataCenterHall(world, o);

export function replace(world, name, obj) {
  const old = world.getObjectByName(name);
  if (old) { world.remove(old); old.traverse(o => { o.geometry?.dispose(); }); }
  if (obj) world.add(obj);
}

/** Every player's die side by side with name tags (live design overview). */
export function buildDieGrid(chips, catalog) {
  const g = new THREE.Group(); g.name = 'chip';
  const list = Object.values(chips || {}).filter(c => c.cells.some(Boolean) || c.taped);
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(list.length)))), gap = 0.95;
  list.forEach((c, i) => {
    const d = buildChip(c, catalog); d.name = '';
    d.position.set((i % cols - (cols - 1) / 2) * gap, 0.8, (Math.floor(i / cols) - (Math.ceil(list.length / cols) - 1) / 2) * gap);
    const tag = label(c.owner, c.taped ? '● ' : ''); tag.position.set(0, 0.3, -0.25); d.add(tag);
    g.add(d);
  });
  Object.assign(g.userData, { n: list.length, cols, rows: Math.ceil(list.length / cols) });
  return g;
}
