import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, apply, snapshot } from './rooms.js';

test('rack add totals and capacity', () => {
  const s = newState();
  assert.equal(apply(s, { type: 'rack.add', id: 'dgx-b200' }, 'p'), null);
  assert.equal(snapshot(s).totals.rack.u, 10);
  for (let i = 0; i < 3; i++) apply(s, { type: 'rack.add', id: 'dgx-b200' }, 'p');
  assert.equal(apply(s, { type: 'rack.add', id: 'pure-x70' }, 'p'), 'rack full');
});

test('color validation and order', () => {
  const s = newState();
  apply(s, { type: 'rack.color', frame: 'red' }, 'p');
  assert.equal(s.rack.frame, '#1c1d20');
  assert.equal(apply(s, { type: 'rack.order' }, 'p'), 'empty rack');
  apply(s, { type: 'rack.add', id: 'r760' }, 'p');
  assert.equal(apply(s, { type: 'rack.order' }, 'p'), null);
  assert.equal(s.rack.ordered.price, 1890 + 18500);
});

test('chip paint and tapeout', () => {
  const s = newState();
  assert.equal(apply(s, { type: 'chip.tapeout' }, 'p'), 'empty die');
  apply(s, { type: 'chip.paint', cell: 0, block: 'tensor' }, 'p');
  assert.ok(snapshot(s).totals.chip.tflops > 0);
  assert.equal(apply(s, { type: 'chip.paint', cell: 99, block: 'tensor' }, 'p'), 'bad cell');
});
