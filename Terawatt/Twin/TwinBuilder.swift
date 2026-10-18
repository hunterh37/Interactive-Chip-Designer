import RealityKit
import UIKit

/// Procedural scale-ladder models from simple shapes. Tappable entities are named "tap:<kind>:<value>".
@MainActor
enum TwinBuilder {
    // Hall geometry in meters (1:1 for the immersive walk).
    static let rackW: Float = 0.6, rackH: Float = 2.3, rackD: Float = 1.3
    static let racksPerRow = 20, coldAisle: Float = 1.8, hotAisle: Float = 1.2

    static func stressColor(_ v: Double) -> UIColor {
        if v >= 1 { return UIColor(red: 0.93, green: 0.18, blue: 0.16, alpha: 1) }
        let t = CGFloat(max(0, min(v, 1)))
        let lo = (r: 0.16, g: 0.68, b: 0.62), mid = (r: 0.98, g: 0.62, b: 0.12)
        return UIColor(red: lo.r + (mid.r - lo.r) * t, green: lo.g + (mid.g - lo.g) * t, blue: lo.b + (mid.b - lo.b) * t, alpha: 1)
    }

    static func box(_ size: SIMD3<Float>, _ pos: SIMD3<Float>, _ c: UIColor, in parent: Entity, metal: Bool = false) -> ModelEntity {
        let m = ModelEntity(mesh: .generateBox(size: size, cornerRadius: min(size.x, size.y, size.z) * 0.08),
                            materials: [SimpleMaterial(color: c, roughness: 0.5, isMetallic: metal)])
        m.position = pos
        parent.addChild(m)
        return m
    }

    static func sphere(_ r: Float, _ pos: SIMD3<Float>, _ c: UIColor, in parent: Entity) -> ModelEntity {
        let m = ModelEntity(mesh: .generateSphere(radius: r), materials: [SimpleMaterial(color: c, roughness: 0.7, isMetallic: false)])
        m.position = pos
        parent.addChild(m)
        return m
    }

    static func tappable(_ e: ModelEntity, _ name: String) {
        e.name = "tap:" + name
        e.components.set(InputTargetComponent())
        e.generateCollisionShapes(recursive: false)
        e.components.set(HoverEffectComponent())
    }

    static func label(_ text: String, _ pos: SIMD3<Float>, size: CGFloat = 0.018, in parent: Entity) {
        guard !text.isEmpty else { return }
        let mesh = MeshResource.generateText(text, extrusionDepth: 0.001, font: .systemFont(ofSize: size, weight: .semibold),
                                             containerFrame: .zero, alignment: .center, lineBreakMode: .byWordWrapping)
        let e = ModelEntity(mesh: mesh, materials: [UnlitMaterial(color: UIColor(white: 0.12, alpha: 1))])
        let w = mesh.bounds.extents.x
        e.position = pos - [w / 2, 0, 0]
        parent.addChild(e)
    }

    // MARK: Tabletop (meters on the table, origin at volume floor center)

    static func tabletop(_ sc: Scenario, _ t: TwinMetrics, focus: TwinFocus, lens: TwinLens) -> Entity {
        let root = Entity()
        switch focus.scale {
        case .fleet: fleet(sc, t, lens, root)
        case .offWorld: offWorld(sc, t, lens, root)
        case .site: site(sc, t, focus, lens, root)
        case .building: building(sc, t, focus, lens, root)
        case .hall:
            let h = hall(sc, focus, lens)
            let s = 1.0 / max(h.length, h.width, 1)
            h.root.scale = .init(repeating: s)
            root.addChild(h.root)
        case .rack: rack(sc, focus, lens, root)
        case .chip: chip(sc, focus, lens, root)
        }
        return root
    }

    static func latLon(_ lat: Double, _ lon: Double, r: Float) -> SIMD3<Float> {
        let la = Float(lat * .pi / 180), lo = Float(lon * .pi / 180)
        return [r * cos(la) * sin(lo), r * sin(la), r * cos(la) * cos(lo)]
    }

