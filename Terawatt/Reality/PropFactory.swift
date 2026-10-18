import RealityKit
import UIKit
import RealLibrary

/// Maps notes/PROPS.md ids to a RealityHD catalog entity, else a sized graphite box.
@MainActor
enum PropFactory {
    static let sizes: [String: SIMD3<Float>] = [
        "rack-ai-1mw": [0.6, 2.4, 1.4], "rack-lpu": [0.6, 2.4, 1.4], "rack-air-42u": [0.6, 2.0, 1.2],
        "rack-nvl72-2025": [0.6, 2.3, 1.2], "cdu-liquid": [0.8, 2.2, 1.2], "chiller-unit": [10, 2.8, 2.4],
        "hall-column": [0.6, 10, 0.6], "led-row-light": [2.4, 0.06, 0.12],
    ]
    private static var cache: [String: Entity] = [:]

    static func make(_ id: String) async -> Entity {
        if let e = cache[id] { return e.clone(recursive: true) }
        let e: Entity
        if let real = try? await RealityHD.entity(id, grabbable: false) { e = real } else { e = box(id) }
        e.name = id
        cache[id] = e
        return e.clone(recursive: true)
    }

    static func box(_ id: String, color: UIColor = UIColor(white: 0.2, alpha: 1)) -> Entity {
        let s = sizes[id] ?? [1, 1, 1]
        let m = ModelEntity(mesh: .generateBox(size: s, cornerRadius: 0.02), materials: [SimpleMaterial(color: color, roughness: 0.6, isMetallic: true)])
        m.position.y = s.y / 2
        let root = Entity(); root.addChild(m); root.name = id
        return root
    }
}
