import RealityKit
import UIKit

/// Rack-install training stage. Rack-local meters: rack footprint centered at origin, front face at +z.
@MainActor
final class TrainingScene {
    let root = Entity()
    private let stage = Entity()
    private var highlight = Entity()
    private var tray: Entity?
    private var cables = Entity()
    private var leds: [ModelEntity] = []
    private(set) var zoom = TrainZoom.rack

    static let rackW: Float = 0.6, rackH: Float = 2.4, rackD: Float = 1.4

    /// Anchor boxes for each focus name (center, size) so highlights work while the prop lacks named parts.
    static let anchors: [String: (SIMD3<Float>, SIMD3<Float>)] = {
        let f = rackD / 2, r = -rackD / 2
        var a: [String: (SIMD3<Float>, SIMD3<Float>)] = [
            "rack-front-door": ([0, rackH / 2, f + 0.02], [rackW, rackH, 0.04]),
            "rack-rear-door": ([0, rackH / 2, r - 0.02], [rackW, rackH, 0.04]),
            "u-rail-left": ([-0.24, rackH / 2, f - 0.08], [0.03, rackH - 0.2, 0.03]),
            "u-rail-right": ([0.24, rackH / 2, f - 0.08], [0.03, rackH - 0.2, 0.03]),
            "pdu-a": ([-0.26, 1.15, r + 0.08], [0.06, 1.8, 0.06]),
            "pdu-b": ([0.26, 1.15, r + 0.08], [0.06, 1.8, 0.06]),
            "manifold-supply": ([-0.18, 1.15, r + 0.14], [0.05, 1.9, 0.05]),
            "manifold-return": ([0.18, 1.15, r + 0.14], [0.05, 1.9, 0.05]),
            "tor-switch": ([0, rackH - 0.16, f - 0.3], [0.44, 0.045, 0.6]),
            "grounding-lug": ([0.27, 0.15, f - 0.05], [0.04, 0.06, 0.03]),
            "cable-manager-left": ([-0.31, rackH / 2, f - 0.1], [0.04, rackH - 0.2, 0.12]),
            "cable-manager-right": ([0.31, rackH / 2, f - 0.1], [0.04, rackH - 0.2, 0.12]),
            "blanking-panels": ([0, RackU.height(u: 40), f - 0.04], [0.48, RackU.pitch * 4, 0.02]),
            "aisle-sign": ([0, 2.9, f + 0.6], [0.6, 0.25, 0.02]),
            "trainee-kit": ([0.9, 0.5, f + 0.7], [0.6, 1.0, 0.5]),
        ]
        for s in 1...18 {
            a[String(format: "tray-slot-%02d", s)] = ([0, RackU.height(u: RackU.slotU(s)) + RackU.pitch, f - 0.45], [0.44, RackU.pitch * 2, 0.9])
        }
        return a
    }()

    func build(state: TrainingState, campus: CampusSpec, immersive: Bool) async {
        zoom = state.step.zoom
        root.children.removeAll(); stage.children.removeAll()
        root.addChild(stage)
        if zoom >= .hall {
            let hall = await CampusBuilder.build(campus, immersive: immersive)
            hall.position = [0, 0, -CampusBuilder.hotAisleZ(campus)]
            stage.addChild(hall)
            return
        }
        stage.addChild(floor(zoom == .rack ? 4 : 16))
        let rack = await PropFactory.make("rack-ai-1mw")
        rack.name = "training-rack"
        stage.addChild(rack)
        addUTicks(to: stage)
        if zoom == .row { await addRow(around: rack) }
        await addKit(state)
        apply(state, animated: false)
        if immersive { addLights() }
    }

    /// Moves tray, cables, doors, LEDs and the highlight to match the state.
    func apply(_ s: TrainingState, animated: Bool) {
        highlight.removeFromParent()
        if let name = s.step.focus, let (c, size) = Self.anchors[name] {
            highlight = Entity()
            let box = outline(size: size + 0.02)
            box.position = c
            highlight.addChild(box)
            highlight.addChild(marker(x: c.x, front: c.z >= 0))
            stage.addChild(highlight)
        }
        if let tray {
            let (c, _) = Self.anchors["tray-slot-09"]!
            let target: SIMD3<Float> = s.trayInstalled ? [0, c.y - RackU.pitch, Self.rackD / 2 - 0.9] : [0, 0.9, Self.rackD / 2 + 0.55]
            var t = tray.transform; t.translation = target
            if animated { tray.move(to: t, relativeTo: stage, duration: 0.8, timingFunction: .easeInOut) } else { tray.transform = t }
        }
        cables.children.removeAll()
        if s.powerCabled { addPowerCords() }
        if s.liquidCoupled { addHoses() }
        if s.networkCabled { addFiber() }
        let ledMat = UnlitMaterial(color: s.poweredOn ? .systemGreen : UIColor(white: 0.15, alpha: 1))
        for l in leds { l.model?.materials = [ledMat] }
        if let door = stage.findEntity(named: "rack-front-door") {
            let open = simd_quatf(angle: s.doorsOpen ? -1.9 : 0, axis: [0, 1, 0])
            var t = door.transform; t.rotation = open
            if animated { door.move(to: t, relativeTo: door.parent, duration: 0.6) } else { door.transform = t }
        }
    }