    private static func fleet(_ sc: Scenario, _ t: TwinMetrics, _ lens: TwinLens, _ root: Entity) {
        let R: Float = 0.2, c: SIMD3<Float> = [0, 0.26, 0]
        let globe = sphere(R, c, UIColor(red: 0.86, green: 0.89, blue: 0.92, alpha: 1), in: root)
        globe.orientation = simd_quatf(angle: -0.6, axis: [0, 1, 0])
        for (i, s) in sc.sites.enumerated() where s.enabled && s.location == .earth {
            let (v, text) = TwinLensMath.site(lens, s, t.sites[i], sc)
            let h = 0.015 + Float(min(t.sites[i].facilityMW / 200, 1)) * 0.07
            let dir = simd_normalize(latLon(s.lat, s.lon, r: 1))
            let pin = box([0.014, h, 0.014], dir * (R + h / 2), stressColor(v), in: globe)
            pin.orientation = simd_quatf(from: [0, 1, 0], to: dir)
            tappable(pin, "site:\(i)")
            let tag = Entity(); tag.position = dir * (R + h + 0.012)
            tag.components.set(BillboardComponent())
            label("\(s.name)\n\(text)", .zero, size: 0.011, in: tag)
            globe.addChild(tag)
        }
    }

    private static func offWorld(_ sc: Scenario, _ t: TwinMetrics, _ lens: TwinLens, _ root: Entity) {
        let c: SIMD3<Float> = [0, 0.26, 0]
        _ = sphere(0.07, c, UIColor(red: 0.55, green: 0.7, blue: 0.9, alpha: 1), in: root)
        for k in 0..<48 {   // LEO ring
            let a = Float(k) / 48 * 2 * .pi
            _ = box([0.006, 0.006, 0.006], c + [0.11 * cos(a), 0, 0.11 * sin(a)], UIColor(white: 0.6, alpha: 1), in: root)
        }
        let spots: [TwinLocation: (SIMD3<Float>, Float, UIColor)] = [
            .leo: (c + [0.11, 0, 0], 0.018, UIColor(white: 0.85, alpha: 1)),
            .moon: (c + [0.36, 0.02, -0.1], 0.03, UIColor(white: 0.75, alpha: 1)),
            .mars: (c + [-0.4, -0.02, -0.12], 0.04, UIColor(red: 0.78, green: 0.38, blue: 0.22, alpha: 1)),
        ]
        for (i, s) in sc.sites.enumerated() where s.location.offWorld {
            guard let (p, r, col) = spots[s.location] else { continue }
            let body = sphere(r, p, s.enabled ? stressColor(TwinLensMath.site(lens, s, t.sites[i], sc).0) : col, in: root)
            tappable(body, "site:\(i)")
            let text = s.enabled ? TwinLensMath.site(lens, s, t.sites[i], sc).1 : "off"
            label("\(s.location.title)\n\(text)", p + [0, r + 0.02, 0], size: 0.012, in: root)
        }
    }

    private static func groundColor(_ l: TwinLocation) -> UIColor {
        switch l {
        case .earth: UIColor(red: 0.82, green: 0.86, blue: 0.8, alpha: 1)
        case .leo: UIColor(white: 0.2, alpha: 1)
        case .moon: UIColor(white: 0.7, alpha: 1)
        case .mars: UIColor(red: 0.72, green: 0.42, blue: 0.3, alpha: 1)
        }
    }

    private static func site(_ sc: Scenario, _ t: TwinMetrics, _ f: TwinFocus, _ lens: TwinLens, _ root: Entity) {
        let s = sc.sites[f.site], m = t.sites[f.site]
        _ = box([0.9, 0.01, 0.9], [0, 0.005, 0], groundColor(s.location), in: root)
        let (v, text) = TwinLensMath.site(lens, s, m, sc)
        let n = s.buildings.count
        for (bi, _) in s.buildings.enumerated() {
            let x = (Float(bi) - Float(n - 1) / 2) * 0.28
            let b = box([0.22, 0.12, 0.3], [x, 0.07, 0], stressColor(v), in: root)
            tappable(b, "building:\(bi)")
        }
        if s.location.offWorld {
            for k in 0..<4 { _ = box([0.18, 0.004, 0.08], [Float(k - 2) * 0.2 + 0.1, 0.2, 0.32], UIColor(white: 0.92, alpha: 1), in: root, metal: true) }
        } else {
            _ = box([0.1, 0.06, 0.1], [0.32, 0.04, 0.3], UIColor(white: 0.55, alpha: 1), in: root, metal: true)  // grid tie
            for k in 0..<3 { _ = box([0.004, 0.16, 0.004], [0.32, 0.08, 0.3 - Float(k + 1) * 0.14], UIColor(white: 0.4, alpha: 1), in: root) }
        }
        label("\(s.name) · \(s.location.title)\n\(text)", [0, 0.24, -0.1], in: root)
    }

