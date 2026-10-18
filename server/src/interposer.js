// Track 2 (SundAI MIT AI Hackathon, "Design the coolest chiplet layout"), ported from the official judge
// github.com/Czaja107/chiplet-thermal-simulator (prototype-4): same dies, links, port rule, router, reach and
// 13,500 GB/s·mm budget, same 5 workload power maps and PHY/wire energy. The HotSpot solve is replaced by a
// 3-layer finite-volume model (Si interposer, die plane, TIM + Cu spreader/sink) using the spec's materials,
// so temperatures are relative; the score is normalized to the official seeded random layout under this model.
// Coordinates: mm, x right, y up, origin at the interposer's lower-left corner (spec convention).
import { readFileSync } from 'node:fs';

export const T2 = JSON.parse(readFileSync(new URL('./track2.json', import.meta.url)));
const [W, H] = T2.interposer, PR = T2.port, TM = T2.thermal, IC = T2.ic;
export const IDS = Object.keys(T2.dies); // G0..G3, H0..H3
export const INTERPOSER = { w: W, h: H, edge: T2.edge, gap: T2.gap, amb: TM.ambient_c };
export const WORKLOADS = Object.keys(T2.workloads);
const toPlace = xy => IDS.map(id => ({ id, x: xy[id][0], y: xy[id][1] }));
/** Official seeded random layout (the score's reference). */
export const defaultPlace = () => toPlace(T2.random);
export const box = p => { const [w, h] = T2.dies[p.id]; return [p.x, p.y, p.x + w, p.y + h]; };

// ── geometry.py port: clearance, ports, router, reach, budget
const sideOf = (a, b) => { const dx = (b[0] + b[2] - a[0] - a[2]) / 2, dy = (b[1] + b[3] - a[1] - a[3]) / 2; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'top' : 'bottom'); };
function sidePorts(b, side, alloc) {
  const hz = side === 'top' || side === 'bottom', len = hz ? b[2] - b[0] : b[3] - b[1], cap = len * PR.usable_center_fraction_of_each_die_side;
  alloc.sort((p, q) => p[0] < q[0] ? -1 : 1);
  const need = alloc.reduce((t, a) => t + a[1], 0) + Math.max(0, alloc.length - 1) * PR.minimum_gap_between_ports_mm;
  if (need > cap + 1e-8) throw new Error(`edge capacity: ${side} needs ${need.toFixed(1)} mm, has ${cap.toFixed(1)} mm`);
  let s = (hz ? b[0] : b[1]) + (len - need) / 2; const out = {};
  for (const [id, req] of alloc) {
    const m = s + req / 2;
    out[id] = side === 'left' ? { c: [b[0], m], n: [-1, 0], len: req } : side === 'right' ? { c: [b[2], m], n: [1, 0], len: req }
      : side === 'bottom' ? { c: [m, b[1]], n: [0, -1], len: req } : { c: [m, b[3]], n: [0, 1], len: req };
    s += req + PR.minimum_gap_between_ports_mm;
  }
  return out;
}
const P = PR.route_grid_pitch_mm, CL = PR.route_clearance_mm, GX = Math.round(W / P), GY = Math.round(H / P);
function route(boxes, a, b) {
  const pos = (i, j) => [(i + 0.5) * P, (j + 0.5) * P];
  const blocked = (i, j) => { const [x, y] = pos(i, j); return boxes.some(([x0, y0, x1, y1]) => x0 - CL < x && x < x1 + CL && y0 - CL < y && y < y1 + CL); };
  const end = p => {
    const px = p.c[0] + p.n[0] * (CL + P), py = p.c[1] + p.n[1] * (CL + P), i = Math.floor(px / P), j = Math.floor(py / P);
    if (i < 0 || j < 0 || i >= GX || j >= GY || blocked(i, j)) throw new Error('port cannot reach a free route track');
    const [cx, cy] = pos(i, j); return [i, j, Math.abs(p.c[0] - cx) + Math.abs(p.c[1] - cy)];
  };
  const [si, sj, sa] = end(a), [gi, gj, ga] = end(b), key = (i, j) => j * GX + i;
  const dist = new Map([[key(si, sj), 0]]), par = new Map(), open = [[Math.abs(si - gi) + Math.abs(sj - gj), 0, si, sj]];
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0] || (open[k][0] === open[bi][0] && open[k][1] < open[bi][1])) bi = k;
    const [, d, i, j] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (d !== dist.get(key(i, j))) continue;
    if (i === gi && j === gj) {
      const path = [[gi, gj]]; let k = key(gi, gj); while (par.has(k)) { k = par.get(k); path.push([k % GX, Math.floor(k / GX)]); }
      return { len: +(d * P + sa + ga).toFixed(3), path: path.reverse() };
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GY || blocked(ni, nj)) continue;
      const nk = key(ni, nj); if (d + 1 < (dist.get(nk) ?? Infinity)) { dist.set(nk, d + 1); par.set(nk, key(i, j)); open.push([d + 1 + Math.abs(ni - gi) + Math.abs(nj - gj), d + 1, ni, nj]); }
    }
  }
  throw new Error('no obstacle-free route');
}

