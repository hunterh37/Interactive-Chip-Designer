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
        "foup-stocker": [6, 2, 4], "wet-bench": [4, 2.2, 1.5], "cvd-ald-cluster": [4, 2.5, 4],
        "litho-track": [8, 2.5, 3], "euv-scanner-highna": [14, 4, 4], "ebeam-metrology": [3, 2.2, 2.5],
        "plasma-etch-cluster": [4, 2.5, 4], "ion-implanter": [8, 2.5, 3], "pvd-cluster": [4, 2.5, 4],
        "cmp-tool": [4, 2.2, 3], "probe-station": [1.5, 1.8, 1.5], "hybrid-bonder": [3, 2.2, 2.5],
        "foup": [0.4, 0.36, 0.34], "oht-vehicle": [0.6, 0.9, 0.6], "oht-rail": [3, 0.2, 0.2],
    ]
    /// Fab ids render as light powder-coat placeholders until RealityHD ships them.
    static let fabIDs: Set<String> = ["foup-stocker", "wet-bench", "cvd-ald-cluster", "litho-track", "euv-scanner-highna",
        "ebeam-metrology", "plasma-etch-cluster", "ion-implanter", "pvd-cluster", "cmp-tool", "probe-station",
        "hybrid-bonder", "foup", "oht-vehicle", "oht-rail"]
    private static var cache: [String: Entity] = [:]

    static func make(_ id: String) async -> Entity {
        if let e = cache[id] { return e.clone(recursive: true) }
        let e: Entity
        if let real = try? await RealityHD.entity(id, grabbable: false) { e = real } else { e = box(id) }
        e.name = id
        cache[id] = e
        return e.clone(recursive: true)
    }

    static func box(_ id: String, color: UIColor? = nil) -> Entity {
        let color = color ?? UIColor(white: fabIDs.contains(id) ? 0.85 : 0.2, alpha: 1)
        let s = sizes[id] ?? [1, 1, 1]
        let m = ModelEntity(mesh: .generateBox(size: s, cornerRadius: 0.02), materials: [SimpleMaterial(color: color, roughness: 0.6, isMetallic: true)])
        m.position.y = s.y / 2
        let root = Entity(); root.addChild(m); root.name = id
        return root
    }
}
