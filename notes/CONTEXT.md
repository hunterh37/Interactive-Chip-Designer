# ChipDesigner monorepo context
- server/ Node ws server. src/catalog.js (real components, chip blocks), src/rooms.js (ops: rack.add/remove/color/frameType/order, chip.paint/clear/tapeout), src/index.js (HTTP /api/catalog, POST /api/rooms, /ws?room&kind&mode&name). Tests: npm test -w server.
- web/ Vite + three. index.html host (QR + mode toggle), join.html phone (configure, purchase, AR: iOS USDZExporter Quick Look, Android -> xr.html), xr.html WebXR AR/VR. src/scene.js builders mirror Terawatt/Live/LiveBuilder.swift.
- Terawatt/ visionOS app (kept). Terawatt/Live/: LiveSession (ws client, LIVE_API_URL), LiveBuilder, LiveView (Home join row, volume, mixed immersive life-size rack).
- render.yaml: chipdesigner-api (node) + chipdesigner-web (static). Workspace ChipDesigner tea-dbah1qbrjlhs73a871h0.
- scripts/export-realityhd.sh: RealityHD props -> web/public/models (GLB ok, USDZ via blender failing).
