import RealityKit
import UIKit

/// RealityKit twin of web/src/scene.js. Same metres, same layout, so the phone, WebXR and Vision Pro agree.
@MainActor
enum LiveBuilder {
    static let U: Float = 0.04445

    static func color(_ hex: String) -> UIColor {
        var v: UInt64 = 0; Scanner(string: hex.trimmingCharacters(in: ["#"])).scanHexInt64(&v)
        return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }

    private static func box(_ s: SIMD3<Float>, _ p: SIMD3<Float>, _ c: UIColor, metal: Bool = true, glow: Bool = false, in parent: Entity) {
        var m: any Material = SimpleMaterial(color: c, roughness: 0.45, isMetallic: metal)
        if glow { m = UnlitMaterial(color: c) }
        let e = ModelEntity(mesh: .generateBox(size: s), materials: [m])
        e.position = p; parent.addChild(e)
    }

    static func rack(_ r: LiveRack, _ cat: LiveCatalog, cart: Bool = true) async -> Entity {
        let g = Entity(); g.name = "live-rack"
        let units = cat.racks.first { $0.id == r.rackId }?.u ?? 42
        let H = Float(units) * U + 0.12, W: Float = 0.6, D: Float = 1.07, t: Float = 0.03
        let frame = color(r.frame), accent = color(r.accent)
        for x: Float in [-1, 1] { box([t, H, D], [x * (W - t) / 2, H / 2, 0], frame, in: g) }
        box([W, t, D], [0, H - t / 2, 0], frame, in: g)
        box([W, 0.06, D], [0, 0.03, 0], frame, in: g)
        box([W, H, 0.01], [0, H / 2, -D / 2], frame, in: g)
        for x: Float in [-1, 1] { box([0.008, H - 0.1, 0.01], [x * (W / 2 - 0.004), H / 2, D / 2 + 0.006], accent, glow: true, in: g) }
        var y: Float = 0.06
        for s in r.slots {
            guard let c = cat.components.first(where: { $0.id == s.id }) else { continue }
            let h = Float(c.u) * U - 0.002
            let srv = Entity(); srv.position = [0, y + h / 2, 0.06]
            box([0.482, h, 0.9], .zero, UIColor(white: 0.17, alpha: 1), in: srv)
            box([0.47, h * 0.86, 0.01], [0, 0, 0.455], color(c.color), metal: false, in: srv)
            let vents = max(1, Int((Float(c.u) * 1.5).rounded()))
            for k in 0..<vents { box([0.38, min(0.008, h * 0.15), 0.004], [-0.02, -h / 2 + (Float(k) + 0.5) * h / Float(vents), 0.462], .black, metal: false, in: srv) }
            box([0.012, 0.012, 0.004], [0.21, h / 2 - 0.014, 0.462], accent, glow: true, in: srv)
            g.addChild(srv); y += Float(c.u) * U
        }
        // RealityHD crash cart + monitor beside the rack for scale (PropFactory falls back to sized boxes).
        if cart { let c = await PropFactory.make("crash-cart-kvm"); c.position = [0.75, 0, 0.4]; g.addChild(c) }
        return g
    }

    static let pitch: Float = 0.7

    /// Server room: every player's rack side by side, centred on the origin.
    static func room(_ racks: [LiveRack], _ cat: LiveCatalog) async -> Entity {
        let g = Entity(); g.name = "live-room"
        for (i, r) in racks.enumerated() {
            let e = await rack(r, cat, cart: false)
            e.position.x = (Float(i) - Float(racks.count - 1) / 2) * pitch
            g.addChild(e)
        }
        let cart = await PropFactory.make("crash-cart-kvm")
        cart.position = [Float(racks.count) / 2 * pitch + 0.5, 0, 0.4]; g.addChild(cart)
        return g
    }

    /// Die on substrate, 1 cell = 0.06 m; reuses ChipScene block palette semantics from the web catalog.
    static func chip(_ chip: LiveChip, _ cat: LiveCatalog) -> Entity {
        let g = Entity(); g.name = "live-chip"
        let s: Float = 0.06, cols = cat.die.cols, rows = cat.die.rows, W = Float(cols) * s, D = Float(rows) * s
        box([W + 0.24, 0.03, D + 0.24], [0, 0.015, 0], UIColor(red: 0.11, green: 0.29, blue: 0.17, alpha: 1), metal: false, in: g)
        box([W + 0.02, 0.02, D + 0.02], [0, 0.04, 0], UIColor(white: 0.13, alpha: 1), in: g)
        let colors = Dictionary(uniqueKeysWithValues: cat.chipBlocks.map { ($0.id, color($0.color)) })
        for (i, id) in chip.cells.enumerated() {
            let x = Float(i % cols) - Float(cols) / 2 + 0.5, z = Float(i / cols) - Float(rows) / 2 + 0.5
            if let id, let c = colors[id] { box([s * 0.94, 0.025, s * 0.94], [x * s, 0.0625, z * s], c, glow: chip.taped, in: g) }
            else { box([s * 0.94, 0.004, s * 0.94], [x * s, 0.052, z * s], UIColor(white: 0.24, alpha: 1), in: g) }
        }
        if chip.taped { box([W + 0.06, 0.012, D + 0.06], [0, 0.11, 0], UIColor(white: 0.75, alpha: 0.35), in: g) }
        return g
    }
}
