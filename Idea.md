# Terawatt

Apple Vision Pro app for designing the AI data center of 2035 at life size, then following one chip from RTL to wafer to rack.
Bundle `org.dicyaninlabs.terawatt`. Assets from RealityHD (procedural photoreal RealityKit, visionOS 26).

## Modes

1. Design Studio. Lay out a 2035 AI campus: hall size, room list, rack rows, power and liquid cooling. Walk it at 1:1, shrink it to tabletop.
2. Fab. One flagship 2 nm-class (A14 node) EUV fab, Terawatt Fab 1. Walk the cleanroom and follow a wafer through 12 process stations at life size.
3. Chip Workshop. Build an AI accelerator die from scratch (blocks, floorplan, interconnect), tape it out, watch Fab 1 produce it, package it with HBM, drop it into a GPU tray and a rack in the user's own data center.

## Loop

Design hall -> design chip -> fab chip -> package -> install in rack -> campus stats change (PFLOPS, MW, PUE, water).

## 2035 assumptions

- Rack density up to 792 kW (GPU rack preset), 800 V DC busway, 100 % direct-to-chip plus immersion option.
- Co-packaged optics, 3D-stacked HBM5, glass-core substrates, backside power delivery.
- Campus 1 to 5 GW with on-site SMR or fuel-cell yard, heat reuse loop.
- Fab: High-NA EUV, 2 nm-class GAA and CFET, 300 mm wafers in FOUPs on overhead hoist transport.

## Scale views

- Life size: walk a hot aisle, stand next to a 1 MW rack, stand under a High-NA EUV scanner (~14 m long).
- Tabletop: whole campus or whole fab as a volume.
- Micro: zoom from wafer to die to transistor stack (cutaway, scaled 1e6x).

## Design levers (notes/ref/design-levers.jpg)

Where (6 Earth sites, LEO, Moon, Mars), cooling (chillers to orbital radiators), chips (GPU prefill, LPU decode, air card), serving (prefill/decode split, routing, speculative decoding).
2035 rack presets: GPU 792 kW $23.8M 144 chips; LPU 516 kW $14.3M 256 chips; Air 37 kW $0.5M 32 cards. Baseline GB200 NVL72 132 kW.

## App design rules

- One window, three mode tiles, no subtitles. Every other control lives in the 3D scene or a single Inspector ornament.
- Max 5 controls on screen at once. Levers are physical: dials, sliders and switches on a lectern beside the user.
- The scene carries the information. Numbers appear as one HUD strip: MW, PUE, tokens/s, $/M tokens, capex, carbon.
- Every change is visible within 1 s at life size (racks spawn, pipes reroute, heat haze shifts, fans spin up).
- Defaults produce a credible 2035 hall in one tap. Customization is optional depth.

## How life size works on Vision Pro

- Real scale: 1 RealityKit unit = 1 m. Floor anchored via full ImmersiveSpace with floor at y = 0; mixed space for single props in the user's room.
- Large spaces: user stands in one 4 x 4 m safe zone; locomotion by teleport rings at aisle ends and room doors. No smooth locomotion.
- Scale switch animates the whole world around the user's feet (1:1 -> 1:100 -> 1:1000) so orientation is kept.
- Human reference figure and floor grid at every scale so size reads instantly.
- Content streams by room: only the current room plus neighbors is live; distant halls are baked impostors.

## Realism pipeline

- All geometry procedural from RealityHD (no downloaded meshes); every prop briefed, rendered and gated >= 0.85 before use.
- Hero props (1 MW rack, EUV scanner, CDU, compute tray) get 3 LODs, articulated doors and trays, close-range detail: screws, labels, QD fittings, cable bend radii.
- Lighting: RealityHD interior probe per room, emissive LED rows, status LEDs as instanced emissive quads, fab amber light, sun for yards.
- Dressing pass per room: cable trays, labels, floor markings, wear, signage. Rooms without dressing do not ship.
- Heat, airflow and coolant shown as subtle in-world layers (shimmer, particle flow, pipe tint) toggled by one switch.

## Simulation (closed form, unit tested)

- Power: rack kW x count + cooling overhead -> facility MW, PUE by cooling type and site climate.
- Thermal: per-rack heat -> CDU load -> supply/return temps; over-capacity racks glow and throttle.
- Serving: chip mix (GPU prefill, LPU decode, air card) + serving strategy -> tokens/s, latency, $/M tokens.
- Site: price, carbon intensity, grid cap, round-trip latency per site; orbit/Moon/Mars swap cooling to radiators.
- Chip: block counts -> area, power, perf/W; tape-out feeds Fab wafer and rack PFLOPS.
- All models pure Swift in `TerawattSim`, headless XCTest coverage, no UI dependency.