    // MARK: stage pieces

    private func floor(_ size: Float) -> Entity {
        let tiles = Entity()
        let tile = MeshResource.generateBox(size: [0.596, 0.03, 0.596])
        let a = SimpleMaterial(color: UIColor(white: 0.78, alpha: 1), roughness: 0.55, isMetallic: false)
        let perf = SimpleMaterial(color: UIColor(white: 0.6, alpha: 1), roughness: 0.4, isMetallic: true)
        let n = Int(size / 0.6)
        for i in -n / 2...n / 2 { for k in -n / 2...n / 2 {
            // Perforated tiles on the cold aisle in front of the rack.
            let cold = k == 2 && abs(i) <= 1
            let e = ModelEntity(mesh: tile, materials: [cold ? perf : a])
            e.position = [Float(i) * 0.6, -0.015, Float(k) * 0.6]
            tiles.addChild(e)
        } }
        tiles.name = "raised-floor"
        return tiles
    }

    private func addUTicks(to parent: Entity) {
        let mat = UnlitMaterial(color: UIColor(white: 0.95, alpha: 1))
        let tick = MeshResource.generateBox(size: [0.012, 0.0015, 0.002])
        let ticks = Entity(); ticks.name = "u-ticks"
        for u in 1...48 {
            for sx: Float in [-0.255, 0.255] {
                let e = ModelEntity(mesh: tick, materials: [mat])
                e.position = [sx, RackU.height(u: u), Self.rackD / 2 + 0.003]
                ticks.addChild(e)
            }
        }
        parent.addChild(ticks)
    }

    private func addRow(around rack: Entity) async {
        let pitch: Float = 0.6
        for i in -6...6 where i != 0 {
            let e = rack.clone(recursive: true)
            e.position = [Float(i) * pitch, 0, 0]
            stage.addChild(e)
        }
        // Partner row across the hot aisle, rear faces the trainee rack's rear.
        let aisle = Float(CampusSpec.hotAisle)
        for i in -6...6 {
            let e = rack.clone(recursive: true)
            e.position = [Float(i) * pitch, 0, -Self.rackD - aisle]
            e.orientation = simd_quatf(angle: .pi, axis: [0, 1, 0])
            stage.addChild(e)
        }
        let glass = SimpleMaterial(color: UIColor(white: 0.9, alpha: 0.25), roughness: 0.1, isMetallic: false)
        let roof = ModelEntity(mesh: .generateBox(size: [13 * pitch, 0.03, aisle]), materials: [glass])
        roof.position = [0, Self.rackH + 0.05, -Self.rackD / 2 - aisle / 2]
        stage.addChild(roof)
        let bus = ModelEntity(mesh: .generateBox(size: [13 * pitch, 0.12, 0.3]), materials: [UnlitMaterial(color: UIColor(Theme.accent))])
        bus.position = [0, 3.1, -Self.rackD / 2 - 0.2]
        stage.addChild(bus)
    }

    private func addKit(_ s: TrainingState) async {
        let f = Self.rackD / 2
        let t = await PropFactory.make("compute-tray-gpu")
        tray = t
        stage.addChild(t)
        leds = []
        let led = MeshResource.generateBox(size: [0.006, 0.006, 0.002])
        for k in 0..<4 {
            let l = ModelEntity(mesh: led, materials: [UnlitMaterial(color: .darkGray)])
            l.position = [-0.18 + Float(k) * 0.012, 0.07, 0.452]
            t.addChild(l); leds.append(l)
        }
        let lift = await PropFactory.make("server-lift")
        lift.position = [0, 0, f + 0.55]
        stage.addChild(lift)
        let cart = await PropFactory.make("crash-cart-kvm")
        cart.position = [0.95, 0, f + 0.9]
        stage.addChild(cart)
        let sign = await PropFactory.make("aisle-sign")
        sign.position = [0, 2.8, f + 0.6]
        stage.addChild(sign)
        let blank = await PropFactory.make("blanking-panel")
        for u in [39, 40, 41, 42] {
            let b = blank.clone(recursive: true)
            b.position = [0, RackU.height(u: u), f - 0.03]
            stage.addChild(b)
        }
        if s.step.props.contains("loto-tag") || s.done.contains(.lockout) && !s.done.contains(.doors) {
            let tag = await PropFactory.make("loto-tag")
            tag.position = Self.anchors["pdu-a"]!.0 + [0, 0.2, -0.04]
            stage.addChild(tag)
        }
        cables.name = "cables"
        stage.addChild(cables)
    }

