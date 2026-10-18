import RealityKit
import UIKit

/// Builds a campus entity in meters from a spec. Racks are cloned from one prop per preset.
@MainActor
enum CampusBuilder {
    static let rowGap: Float = 3.0  // aisle + rack depth

    static func build(_ s: CampusSpec, racksPerRowCap: Int = 200) async -> Entity {
        let root = Entity()
        let L = Float(s.hall.length), W = Float(s.hall.width)
        let floor = ModelEntity(mesh: .generatePlane(width: L, depth: W), materials: [SimpleMaterial(color: .white, roughness: 0.9, isMetallic: false)])
        root.addChild(floor)
        for room in s.rooms where room.kind != .dataHall {
            let b = ModelEntity(mesh: .generateBox(width: Float(room.width), height: 6, depth: Float(room.depth)),
                                materials: [SimpleMaterial(color: UIColor(white: 0.85, alpha: 1), roughness: 0.8, isMetallic: false)])
            b.position = [Float(room.x), 3, Float(room.z)]
            root.addChild(b)
        }
        let startZ = -Float(s.rows.count - 1) * rowGap / 2
        for (i, row) in s.rows.enumerated() {
            let proto = await PropFactory.make(RackPreset.of(row.preset).propID)
            let n = min(row.racks, racksPerRowCap)
            let x0 = -Float(n - 1) * Float(row.pitch) / 2
            for r in 0..<n {
                let e = proto.clone(recursive: true)
                e.position = [x0 + Float(r) * Float(row.pitch), 0, startZ + Float(i) * rowGap]
                if i % 2 == 1 { e.orientation = simd_quatf(angle: .pi, axis: [0, 1, 0]) }
                root.addChild(e)
            }
        }
        return root
    }
}
