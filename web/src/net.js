const env = import.meta.env.VITE_API_URL;
export const API = env ? (env.startsWith('http') ? env : `https://${env}`) : `${location.protocol}//${location.hostname}:8787`;
const WS = API.replace(/^http/, 'ws') + '/ws';

export async function catalog() { return (await fetch(`${API}/api/catalog`)).json(); }
export async function createRoom() { return (await fetch(`${API}/api/rooms`, { method: 'POST' })).json(); }

/** Live room connection with auto-reconnect. onState(state), onPose(id, p). */
export function connect({ room = 'DEMO', kind, mode, name, pid = '', onState, onPose, onError }) {
  let ws, closed = false, queue = [];
  const open = () => {
    ws = new WebSocket(`${WS}?room=${room}&kind=${kind}&mode=${mode}&name=${encodeURIComponent(name || kind)}&pid=${pid}`);
    ws.onopen = () => { queue.forEach(m => ws.send(m)); queue = []; };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'state') onState?.(m.state);
      else if (m.t === 'pose') onPose?.(m.id, m.p);
      else if (m.t === 'error') onError?.(m.error);
    };
    ws.onclose = () => { if (!closed) setTimeout(open, 1000); };
  };
  open();
  return {
    send(op) { const m = JSON.stringify(op); ws.readyState === 1 ? ws.send(m) : queue.push(m); },
    close() { closed = true; ws.close(); },
  };
}
