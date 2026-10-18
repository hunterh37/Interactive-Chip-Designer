import RealityKit
import UIKit

/// Builds a campus entity in meters from a spec. Rows pair back to back around a hot aisle.
@MainActor
enum CampusBuilder {
    static let pairPitch = Float(CampusSpec.rackDepth + CampusSpec.hotAisle + CampusSpec.rackDepth + CampusSpec.coldAisle)
    static let rowOffset = Float(CampusSpec.rackDepth + CampusSpec.hotAisle)
    static let roofY: Float = 2.45

    /// Row z in meters, layout centered on the hall.
    static func rowZ(_ i: Int, count: Int) -> Float { rawZ(i) - (rawZ(0) + rawZ(max(0, count - 1))) / 2 }
    private static func rawZ(_ i: Int) -> Float { Float(i / 2) * pairPitch + Float(i % 2) * rowOffset }

    /// Center of the first hot aisle, the walk spawn point.
    static func hotAisleZ(_ s: CampusSpec) -> Float {
        guard s.rows.count > 1 else { return rowZ(0, count: 1) - 1.3 }
        return (rowZ(0, count: s.rows.count) + rowZ(1, count: s.rows.count)) / 2
    }

    static func build(_ s: CampusSpec, immersive: Bool) async -> Entity {
        let root = Entity()
        let L = Float(s.hall.length), W = Float(s.hall.width), H = Float(s.hall.clearHeight)
        let n = s.rows.count

        root.addChild(shell(L: L, W: W, H: H, roof: immersive))
        if immersive {
            let sun = Entity()
            sun.components.set(DirectionalLightComponent(color: .white, intensity: 4000))
            sun.orientation = simd_quatf(angle: -.pi / 2.3, axis: [1, 0, 0])
            root.addChild(sun)
            let nx = min(4, max(1, Int(L / 12))), nz = min(2, max(1, Int(W / 12)))
            for ix in 0..<nx { for iz in 0..<nz {
                let l = Entity()
                l.components.set(PointLightComponent(color: .white, intensity: 30000, attenuationRadius: 9))
                l.position = [(Float(ix) + 0.5) / Float(nx) * L - L / 2, max(1.5, H - 0.8), (Float(iz) + 0.5) / Float(nz) * W - W / 2]
                root.addChild(l)
            } }
        }

        // Racks, containment, busway, lights.
        var protos: [RackPresetID: Entity] = [:]
        let white = UnlitMaterial(color: .white)
        let busMat = UnlitMaterial(color: UIColor(Theme.accent))
        let glass = SimpleMaterial(color: UIColor(white: 0.9, alpha: 0.28), roughness: 0.1, isMetallic: false)
        let lightMesh = MeshResource.generateBox(size: [2.4, 0.04, 0.12])
        for (i, row) in s.rows.enumerated() {
            let id = row.preset
            if protos[id] == nil { protos[id] = await PropFactory.make(RackPreset.of(id).propID) }
            let proto = protos[id]!
            let count = min(row.racks, s.maxRacksPerRow)
            let pitch = Float(row.pitch)
            let len = Float(count) * pitch
            let z = rowZ(i, count: n)
            let x0 = -Float(count - 1) * pitch / 2
            let rowRoot = Entity()
            rowRoot.name = "row\(i)"
            for r in 0..<count {
                let e = proto.clone(recursive: true)
                e.position = [x0 + Float(r) * pitch, 0, z]
                if i % 2 == 0 { e.orientation = simd_quatf(angle: .pi, axis: [0, 1, 0]) }
                rowRoot.addChild(e)
            }
            let bus = ModelEntity(mesh: .generateBox(size: [len, 0.12, 0.3]), materials: [busMat])
            bus.position = [0, min(H - 0.5, 3.1), z]
            rowRoot.addChild(bus)
            let hot = i % 2 == 0, hasPartner = i + 1 < n
            if hot && hasPartner {
                let zc = (z + rowZ(i + 1, count: n)) / 2
                if row.contained {
                    let roof = ModelEntity(mesh: .generateBox(size: [len, 0.04, Float(CampusSpec.hotAisle)]), materials: [glass])
                    roof.position = [0, roofY, zc]
                    rowRoot.addChild(roof)
                    for sx: Float in [-1, 1] {
                        let door = ModelEntity(mesh: .generateBox(size: [0.04, roofY, Float(CampusSpec.hotAisle)]), materials: [glass])
                        door.position = [sx * len / 2, roofY / 2, zc]
                        rowRoot.addChild(door)
                    }
                }
                let ly = row.contained ? roofY - 0.04 : min(H - 0.3, 2.9)
                for k in 0..<max(1, Int(len / 2.4)) {
                    let l = ModelEntity(mesh: lightMesh, materials: [white])
                    l.position = [-len / 2 + 1.2 + Float(k) * 2.4, ly, zc]
                    rowRoot.addChild(l)
                }
            }
            root.addChild(rowRoot)
        }

        // Support rooms.
        let stats = CampusMath.stats(s)
        let wall = SimpleMaterial(color: UIColor(white: 0.85, alpha: 1), roughness: 0.8, isMetallic: false)
        for room in s.rooms where room.kind != .dataHall {
            let rw = Float(room.width), rd = Float(room.depth), rx = Float(room.x), rz = Float(room.z)
            if room.kind == .chillerYard {
                let pad = ModelEntity(mesh: .generateBox(size: [rw, 0.1, rd]), materials: [wall])
                pad.position = [rx, 0.05, rz]
                root.addChild(pad)
                let units = max(1, min(60, Int(stats.facilityMW / 4)))
                let proto = await PropFactory.make("chiller-unit")
                for u in 0..<units {
                    let e = proto.clone(recursive: true)
                    let col = u % 2, line = u / 2
                    e.position = [rx + (col == 0 ? -7 : 7) * rw / 30, 0.1, rz - rd / 2 + 3 + Float(line) * 3.5]
                    e.orientation = simd_quatf(angle: .pi / 2, axis: [0, 1, 0])
                    root.addChild(e)
                }
            } else {
                let b = ModelEntity(mesh: .generateBox(size: [rw, 6, rd]), materials: [wall])
                b.position = [rx, 3, rz]
                root.addChild(b)
                if room.kind == .cdu {
                    let units = max(1, min(40, Int(stats.itMW / 2)))
                    let proto = await PropFactory.make("cdu-liquid")
                    for u in 0..<units {
                        let e = proto.clone(recursive: true)
                        e.position = [rx - rw / 2 + (Float(u) + 0.5) * rw / Float(units), 0, rz + rd / 2 + 0.7]
                        root.addChild(e)
                    }
                }
            }
        }
        return root
    }

