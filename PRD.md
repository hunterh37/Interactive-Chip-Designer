# ChipDesigner PRD

## Summary

ChipDesigner is a hackathon demo. A host screen shows a QR code and room code. Phones scan it and join a shared room over WebSocket. Every participant edits the same state and sees changes within one network round trip. The shared scene can be viewed in WebXR (Android AR/VR), in iOS AR Quick Look (USDZ export), and on Apple Vision Pro.

## Modes

### Server Rack

- Pick a rack frame: APC NetShelter SX 42U (42U) or NVIDIA GB200 NVL72 frame (48U).
- Add real components from the catalog (server/src/catalog.js): GPU servers (DGX B200, HGX H200, MI325X), CPU servers, InfiniBand and Ethernet switches, flash storage, PDUs, UPS, in-rack CDU, blanking panels. Each has rack units, kW and list price in USD.
- Set frame and accent colors (`#rrggbb`).
- Totals: U used of capacity, kW, price.
- Purchase: `rack.order` freezes totals and returns an order id (`CD-XXXXXX`). Demo only, no payment.
- Adds are rejected when the rack is full.

### Chip Design

- 8 x 8 die floorplan on an 858 mm2 reticle.
- Paint cells with blocks: tensor cores, SRAM cache, HBM4 PHY, Arm CPU cluster, network-on-chip, NVLink/CPO I/O.
- Totals: used mm2, TFLOPS, watts.
- Tape out: `chip.tapeout` marks the die taped. Any later paint or clear resets it. Empty dies are rejected.

## Room model

- Room code: 4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ`.
- `POST /api/rooms` creates a room and returns `{ code, joinUrl }`.
- `GET /api/catalog` returns racks, components and chip blocks.
- `/ws?room&kind&mode&name` joins as `kind` host, phone or visionOS client.
- Client ops: `rack.add`, `rack.remove`, `rack.color`, `rack.frameType`, `rack.order`, `chip.paint`, `chip.clear`, `chip.tapeout`.
- The server applies each op to authoritative state, increments `rev` and broadcasts a snapshot including computed totals.
- `GET /healthz` returns `{ ok, rooms }`.

## Clients

### Host screen (web/index.html)

QR code for the join URL, room code, mode toggle, live 3D view of the shared state, player list.

### Phone (web/join.html)

Tabs for Server Rack and Chip Design. Rack: frame choice, color pickers, category tabs, component list, remove, purchase. Chip: block palette, tap cells to paint, clear, tape out. Live 3D preview and summary line. AR button:
- iOS: three.js `USDZExporter` builds a USDZ of the current scene and opens AR Quick Look.
- Android: opens web/xr.html.

### WebXR (web/xr.html)

AR (immersive-ar) and VR (immersive-vr) sessions on Android Chrome and headsets. Scene builders in web/src/scene.js mirror Terawatt/Live/LiveBuilder.swift so both platforms show the same geometry.

### Apple Vision Pro (Terawatt/Live/)

- Home window has a join row: room code field, Live Rack, Live Chip.
- LiveSession is the WebSocket client. The API base URL comes from `LIVE_API_URL`.
- Volume: rack at 0.25 scale or die at 1.2 scale, with an ornament HUD (U, kW, price, order id).
- Mixed immersive space: life-size rack placed 1.6 m in front of the user. Rack mode only.
- Presenter POV: the headset user wears the room view while phones edit, so the audience watches the rack change at full size.

## Deployment

Render blueprint in render.yaml: `chipdesigner-api` (Node web service, `/healthz`) and `chipdesigner-web` (static site from `web/dist`). Workspace ChipDesigner. The API reads `WEB_URL` for join links. The web build reads `VITE_API_URL`.

## Assets

scripts/export-realityhd.sh builds RealityHD props into web/public/models. GLB export works. USDZ export through Blender currently fails.

## Acceptance

- A second phone joining a room sees the first phone's rack edits.
- Order and tape-out states appear on host, phones, and Vision Pro.
- `npm test -w server` passes.
- AR launches on one iOS device (Quick Look) and one Android device (WebXR).
- Vision Pro shows the life-size rack from a live room.

## Out of scope

Real payments, accounts, persistence across server restarts, chip simulation beyond the totals formulas.

## Legacy visionOS modes

Design Studio, Fab, Training and Chip Workshop remain in Terawatt/ as the original offline visionOS app. They are unchanged by ChipDesigner. Their spec is in Idea.md.
