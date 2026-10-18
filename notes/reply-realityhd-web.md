# RealityHD models in the web app

Use the RealityHD models. The pipeline exists: scripts/export-realityhd.sh runs `realityhd export <id> --lod 1 --size 512` to GLB, and web/src/scene.js already loads GLB with GLTFLoader (desktop-monitor, laptop). Only 2 of 1475 catalog ids are exported today.

Datacenter ids in ../RealityHD/CATALOG.md:
rack-nvl72-2025, rack-ai-1mw, rack-air-42u, rack-lpu, rack-manifold, compute-tray-gpu, switch-tray-cpo,
cable-tray-ladder, leak-detection-cable, cable-label, server-lift, electrical-panel, pole-transformer,
rooftop-hvac, utility-cabinet, track-lighting, ceiling-light.

Plan:
1. Add those ids to the `for id in ...` lists in scripts/export-realityhd.sh. Use --lod 2 for room filler, --lod 1 for the hero rack.
2. Compress with gltf-transform (draco or meshopt + KTX2/WebP textures). Target under 1.5 MB per GLB for phone guests.
3. Data center / server room: replace box props with GLB instances (InstancedMesh per mesh for rack rows), cable-tray-ladder overhead, hvac and electrical-panel on walls.
4. Rack view: keep the procedural rack in scene.js. Paint mode (commit 96bc908) colors named parts ('sides' etc.) and syncs to 6 clients; a GLB rack has different node names. Either map GLB node names to paint parts, or load compute-tray-gpu / switch-tray-cpo GLBs into the procedural chassis slots. The second option keeps paint mode and the slide-in animation.
5. Lazy-load per scene, show the procedural box until the GLB resolves (same fallback PropFactory.swift:35 uses).

Improving the hand-built three.js geometry is lower value than this: the RealityHD racks already have PBR materials and LODs.