    private func addLights() {
        for (x, z): (Float, Float) in [(0, 1.8), (0, -1.8), (2, 0)] {
            let l = Entity()
            l.components.set(PointLightComponent(color: .white, intensity: 26000, attenuationRadius: 8))
            l.position = [x, 3.2, z]
            stage.addChild(l)
        }
    }

    // MARK: cables

    private func addPowerCords() {
        let y = RackU.height(u: RackU.slotU(9)) + RackU.pitch
        let r = -Self.rackD / 2
        let black = SimpleMaterial(color: UIColor(white: 0.08, alpha: 1), roughness: 0.7, isMetallic: false)
        for (sx, pdu) in [(Float(-0.12), "pdu-a"), (0.12, "pdu-b")] {
            let p = Self.anchors[pdu]!.0
            cable([[sx, y, r + 0.05], [sx, y, r + 0.03], [p.x * 0.9, y + 0.02, r + 0.06], [p.x, y + 0.1, p.z]], radius: 0.006, mat: black)
        }
    }

    private func addHoses() {
        let y = RackU.height(u: RackU.slotU(9)) + RackU.pitch
        let r = -Self.rackD / 2
        let blue = SimpleMaterial(color: UIColor(red: 0.1, green: 0.35, blue: 0.85, alpha: 1), roughness: 0.4, isMetallic: false)
        let red = SimpleMaterial(color: UIColor(red: 0.8, green: 0.12, blue: 0.1, alpha: 1), roughness: 0.4, isMetallic: false)
        for (sx, m, key) in [(Float(-0.05), blue, "manifold-supply"), (0.05, red, "manifold-return")] {
            let p = Self.anchors[key]!.0
            cable([[sx, y, r + 0.05], [sx, y, r + 0.1], [p.x, y, p.z]], radius: 0.008, mat: m)
        }
    }

    private func addFiber() {
        let y = RackU.height(u: RackU.slotU(9)) + RackU.pitch
        let f = Self.rackD / 2
        let tor = Self.anchors["tor-switch"]!.0
        let aqua = SimpleMaterial(color: UIColor(red: 0.2, green: 0.8, blue: 0.85, alpha: 1), roughness: 0.5, isMetallic: false)
        for k in 0..<4 {
            let x = -0.1 + Float(k) * 0.03
            cable([[x, y + 0.02, f - 0.02], [x, y + 0.02, f + 0.02], [-0.31, y + 0.05, f - 0.08],
                   [-0.31, tor.y - 0.05, f - 0.08], [x, tor.y, f + 0.01], [x, tor.y, f - 0.01]], radius: 0.0015, mat: aqua)
        }
    }

    private func cable(_ pts: [SIMD3<Float>], radius: Float, mat: RealityKit.Material) {
        for i in 0..<(pts.count - 1) {
            let a = pts[i], b = pts[i + 1], d = b - a, len = simd_length(d)
            guard len > 0.0005 else { continue }
            let seg = ModelEntity(mesh: .generateCylinder(height: len, radius: radius), materials: [mat])
            seg.position = (a + b) / 2
            seg.orientation = simd_quatf(from: [0, 1, 0], to: d / len)
            cables.addChild(seg)
            let joint = ModelEntity(mesh: .generateSphere(radius: radius), materials: [mat])
            joint.position = b
            cables.addChild(joint)
        }
    }

    // MARK: highlight

    private func outline(size s: SIMD3<Float>) -> Entity {
        let e = Entity(); e.name = "training-highlight"
        let mat = UnlitMaterial(color: UIColor(Theme.accent))
        let t: Float = 0.006
        for ax in 0..<3 {
            var dims = SIMD3<Float>(repeating: t); dims[ax] = s[ax]
            let mesh = MeshResource.generateBox(size: dims)
            let o = [(ax + 1) % 3, (ax + 2) % 3]
            for a: Float in [-0.5, 0.5] { for b: Float in [-0.5, 0.5] {
                var p = SIMD3<Float>(repeating: 0); p[o[0]] = a * s[o[0]]; p[o[1]] = b * s[o[1]]
                let edge = ModelEntity(mesh: mesh, materials: [mat]); edge.position = p
                e.addChild(edge)
            } }
        }
        return e
    }

    /// Floor ring where the trainee stands.
    private func marker(x: Float, front: Bool) -> Entity {
        let ring = ModelEntity(mesh: .generateCylinder(height: 0.004, radius: 0.28), materials: [UnlitMaterial(color: UIColor(white: 1, alpha: 0.85))])
        let hole = ModelEntity(mesh: .generateCylinder(height: 0.006, radius: 0.25), materials: [UnlitMaterial(color: UIColor(white: 0.25, alpha: 1))])
        ring.addChild(hole)
        ring.name = "stand-here"
        ring.position = [x * 0.5, 0.004, front ? Self.rackD / 2 + 0.75 : -Self.rackD / 2 - 0.6]
        return ring
    }
}
