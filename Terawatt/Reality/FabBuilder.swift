import RealityKit
import UIKit

/// Terawatt Fab 1 litho bay: two tool rows around an OHT aisle, meters, origin at aisle start on the floor.
@MainActor
final class FabScene {
    struct Slot { let id: String; let center: SIMD3<Float>; let size: SIMD3<Float>; let sign: Float }

    static let railY: Float = 4.3
    static let aisleHalf: Float = 2
    let root = Entity()
    private(set) var slots: [Slot] = []
    private(set) var length: Float = 0
    private(set) var width: Float = 0
    private let oht = Entity()
    private let foup = Entity()
    private let wafer = ModelEntity()
    private var lamps: [[ModelEntity]] = []
    private var motion: Task<Void, Never>?

    /// Station center x of the first tool, the walk spawn reference.
    var startX: Float { slots.first?.center.x ?? 0 }

    static func layout() -> [Slot] {
        var x: [Float] = [2, 2]
        return FabStation.allCases.map { s in
            let id = FabFlow.toolID(s)
            let size = PropFactory.sizes[id] ?? [2, 2, 2]
            let row = s.rawValue < 6 ? 0 : 1
            let sign: Float = row == 0 ? -1 : 1
            let cx = x[row] + size.x / 2
            x[row] += size.x + 3
            return Slot(id: id, center: [cx, 0, sign * (aisleHalf + size.z / 2)], size: size, sign: sign)
        }
    }

    static func lookMaterial(_ l: WaferLook) -> SimpleMaterial {
        switch l {
        case .bare: SimpleMaterial(color: UIColor(white: 0.78, alpha: 1), roughness: 0.15, isMetallic: true)
        case .oxide: SimpleMaterial(color: UIColor(red: 0.35, green: 0.55, blue: 0.95, alpha: 1), roughness: 0.1, isMetallic: true)
        case .patterned: SimpleMaterial(color: UIColor(red: 0.62, green: 0.3, blue: 0.85, alpha: 1), roughness: 0.1, isMetallic: true)
        case .metal: SimpleMaterial(color: UIColor(red: 0.85, green: 0.5, blue: 0.25, alpha: 1), roughness: 0.2, isMetallic: true)
        }
    }

    func build(immersive: Bool, station: FabStation) async {
        slots = Self.layout()
        let ends = slots.map { $0.center.x + $0.size.x / 2 }.max() ?? 10
        length = ends + 3
        let depth = slots.map(\.size.z).max() ?? 4
        width = 2 * (Self.aisleHalf + depth + 1.5)
        let H: Float = 5
        let amber = UnlitMaterial(color: UIColor(red: 1, green: 0.78, blue: 0.2, alpha: 1))

        // Raised grate floor.
        root.addChild(slab([length, 0.1, width], [length / 2, -0.05, 0], SimpleMaterial(color: UIColor(white: 0.18, alpha: 1), roughness: 0.8, isMetallic: true)))
        let gray = UnlitMaterial(color: UIColor(white: 0.45, alpha: 1))
        for i in 0...Int(length / 0.6) { root.addChild(slab([0.015, 0.01, width], [Float(i) * 0.6, 0.005, 0], gray)) }
        for j in 0...Int(width / 0.6) { root.addChild(slab([length, 0.01, 0.015], [length / 2, 0.005, -width / 2 + Float(j) * 0.6], gray)) }

        // OHT rail.
        root.addChild(slab([length, 0.2, 0.2], [length / 2, Self.railY + 0.1, 0], SimpleMaterial(color: UIColor(white: 0.7, alpha: 1), roughness: 0.3, isMetallic: true)))

        // Tools and status towers.
        for (i, s) in slots.enumerated() {
            let tool = await PropFactory.make(s.id)
            tool.position = s.center
            if s.sign > 0 { tool.orientation = simd_quatf(angle: .pi, axis: [0, 1, 0]) }
            root.addChild(tool)
            let tower = Entity()
            tower.position = [s.center.x - s.size.x / 2 + 0.3, s.size.y, s.sign * (Self.aisleHalf + 0.2)]
            tower.addChild(slab([0.05, 0.4, 0.05], [0, 0.2, 0], SimpleMaterial(color: .darkGray, isMetallic: true)))
            var row: [ModelEntity] = []
            for k in 0..<3 {
                let lamp = ModelEntity(mesh: .generateSphere(radius: 0.035), materials: [UnlitMaterial(color: .darkGray)])
                lamp.position = [0, 0.3 + Float(k) * 0.07, 0]
                tower.addChild(lamp); row.append(lamp)
            }
            lamps.append(row)
            root.addChild(tower)
            _ = i
        }

        // OHT vehicle carrying a FOUP with the wafer.
        let veh = await PropFactory.make("oht-vehicle")
        oht.addChild(veh)
        let fp = await PropFactory.make("foup")
        foup.addChild(fp)
        wafer.model = ModelComponent(mesh: .generateCylinder(height: 0.004, radius: 0.15), materials: [Self.lookMaterial(.bare)])
        wafer.position = [0, 0.4, 0]
        foup.addChild(wafer)
        oht.addChild(foup)
        root.addChild(oht)

        if immersive {
            let amberLight = UIColor(red: 1, green: 0.78, blue: 0.25, alpha: 1)
            root.addChild(slab([length, 0.1, width], [length / 2, H, 0], amber))
            for i in 0...Int(length / 1.2) { root.addChild(slab([0.03, 0.02, width], [Float(i) * 1.2, H - 0.06, 0], UnlitMaterial(color: UIColor(red: 0.6, green: 0.45, blue: 0.1, alpha: 1)))) }
            for z in [-width / 2, width / 2] { root.addChild(slab([length, H, 0.1], [length / 2, H / 2, z], UnlitMaterial(color: UIColor(red: 0.95, green: 0.8, blue: 0.35, alpha: 1)))) }
            for x in [Float(0), length] { root.addChild(slab([0.1, H, width], [x, H / 2, 0], UnlitMaterial(color: UIColor(red: 0.95, green: 0.8, blue: 0.35, alpha: 1)))) }
            for i in 0..<Int(length / 8) {
                let l = Entity()
                l.components.set(PointLightComponent(color: amberLight, intensity: 30000, attenuationRadius: 12))
                l.position = [4 + Float(i) * 8, H - 0.5, 0]
                root.addChild(l)
            }
        }
        apply(station, animated: false)
    }

