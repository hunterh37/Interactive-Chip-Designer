# RealityHD prop library for Terawatt

New ids land in RealityHD as `Props/DataCenter`, `Props/Fab`, `Props/ChipLab`, `Structures/DataCenter`. Reused existing ids listed last.
Columns: id, size m (w x h x d), budget tris, articulated parts, materials.

## Data center, IT

| id | size | budget | articulated | materials |
|---|---|---|---|---|
| rack-ai-1mw | 0.6 x 2.4 x 1.4 | 15000 | front door, rear door, trays slide | metal.powdercoat:1A1C1F, metal.perforated, plastic.matte |
| rack-lpu | 0.6 x 2.4 x 1.4 | 15000 | doors, trays slide | metal.powdercoat:2A2D33, metal.perforated |
| lpu-card | 0.11 x 0.02 x 0.27 | 4000 | handheld | plastic.pcb, metal.aluminum |
| air-inference-card | 0.11 x 0.02 x 0.17 | 3000 | handheld | plastic.pcb, metal.aluminum-fins |
| rack-nvl72-2025 | 0.6 x 2.3 x 1.2 | 15000 | doors, trays | metal.powdercoat, metal.perforated |
| rack-air-42u | 0.6 x 2.0 x 1.2 | 12000 | doors | metal.powdercoat, metal.perforated |
| compute-tray-gpu | 0.44 x 0.09 x 0.9 | 12000 | slide, lid | metal.aluminum-brushed, copper, plastic.pcb |
| gpu-module-2035 | 0.12 x 0.02 x 0.18 | 8000 | cold plate lift | copper, plastic.pcb, metal.anodized |
| cold-plate | 0.12 x 0.015 x 0.18 | 3000 | none | copper.polished, metal.nickel |
| switch-tray-cpo | 0.44 x 0.045 x 0.6 | 8000 | slide | metal.aluminum-brushed, glass.fiber |
| power-shelf-800vdc | 0.44 x 0.09 x 0.7 | 6000 | slide | metal.powdercoat, plastic.matte |
| immersion-tank | 2.4 x 1.2 x 1.1 | 14000 | lid hinge | metal.stainless, glass.clear, fluid.dielectric |
| rack-manifold | 0.08 x 2.2 x 0.1 | 4000 | quick-disconnects | metal.stainless, rubber.hose:1F4E8C, rubber.hose:B51D17 |
| blanking-panel | 0.48 x 0.044 x 0.01 | 400 | none | plastic.matte:1A1A1A |
| storage-jbof | 0.44 x 0.09 x 0.8 | 6000 | drive sleds | metal.aluminum-brushed, plastic.matte |
| nvme-sled | 0.08 x 0.01 x 0.12 | 1200 | handheld | metal.aluminum, plastic.pcb |
| network-patch-panel | 0.48 x 0.044 x 0.1 | 4000 | none | metal.powdercoat, plastic.matte |
| fiber-trunk-bundle | 1.0 x 0.05 x 0.05 | 3000 | none | plastic.jacket:E8C21A |
| crash-cart-kvm | 0.6 x 1.0 x 0.5 | 9000 | drawer, monitor fold | metal.powdercoat, plastic.matte |
| rack-pdu | 0.06 x 1.8 x 0.06 | 3000 | none | metal.powdercoat, plastic.matte |

## Data center, facility

