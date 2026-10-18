import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, apply, snapshot } from './rooms.js';

const join = (s, id, name = id) => { s.players[id] = { name, kind: 'phone', mode: 'rack' }; };

test('each player gets their own rack; room totals sum', () => {
  const s = newState(); join(s, 'a'); join(s, 'b');
  assert.equal(apply(s, { type: 'rack.add', id: 'dgx-b200' }, 'a'), null);
  assert.equal(apply(s, { type: 'rack.add', id: 'r760' }, 'b'), null);
  const snap = snapshot(s);
  assert.equal(snap.racks.a.totals.u, 10);
  assert.equal(snap.racks.b.totals.u, 2);
  assert.equal(snap.totals.room.racks, 2);
  assert.equal(snap.racks.a.owner, 'a');
});

test('capacity per rack', () => {
  const s = newState(); join(s, 'a');
  for (let i = 0; i < 4; i++) apply(s, { type: 'rack.add', id: 'dgx-b200' }, 'a');
  assert.equal(apply(s, { type: 'rack.add', id: 'pure-x70' }, 'a'), 'rack full');
});

test('color validation and order', () => {
  const s = newState(); join(s, 'a');
  apply(s, { type: 'rack.color', frame: 'red' }, 'a');
  assert.equal(s.racks.a.frame, '#1c1d20');
  assert.equal(apply(s, { type: 'rack.order' }, 'a'), 'empty rack');
  apply(s, { type: 'rack.add', id: 'r760' }, 'a');
  assert.equal(apply(s, { type: 'rack.order' }, 'a'), null);
  assert.equal(s.racks.a.ordered.price, 1890 + 18500);
  assert.equal(snapshot(s).totals.room.ordered, 1);
});

test('chip paint, tapeout, lobby reset', () => {
  const s = newState(); join(s, 'a');
  assert.equal(apply(s, { type: 'chip.tapeout' }, 'a'), 'empty die');
  apply(s, { type: 'chip.paint', cell: 0, block: 'tensor' }, 'a');
  assert.ok(snapshot(s).totals.chip.tflops > 0);
  apply(s, { type: 'rack.add', id: 'r760' }, 'a');
  apply(s, { type: 'lobby.reset' }, 'a');
  assert.deepEqual(s.racks, {});
  assert.equal(s.chip.cells[0], null);
});

test('personal chip challenge: paint, score gates, tapeout locks, name propagates', async () => {
  const { newState, apply, snapshot } = await import('./rooms.js');
  const s = newState(); s.players.p1 = { name: 'x', kind: 'phone' };
  assert.equal(apply(s, { type: 'player.name', name: 'Ada' }, 'p1'), null);
  assert.equal(apply(s, { type: 'my.tapeout' }, 'p1'), 'empty die');
  for (let i = 0; i < 10; i++) apply(s, { type: 'my.paint', cell: i, block: 'tensor' }, 'p1');
  const before = snapshot(s).chips.p1.result;
  assert.equal(before.effective, 0); // no memory bandwidth
  apply(s, { type: 'my.paint', cell: 10, block: 'hbm' }, 'p1');
  apply(s, { type: 'my.paint', cell: 11, block: 'io' }, 'p1');
  apply(s, { type: 'my.paint', cell: 12, block: 'cpu' }, 'p1');
  const r = snapshot(s).chips.p1.result;
  assert.ok(r.score > 0 && r.checks.power && r.checks.io);
  assert.equal(apply(s, { type: 'my.tapeout' }, 'p1'), null);
  assert.equal(apply(s, { type: 'my.paint', cell: 20, block: 'sram' }, 'p1'), 'already taped out');
  assert.equal(snapshot(s).chips.p1.owner, 'Ada');
});
