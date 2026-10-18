import RealityKit
import UIKit

/// Chip Workshop scene. 1 mm of die = 0.01 m. Origin at table center, y up.
@MainActor
final class ChipScene {
    static let k: Float = 0.01
    let root = Entity()
    private var layers: [(e: Entity, base: SIMD3<Float>, lift: Float)] = []

    static func color(_ k: ChipBlockKind) -> UIColor {
        switch k {
        case .tensorCore: UIColor(red: 0.95, green: 0.45, blue: 0.1, alpha: 1)
        case .sram: UIColor(red: 0.3, green: 0.55, blue: 0.95, alpha: 1)
        case .hbmPHY: UIColor(red: 0.2, green: 0.75, blue: 0.55, alpha: 1)
        case .noc: UIColor(white: 0.7, alpha: 1)
        case .io: UIColor(red: 0.85, green: 0.8, blue: 0.25, alpha: 1)
        case .cpo: UIColor(red: 0.7, green: 0.4, blue: 0.9, alpha: 1)
        }
    }

    private func box(_ size: SIMD3<Float>, _ pos: SIMD3<Float>, _ c: UIColor, metallic: Bool = true, in parent: Entity? = nil) -> ModelEntity {
        let m = ModelEntity(mesh: .generateBox(size: size), materials: [SimpleMaterial(color: c, roughness: 0.4, isMetallic: metallic)])
        m.position = pos
        (parent ?? root).addChild(m)
        return m
    }

    func build(chip: ChipSpec, step: ChipStep, micro: MicroLevel, installed: Bool, packaged: Bool) async {
        if micro != .off { buildMicro(chip, micro); return }
        switch step {
        case .spec, .architecture, .floorplan, .simulate: buildDie(chip, heat: step == .simulate)
        case .tapeOut: buildReticle(chip)
        case .package: await buildPackage(chip)
        case .integrate: await buildIntegrate(chip, installed: installed)
        }
    }

    /// Floorplan canvas inside the reticle outline. Heat colors blocks by power density.
    func buildDie(_ chip: ChipSpec, heat: Bool, at parent: Entity? = nil) {
        let k = Self.k, fp = ChipMath.floorplan(chip)
        let w = Float(ChipMath.dieWidthMM) * k, h = Float(fp.dieH) * k
        let host = parent ?? root
        _ = box([w + 0.02, 0.01, h + 0.02], [0, 0.005, 0], UIColor(white: 0.15, alpha: 1), in: host)
        let ret = Float(ChipMath.reticleMM2 / ChipMath.dieWidthMM) * k
        _ = box([w + 0.04, 0.002, ret + 0.04], [0, 0.001, 0], UIColor(white: 0.35, alpha: 1), in: host)
        for b in fp.blocks {
            let bh = Float(b.h) * k
            let c: UIColor = heat
                ? UIColor(hue: CGFloat(0.6 - 0.6 * min(b.kind.wattsPerMM2 / 1.6, 1)), saturation: 0.9, brightness: 1, alpha: 1)
                : Self.color(b.kind)
            _ = box([w * 0.98, 0.012, bh * 0.96], [0, 0.012, -h / 2 + Float(b.y) * k + bh / 2], c, in: host)
        }
        if fp.overflow { _ = box([w, 0.02, 0.01], [0, 0.02, h / 2 + 0.02], UIColor.red, metallic: false, in: host) }
    }

    func buildReticle(_ chip: ChipSpec) {
        buildDie(chip, heat: false)
        let k = Self.k, w = Float(ChipMath.dieWidthMM) * k, h = Float(ChipMath.reticleMM2 / ChipMath.dieWidthMM) * k
        for i in -2...2 {
            _ = box([0.004, 0.003, h + 0.04], [Float(i) * w / 4, 0.02, 0], UIColor(white: 0.9, alpha: 0.6), metallic: false)
        }
        _ = box([w + 0.08, 0.004, 0.006], [0, 0.03, -h / 2 - 0.03], UIColor(red: 1, green: 0.8, blue: 0.2, alpha: 1), metallic: false)
    }