| id | size | budget | articulated | materials |
|---|---|---|---|---|
| hot-aisle-containment | 1.2 x 3.0 x module | 8000 | sliding door | glass.polycarbonate, metal.aluminum |
| raised-floor-tile | 0.6 x 0.03 x 0.6 | 800 | lift | metal.perforated, laminate.antistatic |
| raised-floor-pedestal | 0.05 x 0.6 x 0.05 | 300 | none | metal.galvanized |
| overhead-busway | 3.0 x 0.2 x 0.15 | 3000 | tap-off box | metal.aluminum, plastic.matte |
| cable-tray-ladder | 3.0 x 0.1 x 0.6 | 3000 | none | metal.galvanized |
| cable-tray-fiber | 3.0 x 0.1 x 0.3 | 2500 | none | plastic.matte:E8C21A |
| cdu-liquid | 0.8 x 2.2 x 1.2 | 12000 | doors | metal.powdercoat, metal.stainless, glass.clear |
| chilled-water-pipe | 3.0 x 0.4 x 0.4 | 2500 | none | metal.painted:2E6FA8, insulation.foil |
| pipe-valve-butterfly | 0.4 x 0.6 x 0.3 | 4000 | handwheel | metal.cast-iron, metal.painted:B51D17 |
| pump-skid | 2.0 x 1.5 x 1.0 | 14000 | none | metal.painted, metal.stainless |
| dry-cooler | 12 x 2.5 x 2.4 | 15000 | fans spin | metal.galvanized, metal.aluminum-fins |
| chiller-unit | 10 x 2.8 x 2.4 | 15000 | none | metal.painted:E9E9E4 |
| cooling-tower-cell | 6 x 8 x 6 | 15000 | fan spin | concrete, plastic.fill |
| crah-unit | 2.5 x 2.2 x 1.0 | 10000 | doors | metal.powdercoat:E9E9E4 |
| ups-cabinet | 0.8 x 2.0 x 0.9 | 9000 | door | metal.powdercoat, plastic.matte |
| battery-rack-li | 0.6 x 2.0 x 0.8 | 8000 | door | metal.powdercoat, plastic.matte |
| switchgear-lineup | 0.8 x 2.3 x 1.4 per bay | 10000 | doors, breaker rack-out | metal.powdercoat:A7AAA9, glass.clear |
| transformer-pad | 3.0 x 2.5 x 2.5 | 12000 | none | metal.painted:5A6B4A, porcelain |
| generator-container | 12 x 2.9 x 2.4 | 15000 | doors | metal.painted, metal.galvanized |
| smr-module | 5 x 20 x 5 | 15000 | cutaway | metal.steel, concrete |
| fuel-cell-bank | 6 x 2.5 x 2.5 | 12000 | none | metal.painted |
| fire-suppression-cylinder | 0.3 x 1.6 x 0.3 | 4000 | none | metal.painted:B51D17, metal.brass |
| vesda-pipe | 3.0 x 0.03 x 0.03 | 500 | none | plastic.matte:B51D17 |
| emergency-power-off | 0.15 x 0.2 x 0.1 | 2000 | button | plastic.matte:B51D17 |
| leak-detection-cable | 3.0 x 0.01 x 0.01 | 300 | none | plastic.matte |
| led-row-light | 2.4 x 0.06 x 0.12 | 800 | emissive on/off | metal.aluminum, emissive |
| aisle-sign | 0.4 x 0.2 x 0.02 | 600 | none | plastic.matte, paint |
| security-mantrap | 2.0 x 2.6 x 2.0 | 12000 | doors | glass.clear, metal.stainless |
| biometric-reader | 0.1 x 0.18 x 0.05 | 2500 | none | plastic.gloss, glass |
| noc-video-wall | 8 x 3 x 0.2 | 6000 | emissive | plastic.matte, glass.display |
| noc-console | 3 x 1.1 x 1.2 | 9000 | none | laminate, metal.powdercoat |
| loading-dock-leveler | 2.0 x 0.5 x 2.4 | 5000 | lip | metal.diamond-plate |
| server-lift | 0.7 x 1.9 x 1.0 | 9000 | platform lift | metal.powdercoat, rubber |
| rack-pallet-crate | 0.9 x 2.6 x 1.5 | 6000 | panels | wood.plywood, foam |
| esd-workbench | 1.8 x 0.9 x 0.75 | 7000 | none | laminate.esd, metal.powdercoat |

## Data center, structures

| id | size | budget | notes |
|---|---|---|---|
| hall-shell | parametric | 20000 | walls, columns, roof trusses, clear height param |
| hall-column | 0.6 x param x 0.6 | 800 | concrete, impact guard |
| campus-building | parametric | 15000 | exterior shell for tabletop |
| dc-roof-mech | parametric | 10000 | roof deck with dry coolers placement |
| perimeter-fence | 3 x 2.4 module | 2000 | anti-climb mesh |

## Off-world sites (tabletop)

| id | size | budget | notes |
|---|---|---|---|
| orbital-dc-module | 20 x 6 x 6 | 15000 | pressurized compute truss |
| space-radiator-panel | 10 x 0.1 x 4 | 3000 | deploy hinge, emissive heat glow |
| solar-array-wing | 30 x 0.1 x 6 | 4000 | deploy |
| lunar-dc-habitat | 15 x 6 x 15 | 15000 | regolith berm |
| mars-dc-dome | 20 x 10 x 20 | 15000 | dust material |
| ground-station-dish | 8 x 10 x 8 | 10000 | dish slew |
| earth-site-pin | 0.05 x 0.15 x 0.05 | 500 | map marker, 6 instances |

