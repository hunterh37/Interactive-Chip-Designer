# Terawatt PRD

## Platform

visionOS 26, SwiftUI + RealityKit, XcodeGen. Packages: RealityHD, DicyaninStageDirector, DicyaninPerfProbe, DicyaninRoomWorlds.
Bundle `org.dicyaninlabs.terawatt`. Single target, offline, no account.

## Product principles

Simple app, dense world. One Home window, one Inspector ornament, one HUD strip. Ultra realistic life-size scenes carry the detail.
See Idea.md sections App design rules, How life size works, Realism pipeline, Simulation. Acceptance: each mode reaches its first wow moment (standing in a full hall, under the EUV scanner, holding a finished chip) in under 3 taps.

## Windows and spaces

| Scene | Type | Use |
|---|---|---|
| Home | Window | Mode picker (Design Studio, Fab, Chip Workshop), saved projects |
| Inspector | Window | Parameters for selected hall, room, rack or chip block |
| Tabletop | Volume 1.2 x 0.6 x 1.2 m | Campus, fab or die at reduced scale |
| Walk | ImmersiveSpace (full) | 1:1 interiors, RealityHD environment(for: scene) |
| Passthrough | ImmersiveSpace (mixed) | Single rack, tray or scanner placed in the user's room |

## Mode 1, Design Studio

Inputs (Inspector, persisted as `CampusSpec` JSON):
- Campus: power budget 50 MW to 5 GW, climate preset, site footprint.
- Hall: length 40 to 400 m, width 20 to 120 m, clear height 6 to 14 m, raised floor or slab.
- Rooms (add, remove, resize on a grid): data hall, MEP gallery, electrical room, UPS/battery room, CDU room, chiller yard, generator/SMR yard, network MMR, NOC, loading dock, security mantrap, office, staging.
- Rows: rack count per row, pitch, hot/cold aisle containment, rack type (GPU rack 792 kW, LPU rack 516 kW, Air rack 37 kW, GB200 NVL72 132 kW, immersion tank).
- Cooling: air, rear-door HX, direct-to-chip, two-phase immersion. Power: AC, 800 V DC.

Design levers (source: MIT AI Hackathon slide, notes/ref/design-levers.jpg):
- Where: 6 Earth sites, low Earth orbit, Moon, Mars. Scored on price, carbon, climate, grid cap, round-trip latency.
- Cooling: air + chillers, air + evaporative, direct liquid, immersion, radiators in orbit.
- Chips: GPU (3 TB memory, prefill), LPU (fast decode), air card (low cost); chips per replica, racks per pool.
- Serving: prefill/decode split, routing, multi-agent, speculative decoding, context memory, placement of workloads per pool.

2035 rack presets:

| preset | kW | cost | chips |
|---|---|---|---|
| GPU rack | 792 | $23.8M | 144 |
| LPU rack | 516 | $14.3M | 256 |
| Air rack | 37 | $0.5M | 32 cards |
| 2025 GB200 NVL72 (baseline) | 132 | $3-5M | 72 GPUs |

Sites: Earth sites as walkable halls; orbit, Moon and Mars as tabletop dioramas with radiator panels.

Outputs (live HUD): IT MW, facility MW, PUE, WUE, total PFLOPS (FP4), tokens/s (prefill, decode), $/M tokens, capex, carbon t/yr, latency, rack count, GPU count, cable km, cost estimate.

Generation: rooms built with RealityHD `Room` helpers; racks instanced (`RealInstancing`), LOD by head distance. Target 10 k racks visible at 90 fps via instancing + impostors past 30 m.

Interaction: pinch-drag room walls on the Tabletop grid, tap rack to open doors (articulated), walk aisles in Walk space, teleport markers per room.

## Mode 2, Fab (Terawatt Fab 1)

Flagship A14-class 300 mm logic fab. Tour of 12 stations in process order, each at life size with a cutaway and wafer-state view:

1. Wafer start (FOUP stocker, bare Si wafer)
2. Clean (wet bench)
3. Oxidation / deposition (CVD, ALD cluster tool)
4. Photoresist coat (track)
5. High-NA EUV lithography (scanner, light source, reticle stocker)
6. Develop + inspect (track, e-beam metrology)
7. Etch (plasma etch cluster tool)
8. Ion implant
9. Metallization (PVD, copper plating, backside power)
10. CMP
11. Wafer test (probe station)
12. Dice, package (hybrid bonding, CoWoS-class interposer, HBM stacking), final test

Wafer travels by overhead hoist transport (OHT) between stations. Lithography exposes the user's own floorplan from Mode 3 when one exists, else a reference die.

## Mode 3, Chip Workshop

Steps, each a workbench in Walk space or Tabletop:
1. Spec: target (training, inference), TDP, process node, die area.
2. Architecture: drag blocks onto the die canvas: tensor cores, SRAM, NoC, HBM PHY, SerDes / optical I/O, controller, power mesh.
3. Floorplan + route: auto placement with live area, power, timing score.
4. Simulate: run a toy workload, heat map on die, throughput, perf/W.
5. Tape out: GDS tile rendered on a reticle, hand-off to Fab mode.
6. Package: die + HBM stacks + interposer + substrate + cold plate.
7. Integrate: chip into GPU module, module into compute tray, tray into rack in the user's Design Studio campus. Campus PFLOPS updates.

Simulation is a closed-form model (no SPICE): area from block counts, power from activity factors, timing from wire length. Unit-tested headless.

## Scale controls

Global scale chip: 1:1, 1:10, 1:100, 1:1000, micro (die zoom 1e3x to 1e6x). Ruler entity and human-height reference figure at every scale.

## Realism bar

All props from RealityHD, briefs gated (threshold >= 0.85) before use. Materials: brushed aluminum, powder coat, perforated steel, polycarbonate, cleanroom epoxy floor, raised-floor tiles, copper, gold bond wire, silicon wafer thin-film interference, glass substrate. Interior probe + emissive LED rows for hall lighting; fab yellow lithography bay lighting.

## Simulation module

`TerawattSim` Swift package, no RealityKit import. `PowerModel`, `ThermalModel`, `ServingModel`, `SiteModel`, `ChipModel`, `FabFlow`. Inputs are the Codable specs; outputs a `CampusReport`. XCTest per model with fixtures for the 4 rack presets.

## Data model

`CampusSpec`, `HallSpec`, `RoomSpec`, `RowSpec`, `RackSpec`, `ChipSpec`, `BlockSpec`, `PackageSpec`, `WaferLot`. Codable, stored in Application Support, one file per project.

## Performance

Walk space 90 fps target on device. Budgets: hall scene <= 1.5 M tris on screen, instanced racks, RealityHD `.balanced` default, `.performance` above 2 k racks.

## StageDirector routes

`home`, `studio/tabletop`, `studio/walk/hall`, `studio/walk/cdu`, `fab/station/<1-12>`, `fab/euv`, `chip/<step>`, `chip/integrate`, `rack/passthrough`.

## Out of scope v1

Multiplayer, real EDA import (GDS/LEF), real cost data, SharePlay.

## Milestones

0. Sim: TerawattSim models + tests.
1. Props: RealityHD library additions (notes/PROPS.md), briefs + gate.
2. Design Studio core: rooms, rows, HUD, Walk.
3. Fab: 12 stations, wafer flow.
4. Chip Workshop + integration back into racks.
5. PEEP polish, screenshots, demo video.
