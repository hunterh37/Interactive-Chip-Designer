// Monochrome theme + ASCII helpers shared by host and guest pages.

/** Glyph + gray shade per chip block. Overrides catalog colors so the 3D die matches the UI. */
export const BLOCK_STYLE = {
  tensor: { g: '█', c: '#ffffff', short: 'TNSR' },
  sram:   { g: '▒', c: '#8c8c8c', short: 'SRAM' },
  hbm:    { g: '≡', c: '#d0d0d0', short: 'HBM4' },
  cpu:    { g: '◆', c: '#6e6e6e', short: 'CPU' },
  noc:    { g: '+', c: '#444444', short: 'NOC' },
  io:     { g: '◎', c: '#b0b0b0', short: 'I/O' },
};
export function monoCatalog(cat) {
  cat.chipBlocks.forEach(b => { const s = BLOCK_STYLE[b.id]; if (s) Object.assign(b, { color: s.c, glyph: s.g, short: s.short }); });
  return cat;
}

/** Text meter: [████████░░░░] */
export function bar(v, max, w = 16) {
  const f = Math.max(0, Math.min(w, Math.round((v / max) * w)));
  return '█'.repeat(f) + '░'.repeat(w - f);
}

/** Scramble-in text effect on an element. */
const POOL = '!<>-_\\/[]{}=+*^?#01ABCDEF';
export function scramble(el, text, ms = 500) {
  const t0 = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / ms), n = Math.floor(p * text.length);
    el.textContent = text.slice(0, n) + [...text.slice(n)].map(ch => ch === ' ' ? ' ' : POOL[Math.random() * POOL.length | 0]).join('');
    if (p < 1) requestAnimationFrame(step);
  };
  step();
}

/** Full-bleed animated ASCII field on a canvas. Returns { stop, pulse }. */
export function asciiField(canvas, { density = ' .:-=+*#%@', speed = 1, alpha = 0.22 } = {}) {
  const ctx = canvas.getContext('2d'); let w, h, cw = 9, ch = 14, raf, boost = 0;
  const resize = () => {
    const r = devicePixelRatio || 1; w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * r; canvas.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.font = `11px 'JetBrains Mono', monospace`; ctx.textBaseline = 'top';
  };
  addEventListener('resize', resize); resize();
  const frame = t => {
    t *= 0.00025 * speed; boost *= 0.94;
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y += ch) for (let x = 0; x < w; x += cw) {
      const v = Math.sin(x * 0.011 + t * 3) * Math.cos(y * 0.017 - t * 2) + Math.sin((x + y) * 0.006 + t) * 0.6;
      const k = Math.max(0, Math.min(density.length - 1, Math.floor(((v + 1.6) / 3.2) * density.length + boost * 3)));
      if (k === 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${alpha * (k / density.length) + boost * 0.2})`;
      ctx.fillText(density[k], x, y);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf), pulse: () => { boost = 1; } };
}

/** ASCII die drawing for result cards. */
export function asciiDie(cells, cols, styleOf = id => BLOCK_STYLE[id]?.g ?? '·') {
  const rows = [];
  rows.push('┌' + '──'.repeat(cols) + '─┐');
  for (let r = 0; r < cells.length / cols; r++) rows.push('│ ' + cells.slice(r * cols, r * cols + cols).map(c => (c ? styleOf(c) : '·') + ' ').join('') + '│');
  rows.push('└' + '──'.repeat(cols) + '─┘');
  return rows.join('\n');
}

export const LOGO = String.raw`
 ▄▄▄ ▄  ▄ ▄ ▄▄▄
 █   █▄▄█ █ █▄█
 ▀▀▀ ▀  ▀ ▀ ▀   DESIGNER`;