## Fab (Terawatt Fab 1)

| id | size | budget | articulated | materials |
|---|---|---|---|---|
| euv-scanner-highna | 14 x 4 x 4 | 15000 | covers off, wafer stage | metal.powdercoat:E9E9E4, metal.anodized |
| euv-light-source | 6 x 4 x 4 | 14000 | cutaway | metal.steel, metal.copper |
| duv-immersion-scanner | 6 x 3 x 3 | 14000 | covers | metal.powdercoat |
| litho-track | 8 x 2.5 x 3 | 14000 | panels | metal.powdercoat, glass.clear |
| plasma-etch-cluster | 4 x 2.5 x 4 | 14000 | chamber lids | metal.aluminum, metal.stainless |
| cvd-ald-cluster | 4 x 2.5 x 4 | 14000 | chamber lids | metal.aluminum, metal.stainless |
| pvd-cluster | 4 x 2.5 x 4 | 14000 | chamber lids | metal.aluminum |
| ion-implanter | 8 x 2.5 x 3 | 14000 | panels | metal.powdercoat |
| cmp-tool | 4 x 2.2 x 3 | 12000 | platen spin | metal.stainless, plastic.pad |
| wet-bench | 4 x 2.2 x 1.5 | 10000 | sash | plastic.pvdf, glass.clear |
| diffusion-furnace | 2 x 3.5 x 2 | 10000 | boat elevator | metal.powdercoat, quartz |
| ebeam-metrology | 3 x 2.2 x 2.5 | 10000 | door | metal.powdercoat |
| probe-station | 1.5 x 1.8 x 1.5 | 9000 | probe card lift | metal.powdercoat |
| hybrid-bonder | 3 x 2.2 x 2.5 | 10000 | door | metal.powdercoat, glass |
| dicing-saw | 1.5 x 1.8 x 1.5 | 8000 | lid | metal.powdercoat, glass |
| foup | 0.4 x 0.34 x 0.36 | 4000 | door, handheld | plastic.polycarbonate-tint, plastic.matte |
| foup-stocker | 6 x 4 x 2 | 12000 | robot arm | metal.powdercoat, glass |
| oht-vehicle | 0.6 x 0.6 x 0.9 | 6000 | hoist down | metal.aluminum, plastic.matte |
| oht-rail | 3 x 0.2 x 0.2 | 800 | none | metal.aluminum |
| wafer-300mm | 0.3 x 0.00078 x 0.3 | 2000 | handheld, state param | silicon.thinfilm (bare, oxide, patterned, metal) |
| wafer-cassette | 0.33 x 0.3 x 0.3 | 5000 | handheld | plastic.pfa |
| reticle-pod | 0.2 x 0.05 x 0.2 | 2000 | handheld | plastic.matte, glass.quartz |
| efem-robot | 1 x 1.5 x 1 | 8000 | arm joints | metal.aluminum, plastic.matte |
| ffu-ceiling-tile | 1.2 x 0.3 x 0.6 | 1200 | none | metal.perforated, filter.hepa |
| cleanroom-floor-grate | 0.6 x 0.05 x 0.6 | 800 | none | metal.perforated, paint.epoxy |
| cleanroom-wall-panel | 1.2 x 3 x 0.05 | 600 | none | metal.powdercoat:F4F4F2 |
| air-shower | 1.2 x 2.3 x 1.5 | 9000 | doors | metal.stainless, glass |
| gowning-bench | 1.5 x 0.5 x 0.4 | 3000 | none | metal.stainless |
| bunny-suit-rack | 1.5 x 2 x 0.5 | 8000 | none | fabric.tyvek, metal.chrome |
| gas-cabinet | 0.9 x 2.2 x 0.6 | 8000 | door | metal.powdercoat, metal.stainless |
| chemical-cabinet | 1.2 x 2 x 0.6 | 6000 | doors | metal.powdercoat:E8C21A |
| process-piping-rack | 3 x 1 x 1 | 5000 | none | metal.stainless-electropolish |
| fab-yellow-light-panel | 1.2 x 0.05 x 0.6 | 400 | emissive | emissive.amber |
| tool-status-tower | 0.05 x 0.4 x 0.05 | 600 | lamp states | plastic.translucent |

## Chip Workshop

