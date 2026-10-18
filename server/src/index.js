import http from 'node:http';
import { WebSocketServer } from 'ws';
import { RACKS, COMPONENTS, CHIP_BLOCKS, DIE } from './catalog.js';
import { PAINT_PARTS, DESIGNS } from './rooms.js';
import { newState, apply, snapshot } from './rooms.js';

const PORT = process.env.PORT || 8787;
const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';
const rooms = new Map(); // code -> { state, sockets:Set }

function room(code) {
  code = String(code || 'DEMO').toUpperCase().slice(0, 4); // one lobby for the demo unless a code is given
  if (!rooms.has(code)) rooms.set(code, { state: newState(), sockets: new Set(), touched: Date.now() });
  return rooms.get(code);
}

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, rooms: rooms.size });
  if (url.pathname === '/api/catalog') return json(res, 200, { racks: RACKS, components: COMPONENTS, chipBlocks: CHIP_BLOCKS, die: DIE, paintParts: PAINT_PARTS, designs: DESIGNS });
  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const code = 'DEMO'; room(code);
    return json(res, 200, { code, joinUrl: `${WEB_URL}/join.html?room=${code}` });
  }
  const m = url.pathname.match(/^\/api\/rooms\/([A-Z]{4})$/i);
  if (m) return json(res, 200, snapshot(room(m[1]).state));
  json(res, 404, { error: 'not found' });
});

const wss = new WebSocketServer({ server, path: '/ws' });
const broadcast = r => {
  const msg = JSON.stringify({ t: 'state', state: snapshot(r.state) });
  for (const ws of r.sockets) if (ws.readyState === 1) ws.send(msg);
};

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const r = room(url.searchParams.get('room'));
  const id = (url.searchParams.get('pid') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || Math.random().toString(36).slice(2, 10);
  const kind = ['phone', 'host', 'vision', 'xr'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'phone';
  r.state.players[id] = { name: (url.searchParams.get('name') || kind).slice(0, 20), kind, mode: url.searchParams.get('mode') === 'chip' ? 'chip' : 'rack' };
  r.sockets.add(ws);
  // Stable player id from the client lets a phone keep its rack across reconnects.
  ws.send(JSON.stringify({ t: 'hello', id }));
  broadcast(r);
  ws.on('message', buf => {
    let op; try { op = JSON.parse(buf); } catch { return; }
    if (op.type === 'pose') { // head/controller pose relay, not persisted
      const msg = JSON.stringify({ t: 'pose', id, p: op.p });
      for (const o of r.sockets) if (o !== ws && o.readyState === 1) o.send(msg);
      return;
    }
    const err = apply(r.state, op, id);
    r.touched = Date.now();
    if (err) ws.send(JSON.stringify({ t: 'error', error: err })); else broadcast(r);
  });
  ws.on('close', () => { r.sockets.delete(ws); delete r.state.players[id]; broadcast(r); }); // rack stays in the room
});

setInterval(() => { // drop idle empty rooms after 6 h
  for (const [c, r] of rooms) if (!r.sockets.size && Date.now() - r.touched > 6 * 3600e3) rooms.delete(c);
}, 600e3);

server.listen(PORT, () => console.log(`chipdesigner server :${PORT}`));
