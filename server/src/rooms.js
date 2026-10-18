import { component, rack, rackTotals, chipTotals, chipScore, DIE, CHIP_BLOCKS } from './catalog.js';

const COLORS = /^#[0-9a-f]{6}$/i;
export const newRoomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

export function newState() {
  return {
    racks: {}, // playerId -> rack; one rack per phone player, all shown in one server room
    chip: { name: 'HACK-1', cells: Array(DIE.cols * DIE.rows).fill(null), taped: false },
    players: {},
    chips: {}, // playerId -> personal challenge die
    show: { stage: 0, mode: 'chip' }, // presenter state shared by desktop host and WebXR
    started: null, // ms timestamp once the host starts the experience; joins stay open
    rev: 0,
  };
}

/** Applies one client op to state. Returns error string or null. Pure aside from mutation of `s`. */
/** Paintable rack parts and side-panel designs. Colors live in rack.paint; frame/accent mirror paint.frame/paint.led. */
export const PAINT_PARTS = ['frame', 'sides', 'top', 'door', 'rails', 'chassis', 'bezel', 'led'];
export const DESIGNS = ['none', 'stripes', 'chevron', 'circuit', 'flames', 'grid', 'dots'];
export const newPaint = () => ({ frame: '#1c1d20', sides: '#1c1d20', top: '#1c1d20', door: '#1c1d20', rails: '#3a3d44', chassis: '#2a2c31', bezel: '', led: '#00e0a4', design: 'none', ink: '#00e0a4' });
export const newRack = owner => ({ owner, rackId: 'apc-ar3300', frame: '#1c1d20', accent: '#00e0a4', slots: [], ordered: null, paint: newPaint() });

export function apply(s, op, playerId) {
  if (op.type.startsWith('rack.') && !s.racks[playerId]) s.racks[playerId] = newRack(s.players[playerId]?.name ?? 'guest');
  if (op.type.startsWith('my.') && !s.chips[playerId]) s.chips[playerId] = { owner: s.players[playerId]?.name ?? 'guest', cells: Array(DIE.cols * DIE.rows).fill(null), taped: false, at: null };
  const c = s.chips[playerId];
  const r = s.racks[playerId];
  switch (op.type) {
    case 'rack.add': {
      const c = component(op.id); if (!c) return 'unknown component';
      if (rackTotals(r).u + c.u > rack(r.rackId).u) return 'rack full';
      r.slots.push({ id: c.id, by: playerId }); r.ordered = null; break;
    }
    case 'rack.remove':
      if (op.index < 0 || op.index >= r.slots.length) return 'bad index';
      r.slots.splice(op.index, 1); r.ordered = null; break;
    case 'rack.color':
      r.paint ??= newPaint();
      if (op.frame && COLORS.test(op.frame)) r.frame = r.paint.frame = op.frame;
      if (op.accent && COLORS.test(op.accent)) r.accent = r.paint.led = op.accent;
      break;
    case 'rack.paint': { // { parts: { sides: '#ff0000', ... } } or { part, color }; bezel '' = per-component color
      r.paint ??= newPaint();
      const parts = op.parts ?? { [op.part]: op.color };
      const keys = Object.keys(parts);
      if (!keys.length || keys.some(k => !PAINT_PARTS.includes(k))) return 'unknown part';
      if (keys.some(k => !(COLORS.test(parts[k]) || (k === 'bezel' && parts[k] === '')))) return 'bad color';
      for (const k of keys) r.paint[k] = parts[k].toLowerCase();
      r.frame = r.paint.frame; r.accent = r.paint.led; break;
    }
    case 'rack.design':
      r.paint ??= newPaint();
      if (op.design != null) { if (!DESIGNS.includes(op.design)) return 'unknown design'; r.paint.design = op.design; }
      if (op.ink != null) { if (!COLORS.test(op.ink)) return 'bad color'; r.paint.ink = op.ink.toLowerCase(); }
      break;
    case 'rack.frameType':
      r.rackId = rack(op.id).id;
      while (rackTotals(r).u > rack(r.rackId).u) r.slots.pop();
      break;
    case 'rack.order':
      if (!r.slots.length) return 'empty rack';
      r.ordered = { at: Date.now(), by: s.players[playerId]?.name ?? 'guest', ...rackTotals(r), orderId: 'CD-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
      break;
    case 'chip.paint':
      if (op.cell < 0 || op.cell >= s.chip.cells.length) return 'bad cell';
      if (op.block !== null && !CHIP_BLOCKS.some(b => b.id === op.block)) return 'unknown block';
      s.chip.cells[op.cell] = op.block; s.chip.taped = false; break;
    case 'player.name': {
      const n = String(op.name || '').trim().slice(0, 16); if (!n) return 'name required';
      if (s.players[playerId]) s.players[playerId].name = n;
      if (s.racks[playerId]) s.racks[playerId].owner = n; if (s.chips[playerId]) s.chips[playerId].owner = n; break;
    }
    case 'my.paint':
      if (c.taped) return 'already taped out';
      if (op.cell < 0 || op.cell >= c.cells.length) return 'bad cell';
      if (op.block !== null && !CHIP_BLOCKS.some(b => b.id === op.block)) return 'unknown block';
      c.cells[op.cell] = op.block; break;
    case 'my.clear': c.cells.fill(null); c.taped = false; c.at = null; break;
    case 'my.tapeout':
      if (!c.cells.some(Boolean)) return 'empty die';
      c.taped = true; c.at = Date.now(); break;
    case 'lobby.reset': s.chips = {}; s.racks = {}; s.chip = newState().chip; s.started = null; s.show = { stage: 0, mode: s.show?.mode ?? 'chip' }; break;
    case 'lobby.start': s.started ??= Date.now(); break;
    case 'lobby.stop': s.started = null; break;
    case 'show.set': {
      const st = Math.max(0, Math.min(2, op.stage | 0)), md = op.mode === 'rack' ? 'rack' : 'chip';
      s.show = { stage: st, mode: md }; s.started = st > 0 ? (s.started ?? Date.now()) : null; break;
    }
    case 'chip.clear': s.chip.cells.fill(null); s.chip.taped = false; break;
    case 'chip.tapeout':
      if (!s.chip.cells.some(Boolean)) return 'empty die';
      s.chip.taped = true; break;
    default: return 'unknown op';
  }
  s.rev++;
  return null;
}

export function snapshot(s) {
  const racks = Object.fromEntries(Object.entries(s.racks).map(([id, r]) => [id, { ...r, totals: rackTotals(r) }]));
  const all = Object.values(racks).map(r => r.totals);
  const room = { racks: all.length, kw: +all.reduce((a, t) => a + t.kw, 0).toFixed(2), price: all.reduce((a, t) => a + t.price, 0), ordered: Object.values(s.racks).filter(r => r.ordered).length };
  const chips = Object.fromEntries(Object.entries(s.chips || {}).map(([id, c]) => [id, { ...c, result: chipScore(c) }]));
  return { ...s, racks, chips, totals: { room, chip: chipTotals(s.chip) } };
}