    private func slab(_ size: SIMD3<Float>, _ pos: SIMD3<Float>, _ m: any Material) -> ModelEntity {
        let e = ModelEntity(mesh: .generateBox(size: size), materials: [m]); e.position = pos; return e
    }

    private func vehicleX(_ s: FabStation) -> Float { slots.isEmpty ? 0 : slots[s.rawValue].center.x }
    private var hoistedY: Float { 0.05 }
    private var vehicleY: Float { Self.railY - 0.9 }

    private func setLamps(_ st: FabStation) {
        for (i, row) in lamps.enumerated() {
            let status = FabFlow.status(of: FabStation(rawValue: i)!, wafer: st)
            let on: [Bool] = [false, status == .waiting, status == .running]
            let colors: [UIColor] = [.red, .yellow, .green]
            let dim: [UIColor] = [UIColor(red: 0.3, green: 0.1, blue: 0.1, alpha: 1), UIColor(red: 0.3, green: 0.28, blue: 0.08, alpha: 1), UIColor(red: 0.08, green: 0.28, blue: 0.1, alpha: 1)]
            for k in 0..<3 { row[k].model?.materials = [UnlitMaterial(color: on[k] ? colors[k] : dim[k])] }
        }
    }

    func apply(_ st: FabStation, animated: Bool) {
        motion?.cancel()
        let x = vehicleX(st), sign = slots.isEmpty ? 0 : slots[st.rawValue].sign
        let lowY = -(vehicleY - 1.0)
        let look = Self.lookMaterial(FabFlow.look(st))
        guard animated else {
            oht.position = [x, vehicleY, 0]
            foup.position = [0, lowY, sign * 1.5]
            wafer.model?.materials = [look]; setLamps(st)
            return
        }
        motion = Task { [self] in
            func step(_ s: Double) async { try? await Task.sleep(for: .seconds(s + 0.05)) }
            foup.move(to: Transform(translation: [0, hoistedY, 0]), relativeTo: oht, duration: 0.8); await step(0.8)
            guard !Task.isCancelled else { return }
            let d = Double(abs(oht.position.x - x))
            let t = min(max(d / 8, 0.8), 6)
            oht.move(to: Transform(translation: [x, vehicleY, 0]), relativeTo: root, duration: t); await step(t)
            guard !Task.isCancelled else { return }
            foup.move(to: Transform(translation: [0, lowY, sign * 1.5]), relativeTo: oht, duration: 1.2); await step(1.2)
            guard !Task.isCancelled else { return }
            wafer.model?.materials = [look]; setLamps(st)
        }
    }
}
