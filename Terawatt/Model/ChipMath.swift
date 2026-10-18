import Foundation

enum ChipStep: Int, Codable, CaseIterable, Sendable {
    case spec, architecture, floorplan, simulate, tapeOut, package, integrate
    var title: String { ["Spec", "Architecture", "Floorplan", "Simulate", "Tape out", "Package", "Integrate"][rawValue] }
}

enum MicroLevel: Int, CaseIterable, Sendable {
    case off, wafer, die, transistor
    var title: String { ["Off", "Wafer", "Die", "Transistor"][rawValue] }
}

extension ChipBlockKind {
    var title: String {
        switch self {
        case .tensorCore: "Tensor cores"; case .sram: "SRAM"; case .hbmPHY: "HBM PHY"
        case .noc: "NoC"; case .io: "IO"; case .cpo: "CPO"
        }
    }
    /// Watts per mm2 at 1.4 nm, activity factor included.
    var wattsPerMM2: Double {
        switch self {
        case .tensorCore: 1.6; case .sram: 0.35; case .hbmPHY: 0.9; case .noc: 0.8; case .io: 0.7; case .cpo: 0.6
        }
    }
}

struct PlacedBlock: Equatable, Sendable { var kind: ChipBlockKind; var x, y, w, h: Double }

/// Closed-form chip model: area, power, timing, throughput, cost. No RealityKit.
enum ChipMath {
    static let reticleMM2 = 858.0
    static let dieWidthMM = 26.0
    static let mm2PerHBMPHY = 22.5
    static let pflopsPerStack = 20.0
    static let wattsPerStack = 30.0
    static let basePFLOPS = 60.0

    static func area(_ c: ChipSpec, _ k: ChipBlockKind) -> Double { c.blocks.filter { $0.kind == k }.reduce(0) { $0 + $1.areaMM2 } }
    static func limitMM2(_ c: ChipSpec) -> Double { min(c.dieAreaMM2, reticleMM2) }
    static func fits(_ c: ChipSpec) -> Bool { c.usedArea <= limitMM2(c) + 1e-9 }
    static func hbmStacks(_ c: ChipSpec) -> Int { Int(area(c, .hbmPHY) / mm2PerHBMPHY) }

    static func dieWatts(_ c: ChipSpec) -> Double {
        let node = (c.nodeNM / 1.4).squareRoot()
        return c.blocks.reduce(0) { $0 + $1.areaMM2 * $1.kind.wattsPerMM2 } * node
    }
    static func packageWatts(_ c: ChipSpec) -> Double { dieWatts(c) + Double(hbmStacks(c)) * wattsPerStack }

    /// 0...1 from wire length (die side) and NoC share.
    static func timing(_ c: ChipSpec) -> Double {
        let wire = c.usedArea.squareRoot() / reticleMM2.squareRoot()
        let noc = c.usedArea > 0 ? area(c, .noc) / c.usedArea : 0
        return min(max(1 - 0.5 * wire + min(noc, 0.08) * 3, 0), 1)
    }

    static func pflops(_ c: ChipSpec) -> Double { basePFLOPS * min(c.perfFactor, Double(hbmStacks(c)) * pflopsPerStack / basePFLOPS) }
    static func perfPerKW(_ c: ChipSpec) -> Double { let w = packageWatts(c); return w > 0 ? pflops(c) / w * 1000 : 0 }
    static func unitCostUSD(_ c: ChipSpec) -> Double { c.usedArea * 25 + Double(hbmStacks(c)) * 1500 + 4000 }

    /// Horizontal strips across a 26 mm wide die, in block order. Overflow when the strips exceed the die height.
    static func floorplan(_ c: ChipSpec) -> (blocks: [PlacedBlock], dieH: Double, overflow: Bool) {
        let dieH = limitMM2(c) / dieWidthMM
        var y = 0.0
        let placed = c.blocks.map { b -> PlacedBlock in
            let h = b.areaMM2 / dieWidthMM
            defer { y += h }
            return PlacedBlock(kind: b.kind, x: 0, y: y, w: dieWidthMM, h: h)
        }
        return (placed, dieH, y > dieH + 1e-9)
    }

    static func setArea(_ c: inout ChipSpec, _ k: ChipBlockKind, _ v: Double) {
        if let i = c.blocks.firstIndex(where: { $0.kind == k }) {
            if v <= 0 { c.blocks.remove(at: i) } else { c.blocks[i].areaMM2 = v }
        } else if v > 0 { c.blocks.append(ChipBlock(kind: k, areaMM2: v)) }
    }

    /// Final spec handed to Fab: TDP set from the model.
    static func tapeOut(_ c: ChipSpec) -> ChipSpec? {
        guard fits(c), !c.blocks.isEmpty else { return nil }
        var t = c; t.tdpW = packageWatts(c); return t
    }
}

struct CampusDelta: Equatable, Sendable { var pflops = 0.0, mw = 0.0, usdPerMTok = 0.0 }

enum ChipLoop {
    static let traysPerRack = 18, modulesPerTray = 4
    static var chipsPerRack: Int { traysPerRack * modulesPerTray }

    /// One custom chip per tray slot in every rack of the campus.
    static func installCount(_ s: CampusSpec) -> Int { CampusMath.rackCount(s) * chipsPerRack }

    static func delta(_ s: CampusSpec, chip: ChipSpec, installed: Int) -> CampusDelta {
        let a = CampusMath.stats(s), b = CampusMath.stats(s, installedChips: installed, chip: chip)
        return CampusDelta(pflops: b.pflopsFP4 - a.pflopsFP4, mw: b.facilityMW - a.facilityMW, usdPerMTok: b.usdPerMTok - a.usdPerMTok)
    }
}