    private static func building(_ sc: Scenario, _ t: TwinMetrics, _ f: TwinFocus, _ lens: TwinLens, _ root: Entity) {
        let s = sc.sites[f.site], b = s.buildings[min(f.building, s.buildings.count - 1)]
        let mh = t.sites[f.site].halls.indices.contains(f.building) ? t.sites[f.site].halls[f.building] : []
        let shell = UIColor(white: 0.93, alpha: 1)
        _ = box([0.9, 0.01, 0.6], [0, 0.005, 0], shell, in: root)
        _ = box([0.9, 0.2, 0.01], [0, 0.1, -0.3], shell, in: root)       // cutaway: back and side walls only
        _ = box([0.01, 0.2, 0.6], [-0.45, 0.1, 0], shell, in: root)
        for (hi, h) in b.halls.enumerated() {
            let hm = hi < mh.count ? mh[hi] : HallMetrics()
            let x = (Float(hi) - Float(b.halls.count - 1) / 2) * 0.32
            let v: Double = switch lens {
            case .heat: hm.coolingFit ? min(hm.maxChipKW / 6, 0.9) : 1
            case .power: min(hm.itKW / 100_000, 1)
            case .business: min(hm.rackCostUSD / 3e9, 1)
            case .manufacturing: min(hm.leadTimeWeeks / 52, 1)
            case .comms: t.sites[f.site].risk
            }
            let e = box([0.28, 0.08, 0.4], [x, 0.05, 0], stressColor(v), in: root)
            tappable(e, "hall:\(hi)")
            label("Hall \(hi + 1)\n\(h.cooling.title) · \(Fmt.n(hm.itKW / 1000, 0)) MW", [x, 0.14, 0.1], size: 0.012, in: root)
        }
        for k in 0..<4 { // chillers or radiators
            _ = box([0.06, 0.05, 0.06], [-0.3 + Float(k) * 0.2, 0.03, 0.38], UIColor(white: 0.7, alpha: 1), in: root, metal: true)
        }
        label("PUE \(Fmt.n(s.location.offWorld ? 1.03 : sc.pue, 2)) · \(Fmt.n(t.sites[f.site].facilityMW, 0)) MW", [0, 0.26, -0.25], in: root)
    }

