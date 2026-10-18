import { component, rack, rackTotals, chipTotals, DIE, CHIP_BLOCKS } from './catalog.js';

const COLORS = /^#[0-9a-f]{6}$/i;
export const newRoomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

export function newState() {
  return {
    rack: { rackId: 'apc-ar3300', frame: '#1c1d20', accent: '#00e0a4', slots: [], ordered: null },
    chip: { name: 'HACK-1', cells: Array(DIE.cols * DIE.rows).fill(null), taped: false },
    players: {},
    rev: 0,
  };
}

/** Applies one client op to state. Returns error string or null. Pure aside from mutation of `s`. */
export function apply(s, op, playerId) {
  const r = s.rack;
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
      if (op.frame && COLORS.test(op.frame)) r.frame = op.frame;
      if (op.accent && COLORS.test(op.accent)) r.accent = op.accent;
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
    case 'chip.clear': s.chip.cells.fill(null); s.chip.taped = false; break;
    case 'chip.tapeout':
      if (!s.chip.cells.some(Boolean)) return 'empty die';
      s.chip.taped = true; break;
    default: return 'unknown op';
  }
  s.rev++;
  return null;
}

export const snapshot = s => ({ ...s, totals: { rack: rackTotals(s.rack), chip: chipTotals(s.chip) } });