/** validate_layout(): throws the first rule broken (same order and wording as the judge), else ports and routes. */
export function validate(place, withRoutes = true) {
  const B = Object.fromEntries(place.map(p => [p.id, box(p)])), e = T2.edge, g = T2.gap;
  for (const [id, [x0, y0, x1, y1]] of Object.entries(B)) if (Math.min(x0, y0) < e - 1e-8 || x1 > W - e + 1e-8 || y1 > H - e + 1e-8) throw Object.assign(new Error(`${id} violates package edge clearance`), { dies: [id] });
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) {
    const a = B[IDS[i]], b = B[IDS[j]], gx = Math.max(b[0] - a[2], a[0] - b[2], 0), gy = Math.max(b[1] - a[3], a[1] - b[3], 0);
    if (gx < g - 1e-8 && gy < g - 1e-8) throw Object.assign(new Error(`${IDS[i]} and ${IDS[j]} violate ${g} mm clearance`), { dies: [IDS[i], IDS[j]] });
  }
  const asg = {};
  for (const l of T2.links) for (const [d, o] of [[l.from, l.to], [l.to, l.from]]) (asg[d + '.' + sideOf(B[d], B[o])] ??= []).push([l.id, l.gb_s / PR.density_gb_s_per_mm]);
  const ports = {};
  for (const [k, al] of Object.entries(asg)) { const [d, side] = k.split('.'); try { Object.assign(ports[d] ??= {}, sidePorts(B[d], side, al)); } catch (err) { err.dies = [d]; throw err; } }
  const boxes = Object.values(B), routes = {}; let weighted = 0;
  for (const l of T2.links) {
    const a = ports[l.from][l.id], b = ports[l.to][l.id], lb = Math.abs(a.c[0] - b.c[0]) + Math.abs(a.c[1] - b.c[1]);
    if (lb > l.max_route_mm + 1e-8) throw Object.assign(new Error(`${l.id} ${l.from}→${l.to} needs ${lb.toFixed(1)} mm, reach ${l.max_route_mm} mm`), { dies: [l.from, l.to], link: l.id });
    const r = withRoutes ? route(boxes, a, b) : { len: lb, path: [] };
    if (r.len > l.max_route_mm + 1e-8) throw Object.assign(new Error(`${l.id} route ${r.len.toFixed(1)} mm exceeds ${l.max_route_mm} mm`), { dies: [l.from, l.to], link: l.id });
    routes[l.id] = { ...r, from: a, to: b, gb_s: l.gb_s }; weighted += l.gb_s * r.len;
  }
  if (weighted > PR.total_bandwidth_weighted_route_limit_gb_s_mm + 1e-8) throw new Error(`bandwidth·length ${Math.round(weighted)} > 13,500 GB/s·mm`);
  return { routes, weighted: Math.round(weighted) };
}

