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

test('track 2: official random layout scores 1, clearance breaks tapeout, tapeout locks', async () => {
  const { newState, apply, snapshot } = await import('./rooms.js');
  const s = newState(); s.players.p1 = { name: 'x', kind: 'phone' };
  assert.equal(apply(s, { type: 'player.name', name: 'Ada' }, 'p1'), null);
  assert.equal(apply(s, { type: 'my.clear' }, 'p1'), null);
  assert.equal(s.chips.p1.result.score, 1);
  assert.equal(apply(s, { type: 'my.move', i: 0, x: 0.5, y: 3.259 }, 'p1'), null); // G0 inside the 1 mm edge margin
  assert.equal(s.chips.p1.result.passed, false);
  assert.match(s.chips.p1.result.reason, /edge clearance/);
  assert.equal(apply(s, { type: 'my.tapeout' }, 'p1'), 'layout breaks a rule');
  assert.equal(apply(s, { type: 'my.move', i: 0, x: 7.563, y: 3.259 }, 'p1'), null);
  assert.equal(apply(s, { type: 'my.tapeout' }, 'p1'), null);
  assert.equal(apply(s, { type: 'my.move', i: 1, x: 20, y: 3 }, 'p1'), 'already taped out');
  assert.equal(snapshot(s).chips.p1.owner, 'Ada');
});

test('paint parts and side design sync into rack state', () => {
  const s = newState(); join(s, 'a');
  assert.equal(apply(s, { type: 'rack.paint', parts: { sides: '#FF0000', door: '#00ff00' } }, 'a'), null);
  assert.equal(s.racks.a.paint.sides, '#ff0000');
  assert.equal(apply(s, { type: 'rack.paint', part: 'frame', color: '#123456' }, 'a'), null);
  assert.equal(s.racks.a.frame, '#123456');
  assert.equal(apply(s, { type: 'rack.paint', part: 'bogus', color: '#123456' }, 'a'), 'unknown part');
  assert.equal(apply(s, { type: 'rack.paint', part: 'top', color: 'red' }, 'a'), 'bad color');
  assert.equal(apply(s, { type: 'rack.paint', part: 'bezel', color: '' }, 'a'), null);
  assert.equal(apply(s, { type: 'rack.design', design: 'flames', ink: '#ff8800' }, 'a'), null);
  assert.equal(snapshot(s).racks.a.paint.design, 'flames');
  assert.equal(apply(s, { type: 'rack.design', design: 'skulls' }, 'a'), 'unknown design');
});

test('track 2 rules match the judge: reach, examples, autocool improves', async () => {
  const { score, T2, IDS } = await import('./interposer.js');
  const lay = n => IDS.map(id => ({ id, x: T2.examples[n][id][0], y: T2.examples[n][id][1] }));
  for (const n of Object.keys(T2.examples)) assert.ok(score(lay(n)).passed, n);
  const far = lay('ring_center'); far[IDS.indexOf('H0')].x += 3; // pull H0 away from G0: P0 exceeds 5 mm reach
  const r = score(far); assert.equal(r.passed, false); assert.match(r.reason, /P0|S1|clearance|capacity/);
  const s = newState(); join(s, 'a'); apply(s, { type: 'my.clear' }, 'a');
  assert.equal(apply(s, { type: 'my.autocool' }, 'a'), null);
  assert.ok(s.chips.a.result.passed && s.chips.a.result.score <= 1);
});

test('site pins, votes, lock on leaving join', () => {
  const s = newState(); join(s, 'a'); join(s, 'b'); join(s, 'c');
  assert.equal(apply(s, { type: 'site.pin', lat: 200, lon: 0 }, 'a'), 'bad location');
  apply(s, { type: 'site.pin', lat: 39.04, lon: -77.49, place: 'Ashburn' }, 'a');
  apply(s, { type: 'site.pin', lat: 64.1, lon: -21.9, place: 'Reykjavik' }, 'b');
  assert.equal(apply(s, { type: 'site.vote', target: 'zz' }, 'c'), 'no such pin');
  apply(s, { type: 'site.vote', target: 'b' }, 'c');
  const snap = snapshot(s);
  assert.equal(snap.site.tally.b, 2); assert.equal(snap.site.leader, 'b');
  apply(s, { type: 'show.set', stage: 1, mode: 'rack' }, 'host');
  assert.equal(s.site.chosen.place, 'Reykjavik'); assert.equal(s.site.chosen.votes, 2);
  assert.equal(apply(s, { type: 'site.vote', target: 'a' }, 'a'), 'site locked');
  apply(s, { type: 'lobby.reset' }, 'a'); assert.equal(s.site.chosen, null);
});
