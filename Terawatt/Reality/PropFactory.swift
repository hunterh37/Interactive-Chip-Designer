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
        "hbm-stack": [0.011, 0.0008, 0.01], "gpu-module-2035": [0.12, 0.02, 0.18], "compute-tray-gpu": [0.44, 0.09, 0.9],
        "server-lift": [0.6, 1.2, 0.9], "crash-cart-kvm": [0.5, 1.0, 0.45], "aisle-sign": [0.6, 0.55, 0.02],
        "blanking-panel": [0.48, 0.044, 0.01], "loto-tag": [0.075, 0.14, 0.004], "esd-wrist-strap": [0.08, 0.02, 0.08],
        "power-cord-c19": [0.06, 0.03, 1.5], "quick-disconnect": [0.03, 0.03, 0.08], "leak-detection-cable": [2, 0.006, 0.006],
        "fiber-patch-lc": [0.02, 0.01, 2], "fiber-cleaner": [0.03, 0.18, 0.03], "cable-label": [0.03, 0.012, 0.001],
        "velcro-tie": [0.2, 0.012, 0.002],
        "foup": [0.4, 0.36, 0.34], "oht-vehicle": [0.6, 0.9, 0.6], "oht-rail": [3, 0.2, 0.2],
    ]
    /// Fab ids render as light powder-coat placeholders until RealityHD ships them.
    static let fabIDs: Set<String> = ["foup-stocker", "wet-bench", "cvd-ald-cluster", "litho-track", "euv-scanner-highna",
        "ebeam-metrology", "plasma-etch-cluster", "ion-implanter", "pvd-cluster", "cmp-tool", "probe-station",
        "hybrid-bonder", "hbm-stack", "gpu-module-2035", "compute-tray-gpu", "foup", "oht-vehicle", "oht-rail",
        "server-lift", "crash-cart-kvm", "aisle-sign", "loto-tag", "esd-wrist-strap", "power-cord-c19", "quick-disconnect",
        "leak-detection-cable", "fiber-patch-lc", "fiber-cleaner", "cable-label", "velcro-tie"]
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