// ── thermal: 3 layers on a `c` mm grid. Lateral conductance k·t (W/K), vertical A/R'' per cell.
const KSI = 1 / TM.thermal_resistivity_si_mK_per_W, TI = TM.interposer_si_thickness_um * 1e-6, TD = TM.die_si_thickness_um * 1e-6, TT = TM.tim_thickness_um * 1e-6;
const G_I = KSI * TI, G_D = KSI * TD, G_GAP = TD / TM.thermal_resistivity_gap_mK_per_W, G_S = 400 * (0.001 + 0.0069); // Cu spreader 1 mm + sink 6.9 mm (HotSpot example3)
const [CX0, CY0, CX1, CY1] = TM.cooling_contact_rect_mm;
function heat(place, val, wl, c) {
  const nx = Math.round(W / c), ny = Math.round(H / c), qi = new Float64Array(nx * ny), qd = new Float64Array(nx * ny), owner = new Int8Array(nx * ny).fill(-1);
  const put = (q, x, y, w) => { const i = Math.min(nx - 1, Math.max(0, Math.floor(x / c))), j = Math.min(ny - 1, Math.max(0, Math.floor(y / c))); q[j * nx + i] += w; };
  const w = T2.workloads[wl], n = 16, sub = Math.max(1, Math.ceil(0.75 / c));
  place.forEach((p, k) => {
    const [x0, y0, x1, y1] = box(p), dx = (x1 - x0) / n, dy = (y1 - y0) / n, m = w.maps[p.id];
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) put(qd, x0 + (col + (a + 0.5) / sub) * dx, y0 + (r + (b + 0.5) / sub) * dy, m[r][col] / sub / sub);
    for (let j = Math.ceil(y0 / c); j < Math.floor(y1 / c); j++) for (let i = Math.ceil(x0 / c); i < Math.floor(x1 / c); i++) owner[j * nx + i] = k;
    for (let j = Math.floor(y0 / c); j < Math.ceil(y1 / c); j++) for (let i = Math.floor(x0 / c); i < Math.ceil(x1 / c); i++) if (owner[j * nx + i] < 0 && (Math.min(x1, (i + 1) * c) - Math.max(x0, i * c)) * (Math.min(y1, (j + 1) * c) - Math.max(y0, j * c)) > c * c / 2) owner[j * nx + i] = k;
  });
  let phy = 0, wire = 0;
  for (const l of T2.links) {
    const r = val.routes[l.id], bits = l.gb_s * w.util[l.id] * 8e9, pw = bits * IC.phy_energy_total_pj_per_bit * 1e-12, ww = bits * IC.wire_energy_pj_per_bit_per_mm * 1e-12 * r.len;
    phy += pw; wire += ww;
    for (const pt of [r.from, r.to]) { // half inside the die plane, half outside on the interposer, spread along the port
      for (let s = 0; s < 8; s++) { const t = (s + 0.5) / 8 - 0.5, tx = pt.n[0] ? 0 : t * pt.len, ty = pt.n[0] ? t * pt.len : 0;
        put(qd, pt.c[0] - pt.n[0] * 0.5 + tx, pt.c[1] - pt.n[1] * 0.5 + ty, pw / 4 / 8); put(qi, pt.c[0] + pt.n[0] * 0.5 + tx, pt.c[1] + pt.n[1] * 0.5 + ty, pw / 4 / 8); }
    }
    const pts = r.path.length ? r.path.map(([i, j]) => [(i + 0.5) * P, (j + 0.5) * P]) : [r.from.c, r.to.c];
    pts.forEach(([x, y]) => put(qi, x, y, ww / pts.length));
  }
  return { nx, ny, qi, qd, owner, phy, wire };
}
function solveOne(place, val, wl, c, iters) {
  const h = heat(place, val, wl, c), { nx, ny, owner } = h, N = nx * ny, A = c * c * 1e-6;
  const ti = new Float64Array(N), td = new Float64Array(N), ts = new Float64Array(N), gid = new Float64Array(N), gds = new Float64Array(N), gdl = new Float64Array(N);
  const total = h.qi.reduce((a, b) => a + b, 0) + h.qd.reduce((a, b) => a + b, 0), sinkT = TM.ambient_c + total * TM.cooling_resistance_K_per_W, gsa = A / (W * H * 1e-6) / TM.cooling_resistance_K_per_W;
  for (let k = 0; k < N; k++) {
    const x = (k % nx + 0.5) * c, y = (Math.floor(k / nx) + 0.5) * c, die = owner[k] >= 0, rt = x > CX0 && x < CX1 && y > CY0 && y < CY1 ? TM.thermal_resistivity_tim_mK_per_W : TM.outside_contact_resistivity_mK_per_W;
    const rd = die ? TD / 2 * TM.thermal_resistivity_si_mK_per_W : TD / 2 * TM.thermal_resistivity_gap_mK_per_W;
    gid[k] = A / (TI / 2 * TM.thermal_resistivity_si_mK_per_W + rd); gds[k] = A / (rd + TT * rt); gdl[k] = die ? G_D : G_GAP;
    ti[k] = td[k] = ts[k] = sinkT;
  }
  const om = 1.8;
  for (let it = 0; it < iters; it++) for (let k = 0; k < N; k++) {
    const i = k % nx, j = (k - i) / nx, nb = [];
    if (i > 0) nb.push(k - 1); if (i < nx - 1) nb.push(k + 1); if (j > 0) nb.push(k - nx); if (j < ny - 1) nb.push(k + nx);
    let s = 0, g = 0; for (const m of nb) { s += G_I * ti[m]; g += G_I; }
    ti[k] += om * ((h.qi[k] + s + gid[k] * td[k]) / (g + gid[k]) - ti[k]);
    s = 0; g = 0; for (const m of nb) { const gl = owner[m] === owner[k] && owner[k] >= 0 ? G_D : Math.min(gdl[k], gdl[m]); s += gl * td[m]; g += gl; }
    td[k] += om * ((h.qd[k] + s + gid[k] * ti[k] + gds[k] * ts[k]) / (g + gid[k] + gds[k]) - td[k]);
    s = 0; g = 0; for (const m of nb) { s += G_S * ts[m]; g += G_S; }
    ts[k] += om * ((s + gds[k] * td[k] + gsa * TM.ambient_c + (A / (W * H * 1e-6)) * 0) / (g + gds[k] + gsa) - ts[k]);
  }
  // Energy balance pins the sink mean to ambient + P·R_conv; shift the stack so the solve needs fewer iterations.
  let mean = 0; for (let k = 0; k < N; k++) mean += ts[k]; mean /= N; const sh = sinkT - mean;
  let gpu = -1e9, hbm = -1e9, gHot = 0, hHot = 0;
  for (let k = 0; k < N; k++) { const o = owner[k]; if (o < 0) continue; const t = td[k] + sh; if (place[o].id[0] === 'G') { if (t > gpu) { gpu = t; gHot = k; } } else if (t > hbm) { hbm = t; hHot = k; } }
  const at = k => [+((k % nx + 0.5) * c).toFixed(1), +((Math.floor(k / nx) + 0.5) * c).toFixed(1)];
  return { gpu: +gpu.toFixed(2), hbm: +hbm.toFixed(2), gHot: at(gHot), hHot: at(hHot), phy: +h.phy.toFixed(2), wire: +h.wire.toFixed(2), nx, ny, map: Array.from(td, t => +(t + sh).toFixed(1)) };
}

