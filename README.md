# ChipDesigner

Shared-room demo for designing a server rack or an AI chip. A host screen shows a QR code, phones join the room, and the result is viewable in WebXR, iOS AR Quick Look and on Apple Vision Pro. See PRD.md for the spec.

## Layout

| Path | Contents |
|---|---|
| server/ | Node WebSocket server. `src/catalog.js` (components, chip blocks), `src/rooms.js` (state and ops), `src/index.js` (HTTP and `/ws`). |
| web/ | Vite and three.js. `index.html` host, `join.html` phone, `xr.html` WebXR, `src/scene.js` scene builders. |
| Terawatt/ | visionOS app. `Terawatt/Live/` holds the ChipDesigner client (LiveSession, LiveBuilder, LiveView). |
| TerawattTests/ | Swift tests, including LiveSessionTests. |
| scripts/ | `export-realityhd.sh`. |
| render.yaml | Render blueprint. |

## Local development

```
npm install
npm run dev -w server
npm run dev -w web
```

Run the two dev commands in separate terminals. Open http://localhost:5173. The server listens on port 8787. Tests: `npm test`.

Phones on the same network need the host machine's LAN address in place of localhost, and `WEB_URL` set to the same address when starting the server.

## Render deploy

render.yaml defines `chipdesigner-api` (Node, health check `/healthz`) and `chipdesigner-web` (static, publishes `web/dist`). Both belong to the Render workspace ChipDesigner. Create a Blueprint from the repo. Set `WEB_URL` on the API to the web service URL and `VITE_API_URL` on the web service to the API URL. Defaults are `https://chipdesigner-web.onrender.com` and `https://chipdesigner-api.onrender.com`.

For Vision Pro, set `LIVE_API_URL` in the visionOS app to the API URL.

## RealityHD export

```
scripts/export-realityhd.sh
```

Requires the RealityHD checkout at `../RealityHD`. Builds the `realityhd` CLI and exports `desktop-monitor` and `laptop` at LOD 1, 512 px textures, into `web/public/models`. GLB output works. USDZ output through Blender currently fails.

## Demo script

1. Deploy or start locally and open the host page. The QR code and 4-letter room code appear.
2. Scan the QR with two phones. Both open `join.html` in the room.
3. Phone A, Server Rack: choose the NVL72 frame, add DGX B200 and a Spectrum-4 switch, change the frame and accent colors.
4. Phone B edits the same rack. Both phones and the host screen update.
5. Press purchase on a phone. The order id and totals appear everywhere.
6. Switch to Chip Design. Paint tensor, SRAM and HBM blocks, then tape out.
7. On iPhone, press AR to open Quick Look. On Android, press AR to open the WebXR view.
8. On Vision Pro, enter the room code in Home, choose Live Rack, and open the volume and the life-size mixed immersive rack. The presenter wears the headset while phones keep editing.

## Legacy visionOS modes

Design Studio, Fab, Training and Chip Workshop remain in Terawatt/ and build from `Terawatt.xcodeproj` (XcodeGen, `project.yml`). See Idea.md.