    private static func shell(L: Float, W: Float, H: Float, roof: Bool) -> Entity {
        let e = Entity()
        let floor = ModelEntity(mesh: .generateBox(size: [L, 0.1, W]), materials: [SimpleMaterial(color: .white, roughness: 0.9, isMetallic: false)])
        floor.position.y = -0.05
        e.addChild(floor)
        let m = SimpleMaterial(color: UIColor(white: 0.92, alpha: roof ? 1 : 0.25), roughness: 0.9, isMetallic: false)
        let t: Float = 0.3
        for (size, pos) in [
            (SIMD3<Float>(L, H, t), SIMD3<Float>(0, H / 2, -W / 2)), (SIMD3<Float>(L, H, t), SIMD3<Float>(0, H / 2, W / 2)),
            (SIMD3<Float>(t, H, W), SIMD3<Float>(-L / 2, H / 2, 0)), (SIMD3<Float>(t, H, W), SIMD3<Float>(L / 2, H / 2, 0)),
        ] {
            let w = ModelEntity(mesh: .generateBox(size: size), materials: [m])
            w.position = pos
            e.addChild(w)
        }
        if roof {
            let c = ModelEntity(mesh: .generateBox(size: [L, t, W]), materials: [m])
            c.position.y = H + t / 2
            e.addChild(c)
        }
        return e
    }
}