| id | size | budget | articulated | materials |
|---|---|---|---|---|
| die-blank-reticle | 0.026 x 0.0008 x 0.033 | 2000 | block slots | silicon.die |
| die-block-tile | parametric | 600 | snap | silicon.die, emissive by type |
| hbm-stack | 0.011 x 0.0008 x 0.01 | 2500 | explode layers | silicon.die, metal.copper |
| interposer-glass | 0.08 x 0.001 x 0.06 | 2000 | none | glass.substrate, metal.copper |
| package-substrate | 0.1 x 0.003 x 0.1 | 2500 | none | laminate.abf, metal.gold |
| chip-package-final | 0.1 x 0.006 x 0.1 | 5000 | lid, explode | metal.nickel, silicon.die |
| transistor-gaa-cutaway | 0.5 x 0.5 x 0.5 (micro scale) | 8000 | layer explode | silicon, oxide.hafnium, metal.tungsten |
| interconnect-stack-cutaway | 0.5 x 1 x 0.5 (micro scale) | 8000 | layer explode | metal.copper, oxide.lowk |
| design-workbench-2035 | 2.4 x 1.0 x 1.2 | 10000 | holo plane | laminate, metal.aluminum, glass.display |
| holo-table | 1.6 x 0.9 x 1.0 | 6000 | emissive | glass.display, metal.anodized |
| wafer-display-stand | 0.4 x 0.5 x 0.2 | 3000 | none | metal.chrome, acrylic |
| bond-wire-macro | parametric | 1500 | none | metal.gold |

## Reused from RealityHD catalog

office-desk, desktop-monitor, laptop, conference-table, lobby-sofa, reception-desk, filing-cabinet, fire-extinguisher, first-aid-kit, cable-spool, pallet, microscope, anglepoise-lamp, shop-vac, oil-drum.

## New materials needed

metal.perforated, laminate.antistatic, laminate.esd, glass.polycarbonate, silicon.thinfilm, silicon.die, glass.substrate, laminate.abf, fluid.dielectric, filter.hepa, paint.epoxy (cleanroom), metal.stainless-electropolish, fabric.tyvek, plastic.pfa, emissive.amber, oxide.lowk, oxide.hafnium, metal.aluminum-fins, insulation.foil.

## New scenes

dc-hall-ai (parametric), dc-cdu-room, dc-electrical-room, dc-noc, dc-yard, fab-litho-bay, fab-etch-bay, fab-gowning, fab-backend-packaging, chip-workshop-studio.

## Count

DC IT 20, DC facility 35, DC structures 5, off-world 7, Fab 34, Chip 12: 113 new props, 15 reused, 19 materials, 10 scenes.

## Training (rack install)

| id | size | budget | articulated | materials |
|---|---|---|---|---|
| server-lift | 0.6 x 1.2 x 0.9 | 6000 | platform raises | metal.powdercoat:E8C21A, rubber |
| crash-cart-kvm | 0.5 x 1.0 x 0.45 | 6000 | drawer | metal.powdercoat, plastic.matte, glass.screen |
| aisle-sign | 0.6 x 0.25 x 0.02 | 600 | none | plastic.matte:F2F2F2, decal text "HALL A ROW 07" |
| loto-tag | 0.075 x 0.14 x 0.004 | 600 | handheld | plastic.matte:D62A1E, metal.steel padlock |
| esd-wrist-strap | 0.08 x 0.02 x 0.08 | 1500 | handheld | fabric.elastic:1A1A1A, metal.steel snap, coil cord |
| power-cord-c19 | 0.06 x 0.03 x 1.5 | 2000 | handheld | rubber:111111, plastic.matte connector |
| quick-disconnect | 0.03 x 0.03 x 0.08 | 1500 | handheld | metal.steel, plastic.matte blue/red ring |
| leak-detection-cable | 2.0 x 0.006 x 0.006 | 800 | none | plastic.jacket:E8C21A |
| fiber-patch-lc | 0.02 x 0.01 x 2.0 | 2000 | handheld | plastic.jacket:2CC7D6, LC duplex |
| fiber-cleaner | 0.03 x 0.18 x 0.03 | 1200 | handheld | plastic.matte:2A6BD6 |
| cable-label | 0.03 x 0.012 x 0.001 | 100 | none | plastic.matte:FFFFFF |
| velcro-tie | 0.2 x 0.012 x 0.002 | 200 | none | fabric.hook:1A1A1A |