    /// Layers: substrate, interposer, die + HBM stacks, cold plate. `lift` is the explode height per layer.
    func buildPackage(_ chip: ChipSpec) async {
        let k = Self.k
        func add(_ e: Entity, _ pos: SIMD3<Float>, lift: Float) { e.position = pos; root.addChild(e); layers.append((e, pos, lift)) }
        let sub = box([0.58, 0.02, 0.58], .zero, UIColor(red: 0.1, green: 0.35, blue: 0.2, alpha: 1)); root.removeChild(sub)
        add(sub, [0, 0.01, 0], lift: 0)
        let inter = box([0.5, 0.008, 0.5], .zero, UIColor(white: 0.55, alpha: 1)); root.removeChild(inter)
        add(inter, [0, 0.03, 0], lift: 0.12)
        let die = Entity(); buildDie(chip, heat: false, at: die)
        add(die, [0, 0.045, 0], lift: 0.28)
        let n = ChipMath.hbmStacks(chip)
        for i in 0..<n {
            let s = await PropFactory.make("hbm-stack")
            s.scale = .init(repeating: 1000 * k)
            let side: Float = i % 2 == 0 ? -1 : 1
            let row = Float(i / 2) - Float((n - 1) / 2) / 2
            add(s, [side * 0.21, 0.04, row * 0.14], lift: 0.28)
        }
        let plate = box([0.4, 0.03, 0.46], .zero, UIColor(red: 0.8, green: 0.5, blue: 0.3, alpha: 1)); root.removeChild(plate)
        add(plate, [0, 0.1, 0], lift: 0.5)
    }

    func setExplode(_ on: Bool, animated: Bool) {
        for l in layers {
            var t = l.e.transform
            t.translation = l.base + [0, on ? l.lift : 0, 0]
            if animated { l.e.move(to: t, relativeTo: l.e.parent, duration: 0.6, timingFunction: .easeInOut) } else { l.e.transform = t }
        }
    }

    /// Module (scaled up), tray, rack side by side. Tray sits pulled out until the chip is installed.
    func buildIntegrate(_ chip: ChipSpec, installed: Bool) async {
        let module = await PropFactory.make("gpu-module-2035"); module.scale = .init(repeating: 2.5); module.position = [-0.4, 0, 0.1]
        let tray = await PropFactory.make("compute-tray-gpu"); tray.position = [0, 0.4, installed ? 0 : 0.35]
        let rack = await PropFactory.make(RackPreset.of(.gpu).propID); rack.scale = .init(repeating: 0.4); rack.position = [0.4, 0, 0]
        for e in [module, tray, rack] { root.addChild(e) }
        let die = Entity(); buildDie(chip, heat: false, at: die)
        die.scale = .init(repeating: 0.3); die.position = [-0.4, 0.06, 0.1]
        root.addChild(die)
        if installed { _ = box([0.1, 0.02, 0.1], [0, 0.46, 0], Self.color(.tensorCore)) }
    }

    func buildMicro(_ chip: ChipSpec, _ level: MicroLevel) {
        switch level {
        case .off: break
        case .wafer:
            let disc = ModelEntity(mesh: .generateCylinder(height: 0.01, radius: 0.45), materials: [FabScene.lookMaterial(.patterned)])
            disc.position.y = 0.005; root.addChild(disc)
            let step: Float = 0.1
            for i in -4...4 { for j in -4...4 where Float(i * i + j * j).squareRoot() * step < 0.4 {
                _ = box([step * 0.9, 0.004, step * 0.9], [Float(i) * step, 0.012, Float(j) * step], UIColor(white: 0.15, alpha: 1))
            } }
        case .die:
            buildDie(chip, heat: false)
        case .transistor:
            // Cutaway: front half removed, fin stack on silicon with contacts and metal layers.
            _ = box([0.6, 0.06, 0.3], [0, 0.03, 0], UIColor(white: 0.7, alpha: 1))
            for i in -3...3 {
                _ = box([0.03, 0.08, 0.28], [Float(i) * 0.08, 0.1, 0], UIColor(red: 0.3, green: 0.55, blue: 0.95, alpha: 1))
                _ = box([0.012, 0.03, 0.26], [Float(i) * 0.08, 0.165, 0], UIColor(red: 0.95, green: 0.45, blue: 0.1, alpha: 1))
            }
            for l in 0..<6 {
                let y = 0.22 + Float(l) * 0.045, w = 0.6 - Float(l) * 0.04
                _ = box([w, 0.02, 0.3], [0, y, 0], UIColor(red: 0.85, green: 0.5, blue: 0.25, alpha: 1))
                _ = box([w, 0.02, 0.3], [0, y + 0.022, 0], UIColor(white: 0.3, alpha: 0.5), metallic: false)
            }
        }
    }
}
