// Track 2: compact thermal model of the 8×8 die, a surrogate fitted on it, and a surrogate-driven layout optimizer.
import { CHIP_BLOCKS, DIE, isEdge } from './die.js';

const N = DIE.cols * DIE.rows, CELL = DIE.reticleMM2 / N;
const RV = 5.0, G = 1.5, AMB = 35; // °C/W per cell to the cold plate, lateral/vertical conductance ratio, coolant °C
const nbr = Array.from({ length: N }, (_, i) => {
  const x = i % DIE.cols, y = Math.floor(i / DIE.cols);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < DIE.cols && b < DIE.rows).map(([a, b]) => b * DIE.cols + a);
});
const watts = id => { const b = CHIP_BLOCKS.find(k => k.id === id); return b ? b.w * CELL / b.mm2 : 0; };

/** Steady-state cell temperatures: q·Rv = (T − amb) + G·Σ(T − Tn), Gauss-Seidel. */
export function solve(cells) {
  const q = cells.map(watts), T = Array(N).fill(AMB);
  for (let it = 0; it < 200; it++) for (let i = 0; i < N; i++) {
    let s = 0; for (const j of nbr[i]) s += T[j];
    T[i] = (q[i] * RV + AMB + G * s) / (1 + G * nbr[i].length);
  }
  let hot = 0; for (let i = 1; i < N; i++) if (T[i] > T[hot]) hot = i;
  return { temps: T.map(t => +t.toFixed(1)), tmax: +T[hot].toFixed(1), hot };
}
export const throttle = tmax => Math.max(0.6, Math.min(1, 1 - (tmax - 95) / 50));

// Surrogate: linear model on cheap layout features, fitted to solver output on random layouts.
const center = i => { const x = i % DIE.cols, y = Math.floor(i / DIE.cols); return x >= 2 && x <= 5 && y >= 2 && y <= 5; };
export function features(cells) {
  const q = cells.map(watts); let pairs = 0, tot = 0, sq = 0, peak3 = 0, peak5 = 0;
  for (let i = 0; i < N; i++) { tot += q[i]; sq += q[i] * q[i]; for (const j of nbr[i]) if (j > i) pairs += q[i] * q[j]; }
  for (let y = 0; y < DIE.rows; y++) for (let x = 0; x < DIE.cols; x++) { // hottest 3×3 and 5×5 windows
    let s3 = 0, s5 = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= DIE.cols || b >= DIE.rows) continue;
      const v = q[b * DIE.cols + a]; s5 += v; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) s3 += v;
    }
    peak3 = Math.max(peak3, s3); peak5 = Math.max(peak5, s5);
  }
  return [1, tot / 100, pairs / 1000, sq / 1000, peak3 / 10, peak5 / 100];
}
let W = null, fit = null;
function train(n = 3000) {
  const ids = [null, ...CHIP_BLOCKS.map(b => b.id)]; let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const X = [], y = [];
  for (let k = 0; k < n; k++) {
    const fill = rnd(), cells = Array.from({ length: N }, () => rnd() < fill ? ids[1 + Math.floor(rnd() * (ids.length - 1))] : null);
    if (k % 2) { // half the set: a tensor blob somewhere, so clustering is represented
      const cx = rnd() * 8, cy = rnd() * 8, r = 1 + rnd() * 2.5;
      for (let i = 0; i < N; i++) if (Math.hypot(i % 8 - cx, Math.floor(i / 8) - cy) < r) cells[i] = 'tensor';
    }
    X.push(features(cells)); y.push(solve(cells).tmax);
  }
  const d = X[0].length, A = Array.from({ length: d }, () => Array(d + 1).fill(0)); // normal equations + small ridge
  X.forEach((x, r) => { for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) A[i][j] += x[i] * x[j]; A[i][d] += x[i] * y[r]; } });
  for (let i = 0; i < d; i++) A[i][i] += 1e-6;
  for (let c = 0; c < d; c++) { let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < d; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= d; j++) A[r][j] -= f * A[c][j]; } }
  W = A.map((row, i) => row[d] / row[i]);
  const pred = X.map(predictX), mean = y.reduce((a, b) => a + b) / n;
  const mae = y.reduce((a, t, i) => a + Math.abs(t - pred[i]), 0) / n, r2 = 1 - y.reduce((a, t, i) => a + (t - pred[i]) ** 2, 0) / y.reduce((a, t) => a + (t - mean) ** 2, 0);
  fit = { samples: n, mae: +mae.toFixed(2), r2: +r2.toFixed(3) };
}
export const weights = () => W;
const predictX = x => x.reduce((a, v, i) => a + v * W[i], 0);
export const predict = cells => { if (!W) train(); return predictX(features(cells)); };
export const surrogateFit = () => { if (!W) train(); return fit; };

/** Rearranges the same blocks for lower Tmax: hill-climb on swaps scored by the surrogate, solver verifies. */
export function autocool(cells, steps = 4000) {
  if (!W) train();
  const edgeOnly = id => id === 'hbm' || id === 'io';
  let cur = [...cells], best = predict(cur), seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let s = 0; s < steps; s++) {
    const a = Math.floor(rnd() * N), b = Math.floor(rnd() * N);
    if (cur[a] === cur[b]) continue;
    if ((edgeOnly(cur[a]) && isEdge(a) && !isEdge(b)) || (edgeOnly(cur[b]) && isEdge(b) && !isEdge(a))) continue;
    [cur[a], cur[b]] = [cur[b], cur[a]];
    const p = predict(cur);
    if (p < best) best = p; else [cur[a], cur[b]] = [cur[b], cur[a]];
  }
  const before = solve(cells).tmax, after = solve(cur).tmax;
  return after < before ? { cells: cur, before, after } : { cells: [...cells], before, after: before };
}
