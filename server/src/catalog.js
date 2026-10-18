import { solve, throttle } from './thermal.js';
// Real components, list prices USD (2026 street, rounded). u = rack units.
export const RACKS = [
  { id: 'apc-ar3300', name: 'APC NetShelter SX 42U', u: 42, price: 1890 },
  { id: 'nvl72-frame', name: 'NVIDIA GB200 NVL72 frame', u: 48, price: 38000 },
];

export const COMPONENTS = [
  { id: 'dgx-b200', cat: 'gpu', name: 'NVIDIA DGX B200 (8x B200)', u: 10, kw: 14.3, price: 515000, color: '#76b900' },
  { id: 'hgx-h200', cat: 'gpu', name: 'Supermicro HGX H200 8-GPU', u: 8, kw: 10.2, price: 310000, color: '#76b900' },
  { id: 'mi325x', cat: 'gpu', name: 'AMD Instinct MI325X 8-GPU', u: 8, kw: 10.0, price: 260000, color: '#ed1c24' },
  { id: 'r760', cat: 'cpu', name: 'Dell PowerEdge R760 (2x Xeon 6)', u: 2, kw: 1.4, price: 18500, color: '#0076ce' },
  { id: 'epyc-1u', cat: 'cpu', name: 'Supermicro 1U AMD EPYC 9005', u: 1, kw: 0.9, price: 12800, color: '#ed1c24' },
  { id: 'qm9700', cat: 'network', name: 'NVIDIA Quantum-2 QM9700 IB', u: 1, kw: 0.75, price: 32000, color: '#76b900' },
  { id: 'sn5600', cat: 'network', name: 'NVIDIA Spectrum-4 SN5600 800G', u: 2, kw: 1.6, price: 45000, color: '#76b900' },
  { id: 'arista-7060', cat: 'network', name: 'Arista 7060X5 400G ToR', u: 2, kw: 0.8, price: 28000, color: '#2d6db5' },
  { id: 'pure-x70', cat: 'storage', name: 'Pure Storage FlashArray//X70', u: 3, kw: 1.0, price: 95000, color: '#fe5000' },
  { id: 'vast-dbox', cat: 'storage', name: 'VAST Data DBox', u: 2, kw: 1.2, price: 120000, color: '#5c2d91' },
  { id: 'apc-pdu', cat: 'power', name: 'APC 9000 Switched PDU', u: 1, kw: 0, price: 2400, color: '#333333' },
  { id: 'eaton-ups', cat: 'power', name: 'Eaton 9PX 6kVA UPS', u: 3, kw: 0, price: 6900, color: '#1f1f1f' },
  { id: 'cdu-coolit', cat: 'cooling', name: 'CoolIT CHx80 in-rack CDU', u: 4, kw: 0.5, price: 42000, color: '#00a3e0' },
  { id: 'blank-1u', cat: 'misc', name: '1U blanking panel', u: 1, kw: 0, price: 12, color: '#111111' },
];

import { CHIP_BLOCKS, DIE, isEdge } from './die.js';
export { CHIP_BLOCKS, DIE, isEdge };
const byId = new Map(COMPONENTS.map(c => [c.id, c]));
export const component = id => byId.get(id);
export const rack = id => RACKS.find(r => r.id === id) ?? RACKS[0];

export function rackTotals(state) {
  const r = rack(state.rackId);
  let u = 0, kw = 0, price = r.price;
  for (const s of state.slots) {
    const c = component(s.id); if (!c) continue;
    u += c.u; kw += c.kw; price += c.price;
  }
  return { u, capacity: r.u, kw: +kw.toFixed(2), price };
}

/** Challenge score for a personal die. Compute is capped by memory bandwidth; power and I/O are hard gates. */
export const CHALLENGE = { watts: 1000, bwPerHBM: 900, bwPerSRAM: 150 };
export function chipScore(chip) {
  const t = chipTotals(chip), n = id => chip.cells.filter(c => c === id).length;
  // HBM PHYs and I/O SerDes sit on the die edge (shoreline) in real floorplans; interior ones do not connect.
  const edge = id => chip.cells.filter((c, i) => c === id && isEdge(i)).length;
  const bw = edge('hbm') * CHALLENGE.bwPerHBM + n('sram') * CHALLENGE.bwPerSRAM;
  const th = solve(chip.cells), thr = throttle(th.tmax); // above 95 °C the clock derates
  const effective = Math.round(Math.min(t.tflops, bw) * thr);
  const checks = { power: t.watts <= CHALLENGE.watts, memory: edge('hbm') > 0, io: edge('io') > 0, control: n('cpu') > 0 };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.round(effective * (checks.power ? 1 : 0.4) * (0.55 + 0.15 * (passed - (checks.power ? 1 : 0))));
  return { ...t, bandwidth: bw, effective, checks, score, tmax: th.tmax, hot: th.hot, throttle: +thr.toFixed(2), misplaced: n('hbm') + n('io') - edge('hbm') - edge('io') };
}

export function chipTotals(chip) {
  const cell = DIE.reticleMM2 / (DIE.cols * DIE.rows);
  let tflops = 0, w = 0, used = 0;
  const blocks = new Map(CHIP_BLOCKS.map(b => [b.id, b]));
  for (const id of chip.cells) {
    const b = blocks.get(id); if (!b) continue;
    used++; tflops += b.tflops * cell / b.mm2; w += b.w * cell / b.mm2;
  }
  return { usedMM2: Math.round(used * cell), tflops: Math.round(tflops), watts: Math.round(w) };
}