    /// Rows of racks in meters. Returns footprint for scaling.
    static func hall(_ sc: Scenario, _ f: TwinFocus, _ lens: TwinLens) -> (root: Entity, length: Float, width: Float) {
        let root = Entity()
        let s = sc.sites[f.site], b = s.buildings[min(f.building, s.buildings.count - 1)]
        let h = b.halls[min(f.hall, b.halls.count - 1)]
        var racks: [RackSpec] = []
        for (id, n) in h.rackMix.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            guard let r = ScenarioEngine.rack(id, year: sc.year) else { continue }
            racks += Array(repeating: r, count: min(n, 400))
        }
        let rows = max(1, Int(ceil(Double(racks.count) / Double(racksPerRow))))
        let pair = rackD * 2 + hotAisle + coldAisle
        let L = Float(racksPerRow) * rackW + 4, W = Float((rows + 1) / 2) * pair + coldAisle
        _ = box([L, 0.05, W], [0, -0.025, 0], UIColor(white: 0.9, alpha: 1), in: root)
        let liquid = h.cooling == .directLiquid || h.cooling == .immersion
        for (i, r) in racks.enumerated() {
            let row = i / racksPerRow, col = i % racksPerRow
            let z = -W / 2 + coldAisle + Float(row / 2) * pair + (row % 2 == 0 ? rackD / 2 : rackD * 1.5 + hotAisle)
            let x = -L / 2 + 2 + (Float(col) + 0.5) * rackW
            let (v, _) = TwinLensMath.rack(lens, r, cooling: h.cooling, location: s.location)
            let e = box([rackW * 0.94, rackH, rackD], [x, rackH / 2, z], stressColor(v), in: root)
            if col == 0 { tappable(e, "rack:\(r.id.rawValue)") } else { e.name = "tap:rack:\(r.id.rawValue)"; e.components.set(InputTargetComponent()); e.generateCollisionShapes(recursive: false) }
            if liquid && col == 0 {   // coolant manifold along the row
                _ = box([Float(racksPerRow) * rackW, 0.12, 0.12], [-L / 2 + 2 + Float(racksPerRow) * rackW / 2, rackH + 0.15, z],
                        UIColor(red: 0.2, green: 0.45, blue: 0.9, alpha: 1), in: root, metal: true)
            }
        }
        return (root, L, W)
    }

    private static func rack(_ sc: Scenario, _ f: TwinFocus, _ lens: TwinLens, _ root: Entity) {
        let s = sc.sites[f.site], b = s.buildings[min(f.building, s.buildings.count - 1)]
        let h = b.halls[min(f.hall, b.halls.count - 1)]
        guard let r = ScenarioEngine.rack(f.rack, year: sc.year) else {
            label("\(f.rack.rawValue.uppercased()) not available in \(Int(sc.year))", [0, 0.2, 0], in: root); return
        }
        let (v, text) = TwinLensMath.rack(lens, r, cooling: h.cooling, location: s.location)
        let k: Float = 0.2   // table meters per rack meter
        _ = box([rackW * k * 1.05, rackH * k, rackD * k * 1.02], [0, rackH * k / 2, 0], UIColor(white: 0.25, alpha: 1), in: root, metal: true)
        let trays = 18
        for i in 0..<trays {
            let y = (0.15 + Float(i) / Float(trays) * 1.95) * k
            let t = box([rackW * k * 0.95, 0.07 * k, 0.04], [0, y, rackD * k / 2 + 0.01], stressColor(v), in: root)
            tappable(t, "chip")
        }
        label("\(r.title) · \(Int(sc.year))\n\(Fmt.n(r.kW, 0)) kW · \(r.chips) chips · $\(Fmt.big(r.costUSD))\n\(text) · \(h.cooling.title)",
              [0, rackH * k + 0.05, 0], size: 0.014, in: root)
    }

    private static func chip(_ sc: Scenario, _ f: TwinFocus, _ lens: TwinLens, _ root: Entity) {
        let s = sc.sites[f.site], b = s.buildings[min(f.building, s.buildings.count - 1)]
        let h = b.halls[min(f.hall, b.halls.count - 1)]
        guard let r = ScenarioEngine.rack(f.rack, year: sc.year) else { return }
        let fit = ScenarioEngine.coolingFits(h.cooling, rack: r, location: s.location)
        let c: SIMD3<Float> = [0, 0.18, 0]
        _ = box([0.3, 0.01, 0.3], c, UIColor(red: 0.2, green: 0.45, blue: 0.3, alpha: 1), in: root)        // substrate
        _ = box([0.16, 0.012, 0.16], c + [0, 0.05, 0], UIColor(white: 0.6, alpha: 1), in: root, metal: true) // interposer, lifted
        let die = box([0.1, 0.01, 0.1], c + [0, 0.1, 0], stressColor(fit ? min(r.chipKW / 6, 0.9) : 1), in: root)
        _ = die
        for (dx, dz) in [(-0.065, -0.04), (-0.065, 0.04), (0.065, -0.04), (0.065, 0.04)] {
            _ = box([0.025, 0.03, 0.035], c + [Float(dx), 0.11, Float(dz)], UIColor(white: 0.35, alpha: 1), in: root, metal: true) // HBM
        }
        _ = box([0.22, 0.02, 0.22], c + [0, 0.16, 0], fit ? UIColor(red: 0.2, green: 0.45, blue: 0.9, alpha: 0.6) : UIColor(white: 0.8, alpha: 1), in: root, metal: true) // cold plate
        let need = r.needsLiquid ? "needs direct liquid or immersion" : "air OK"
        label("\(r.title) chip · \(Fmt.n(r.chipKW, 1)) kW\n\(need) · hall: \(h.cooling.title)\(fit ? "" : " ✕")",
              c + [0, 0.22, 0], size: 0.014, in: root)
        _ = lens
    }
}