/** Per-workload worst GPU and HBM die-plane temperatures. */
export function simulate(place, { c = 1, iters = 140, val = validate(place), maps = false } = {}) {
  const per = {}; let gpu = -1e9, hbm = -1e9, gw = '', hw = '';
  for (const wl of WORKLOADS) { const r = solveOne(place, val, wl, c, iters); per[wl] = r; if (r.gpu > gpu) { gpu = r.gpu; gw = wl; } if (r.hbm > hbm) { hbm = r.hbm; hw = wl; } }
  if (!maps) for (const r of Object.values(per)) delete r.map;
  return { gpu, hbm, gpuWorkload: gw, hbmWorkload: hw, per, val };
}

let REF = null;
/** Official random layout through the same model: the score's denominator (judge does the same with HotSpot). */
export const reference = () => (REF ??= (({ gpu, hbm }) => ({ gpu, hbm }))(simulate(defaultPlace())));

/** Judge score, lower is better; below 1 beats the seeded random layout on both GPU and HBM. Invalid → passed false. */
export function score(place) {
  let val; try { val = validate(place); } catch (e) { return { passed: false, reason: e.message, bad: e.dies ?? [], link: e.link ?? null, score: null, points: 0 }; }
  const sim = simulate(place, { val, maps: true }), ref = reference(), a = TM.ambient_c;
  const s = Math.max((sim.gpu - a) / (ref.gpu - a), (sim.hbm - a) / (ref.hbm - a));
  const hot = sim.per[sim.gpuWorkload];
  return {
    passed: true, score: +s.toFixed(4), points: Math.round(1000 / s), worstGpu: sim.gpu, worstHbm: sim.hbm, gpuWorkload: sim.gpuWorkload, hbmWorkload: sim.hbmWorkload,
    gpuHot: hot.gHot, hbmHot: sim.per[sim.hbmWorkload].hHot, weighted: val.weighted, wireW: hot.wire, phyW: hot.phy,
    links: Object.fromEntries(Object.entries(val.routes).map(([id, r]) => [id, { len: r.len, path: r.path, from: r.from.c, to: r.to.c }])),
    heat: { nx: hot.nx, ny: hot.ny, map: hot.map }, ref,
  };
}

/** AI cool: hill-climb on a 2 mm grid against the same rules, verified at 1 mm. */
export function optimize(place, steps = 90, seed = 7) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, a = TM.ambient_c, ref = reference();
  const cost = pl => { try { const s = simulate(pl, { c: 2, iters: 90 }); return Math.max((s.gpu - a) / (ref.gpu - a), (s.hbm - a) / (ref.hbm - a)); } catch { return Infinity; } };
  let cur = place.map(p => ({ ...p })), best = cost(cur);
  for (let s = 0; s < steps; s++) {
    const nxt = cur.map(p => ({ ...p })), p = nxt[Math.floor(rnd() * nxt.length)], amp = rnd() < 0.5 ? 1 : 3;
    p.x = +(p.x + (rnd() - 0.5) * 2 * amp).toFixed(2); p.y = +(p.y + (rnd() - 0.5) * 2 * amp).toFixed(2);
    const c = cost(nxt); if (c < best) { best = c; cur = nxt; }
  }
  const before = score(place), after = score(cur);
  return after.passed && (!before.passed || after.score < before.score) ? { place: cur, before, after } : { place, before, after: before };
}
