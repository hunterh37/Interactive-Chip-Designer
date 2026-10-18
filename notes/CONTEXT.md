# Context

## File map
- project.yml: XcodeGen. Targets Terawatt, TerawattTests. Packages RealityHD (local ../RealityHD), DicyaninStageDirector, DicyaninPerfProbe (main).
- Terawatt/TerawattApp.swift: scenes home, inspector (windows), tabletop (volume 1.2x0.6x1.2 m), walk (full ImmersiveSpace). DEBUG: PerfProbe start, `.director(DemoRoutes.register)`.
- Terawatt/Model: CampusSpec (HallDims, Room, RackRow, CoolingKind, PowerKind), RackPreset (table + propID), ChipSpec (blocks, perfFactor), Wafer (FabStation x12, WaferState.advance), ProjectStore (@Observable, JSON per project in Application Support/Projects).
- Terawatt/Engine: CampusMath (pure stats -> CampusStats, site score/rank), Sites (9 sites).
- Terawatt/Reality: PropFactory (PROPS.md id -> RealityHD.entity or box), CampusBuilder (spec -> Entity, meters).
- Terawatt/Scenes: HomeView, InspectorView, TabletopView, WalkView, HUDStrip (ornament).
- Terawatt/Theme.swift: paper, graphite, accent orange; Fmt helpers.
- Terawatt/Demo/DemoRoutes.swift: StageDirector route `launch`.
- TerawattTests/CampusMathTests.swift: swift-testing.

## Types
- CampusStats: rackCount, gpuCount, itMW, facilityMW, pue, wue, pflopsFP4, prefillTokS, decodeTokS, usdPerMTok, capexUSD, carbonTPerYr, latencyMs, cableKm, overBudget.
- CampusMath.stats(spec, installedChips:, chip:) is the entry point for HUD.
- Fab and Chip Workshop tiles open tabletop + inspector.

## Design Studio (done)
- Inspector edits site, budget, hall L/W/H, rows, racks per row (clamped by CampusSpec.maxRacksPerRow), rack preset, cooling, power. Autosaves via ProjectStore.persist(). Hall change calls CampusSpec.relayoutRooms().
- CampusBuilder.build(spec, immersive:) is uncapped. Rows pair back to back around a hot aisle (rowZ, hotAisleZ). Contained pairs get roof and end doors; busway per row (accent); LED strips; CDU row; chiller yard grid.
- TabletopView and WalkView rebuild with .task(id: campus). Walk spawns at hotAisleZ, HUD attachment at x=3 m.
- .gitignore rewritten; Terawatt.xcodeproj untracked (regenerate with xcodegen generate).

## Fab mode (done)
- ProjectStore.mode (.studio/.fab, not persisted), sceneKey drives tabletop/walk rebuild. Home Fab tile sets .fab and opens tabletop + inspector.
- Model/FabFlow: toolIDs (12), look(station) -> WaferLook (bare/oxide/patterned/metal), status(of:wafer:) -> ToolStatus, WaferState.at(_:).
- Reality/FabBuilder (FabScene): two tool rows (stations 1-6 at z<0, 7-12 at z>0) around a 4 m OHT aisle, grate floor, rail y=4.3, status towers (amber waiting, green running), immersive adds yellow FFU ceiling, walls, point lights. apply(station, animated:) moves OHT, hoists FOUP, sets wafer material and lamps.
- Placeholders: foup, oht-vehicle, 12 tool ids render as light boxes via PropFactory.sizes/fabIDs until RealityHD terawatt-fab merges; wafer is a cylinder entity with lookMaterial.
- Scenes/FabInspector: step list (tap to jump), Next, Restart, Walk. Tabletop scales bay length to 1.1 m; Walk is 1:1 at tool 1.
- Tests: TerawattTests/FabFlowTests.swift (16 tests total pass).

