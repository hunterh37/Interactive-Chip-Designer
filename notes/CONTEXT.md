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
- Fab and Chip Workshop tiles currently open the Inspector only.