## Chip Workshop (done)
- AppMode.chip. Project gains optional chipStepRaw, tapedOut, packaged (old files decode). ProjectStore: micro, explode, delta, openChip, tapeOut (freezes ChipSpec, TDP from model, resets wafer, mode .fab), package, install (installCount = racks x 72), uninstall.
- Model/ChipMath: ChipStep (7), MicroLevel, ChipMath (reticle 858 mm2, 26 mm wide strip floorplan, power by block W/mm2 x node, timing, HBM stacks = PHY area / 22.5, perf capped 20 PFLOPS/stack, unitCostUSD), ChipLoop.delta -> CampusDelta (PFLOPS, MW, $/Mtok).
- CampusMath.stats adds installed chips to tokens (8k decode, 120k prefill x perfFactor) and capex. Installed chips are additive to preset GPUs.
- Reality/ChipBuilder (ChipScene, 1 mm = 0.01 m): die canvas (heat in simulate), reticle, package explode (setExplode animates), integrate, micro wafer/die/transistor placeholders.
- Scenes/ChipInspector: steps, controls, readout, micro picker. FabInspector shows Package when wafer finished and chip taped out. HUDStrip shows delta row when installed.
- Placeholder prop ids: hbm-stack, gpu-module-2035, compute-tray-gpu.
- Tests: TerawattTests/ChipLoopTests.swift (24 total pass). No StageDirector chip routes yet.

## Training mode
- AppMode.training; store.training: TrainingState (session only). SceneKey.zoom rebuilds on zoom change; step changes call TrainingScene.apply.
- Model/TrainingFlow: TrainStep (18, ppe..campus), focus child name, zoom (rack/row/hall/campus), props; RackU (44.45 mm, slotU).
- Reality/TrainingBuilder: TrainingScene. Rack-local anchors (anchors table) for highlight outline + stand-here ring; tray slides to slot 9; power/hose/fiber cables as cylinder polylines; LEDs green on powerOn. Hall/campus reuse CampusBuilder.
- Scenes/TrainingInspector; Home tile Training; routes training/step/1..18, training/walk.
- Tests: TrainingFlowTests (29 total pass). Prop queue: notes/PROP_QUEUE.md "l1 Training".

## Rack to the Future twin (AppMode.twin)
- Source spec: docs/Rack-to-the-Future-Technical-Spec.pdf (+ .txt extract). Home tile "Rack to the Future" opens tabletop + inspector (ScenarioPanel).
- Terawatt/Resources/twin-presets.json: rack catalog with year points (2025/2030 projection/2035), user cases A/B/C, static sentiment for 6 Earth sites.
- Terawatt/Twin/Scenario.swift: Scenario (budget, grid cap, launch $/kg, PUE, energy price, year, case mix, building $/MW, sites), TwinSite > TwinBuilding > TwinHall (cooling, rackMix). TwinScale (chip..offWorld), TwinFocus (zoomedIn/zoomedOut), TwinLens (heat, power, business, manufacturing, comms).
- Terawatt/Twin/ScenarioEngine.swift: pure. rack(id, year) interpolates; run(sc) -> TwinMetrics; checks in order grid, budget, serving, cooling, latency; firstFailing.cause is a TwinFocus. Off-world: radiator 826 W/m2, 5 kg/m2, solar 7 kg/kW, launch multiple LEO 1, Moon 5, Mars 10. Sentiment con > 0.4 adds building cost and delay. TwinLensMath maps metrics to 0...1 stress.
- Terawatt/Twin/TwinBuilder.swift: procedural levels; tappable entities named tap:site:i, tap:building:i, tap:hall:i, tap:rack:<id>, tap:chip. hall() is 1:1 meters (walk) and scaled on tabletop.
- Terawatt/Twin/ScenarioPanel.swift: breadcrumb, constraint gauges (tap failing -> zoom to cause), lens, year, level editors, presets, case mix, off-world toggles, assumptions. TwinHUD ornament.
- ProjectStore: Project.scenarioRaw (optional), focus, lens, twin, openTwin, zoomIn/zoomOut/zoom(to:). SceneKey.twin rebuilds tabletop/walk.
- Routes: twin/1-fleet ... twin/6-2025 follow the spec demo flow.
- Tests: TerawattTests/TwinEngineTests.swift (worked example 631 racks, grid binds before budget, cooling fit, year interpolation, off-world, case demand). 39 total pass.
- Assumptions (spec open questions): tokens/s per chip from RackPreset values, building $11M/MW, 2030 rack points, sentiment static.
